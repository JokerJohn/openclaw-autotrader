import { execFile } from "node:child_process";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import {
  readJson,
  readJsonIfExists,
  writeJson
} from "./lib/runtime-utils.mjs";

const execFileAsync = promisify(execFile);
const PYTHON_BIN = process.env.PYTHON_BIN || "python3";
const OPENAI_CODEX_SERIAL_GUARD = "/Users/xhubd/.openclaw/workspace/scripts/run_with_codex_serial_guard.py";
const DEFAULT_CHALLENGE_TOTAL_DAYS = 90;
const DEFAULT_COLLECTION_NAME = "OpenClaw养龙虾90天记录";
const DEFAULT_COLLECTION_INTRO = "记录 OpenClaw 这只龙虾连续 90 天的公开日更：本金、当前、进度、当天动作和规则修正。";

function usage() {
  console.error(
    "Usage: node ./src/update-xhs-feedback-strategy.mjs [config.json] <snapshot.json> <analytics.json> <output.json>"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const positionals = [];
  const options = {
    personaMode: "sync",
    previousStrategyPath: null,
    mirrorOutputs: [],
    forcePersonaRefresh: false
  };

  for (const arg of argv.filter(Boolean)) {
    if (arg.startsWith("--persona-mode=")) {
      options.personaMode = String(arg.slice("--persona-mode=".length) || "sync").trim() || "sync";
      continue;
    }

    if (arg.startsWith("--previous-strategy=")) {
      options.previousStrategyPath = path.resolve(process.cwd(), arg.slice("--previous-strategy=".length));
      continue;
    }

    if (arg.startsWith("--mirror-output=")) {
      options.mirrorOutputs.push(path.resolve(process.cwd(), arg.slice("--mirror-output=".length)));
      continue;
    }

    if (arg === "--force-persona-refresh") {
      options.forcePersonaRefresh = true;
      continue;
    }

    positionals.push(arg);
  }

  if (positionals.length !== 3 && positionals.length !== 4) {
    usage();
  }

  if (positionals.length === 4) {
    return {
      configPath: path.resolve(process.cwd(), positionals[0]),
      snapshotPath: path.resolve(process.cwd(), positionals[1]),
      analyticsPath: path.resolve(process.cwd(), positionals[2]),
      outputPath: path.resolve(process.cwd(), positionals[3]),
      ...options
    };
  }

  return {
    configPath: null,
    snapshotPath: path.resolve(process.cwd(), positionals[0]),
    analyticsPath: path.resolve(process.cwd(), positionals[1]),
    outputPath: path.resolve(process.cwd(), positionals[2]),
    ...options
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return null;
  }

  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
  }

  return sorted[middle];
}

function sanitizeTitle(title) {
  return String(title ?? "").trim();
}

function sanitizeBody(body) {
  return String(body ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(text, maxLength) {
  const normalized = sanitizeBody(text);
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function extractHashtags(text) {
  const matches = String(text ?? "").match(/#([^#\s]+?)\[话题\]#/gu) ?? [];
  return [...new Set(matches)];
}

function getNoteHashtags(note) {
  if (Array.isArray(note.hashtags) && note.hashtags.length > 0) {
    return [...new Set(note.hashtags.map((tag) => String(tag).trim()).filter(Boolean))];
  }

  return extractHashtags(note.body);
}

function detectTitleTraits(title) {
  const text = sanitizeTitle(title);
  return {
    has_number: /\d/u.test(text),
    has_day: /第?\d+天/u.test(text),
    has_question: /[？?]/u.test(text),
    has_vertical_keyword: /(SLAM|OpenClaw|龙虾|机器人|公开实验|实验记录|系统日志|AI|秋招|岗位|薪资)/u.test(text),
    has_brand: /(OpenClaw|机器人|SLAM)/u.test(text),
    concise: text.length <= 20
  };
}

function detectBodyTraits(note) {
  const body = sanitizeBody(note.body);
  return {
    has_numbered_sections: /1️⃣|2️⃣|3️⃣|4️⃣|5️⃣/u.test(body),
    has_result_first_screen: /今日进展|公开实验|公开记录|系统动作/u.test(body.slice(0, 80)),
    concise_body: body.length > 0 && body.length <= 520,
    has_reader_language: /今天|继续|记录|实验|系统|复盘/u.test(body),
    hashtag_count: getNoteHashtags(note).length
  };
}

function countKeywordHits(notes, keywords) {
  const hits = keywords.map((keyword) => ({
    keyword,
    count: notes.filter((note) => {
      const haystack = `${sanitizeTitle(note.title)} ${sanitizeBody(note.body)}`;
      return haystack.includes(keyword);
    }).length
  }));
  return hits.filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
}

function isSeriesCandidate(note, snapshot) {
  const title = sanitizeTitle(note.title);
  const body = sanitizeBody(note.body);
  const hashtags = getNoteHashtags(note);
  const hasSeriesTitle = /养龙虾第\d+天/u.test(title);
  const hasSeriesHashtags =
    hashtags.some((tag) => tag.includes("#养龙虾")) &&
    hashtags.some((tag) => tag.includes("#OpenClaw")) &&
    hashtags.some((tag) => tag.includes("#养虾的正确打开方式"));
  const postTime = note.post_time ? new Date(note.post_time).getTime() : 0;
  const challengeStart = snapshot?.challenge?.opened_at
    ? new Date(`${snapshot.challenge.opened_at}T00:00:00+08:00`).getTime()
    : 0;
  const challengeTotalDays = Number(snapshot?.challenge?.total_days ?? DEFAULT_CHALLENGE_TOTAL_DAYS);
  const challengeEnd = challengeStart + (challengeTotalDays + 15) * 24 * 60 * 60 * 1000;

  return postTime >= challengeStart && postTime <= challengeEnd && (hasSeriesTitle || hasSeriesHashtags || (!title && /养龙虾|OpenClaw/u.test(body)));
}

function buildObservation(note) {
  return {
    note_id: note.note_id,
    title: sanitizeTitle(note.title) || "(空标题)",
    post_time: note.post_time ?? null,
    read_count: note.read_count ?? 0,
    like_count: note.like_count ?? 0,
    comment_count: note.comment_count ?? 0,
    fav_count: note.fav_count ?? 0,
    share_count: note.share_count ?? 0,
    engagement_rate: note.engagement_rate ?? null,
    hashtags: getNoteHashtags(note)
  };
}

function buildHashtagInsights(notes) {
  const map = new Map();

  for (const note of notes) {
    for (const tag of getNoteHashtags(note)) {
      const entry = map.get(tag) ?? {
        tag,
        note_count: 0,
        reads: [],
        engagement_rates: []
      };
      entry.note_count += 1;
      entry.reads.push(note.read_count ?? 0);
      entry.engagement_rates.push(note.engagement_rate ?? 0);
      map.set(tag, entry);
    }
  }

  return [...map.values()]
    .map((entry) => ({
      tag: entry.tag,
      note_count: entry.note_count,
      median_reads: median(entry.reads),
      median_engagement_rate: median(entry.engagement_rates)
    }))
    .sort((a, b) => {
      if ((b.median_reads ?? 0) !== (a.median_reads ?? 0)) {
        return (b.median_reads ?? 0) - (a.median_reads ?? 0);
      }
      return b.note_count - a.note_count;
    });
}

function buildStyleLearning(notes, topAccountNotes) {
  const hotTitles = topAccountNotes.map((note) => sanitizeTitle(note.title)).filter(Boolean);
  const allTitleTraits = notes.map((note) => detectTitleTraits(note.title));
  const hotTitleTraits = topAccountNotes.map((note) => detectTitleTraits(note.title));
  const allBodyTraits = notes.map((note) => detectBodyTraits(note));
  const hotHashtags = buildHashtagInsights(topAccountNotes).slice(0, 8);
  const hotKeywords = countKeywordHits(topAccountNotes, [
    "SLAM",
    "岗位",
    "秋招",
    "薪资",
    "OpenClaw",
    "龙虾",
    "机器人",
    "公开实验",
    "系统复盘",
    "AI"
  ]);

  return {
    account_existing_style: {
      hot_topics: hotKeywords.slice(0, 8),
      hot_titles: hotTitles.slice(0, 8),
      hot_hashtags: hotHashtags,
      language_profile: [
        "标题偏直接，先抛主题，不先铺垫。",
        "偏垂直社区表达，喜欢用圈内关键词切人群。",
        "高表现旧帖常带具体对象、具体阶段和较高信息密度。"
      ]
    },
    writing_traits: {
      account_level: {
        concise_title_ratio:
          allTitleTraits.length > 0 ? Number((allTitleTraits.filter((item) => item.concise).length / allTitleTraits.length).toFixed(2)) : 0,
        number_title_ratio:
          allTitleTraits.length > 0 ? Number((allTitleTraits.filter((item) => item.has_number).length / allTitleTraits.length).toFixed(2)) : 0,
        question_title_ratio:
          allTitleTraits.length > 0 ? Number((allTitleTraits.filter((item) => item.has_question).length / allTitleTraits.length).toFixed(2)) : 0,
        numbered_body_ratio:
          allBodyTraits.length > 0 ? Number((allBodyTraits.filter((item) => item.has_numbered_sections).length / allBodyTraits.length).toFixed(2)) : 0,
        result_first_screen_ratio:
          allBodyTraits.length > 0 ? Number((allBodyTraits.filter((item) => item.has_result_first_screen).length / allBodyTraits.length).toFixed(2)) : 0
      },
      hot_note_level: {
        concise_title_ratio:
          hotTitleTraits.length > 0 ? Number((hotTitleTraits.filter((item) => item.concise).length / hotTitleTraits.length).toFixed(2)) : 0,
        number_title_ratio:
          hotTitleTraits.length > 0 ? Number((hotTitleTraits.filter((item) => item.has_number).length / hotTitleTraits.length).toFixed(2)) : 0,
        question_title_ratio:
          hotTitleTraits.length > 0 ? Number((hotTitleTraits.filter((item) => item.has_question).length / hotTitleTraits.length).toFixed(2)) : 0
      }
    },
    style_adaptation_rules: [
      "保留账号里“直接抛主题”的写法，不写空泛开场。",
      "继续用垂直关键词切人群，但在 OpenClaw 系列里固定加入龙虾、机器人、OpenClaw。",
      "标题优先具体对象、具体阶段、具体结果，少写泛化感受。"
    ]
  };
}

function buildShortTermMemory(seriesNotes, hashtagInsights) {
  const recent = [...seriesNotes]
    .sort((a, b) => new Date(b.post_time ?? 0) - new Date(a.post_time ?? 0))
    .slice(0, 7)
    .map((note) => ({
      ...buildObservation(note),
      title_traits: detectTitleTraits(note.title),
      body_traits: detectBodyTraits(note)
    }));

  const relatedHashtags = hashtagInsights.slice(0, 3).map((item) => item.tag);

  return {
    window: "recent-7-series-notes",
    observations: recent,
    current_adjustments: [
      "第一屏先报 PnL、current、今天有没有动作，句子尽量短。",
      "固定 tag 必须写成 #tag[话题]#，每个 tag 后都留一个空格，最后一个 tag 后也保留空格，且 tag 本身不能带 🦞 这类特殊字符；执行层必须把 tag 插成真实可点击的话题节点。",
      "封面继续沿用 GitHub poster 信息结构，但保留 本金 / current / PnL 这些英文指标。",
      "系列封面和合集名都不要出现“自动化”或“自动化测试”，统一改成更像真人连载的表达。",
      "90 天系列正文不能再整批复用同一套句骨架，必须参考历史 100+ 帖子的第一人称口吻做句式轮换。",
      "90 天系列封面也要做 badge / 副标题 / 配色 / 文案重心的轮换，避免连续几天像同一张图复制。",
      "标题按当天结果直给写成小盈 / 小亏 / 大亏 / 持平，不要再写起步、继续等。",
      "正文只保留 今天结果 / 今天怎么做 / 今日记录 三段，去掉第 4 段学习总结、免责声明和明天盯什么。",
      "如果外部链接打不开或其他账号主页看不到，直接按隐藏帖事故处理：删除后低风险重发。"
    ]
  };
}

function mergeUnique(...lists) {
  return [...new Set(lists.flat().filter(Boolean))];
}

function normalizeEnvNames(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  const text = String(value ?? "").trim();
  return text ? [text] : [];
}

function pickFirstEnvValue(envNames, env) {
  for (const envName of envNames) {
    const value = String(env?.[envName] ?? "").trim();
    if (value) {
      return { envName, value };
    }
  }

  return { envName: envNames[0] ?? null, value: "" };
}

function extractJsonObject(text) {
  const raw = String(text ?? "").trim();
  const withoutFence = raw.replace(/^```json\s*/iu, "").replace(/^```\s*/u, "").replace(/\s*```$/u, "");
  const firstBrace = withoutFence.indexOf("{");
  if (firstBrace < 0) {
    throw new Error("Model response did not contain a JSON object.");
  }
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstBrace; index < withoutFence.length; index += 1) {
    const char = withoutFence[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(withoutFence.slice(firstBrace, index + 1));
      }
    }
  }

  throw new Error("Model response did not contain a complete JSON object.");
}

function buildPersonaCorpus(notes, maxBodyCharsPerNote) {
  return [...notes]
    .sort((a, b) => new Date(a.post_time ?? 0) - new Date(b.post_time ?? 0))
    .map((note) => ({
      note_id: note.note_id,
      post_time: note.post_time,
      title: sanitizeTitle(note.title),
      body: limitText(note.body, maxBodyCharsPerNote),
      hashtags: getNoteHashtags(note),
      read_count: note.read_count ?? 0,
      like_count: note.like_count ?? 0,
      comment_count: note.comment_count ?? 0,
      fav_count: note.fav_count ?? 0,
      share_count: note.share_count ?? 0,
      engagement_rate: note.engagement_rate ?? null
    }));
}

function buildCorpusFingerprint(corpus) {
  const hash = createHash("sha256");
  hash.update(
    JSON.stringify(
      corpus.map((note) => [
        note.note_id ?? null,
        note.post_time ?? null,
        note.title ?? "",
        note.body ?? "",
        note.read_count ?? 0,
        note.like_count ?? 0,
        note.comment_count ?? 0,
        note.fav_count ?? 0,
        note.share_count ?? 0,
        note.engagement_rate ?? null
      ])
    )
  );
  return hash.digest("hex").slice(0, 16);
}

function compactPersonaExample(note, maxBodyCharsPerNote) {
  return {
    ...buildObservation(note),
    body_excerpt: limitText(note.body, Math.min(maxBodyCharsPerNote, 240)),
    title_traits: detectTitleTraits(note.title),
    body_traits: detectBodyTraits(note)
  };
}

function dedupeNotesById(notes) {
  const seen = new Set();
  const result = [];

  for (const note of notes) {
    const key = String(note?.note_id ?? "");
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(note);
  }

  return result;
}

function buildPersonaRepresentativeSamples(notes, personaConfig, maxBodyCharsPerNote) {
  const maxTopNotes = personaConfig.maxTopNotes ?? 8;
  const maxRecentNotes = personaConfig.maxRecentNotes ?? 8;
  const maxWeakNotes = personaConfig.maxWeakNotes ?? 6;
  const maxEvolutionNotes = personaConfig.maxEvolutionNotes ?? 6;

  const byRecent = [...notes]
    .sort((a, b) => new Date(b.post_time ?? 0) - new Date(a.post_time ?? 0))
    .slice(0, maxRecentNotes);
  const byReads = [...notes]
    .sort((a, b) => (b.read_count ?? 0) - (a.read_count ?? 0))
    .slice(0, maxTopNotes);
  const byEngagement = [...notes]
    .filter((note) => Number.isFinite(note.engagement_rate))
    .sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0))
    .slice(0, maxTopNotes);
  const weakPosts = [...notes]
    .filter((note) => (note.read_count ?? 0) > 0)
    .sort((a, b) => {
      if ((a.engagement_rate ?? Infinity) !== (b.engagement_rate ?? Infinity)) {
        return (a.engagement_rate ?? Infinity) - (b.engagement_rate ?? Infinity);
      }
      return (a.read_count ?? Infinity) - (b.read_count ?? Infinity);
    })
    .slice(0, maxWeakNotes);

  const sortedByTime = [...notes].sort((a, b) => new Date(a.post_time ?? 0) - new Date(b.post_time ?? 0));
  const evolutionExamples = [];
  if (sortedByTime.length > 0) {
    if (sortedByTime.length <= maxEvolutionNotes) {
      evolutionExamples.push(...sortedByTime);
    } else {
      const step = (sortedByTime.length - 1) / Math.max(maxEvolutionNotes - 1, 1);
      for (let index = 0; index < maxEvolutionNotes; index += 1) {
        evolutionExamples.push(sortedByTime[Math.round(index * step)]);
      }
    }
  }

  return {
    recent_examples: dedupeNotesById(byRecent).map((note) => compactPersonaExample(note, maxBodyCharsPerNote)),
    top_read_examples: dedupeNotesById(byReads).map((note) => compactPersonaExample(note, maxBodyCharsPerNote)),
    top_engagement_examples: dedupeNotesById(byEngagement).map((note) => compactPersonaExample(note, maxBodyCharsPerNote)),
    weak_examples: dedupeNotesById(weakPosts).map((note) => compactPersonaExample(note, maxBodyCharsPerNote)),
    evolution_examples: dedupeNotesById(evolutionExamples).map((note) => compactPersonaExample(note, maxBodyCharsPerNote))
  };
}

function sanitizeCarriedPersona(persona) {
  if (!persona || typeof persona !== "object") {
    return null;
  }

  const next = { ...persona };
  delete next.cache_hit;
  delete next.error;
  delete next.reused_from_previous;
  delete next.stale_reason;
  return next;
}

async function requestPersonaViaOpenClaw({
  cliPath,
  agentId,
  thinking,
  timeoutSeconds,
  promptText,
  maxRetries,
  retryBackoffMs,
  serialGuardWaitTimeoutSeconds
}) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const sessionKey = `agent:${agentId}:cli:direct:xhs-persona-${randomUUID()}`;
    const runId = `persona-${randomUUID()}`;
    try {
      const params = {
        message: promptText,
        agentId,
        sessionKey,
        thinking,
        timeout: timeoutSeconds,
        idempotencyKey: runId
      };
      const baseArgs = [
        cliPath,
        "gateway",
        "call",
        "agent",
        "--expect-final",
        "--json",
        "--timeout",
        String(Math.max((timeoutSeconds + 60) * 1000, 150000)),
        "--params",
        JSON.stringify(params)
      ];
      const { stdout = "", stderr = "" } = await execFileAsync(
        PYTHON_BIN,
        [
          OPENAI_CODEX_SERIAL_GUARD,
          "--wait-timeout-seconds",
          String(Math.max(60, Number(serialGuardWaitTimeoutSeconds || 420))),
          "--label",
          `xhs-persona-agent:${agentId}`,
          "--",
          ...baseArgs
        ],
        {
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024 * 20
        }
      );

      const runPayload = extractJsonObject(stdout);
      if (runPayload?.status !== "ok") {
        throw new Error(
          `OpenClaw persona agent failed: ${runPayload?.summary ?? runPayload?.status ?? "unknown error"}.`
        );
      }

      const responseText = (runPayload?.result?.payloads ?? [])
        .map((payload) => String(payload?.text ?? "").trim())
        .filter(Boolean)
        .join("\n")
        .trim();

      if (!responseText) {
        throw new Error("OpenClaw persona agent returned no text payload.");
      }

      return {
        parsed: extractJsonObject(responseText),
        runPayload,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        attempts: attempt + 1,
        sessionKey,
        runId
      };
    } catch (error) {
      lastError = error;
      const stdout = String(error?.stdout ?? "");
      const stderr = String(error?.stderr ?? "");
      const combined = `${error?.message ?? ""}\n${stdout}\n${stderr}`.trim();
      const retryable =
        /rate.?limit|timed out|timeout|temporar|gateway|fetch failed|ECONN|EPIPE|socket|model_not_found/iu.test(
          combined
        );

      if (retryable && attempt < maxRetries) {
        await sleep(retryBackoffMs * (attempt + 1));
        continue;
      }

      const wrapped = new Error(combined || "OpenClaw persona request failed.");
      wrapped.stdout = stdout;
      wrapped.stderr = stderr;
      throw wrapped;
    } finally {
      try {
        await execFileAsync(
          cliPath,
          [
            "gateway",
            "call",
            "sessions.delete",
            "--json",
            "--params",
            JSON.stringify({
              key: sessionKey,
              deleteTranscript: true,
              emitLifecycleHooks: false
            })
          ],
          {
            cwd: process.cwd(),
            maxBuffer: 1024 * 1024 * 4
          }
        );
      } catch {
        // Best-effort cleanup only. The persona request itself should not fail on cleanup issues.
      }
    }
  }

  throw lastError ?? new Error("OpenClaw persona request failed.");
}

async function analyzePersonaWithOpenClaw({
  config,
  snapshot,
  notes,
  previousStrategy,
  styleLearning,
  shortTermMemory,
  hashtagInsights,
  medianReads,
  medianEngagementRate,
  topAccountNotes,
  personaMode = "sync",
  forcePersonaRefresh = false
}) {
  const personaConfig = config.personaAnalysis ?? {};
  const rawTransport = String(personaConfig.transport ?? "openclaw-gateway").trim() || "openclaw-gateway";
  const transport = rawTransport === "openclaw-agent" ? "openclaw-gateway" : rawTransport;
  const cliPath = personaConfig.cliPath ?? "openclaw";
  const agentId = personaConfig.agentId ?? "xhs-persona-agent";
  const thinking = personaConfig.thinking ?? "minimal";
  const timeoutSeconds = personaConfig.timeoutSeconds ?? 120;
  const maxBodyCharsPerNote = personaConfig.maxBodyCharsPerNote ?? 800;
  const corpus = buildPersonaCorpus(notes, maxBodyCharsPerNote);
  const corpusFingerprint = buildCorpusFingerprint(corpus);
  const maxRetries = personaConfig.maxRetries ?? 0;
  const retryBackoffMs = personaConfig.retryBackoffMs ?? 2500;
  const serialGuardWaitTimeoutSeconds = personaConfig.serialGuardWaitTimeoutSeconds ?? 420;
  const preferredProvider = String(personaConfig.preferredProvider ?? "openai-codex").trim() || null;
  const preferredModel = String(personaConfig.preferredModel ?? "gpt-5.4").trim() || null;
  const preferredRetryAttempts = Math.max(0, Number(personaConfig.preferredRetryAttempts ?? 0));
  const preferredRetryBackoffMs = Math.max(0, Number(personaConfig.preferredRetryBackoffMs ?? 45000));
  const previousAnalysis = previousStrategy?.persona_analysis ?? null;
  const representativeSamples = buildPersonaRepresentativeSamples(notes, personaConfig, maxBodyCharsPerNote);
  const analysis = {
    transport,
    provider: "openclaw",
    model: `agent:${agentId}`,
    requested_agent_id: agentId,
    cli_path: cliPath,
    thinking,
    timeout_seconds: timeoutSeconds,
    corpus_scope: "all_historical_posts",
    persona_mode: personaMode,
    force_refresh: forcePersonaRefresh,
    corpus_fingerprint: corpusFingerprint,
    notes_analyzed: corpus.length,
    notes_with_body: corpus.filter((note) => note.body).length,
    payload_mode: "compact-summary-v1",
    max_retries: maxRetries,
    preferred_provider: preferredProvider,
    preferred_model: preferredModel,
    preferred_retry_attempts: preferredRetryAttempts,
    generated_at: new Date().toISOString(),
    status: "skipped",
    error: null,
    usage: null
  };
  const previousPersona = previousStrategy?.creator_persona ?? null;

  if (transport !== "openclaw-gateway") {
    analysis.status = "blocked";
    analysis.error = `Unsupported persona transport: ${rawTransport}.`;
    return { analysis, persona: previousPersona };
  }

  if (personaConfig.enabled === false) {
    analysis.status = "disabled";
    return { analysis, persona: previousPersona };
  }

  if (corpus.length === 0) {
    analysis.status = "blocked";
    analysis.error = "No historical notes available for persona analysis.";
    return { analysis, persona: previousPersona };
  }

  if (
    !forcePersonaRefresh &&
    previousStrategy?.creator_persona &&
    previousAnalysis?.status === "success" &&
    previousAnalysis?.corpus_fingerprint === corpusFingerprint
  ) {
    analysis.status = "cache_hit";
    analysis.usage = previousAnalysis?.usage ?? null;
    analysis.provider = previousAnalysis?.provider ?? analysis.provider;
    analysis.model = previousAnalysis?.model ?? analysis.model;
    return {
      analysis,
      persona: {
        ...sanitizeCarriedPersona(previousStrategy.creator_persona),
        status: "success",
        reused_from_previous: true,
        cache_hit: true
      }
    };
  }

  if (personaMode === "skip") {
    analysis.status = "deferred";
    analysis.error = "Persona refresh queued in background.";
    return {
      analysis,
      persona: previousStrategy?.creator_persona
        ? {
            ...sanitizeCarriedPersona(previousStrategy.creator_persona),
            status: "cached",
            reused_from_previous: true
          }
        : previousPersona
    };
  }

  const systemPrompt =
    "你是一名资深中文内容策略研究员。你只做基于输入 JSON 的人物画像归纳。不要调用工具，不要读取文件，不要联网。你必须只输出一个严格 JSON 对象，不要写 Markdown、解释、代码块或额外字段。";
  const userPrompt = {
    task: "请基于下面账号全部历史帖子数据摘要，输出创作者人物画像和长期记忆。不要输出运营黑话，要贴近真实人物风格。",
    required_output_schema: {
      profile_summary: "一句话概括这个账号主人的人物画像",
      creator_identity: ["3-6 条身份标签"],
      audience_map: ["3-6 条核心受众描述"],
      voice_traits: ["4-8 条语言风格特征"],
      topic_clusters: ["4-8 条常写主题"],
      signature_patterns: ["4-8 条高识别度写法"],
      credibility_signals: ["3-6 条让读者信任的信号"],
      hot_post_patterns: ["3-6 条高表现内容规律"],
      weak_post_patterns: ["3-6 条低表现内容规律"],
      language_do: ["4-8 条以后应该持续保留的表达"],
      language_dont: ["4-8 条以后应避免的表达"],
      persona_memory: ["6-12 条可直接写入长期记忆的稳定认知"],
      optimization_hypotheses: ["3-6 条下一阶段可验证的优化假设"]
    },
    context: {
      account: "OpenClaw 小红书账号",
      current_series: snapshot?.story?.series_name ?? "OpenClaw 90 天挑战",
      all_historical_notes_count: corpus.length,
      requirement: "必须基于全部历史帖子，不只看近期 10 篇。",
      corpus_fingerprint: corpusFingerprint
    },
    aggregate_summary: {
      median_reads: medianReads,
      median_engagement_rate: medianEngagementRate,
      top_hashtag_insights: hashtagInsights.slice(0, 12),
      top_account_notes: topAccountNotes.map(buildObservation),
      style_learning: styleLearning,
      short_term_memory: shortTermMemory
    },
    representative_samples: representativeSamples
  };
  const promptEnvelope = {
    mode: "xhs-persona-analysis",
    output_contract: "json_object_only",
    instructions: [
      "只输出一个严格 JSON 对象。",
      "字段只能来自 required_output_schema。",
      "字段值缺失时使用空字符串或空数组，不要新增字段。",
      "不要写解释、Markdown、代码块或前后缀。"
    ],
    system_prompt: systemPrompt,
    payload: userPrompt
  };
  const promptText = JSON.stringify(promptEnvelope);
  analysis.prompt_chars = promptText.length;
  analysis.approx_prompt_tokens = Math.round(promptText.length / 2.2);

  try {
    let parsed = null;
    let runPayload = null;
    let attempts = 0;
    let preferredMisses = 0;

    for (let preferredAttempt = 0; preferredAttempt <= preferredRetryAttempts; preferredAttempt += 1) {
      const requestResult = await requestPersonaViaOpenClaw({
        cliPath,
        agentId,
        thinking,
        timeoutSeconds,
      promptText,
      maxRetries,
      retryBackoffMs,
      serialGuardWaitTimeoutSeconds
    });
      parsed = requestResult.parsed;
      runPayload = requestResult.runPayload;
      attempts += requestResult.attempts ?? 1;

      const agentMeta = runPayload?.result?.meta?.agentMeta ?? {};
      const actualProvider = agentMeta.provider ?? analysis.provider;
      const actualModel = agentMeta.model ?? analysis.model;
      const preferredProviderMatched = !preferredProvider || actualProvider === preferredProvider;
      const preferredModelMatched = !preferredModel || actualModel === preferredModel;

      if (preferredProviderMatched && preferredModelMatched) {
        analysis.preferred_retry_used = preferredAttempt;
        break;
      }

      preferredMisses += 1;
      analysis.preferred_retry_used = preferredAttempt;
      if (preferredAttempt >= preferredRetryAttempts) {
        break;
      }

      await sleep(preferredRetryBackoffMs * (preferredAttempt + 1));
    }

    const agentMeta = runPayload?.result?.meta?.agentMeta ?? {};
    analysis.status = "success";
    analysis.usage = agentMeta?.lastCallUsage ?? null;
    analysis.api_attempts = attempts;
    analysis.preferred_miss_count = preferredMisses;
    analysis.provider = agentMeta.provider ?? analysis.provider;
    analysis.model = agentMeta.model ?? analysis.model;
    analysis.openclaw_run_id = runPayload?.runId ?? null;
    analysis.openclaw_session_id = agentMeta.sessionId ?? null;
    analysis.duration_ms = runPayload?.result?.meta?.durationMs ?? null;
    analysis.stop_reason = runPayload?.result?.meta?.stopReason ?? null;

    return {
      analysis,
      persona: {
        status: "success",
        provider: analysis.provider,
        model: analysis.model,
        generated_at: analysis.generated_at,
        profile_summary: parsed.profile_summary ?? "",
        creator_identity: parsed.creator_identity ?? [],
        audience_map: parsed.audience_map ?? [],
        voice_traits: parsed.voice_traits ?? [],
        topic_clusters: parsed.topic_clusters ?? [],
        signature_patterns: parsed.signature_patterns ?? [],
        credibility_signals: parsed.credibility_signals ?? [],
        hot_post_patterns: parsed.hot_post_patterns ?? [],
        weak_post_patterns: parsed.weak_post_patterns ?? [],
        language_do: parsed.language_do ?? [],
        language_dont: parsed.language_dont ?? [],
        persona_memory: parsed.persona_memory ?? [],
        optimization_hypotheses: parsed.optimization_hypotheses ?? []
      }
    };
  } catch (error) {
    analysis.status = "error";
    analysis.error = error.message;
    return { analysis, persona: previousPersona };
  }
}

function buildPersonaSection(personaResult, previousStrategy) {
  if (["success", "cached"].includes(personaResult.persona?.status)) {
    return personaResult.persona;
  }

  if (previousStrategy?.creator_persona) {
    return {
      ...sanitizeCarriedPersona(previousStrategy.creator_persona),
      status: "stale",
      reused_from_previous: true,
      stale_reason: personaResult.analysis.error ?? personaResult.analysis.status
    };
  }

  return {
    status: "unavailable",
    reused_from_previous: false,
    error: personaResult.analysis.error ?? "Persona analysis unavailable."
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [config, snapshot, analytics, previousStrategy] = await Promise.all([
    args.configPath ? readJson(args.configPath) : {},
    readJson(args.snapshotPath),
    readJson(args.analyticsPath),
    readJsonIfExists(args.previousStrategyPath ?? args.outputPath, null)
  ]);

  const notes = analytics.notes ?? [];
  const seriesNotes = notes.filter((note) => isSeriesCandidate(note, snapshot));
  const latestSeriesNote = [...seriesNotes].sort((a, b) => new Date(b.post_time ?? 0) - new Date(a.post_time ?? 0))[0] ?? null;
  const bestSeriesNote = [...seriesNotes].sort((a, b) => (b.engagement_score ?? 0) - (a.engagement_score ?? 0))[0] ?? null;
  const topAccountNotes = [...notes].sort((a, b) => (b.read_count ?? 0) - (a.read_count ?? 0)).slice(0, 10);
  const medianReads = median(notes.map((note) => note.read_count));
  const medianEngagementRate = median(notes.map((note) => note.engagement_rate ?? 0));
  const hashtagInsights = buildHashtagInsights(notes);
  const styleLearning = buildStyleLearning(notes, topAccountNotes);
  const shortTermMemory = buildShortTermMemory(seriesNotes, hashtagInsights);
  const personaResult = await analyzePersonaWithOpenClaw({
    config,
    snapshot,
    notes,
    previousStrategy,
    styleLearning,
    shortTermMemory,
    hashtagInsights,
    medianReads,
    medianEngagementRate,
    topAccountNotes,
    personaMode: args.personaMode,
    forcePersonaRefresh: args.forcePersonaRefresh
  });
  const creatorPersona = buildPersonaSection(personaResult, previousStrategy);
  const longTermPatterns = mergeUnique(
    previousStrategy?.long_term_memory?.stable_patterns ?? [],
    [
      "固定 tag：#slam[话题]# #机器人[话题]# #养龙虾[话题]# #小龙虾[话题]# #OpenClaw[话题]# #AIAgent[话题]# #openclaw[话题]# #养虾的正确打开方式[话题]#，tag 之间必须保留 ASCII 空格，最后一个 tag 后也要保留空格，且不要带 🦞 等特殊字符。",
      "封面首图使用 GitHub challenge poster 竖屏版",
      "结果先行，标题尽量短而具体"
    ],
    creatorPersona.signature_patterns ?? []
  );

  const suggestions = [];
  if (!analytics.complete) {
    suggestions.push("先确保历史帖子同步完整，再更新人物画像和长期记忆。");
  }

  if (personaResult.analysis.status === "deferred") {
    suggestions.push("人物画像刷新已转入后台，本次先复用上一版稳定画像。");
  } else if (!["success", "cache_hit"].includes(personaResult.analysis.status)) {
    const personaProvider = personaResult.analysis.provider ?? "openclaw";
    const personaModel =
      personaResult.analysis.model ?? `agent:${config.personaAnalysis?.agentId ?? "xhs-persona-agent"}`;
    suggestions.push(
      `人物画像本次未由 ${personaProvider}/${personaModel} 重新生成：${personaResult.analysis.error ?? personaResult.analysis.status}。`
    );
  }

  if ((analytics.content_coverage?.ready_ratio ?? 0) < 1) {
    suggestions.push("仍有历史帖子正文未拉全，后续继续补齐正文语料再更新长期记忆。");
  }

  if (latestSeriesNote && !sanitizeTitle(latestSeriesNote.title)) {
    suggestions.push("避免空标题。标题必须明确写出“养龙虾 + Day + OpenClaw + 当天结果词”的核心信息。");
  }

  if ((latestSeriesNote?.comment_count ?? 0) === 0) {
    suggestions.push("开头第一屏先给 PnL、current、今天有没有 fill，不要先解释理念。");
  }

  if ((latestSeriesNote?.engagement_rate ?? 0) < (medianEngagementRate ?? 0)) {
    suggestions.push("正文继续收短：少解释系统视角，多给今天到底发生了什么和你当下的判断。");
  }

  suggestions.push("封面继续沿用 GitHub 挑战海报，只做竖屏重排，不要换视觉语言。");
  suggestions.push("固定保留 tag：#slam[话题]# #机器人[话题]# #养龙虾[话题]# #小龙虾[话题]# #OpenClaw[话题]# #AIAgent[话题]# #openclaw[话题]# #养虾的正确打开方式[话题]#，并确保 tag 之间保留 ASCII 空格，最后一个 tag 后也留空格；tag 本身不要带 🦞 等特殊字符。");
  suggestions.push("小标题继续编号化，用 1️⃣ 2️⃣ 3️⃣ 这种形式拉开层次。");
  suggestions.push("系列正文不要再整批复用同一句骨架，要参考账号历史语料做第一人称、短句、轻微情绪感的轮换。");
  suggestions.push("系列封面要在 badge、副标题、配色和文案重心上轮换，避免平台判定画风同质化。");

  const strategy = {
    version: 2,
    generated_at: new Date().toISOString(),
    source: "xhs-agent/update-xhs-feedback-strategy.mjs",
    analysis_coverage: {
      corpus_scope: "all_historical_posts",
      total_notes_available: analytics.total_notes_available ?? notes.length,
      notes_analyzed: notes.length,
      notes_with_body: notes.filter((note) => sanitizeBody(note.body)).length,
      sync_complete: analytics.complete ?? false
    },
    account_benchmark: {
      median_reads: medianReads,
      median_engagement_rate: medianEngagementRate
    },
    series_benchmark: {
      note_count: seriesNotes.length,
      latest_note: latestSeriesNote ? buildObservation(latestSeriesNote) : null,
      best_note: bestSeriesNote ? buildObservation(bestSeriesNote) : null
    },
    creator_persona: creatorPersona,
    persona_analysis: personaResult.analysis,
    title_playbook: {
      required_keywords: ["养龙虾", "OpenClaw"],
      preferred_pattern: "养龙虾第X天｜OpenClaw小盈 / 小亏 / 大亏 / 持平",
      winning_examples: topAccountNotes.map((note) => sanitizeTitle(note.title)).filter(Boolean).slice(0, 5),
      avoid: ["空标题", "抽象复盘", "只写感受不写结果", "美股/量化/自动交易等中文高风险词"]
    },
    opening_playbook: {
      preferred: "首句直接报 PnL、current、今天有没有动作。第二句再讲今天为什么这么做。",
      avoid: ["先解释模板目标", "先讲大道理", "开头超过 2 句还没出现结果", "写成 AI 元叙事", "开头空泛"]
    },
    hashtag_playbook: {
      required: ["slam", "机器人", "养龙虾", "小龙虾", "OpenClaw", "AIAgent", "openclaw", "养虾的正确打开方式"],
      preferred: ["#slam", "#机器人", "#养龙虾", "#小龙虾", "#OpenClaw", "#AIAgent", "#openclaw", "#养虾的正确打开方式"],
      insights: hashtagInsights.slice(0, 12),
      avoid: ["无关泛标签", "固定 tag 丢失", "超过 8 个标签", "tag 不留空格", "最后一个 tag 后没有空格", "普通 #tag 文本未转成 [话题] 格式", "tag 带 🦞 等特殊字符", "中文高风险金融标签"]
    },
    cover_playbook: {
      preferred: "沿用 GitHub tracking agent 的 repo 概览海报信息结构，改成竖屏。",
      avoid: ["另起一套视觉", "纯文字白底封面", "封面没有 本金 / current / PnL 关键信息", "封面直接写中文高风险词"]
    },
    body_playbook: {
      preferred: ["1️⃣ 今天结果", "2️⃣ 今天怎么做", "3️⃣ 今日记录"],
      avoid: ["无编号小标题", "大段说明文", "先讲道理再讲结果", "AI 味解释腔", "固定第4段学习总结", "中文高风险交易术语堆叠", "免责声明式收尾", "明天盯什么栏目"]
    },
    collection: {
      name: snapshot.story?.collection_name ?? DEFAULT_COLLECTION_NAME,
      description:
        snapshot.story?.collection_intro ?? DEFAULT_COLLECTION_INTRO
    },
    observations: {
      series_notes: seriesNotes.map(buildObservation),
      top_account_notes: topAccountNotes.map(buildObservation),
      top_account_hashtags: hashtagInsights.slice(0, 12),
      comment_signal_status: "当前自动链路默认使用评论量；评论正文抓取仍可继续增强。"
    },
    style_learning: styleLearning,
    short_term_memory: shortTermMemory,
    long_term_memory: {
      corpus_scope: "all_historical_posts",
      total_historical_notes: notes.length,
      stable_patterns: longTermPatterns,
      account_style_summary: styleLearning.account_existing_style,
      persona_memory: creatorPersona.persona_memory ?? [],
      accumulated_rules: mergeUnique(
        previousStrategy?.long_term_memory?.accumulated_rules ?? [],
        creatorPersona.language_do ?? [],
        [
          "持续靠近账号原有直给式标题风格",
          "优先保留高相关社区词和具体对象词",
          "OpenClaw 系列保持简洁、结果先行、社区化表达",
          "标题、封面、正文、tag、合集名统一用 stock / current / PnL 这类英文词，不直接写中文高风险词",
          "系列封面和合集名都不要出现“自动化”或“自动化测试”字样",
          "90 天系列只保留一个官方合集，合集名统一为 OpenClaw养龙虾90天记录，出现相似重复合集要合并并删除",
          "tag 必须写成 #tag[话题]#，每个 tag 后都留空格，最后一个 tag 后也保留空格，且不要带 🦞 等特殊字符；执行层必须插成真实可点击话题节点，成品页逐个点开可跳转",
          "标题按当天结果直接写小盈 / 小亏 / 大亏 / 持平，不要写起步、继续等",
          "90 天系列正文不能再整批复用同一句骨架，要参考历史 100+ 帖子的第一人称口吻做句式轮换",
          "90 天系列封面要在 badge、副标题、配色和文案重心上轮换，避免平台判定画风或内容同质化",
          "如果出现后台已发布但外部不可见，直接按限制展示范围事故处理"
        ]
      )
    },
    suggestions
  };

  await writeJson(args.outputPath, strategy);
  for (const mirrorPath of args.mirrorOutputs) {
    if (mirrorPath && mirrorPath !== args.outputPath) {
      await writeJson(mirrorPath, strategy);
    }
  }

  if (!["success", "cache_hit", "deferred"].includes(personaResult.analysis.status)) {
    console.error(
      `Persona analysis warning: ${personaResult.analysis.error ?? personaResult.analysis.status}`
    );
  }
  console.log(`Wrote ${args.outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
