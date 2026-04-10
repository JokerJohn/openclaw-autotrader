import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  readJson,
  readJsonIfExists,
  resolveConfigPath,
  writeJson
} from "./lib/runtime-utils.mjs";
import {
  acquireChromePage,
  closePersistentChromeContext,
  launchPersistentChromeContext
} from "./executors/xhs-web/shared/browser-utils.mjs";

function usage() {
  console.error(
    "Usage: node ./src/sync-xhs-analytics.mjs <config.json> <output.json> [--pages=N] [--detail-limit=N]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const positionals = [];
  let pages;
  let detailLimit;

  for (const arg of argv) {
    if (arg.startsWith("--pages=")) {
      pages = Number(arg.slice("--pages=".length));
      continue;
    }

    if (arg.startsWith("--detail-limit=")) {
      detailLimit = Number(arg.slice("--detail-limit=".length));
      continue;
    }

    positionals.push(arg);
  }

  if (positionals.length < 2) {
    usage();
  }

  return {
    configPath: path.resolve(process.cwd(), positionals[0]),
    outputPath: path.resolve(process.cwd(), positionals[1]),
    pages,
    detailLimit
  };
}

function msToIso(value) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value).toISOString() : null;
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(0, Math.floor(number));
}

function buildEngagementScore(note) {
  return (
    (note.like_count ?? 0) +
    (note.fav_count ?? 0) * 2 +
    (note.comment_count ?? 0) * 3 +
    (note.share_count ?? 0) * 2
  );
}

function normalizeBodyText(body) {
  return String(body ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHashtags(text) {
  const matches = String(text ?? "").match(/#([^#\s]+?)\[话题\]#/gu) ?? [];
  return [...new Set(matches)];
}

function normalizeNote(note, content = null) {
  const readCount = note.read_count ?? 0;
  const score = buildEngagementScore(note);
  const body = normalizeBodyText(content?.body ?? "");
  const hashtags = content?.hashtags?.length ? content.hashtags : extractHashtags(body);

  return {
    note_id: note.id,
    title: content?.title?.trim() || (note.title ?? ""),
    body: body || null,
    body_preview: body ? body.slice(0, 240) : null,
    hashtags,
    content_status: content?.status ?? (body ? "ready" : "missing"),
    content_fetched_at: content?.fetched_at ?? null,
    post_time: msToIso(note.post_time),
    updated_at: msToIso(note.update_time),
    user_updated_at: msToIso(note.user_update_time),
    type: note.type ?? null,
    audit_status: note.audit_status ?? null,
    cover_url: note.cover_url ?? null,
    read_count: readCount,
    impression_count: note.imp_count ?? null,
    cover_click_rate:
      typeof note.coverClickRate === "number" ? Number((note.coverClickRate * 100).toFixed(2)) : null,
    like_count: note.like_count ?? 0,
    comment_count: note.comment_count ?? 0,
    fav_count: note.fav_count ?? 0,
    share_count: note.share_count ?? 0,
    increase_fans_count: note.increase_fans_count ?? null,
    avg_view_seconds: note.view_time_avg ?? null,
    engagement_score: score,
    engagement_rate: readCount > 0 ? Number((score / readCount).toFixed(4)) : null
  };
}

async function waitForAnalyticsListResponse(page) {
  const response = await page.waitForResponse(
    (candidate) =>
      candidate.url().includes("/api/galaxy/creator/datacenter/note/analyze/list") &&
      candidate.status() === 200,
    { timeout: 30000 }
  );
  const payload = await response.json();

  if (payload?.success === false || (payload?.code ?? 0) !== 0) {
    throw new Error(`Analytics payload rejected: ${payload?.msg ?? payload?.message ?? "unknown error"}`);
  }

  return payload;
}

async function clickNextAnalyticsPage(page) {
  const nextButton = page.locator(".d-pagination .d-pagination-page").last();
  await nextButton.waitFor({ state: "attached", timeout: 15000 });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const disabled = await nextButton.evaluate((element) => element.className.includes("disabled"));
    if (!disabled) {
      const payloadPromise = waitForAnalyticsListResponse(page);
      await nextButton.scrollIntoViewIfNeeded().catch(() => {});
      await nextButton.click();
      return payloadPromise;
    }

    await page.waitForTimeout(500);
  }

  return null;
}

function contentNeedsRefresh(note, cachedContent) {
  if (!cachedContent) {
    return true;
  }

  if (!cachedContent.body) {
    return true;
  }

  if ((cachedContent.updated_at ?? null) !== msToIso(note.update_time)) {
    return true;
  }

  if ((cachedContent.title ?? "").trim() !== (note.title ?? "").trim()) {
    return true;
  }

  return false;
}

function selectNotesForContentRefresh(rawNotes, contentCache, detailLimit) {
  const candidates = rawNotes.filter((note) => contentNeedsRefresh(note, contentCache.notes?.[note.id] ?? null));
  const limit = normalizePositiveInteger(detailLimit, candidates.length);

  if (limit === 0) {
    return {
      candidates,
      noteIds: new Set()
    };
  }

  return {
    candidates,
    noteIds: new Set(candidates.slice(0, limit).map((note) => note.id))
  };
}

async function scrapeNoteContent(page, selectors, noteId) {
  const titleSelector = selectors.titleInput.join(", ");
  const bodySelector = selectors.bodyEditor.join(", ");

  await page.goto(`https://creator.xiaohongshu.com/publish/update?id=${noteId}&noteType=normal`, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  await page.locator(titleSelector).first().waitFor({
    state: "visible",
    timeout: 15000
  });
  await page.locator(bodySelector).first().waitFor({
    state: "visible",
    timeout: 15000
  });

  const title = await page.locator(titleSelector).first().inputValue();
  const body = await page.locator(bodySelector).first().textContent();
  const normalizedBody = normalizeBodyText(body);

  return {
    note_id: noteId,
    title: title.trim(),
    body: normalizedBody,
    hashtags: extractHashtags(normalizedBody),
    status: normalizedBody ? "ready" : "empty",
    fetched_at: new Date().toISOString()
  };
}

function dedupeRawNotes(rawNotes) {
  const notesById = new Map();

  for (const note of rawNotes) {
    if (!note?.id) {
      continue;
    }

    const existing = notesById.get(note.id);
    if (!existing || (note.update_time ?? 0) > (existing.update_time ?? 0)) {
      notesById.set(note.id, note);
    }
  }

  return [...notesById.values()].sort((a, b) => (b.post_time ?? 0) - (a.post_time ?? 0));
}

export async function syncXhsAnalytics({ configPath, outputPath, pages: cliPages, detailLimit: cliDetailLimit }) {
  const config = await readJson(configPath);
  const analytics = config.analytics ?? {};
  const pageSize = analytics.notesPerPage ?? 10;
  const fetchAllHistory = analytics.fetchAllHistory !== false;
  const requestedPages = normalizePositiveInteger(cliPages, analytics.maxPages ?? 1);
  const detailLimit = normalizePositiveInteger(cliDetailLimit, analytics.detailLimit ?? 8);
  const includeContent = analytics.includeContent !== false;
  const cachePath = resolveConfigPath(
    configPath,
    analytics.contentCachePath,
    "../state/xhs-note-content-cache.json"
  );
  const context = await launchPersistentChromeContext({
    configPath,
    config,
    headless: true,
    viewport: { width: 1440, height: 960 }
  });

  try {
    const page = await acquireChromePage(context);
    const firstPayloadPromise = waitForAnalyticsListResponse(page);
    await page.goto("https://creator.xiaohongshu.com/statistics/data-analysis", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    const firstPayload = await firstPayloadPromise;
    const totalNotesAvailable = firstPayload?.data?.total ?? firstPayload?.data?.note_infos?.length ?? 0;
    const totalPagesAvailable = Math.max(1, Math.ceil(totalNotesAvailable / pageSize));
    const targetPages =
      cliPages !== undefined
        ? Math.min(requestedPages, totalPagesAvailable)
        : fetchAllHistory
          ? totalPagesAvailable
          : Math.min(requestedPages, totalPagesAvailable);
    const rawNotes = [...(firstPayload?.data?.note_infos ?? [])];
    let actualPagesFetched = rawNotes.length > 0 ? 1 : 0;

    await page.waitForTimeout(1000);

    for (let pageNumber = 2; pageNumber <= targetPages; pageNumber += 1) {
      const payload = await clickNextAnalyticsPage(page);
      if (!payload) {
        break;
      }
      rawNotes.push(...(payload?.data?.note_infos ?? []));
      actualPagesFetched += 1;
      await page.waitForTimeout(750);
    }

    const dedupedRawNotes = dedupeRawNotes(rawNotes);
    const contentCache = (await readJsonIfExists(cachePath, {
      version: 1,
      updated_at: null,
      notes: {}
    })) ?? { version: 1, updated_at: null, notes: {} };

    const contentStats = {
      enabled: includeContent,
      reused_from_cache: 0,
      freshly_scraped: 0,
      stale_cache_reused: 0,
      deferred: 0,
      cache_fallbacks: 0,
      failed: 0
    };
    const refreshPlan = selectNotesForContentRefresh(dedupedRawNotes, contentCache, detailLimit);

    const contentPage = includeContent && refreshPlan.noteIds.size > 0 ? await acquireChromePage(context) : null;
    const normalizedNotes = [];

    for (const rawNote of dedupedRawNotes) {
      const cachedContent = contentCache.notes?.[rawNote.id] ?? null;
      let content = cachedContent;
      const needsRefresh = includeContent ? contentNeedsRefresh(rawNote, cachedContent) : false;

      if (includeContent) {
        if (needsRefresh && refreshPlan.noteIds.has(rawNote.id)) {
          try {
            const scraped = await scrapeNoteContent(contentPage, config.xhs.selectors, rawNote.id);
            content = {
              ...scraped,
              updated_at: msToIso(rawNote.update_time)
            };
            contentCache.notes[rawNote.id] = content;
            contentStats.freshly_scraped += 1;
          } catch (error) {
            if (cachedContent) {
              content = {
                ...cachedContent,
                status: "cache_fallback"
              };
              contentStats.cache_fallbacks += 1;
            } else {
              content = {
                note_id: rawNote.id,
                title: rawNote.title ?? "",
                body: "",
                hashtags: [],
                status: "error",
                fetched_at: new Date().toISOString(),
                updated_at: msToIso(rawNote.update_time),
                error: error.message
              };
              contentStats.failed += 1;
            }
          }
        } else if (needsRefresh) {
          const rawUpdatedAt = msToIso(rawNote.update_time);

          if (cachedContent) {
            content = {
              ...cachedContent,
              status: "stale_cache"
            };
            contentStats.stale_cache_reused += 1;
          } else {
            content = {
              note_id: rawNote.id,
              title: rawNote.title ?? "",
              body: "",
              hashtags: [],
              status: "deferred",
              fetched_at: null,
              updated_at: rawUpdatedAt
            };
          }
          contentStats.deferred += 1;
        } else {
          contentStats.reused_from_cache += 1;
        }
      }

      normalizedNotes.push(normalizeNote(rawNote, content));
    }

    if (contentPage) {
      await contentPage.close().catch(() => {});
    }

    contentCache.updated_at = new Date().toISOString();
    await writeJson(cachePath, contentCache);

    const bodyReadyCount = normalizedNotes.filter((note) => note.body).length;
    const analyticsSnapshot = {
      version: 2,
      fetched_at: new Date().toISOString(),
      source: "xhs-agent/sync-xhs-analytics.mjs",
      fetch_all_history: fetchAllHistory,
      complete:
        fetchAllHistory
          ? actualPagesFetched === totalPagesAvailable && normalizedNotes.length === totalNotesAvailable
          : actualPagesFetched >= totalPagesAvailable,
      page_size: pageSize,
      requested_pages: requestedPages,
      pages_fetched: actualPagesFetched,
      detail_limit: detailLimit,
      total_notes_available: totalNotesAvailable,
      notes_fetched: normalizedNotes.length,
      content_coverage: {
        enabled: includeContent,
        ready_count: bodyReadyCount,
        ready_ratio: normalizedNotes.length > 0 ? Number((bodyReadyCount / normalizedNotes.length).toFixed(4)) : 0,
        cache_path: cachePath,
        refresh_candidates: refreshPlan.candidates.length,
        refresh_planned: refreshPlan.noteIds.size,
        stats: contentStats
      },
      notes: normalizedNotes
    };

    await writeJson(outputPath, analyticsSnapshot);
    return {
      status: "success",
      outputPath,
      noteCount: normalizedNotes.length,
      pagesFetched: actualPagesFetched,
      totalNotesAvailable,
      analyticsSnapshot
    };
  } finally {
    await closePersistentChromeContext({ context, configPath, config }).catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await syncXhsAnalytics(args);
  console.log(
    JSON.stringify(
      {
        status: result.status,
        output_path: result.outputPath,
        note_count: result.noteCount,
        pages_fetched: result.pagesFetched,
        total_notes_available: result.totalNotesAvailable
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
