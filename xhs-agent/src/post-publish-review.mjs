import path from "node:path";
import { pathToFileURL } from "node:url";
import { readJson, writeJson } from "./lib/runtime-utils.mjs";

function usage() {
  console.error(
    "Usage: node ./src/post-publish-review.mjs <config.json> <post-package.json> <receipt.json> [--write=review.json]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const positionals = [];
  let outputPath = null;

  for (const arg of argv) {
    if (arg.startsWith("--write=")) {
      outputPath = arg.slice("--write=".length);
      continue;
    }

    positionals.push(arg);
  }

  if (positionals.length < 3) {
    usage();
  }

  return {
    configPath: path.resolve(process.cwd(), positionals[0]),
    packagePath: path.resolve(process.cwd(), positionals[1]),
    receiptPath: path.resolve(process.cwd(), positionals[2]),
    outputPath: outputPath ? path.resolve(process.cwd(), outputPath) : null
  };
}

function nowIso() {
  return new Date().toISOString();
}

function compactText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNeedle(value) {
  return compactText(value).toLowerCase();
}

function normalizeHashtag(value) {
  return String(value ?? "")
    .replace(/^#+/, "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeCollectionName(value) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function listExpectedHashtags(postPackage) {
  return [...new Set((postPackage.content?.hashtags ?? []).map(normalizeHashtag).filter(Boolean))];
}

function buildShareUrl(noteId, receipt) {
  return (
    receipt.share_url ??
    receipt.publish_verification?.share_url ??
    (noteId ? `https://www.xiaohongshu.com/explore/${noteId}` : null)
  );
}

function extractRestriction(bodyText, pageUrl) {
  const text = compactText(bodyText);
  const haystack = normalizeNeedle(text);
  const page = String(pageUrl ?? "");
  const rules = [
    {
      code: "ip-risk",
      needles: ["ip存在风险", "可靠网络环境后重试", "安全限制"]
    },
    {
      code: "note-unavailable",
      needles: ["当前笔记暂时无法浏览", "页面不见了", "你访问的页面不见了", "页面不存在"]
    },
    {
      code: "login-gate",
      needles: ["请先登录", "登录后查看", "website-login"]
    }
  ];

  for (const rule of rules) {
    if (rule.needles.some((needle) => haystack.includes(normalizeNeedle(needle)))) {
      return {
        code: rule.code,
        page_url: page,
        excerpt: text.slice(0, 200)
      };
    }
  }

  if (page.includes("/website-login/error") || page.includes("/404")) {
    return {
      code: "platform-error-page",
      page_url: page,
      excerpt: text.slice(0, 200)
    };
  }

  return null;
}

async function readPageState(page) {
  const snapshot = await page.evaluate(() => ({
    title: document.title ?? "",
    body_text: document.body?.innerText ?? "",
    href: location.href
  }));

  return {
    title: compactText(snapshot.title),
    body_text: compactText(snapshot.body_text),
    href: snapshot.href
  };
}

async function waitForUrlChange(page, originalUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const currentUrl = page.url();
    if (currentUrl && currentUrl !== originalUrl) {
      return currentUrl;
    }
    await page.waitForTimeout(250);
  }

  return null;
}

function isSuccessfulTagDestination({ originalUrl, originalNoteId, destination, tag }) {
  const tagNeedle = normalizeHashtag(tag).toLowerCase();
  const url = String(destination?.href ?? "");
  const combined = normalizeNeedle(`${destination?.title ?? ""} ${destination?.body_text ?? ""} ${url}`);
  const urlChanged = Boolean(url) && url !== originalUrl;
  const stillSameNote = originalNoteId ? url.includes(originalNoteId) : url === originalUrl;
  const tagMentioned = Boolean(tagNeedle) && combined.includes(tagNeedle);
  const searchLike =
    /search|result|topic|tag|discovery|explore\//i.test(url) ||
    combined.includes("话题") ||
    combined.includes("搜索");

  return tagMentioned && ((urlChanged && !stillSameNote) || searchLike);
}

function isSuccessfulCollectionDestination({ originalUrl, originalNoteId, destination, collectionName, expectedTitle }) {
  const collectionNeedle = normalizeCollectionName(collectionName);
  const titleNeedle = normalizeNeedle(expectedTitle);
  const url = String(destination?.href ?? "");
  const combined = normalizeNeedle(`${destination?.title ?? ""} ${destination?.body_text ?? ""} ${url}`);
  const urlChanged = Boolean(url) && url !== originalUrl;
  const stillSameNote = originalNoteId ? url.includes(originalNoteId) : url === originalUrl;
  const collectionMentioned = Boolean(collectionNeedle) && normalizeCollectionName(combined).includes(collectionNeedle);
  const titleMentioned = Boolean(titleNeedle) && combined.includes(titleNeedle);
  const collectionLike =
    /collection|album|series|list|board/i.test(url) ||
    combined.includes("合集") ||
    combined.includes("系列");

  return collectionMentioned && ((urlChanged && !stillSameNote) || collectionLike || titleMentioned);
}

async function clickHashtagCandidate(page, tag) {
  return page.evaluate((rawTag) => {
    const target = String(rawTag ?? "")
      .replace(/^#+/, "")
      .replace(/\s+/g, "")
      .trim()
      .toLowerCase();

    function normalize(value) {
      return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function squeeze(value) {
      return normalize(value).replace(/\s+/g, "").toLowerCase();
    }

    function isVisible(node) {
      if (!node) {
        return false;
      }
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    }

    const selector = "a[href],button,[role='link'],[tabindex],span,div,p";
    const matches = [];

    for (const node of document.querySelectorAll(selector)) {
      const clickableRoot = node.matches("a[href],button,[role='link'],[tabindex]")
        ? node
        : node.closest("a[href],button,[role='link'],[tabindex]");
      if (!clickableRoot || !isVisible(clickableRoot)) {
        continue;
      }
      const text = normalize(node.textContent ?? clickableRoot.textContent ?? "");
      if (!text) {
        continue;
      }
      const squeezed = squeeze(text);
      const expectedHash = `#${target}`;
      const exact = squeezed === expectedHash || squeezed === target;
      const contains = squeezed.includes(expectedHash) || squeezed.includes(target);
      if (!exact && !contains) {
        continue;
      }
      const href = clickableRoot.getAttribute("href") ?? null;
      matches.push({
        text,
        href,
        tag_name: clickableRoot.tagName,
        exact
      });
    }

    matches.sort((left, right) => Number(right.exact) - Number(left.exact));
    const candidate = matches[0] ?? null;
    if (!candidate) {
      return {
        clicked: false,
        candidate_count: 0
      };
    }

    const roots = Array.from(document.querySelectorAll("a[href],button,[role='link'],[tabindex]"));
    const clickable = roots.find((node) => {
      const text = normalize(node.textContent ?? "");
      const squeezed = squeeze(text);
      return (
        squeezed === `#${target}` ||
        squeezed === target ||
        squeezed.includes(`#${target}`) ||
        squeezed.includes(target)
      );
    });

    if (!clickable) {
      return {
        clicked: false,
        candidate_count: matches.length,
        candidate
      };
    }

    clickable.click();
    return {
      clicked: true,
      candidate_count: matches.length,
      candidate
    };
  }, tag);
}

async function clickCollectionCandidate(page, collectionName) {
  return page.evaluate((rawCollectionName) => {
    const target = String(rawCollectionName ?? "")
      .replace(/\s+/g, "")
      .trim()
      .toLowerCase();

    function normalize(value) {
      return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function squeeze(value) {
      return normalize(value).replace(/\s+/g, "").toLowerCase();
    }

    function isVisible(node) {
      if (!node) {
        return false;
      }
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    }

    const selector = "a[href],button,[role='link'],[tabindex],span,div,p";
    const matches = [];

    for (const node of document.querySelectorAll(selector)) {
      const clickableRoot = node.matches("a[href],button,[role='link'],[tabindex]")
        ? node
        : node.closest("a[href],button,[role='link'],[tabindex]");
      if (!clickableRoot || !isVisible(clickableRoot)) {
        continue;
      }
      const text = normalize(node.textContent ?? clickableRoot.textContent ?? "");
      if (!text) {
        continue;
      }
      const squeezed = squeeze(text);
      const exact = squeezed === target;
      const contains = target ? squeezed.includes(target) : false;
      const collectionCapsule = squeezed.includes("合集") || squeezed.includes("系列");
      if (!exact && !contains && !collectionCapsule) {
        continue;
      }
      const href = clickableRoot.getAttribute("href") ?? null;
      matches.push({
        text,
        href,
        tag_name: clickableRoot.tagName,
        exact,
        contains
      });
    }

    matches.sort((left, right) => {
      const leftScore = Number(left.exact) * 2 + Number(left.contains);
      const rightScore = Number(right.exact) * 2 + Number(right.contains);
      return rightScore - leftScore;
    });

    const candidate = matches[0] ?? null;
    if (!candidate) {
      return {
        clicked: false,
        candidate_count: 0
      };
    }

    const roots = Array.from(document.querySelectorAll("a[href],button,[role='link'],[tabindex]"));
    const clickable = roots.find((node) => {
      const squeezed = squeeze(node.textContent ?? "");
      return (
        squeezed === target ||
        (target ? squeezed.includes(target) : false) ||
        squeezed.includes("合集") ||
        squeezed.includes("系列")
      );
    });

    if (!clickable) {
      return {
        clicked: false,
        candidate_count: matches.length,
        candidate
      };
    }

    clickable.click();
    return {
      clicked: true,
      candidate_count: matches.length,
      candidate
    };
  }, collectionName);
}

async function verifySingleTagClick({ page, shareUrl, noteId, tag, timeoutMs, initialWaitMs }) {
  await page.goto(shareUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForTimeout(initialWaitMs);
  const initialState = await readPageState(page);
  const restriction = extractRestriction(initialState.body_text, initialState.href);
  if (restriction) {
    return {
      tag,
      status: "manual_required",
      reason: "published-page-blocked",
      page_url: initialState.href,
      restriction
    };
  }

  const popupPromise = page
    .waitForEvent("popup", { timeout: timeoutMs })
    .then(async (popup) => {
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      await popup.waitForTimeout(1200).catch(() => {});
      const state = await readPageState(popup);
      const popupRestriction = extractRestriction(state.body_text, state.href);
      await popup.close().catch(() => {});
      return {
        kind: "popup",
        state,
        restriction: popupRestriction
      };
    })
    .catch(() => null);
  const clickResult = await clickHashtagCandidate(page, tag);

  if (!clickResult.clicked) {
    return {
      tag,
      status: "fail",
      reason: "tag-not-clickable-on-note-page",
      page_url: initialState.href,
      candidate_count: clickResult.candidate_count ?? 0
    };
  }

  const navigationResult = await Promise.race([
    popupPromise,
    waitForUrlChange(page, initialState.href, timeoutMs).then(async (nextUrl) => {
      if (!nextUrl) {
        return null;
      }
      await page.waitForTimeout(1200);
      const state = await readPageState(page);
      return {
        kind: "navigation",
        state,
        restriction: extractRestriction(state.body_text, state.href)
      };
    }),
    page.waitForTimeout(timeoutMs).then(() => null)
  ]);

  if (!navigationResult) {
    return {
      tag,
      status: "fail",
      reason: "tag-click-produced-no-navigation",
      page_url: page.url(),
      candidate: clickResult.candidate ?? null
    };
  }

  const destination = navigationResult.state;
  const destinationRestriction = navigationResult.restriction ?? extractRestriction(destination.body_text, destination.href);
  if (destinationRestriction) {
    return {
      tag,
      status: "manual_required",
      reason: "tag-destination-blocked",
      page_url: destination.href,
      candidate: clickResult.candidate ?? null,
      restriction: destinationRestriction
    };
  }

  const success = isSuccessfulTagDestination({
    originalUrl: initialState.href,
    originalNoteId: noteId,
    destination,
    tag
  });

  return {
    tag,
    status: success ? "pass" : "fail",
    reason: success ? "tag-click-resolved" : "tag-click-destination-not-recognized",
    page_url: destination.href,
    candidate: clickResult.candidate ?? null,
    destination_title: destination.title,
    destination_excerpt: destination.body_text.slice(0, 160)
  };
}

async function runPublishedTagClickReview({ context, postPackage, receipt, reviewConfig }) {
  const noteId = receipt.note_id ?? receipt.publish_verification?.note_id ?? null;
  const shareUrl = buildShareUrl(noteId, receipt);
  const expectedTags = listExpectedHashtags(postPackage);
  const tagReviewConfig = reviewConfig.tagClickReview ?? {};

  if (tagReviewConfig.enabled === false) {
    return {
      status: "manual_required",
      reason: "tag-click-review-disabled",
      expected_tags: expectedTags
    };
  }

  if (!context) {
    return {
      status: "manual_required",
      reason: "browser-context-unavailable",
      expected_tags: expectedTags
    };
  }

  if (!shareUrl) {
    return {
      status: "manual_required",
      reason: "share-url-missing",
      expected_tags: expectedTags
    };
  }

  if (expectedTags.length === 0) {
    return {
      status: "manual_required",
      reason: "no-expected-tags",
      expected_tags: []
    };
  }

  const timeoutMs = tagReviewConfig.timeoutMs ?? 20000;
  const initialWaitMs = tagReviewConfig.initialWaitMs ?? 3500;
  const page = await context.newPage();

  try {
    const results = [];
    for (const tag of expectedTags) {
      const result = await verifySingleTagClick({
        page,
        shareUrl,
        noteId,
        tag,
        timeoutMs,
        initialWaitMs
      });
      results.push(result);
      if (result.status === "manual_required" && result.reason === "published-page-blocked") {
        break;
      }
    }

    const hasFailure = results.some((result) => result.status === "fail");
    const hasManualFallback = results.some((result) => result.status === "manual_required");

    return {
      status: hasFailure ? "fail" : hasManualFallback ? "manual_required" : "pass",
      reason: hasFailure
        ? "one-or-more-tags-not-clickable"
        : hasManualFallback
          ? "tag-review-needs-reliable-network"
          : "all-tags-clickable",
      expected_tags: expectedTags,
      checked_tags: results.length,
      results
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function runFrontendCollectionPageReview({ context, postPackage, receipt, reviewConfig }) {
  const noteId = receipt.note_id ?? receipt.publish_verification?.note_id ?? null;
  const shareUrl = buildShareUrl(noteId, receipt);
  const collectionName = postPackage.publish?.collection?.name ?? null;
  const pageReviewConfig = reviewConfig.collectionPageReview ?? {};

  if (pageReviewConfig.enabled === false) {
    return {
      status: "manual_required",
      reason: "collection-page-review-disabled",
      collection_name: collectionName
    };
  }

  if (!context) {
    return {
      status: "manual_required",
      reason: "browser-context-unavailable",
      collection_name: collectionName
    };
  }

  if (!shareUrl) {
    return {
      status: "manual_required",
      reason: "share-url-missing",
      collection_name: collectionName
    };
  }

  if (!collectionName) {
    return {
      status: "manual_required",
      reason: "collection-name-missing",
      collection_name: null
    };
  }

  const timeoutMs = pageReviewConfig.timeoutMs ?? 20000;
  const initialWaitMs = pageReviewConfig.initialWaitMs ?? 3500;
  const page = await context.newPage();

  try {
    await page.goto(shareUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(initialWaitMs);
    const initialState = await readPageState(page);
    const restriction = extractRestriction(initialState.body_text, initialState.href);
    if (restriction) {
      return {
        status: "manual_required",
        reason: "published-page-blocked",
        collection_name: collectionName,
        page_url: initialState.href,
        restriction
      };
    }

    const popupPromise = page
      .waitForEvent("popup", { timeout: timeoutMs })
      .then(async (popup) => {
        await popup.waitForLoadState("domcontentloaded").catch(() => {});
        await popup.waitForTimeout(1200).catch(() => {});
        const state = await readPageState(popup);
        const popupRestriction = extractRestriction(state.body_text, state.href);
        await popup.close().catch(() => {});
        return {
          kind: "popup",
          state,
          restriction: popupRestriction
        };
      })
      .catch(() => null);

    const clickResult = await clickCollectionCandidate(page, collectionName);
    if (!clickResult.clicked) {
      return {
        status: "fail",
        reason: "collection-entry-not-clickable-on-note-page",
        collection_name: collectionName,
        page_url: initialState.href,
        candidate_count: clickResult.candidate_count ?? 0
      };
    }

    const navigationResult = await Promise.race([
      popupPromise,
      waitForUrlChange(page, initialState.href, timeoutMs).then(async (nextUrl) => {
        if (!nextUrl) {
          return null;
        }
        await page.waitForTimeout(1200);
        const state = await readPageState(page);
        return {
          kind: "navigation",
          state,
          restriction: extractRestriction(state.body_text, state.href)
        };
      }),
      page.waitForTimeout(timeoutMs).then(() => null)
    ]);

    if (!navigationResult) {
      return {
        status: "fail",
        reason: "collection-click-produced-no-navigation",
        collection_name: collectionName,
        page_url: page.url(),
        candidate: clickResult.candidate ?? null
      };
    }

    const destination = navigationResult.state;
    const destinationRestriction = navigationResult.restriction ?? extractRestriction(destination.body_text, destination.href);
    if (destinationRestriction) {
      return {
        status: "manual_required",
        reason: "collection-page-blocked",
        collection_name: collectionName,
        page_url: destination.href,
        candidate: clickResult.candidate ?? null,
        restriction: destinationRestriction
      };
    }

    const success = isSuccessfulCollectionDestination({
      originalUrl: initialState.href,
      originalNoteId: noteId,
      destination,
      collectionName,
      expectedTitle: postPackage.content?.title ?? null
    });

    return {
      status: success ? "pass" : "fail",
      reason: success ? "collection-page-resolved" : "collection-page-destination-not-recognized",
      collection_name: collectionName,
      page_url: destination.href,
      candidate: clickResult.candidate ?? null,
      destination_title: destination.title,
      destination_excerpt: destination.body_text.slice(0, 200)
    };
  } finally {
    await page.close().catch(() => {});
  }
}

function collectVisibilityRiskHits(postPackage, visibilityRiskPhrases) {
  const fields = [
    ["content.title", postPackage.content?.title],
    ["content.body", postPackage.content?.body],
    ["content.hashtags", (postPackage.content?.hashtags ?? []).join(" ")],
    ["publish.collection.name", postPackage.publish?.collection?.name],
    ["publish.collection.description", postPackage.publish?.collection?.description]
  ];
  const hits = [];

  for (const [field, value] of fields) {
    const haystack = normalizeNeedle(value);
    if (!haystack) {
      continue;
    }

    for (const phrase of visibilityRiskPhrases) {
      const needle = normalizeNeedle(phrase);
      if (needle && haystack.includes(needle)) {
        hits.push({ field, phrase });
      }
    }
  }

  return hits;
}

function countPassed(checks) {
  return checks.filter((check) => check.status === "pass").length;
}

function countPending(checks) {
  return checks.filter((check) => check.status === "pending" || check.status === "manual_required").length;
}

function countFailed(checks) {
  return checks.filter((check) => check.status === "fail" || check.status === "blocked").length;
}

function buildChecklist({ config, postPackage, receipt, reviewConfig, tagClickReview, collectionPageReview }) {
  const noteId = receipt.note_id ?? receipt.publish_verification?.note_id ?? null;
  const shareUrl = buildShareUrl(noteId, receipt);
  const managerVerified = Boolean(
    receipt.publish_verification?.kind === "note-manager-match" || receipt.success_text
  );
  const visibilityRiskPhrases = config.contentPolicy?.visibilityRiskPhrases ?? [];
  const riskHits = collectVisibilityRiskHits(postPackage, visibilityRiskPhrases);
  const followUpHours = reviewConfig.analyticsFollowUpHours ?? 2;
  const manualWindowMinutes = reviewConfig.manualReviewWindowMinutes ?? 30;
  const lowReadThreshold = reviewConfig.lowReadThreshold ?? 150;
  const expectedTags = listExpectedHashtags(postPackage);

  return [
    {
      id: "creator_publish_signal",
      type: "auto",
      status: receipt.status === "success" && receipt.mode === "publish" ? "pass" : "fail",
      summary: "发布流程返回成功信号",
      evidence: {
        receipt_status: receipt.status,
        mode: receipt.mode,
        success_text: receipt.success_text ?? null
      }
    },
    {
      id: "note_manager_match",
      type: "auto",
      status: managerVerified ? "pass" : "fail",
      summary: "创作后台笔记管理页能匹配到新帖",
      evidence: receipt.publish_verification ?? null
    },
    {
      id: "note_id_captured",
      type: "auto",
      status: noteId ? "pass" : "blocked",
      summary: "发布后必须回填 note_id 和分享链接",
      evidence: {
        note_id: noteId,
        share_url: shareUrl
      },
      action_if_failed: "打开笔记管理页重新定位该卡片，补回 note_id 后才允许将此次发布视为已完成。"
    },
    {
      id: "low_risk_copy_guard",
      type: "auto",
      status: riskHits.length === 0 ? "pass" : "fail",
      summary: "标题、正文、tag、合集名不得残留高风险金融交易表述",
      evidence: riskHits,
      action_if_failed:
        "停止继续投放该稿件，删除旧帖并按公开实验语义重写后重发。"
    },
    {
      id: "published_tag_click_review",
      type: "auto",
      status: tagClickReview?.status ?? "manual_required",
      summary: "发布后逐个点击成品页 tag，确认每个 tag 都是有效话题入口",
      evidence: tagClickReview ?? {
        expected_tags: expectedTags,
        reason: "tag-click-review-not-run"
      },
      pass_condition: "预期 tag 全部能在成品页点击进入话题页或搜索结果页。",
      fail_condition: "任一 tag 没有可点击入口，或点击后没有进入对应话题/搜索页面。",
      action_if_failed:
        "换可靠网络重新跑 tag 点击复核；如果仍失败，回到正文 tag 行修正格式后再重发。"
    },
    {
      id: "frontend_collection_page_review",
      type: "auto",
      status: collectionPageReview?.status ?? "manual_required",
      summary: "发布后从前台笔记页点击合集入口，确认能进入对应合集页",
      evidence: collectionPageReview ?? {
        collection_name: postPackage.publish?.collection?.name ?? config.collection?.name ?? null,
        reason: "collection-page-review-not-run"
      },
      pass_condition: "前台笔记页能点进目标合集页，并且合集页能识别出目标合集名或对应帖子。",
      fail_condition: "笔记页没有合集入口、点击合集后不跳转，或跳转后不是目标合集页。",
      action_if_failed:
        "先确认系列帖默认加入合集；若环境被前台风控拦截，则换可靠网络补跑前台合集页回查。"
    },
    {
      id: "second_account_direct_link",
      type: "manual_required",
      status: "manual_required",
      summary: `T+${manualWindowMinutes} 分钟内，用第二个已登录小红书账号打开分享链接`,
      evidence: {
        share_url: shareUrl,
        note_id: noteId
      },
      pass_condition: "第二账号可正常打开帖子详情页。",
      fail_condition: "第二账号打开后提示页面不存在、当前笔记暂时无法浏览、自动跳首页或白页。"
    },
    {
      id: "second_account_profile_visibility",
      type: "manual_required",
      status: "manual_required",
      summary: `T+${manualWindowMinutes} 分钟内，用第二账号进入作者主页检查帖子是否可见`,
      evidence: {
        expected_title: postPackage.content?.title ?? null
      },
      pass_condition: "第二账号在作者主页可以看到对应标题卡片。",
      fail_condition: "第二账号主页看不到该帖，或只能作者本人账号看到。"
    },
    {
      id: "second_account_collection_visibility",
      type: "manual_required",
      status: "manual_required",
      summary: `T+${manualWindowMinutes} 分钟内，用第二账号进入合集页检查该帖是否可见`,
      evidence: {
        collection_name: postPackage.publish?.collection?.name ?? config.collection?.name ?? null
      },
      pass_condition: "第二账号在合集页可见该帖。",
      fail_condition: "主页或合集页任一处不可见，都按可见性受限事故处理。"
    },
    {
      id: "read_trend_followup",
      type: "pending",
      status: "pending",
      summary: `T+${followUpHours} 小时后复核阅读和互动是否继续变化`,
      evidence: {
        low_read_threshold: lowReadThreshold
      },
      pass_condition: "阅读、点赞、收藏、分享至少有一项继续增长，且外部可见。",
      fail_condition: `阅读长期停在低位（例如 <= ${lowReadThreshold}）且第二账号不可见，按隐藏帖事故处理。`
    }
  ];
}

function buildEscalation(reviewConfig) {
  const manualWindowMinutes = reviewConfig.manualReviewWindowMinutes ?? 30;
  const followUpHours = reviewConfig.analyticsFollowUpHours ?? 2;

  return {
    hidden_note_incident_definition: [
      "创作后台显示已发布，但第二账号打开分享链接失败",
      "创作后台显示已发布，但第二账号在主页或合集页看不到",
      `发布后 ${followUpHours} 小时阅读长期停在低位，且人工复核仍不可见`
    ],
    required_response: [
      `发布后 ${manualWindowMinutes} 分钟内未完成人工复核，不得把该帖标记为“已安全上线”`,
      "一旦命中隐藏帖事故，不要继续编辑旧帖，直接删除并按低风险稿重发",
      "删除重发前，必须重新检查标题、封面、正文、tag、合集名是否存在金融交易风险词"
    ]
  };
}

function summarizeChecks(checks) {
  return {
    passed: countPassed(checks),
    pending: countPending(checks),
    failed: countFailed(checks)
  };
}

function deriveOverallStatus(checks) {
  if (countFailed(checks) > 0) {
    return "action_required";
  }

  if (countPending(checks) > 0) {
    return "pending_manual_review";
  }

  return "pass";
}

export function buildPostPublishReview({ config, postPackage, receipt }) {
  const reviewConfig = config.postPublishReview ?? {};
  const tagClickReview = receipt.tag_click_review ?? null;
  const collectionPageReview = receipt.collection_page_review ?? null;
  const checks = buildChecklist({ config, postPackage, receipt, reviewConfig, tagClickReview, collectionPageReview });
  const summary = summarizeChecks(checks);
  const noteId = receipt.note_id ?? receipt.publish_verification?.note_id ?? null;
  const shareUrl = buildShareUrl(noteId, receipt);

  return {
    generated_at: nowIso(),
    enabled: reviewConfig.enabled !== false,
    policy_version: reviewConfig.policyVersion ?? "2026-03-12",
    overall_status: deriveOverallStatus(checks),
    package_id: postPackage.package_id,
    note_id: noteId,
    share_url: shareUrl,
    title: postPackage.content?.title ?? null,
    day: postPackage.series?.day ?? null,
    collection_name: postPackage.publish?.collection?.name ?? config.collection?.name ?? null,
    summary,
    checks,
    escalation: buildEscalation(reviewConfig)
  };
}

export async function writePostPublishReview({ config, postPackage, receipt, artifactDir, receiptPath, context }) {
  if (config.postPublishReview?.enabled !== false) {
    receipt.tag_click_review = await runPublishedTagClickReview({
      context,
      postPackage,
      receipt,
      reviewConfig: config.postPublishReview ?? {}
    });
    receipt.collection_page_review = await runFrontendCollectionPageReview({
      context,
      postPackage,
      receipt,
      reviewConfig: config.postPublishReview ?? {}
    });
  }
  const review = buildPostPublishReview({ config, postPackage, receipt });
  const reviewPath = path.join(artifactDir, `${postPackage.package_id}-post-publish-review.json`);
  await writeJson(reviewPath, review);

  if (receiptPath) {
    receipt.post_publish_review = review;
    receipt.post_publish_review_path = reviewPath;
  }

  return {
    review,
    reviewPath
  };
}

async function main() {
  const { configPath, packagePath, receiptPath, outputPath } = parseArgs(process.argv.slice(2));
  const [config, postPackage, receipt] = await Promise.all([
    readJson(configPath),
    readJson(packagePath),
    readJson(receiptPath)
  ]);
  const review = buildPostPublishReview({ config, postPackage, receipt });

  if (outputPath) {
    await writeJson(outputPath, review);
    console.log(JSON.stringify({ status: "success", review_path: outputPath }, null, 2));
    return;
  }

  console.log(JSON.stringify(review, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
