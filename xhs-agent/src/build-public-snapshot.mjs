import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(scriptDir, "../templates/30-day-series.json");
const DEFAULT_CHALLENGE_TOTAL_DAYS = 90;
const DEFAULT_SERIES_NAME = "90-Day OpenClaw AutoTrader Challenge";
const DEFAULT_COLLECTION_NAME = "OpenClaw养龙虾90天记录";
const DEFAULT_COLLECTION_INTRO = "记录 OpenClaw 这只龙虾连续 90 天的公开日更：本金、当前、进度、当天动作和规则修正。";

function usage() {
  console.error(
    "Usage: node ./src/build-public-snapshot.mjs <repo-root> <output.json> [--date=YYYY-MM-DD]"
  );
  process.exit(1);
}

function stripMd(value) {
  return value
    .replace(/!\[(.*?)\]\((.*?)\)/g, "")
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();
}

function hasCjk(value) {
  return /[\u3400-\u9fff]/.test(value);
}

function cleanText(value) {
  return stripMd(String(value ?? ""))
    .replace(/\s+/g, " ")
    .trim();
}

function pickPreferredText(value) {
  const text = cleanText(value);
  const parts = text.split(" / ").map((part) => part.trim()).filter(Boolean);
  const cjkParts = parts.filter(hasCjk);
  if (cjkParts.length > 0) {
    return cjkParts[cjkParts.length - 1];
  }

  return text;
}

function normalizeDecisionText(value) {
  return cleanText(value)
    .replace(/\bHOLD\s+无\b/giu, "HOLD")
    .replace(/\bHOLD\b/gu, "观望")
    .replace(/\bBUY\b/gu, "买入")
    .replace(/\bSELL\b/gu, "卖出")
    .replace(/\b观望\s+无\b/gu, "观望")
    .replace(/\b继续等待\s+无\b/gu, "继续等待")
    .trim();
}

function dedupeNarrative(value) {
  const clauses =
    String(value ?? "")
      .replace(/\s+/g, " ")
      .match(/[^。！？!?；;]+[。！？!?；;]?/gu) ?? [];
  const seen = new Set();
  const kept = [];

  for (const clause of clauses) {
    const normalized = cleanText(clause).replace(/[。！？!?；;]+$/u, "");
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (normalized.length >= 14 && seen.has(key)) {
      continue;
    }

    seen.add(key);
    kept.push(clause.trim());
  }

  return cleanText(kept.join(" "));
}

function sanitizePublicNarrative(value) {
  const replacements = [
    [/维持\s*comparison_stage\s*的\s*(?:继续等待|观望|HOLD)\s*结论/giu, "维持上一轮观望结论"],
    [/comparison_stage\s*首选已是\s*(?:继续等待|观望|HOLD)/giu, "上一轮比较阶段已经给出观望结论"],
    [/comparison_stage\s*已给出\s*(?:HOLD|观望)\s*为首选/giu, "上一轮比较阶段已经把观望列为首选"],
    [/comparison_stage/giu, "比较阶段"],
    [/latest_event_signals\.market_gate/giu, "市场门控"],
    [/recent_event_signals/giu, "近期事件信号"],
    [/latest_event_signals/giu, "最新事件信号"],
    [/quotes\[\]\.ev_after_fee_pct/giu, "候选的扣费后 EV"],
    [/ev_after_fee_pct/giu, "扣费后 EV"],
    [/fee-adjusted EV/giu, "扣费后 EV"],
    [/expected_win\/loss/giu, "盈亏期望"],
    [/expected pocket growth after fees/giu, "扣费后的净收益预期"],
    [/pocket growth after fees/giu, "扣费后的净收益预期"],
    [/expected edge/giu, "预期优势"],
    [/round-trip cost/giu, "往返交易成本"],
    [/win_prob/giu, "胜率"],
    [/proxy_edge_pct/giu, "代理优势"],
    [/blended_edge_pct/giu, "综合优势"],
    [/fee_floor_pct/giu, "手续费底线"],
    [/pocket_cash_hkd/giu, "可用现金"],
    [/min_trade_notional_hkd/giu, "最小交易金额"],
    [/min_residual_position_hkd/giu, "最小剩余持仓金额"],
    [/cash reserve/giu, "现金缓冲"],
    [/prefer_fewer_trades/giu, "减少交易次数规则"],
    [/block_new_buys\s*=\s*true/giu, "当前禁止新增买入"],
    [/block_new_buys/giu, "禁止新增买入"],
    [/neutral_earnings_caution/giu, "财报中性谨慎"],
    [/geopolitics_risk/giu, "地缘风险"],
    [/shipping_disruption/giu, "航运扰动"],
    [/local_guard/giu, "本地保护门槛"],
    [/\bgate\b/giu, "门控"],
    [/top candidates/giu, "靠前候选"],
    [/top_score/giu, "最高评分"],
    [/dry-run/giu, "快速评估"],
    [/plan_only/giu, "仅计划"],
    [/\bN\/A\b/gu, "暂无"],
    [/\s+/gu, " "]
  ];

  let text = pickPreferredText(value);
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  return dedupeNarrative(text)
    .replace(/\b观望\s+无\b/gu, "观望")
    .replace(/\b继续等待\s+无\b/gu, "继续等待")
    .trim();
}

function selectPublicContext(noTradeReason, reviewPlan) {
  const sanitizedNoTrade = sanitizePublicNarrative(noTradeReason);
  const sanitizedReview = sanitizePublicNarrative(reviewPlan);

  if (
    sanitizedReview &&
    (!sanitizedNoTrade || /尚未进入常规交易时段|集合竞价时段|非交易时段/u.test(sanitizedNoTrade))
  ) {
    return sanitizedReview;
  }

  return sanitizedNoTrade || sanitizedReview;
}

function parseCurrency(value) {
  const text = cleanText(value);
  const match = text.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const sign = /(^-|-\s*HKD|HKD\s*-|\(-)/i.test(text) ? -1 : 1;
  return sign * Number(match[0].replace(/,/g, ""));
}

function parseInteger(value) {
  const match = cleanText(value).match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function parseMarkdownTable(markdown) {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (lines.length < 2) {
    return [];
  }

  const splitRow = (line) =>
    line
      .slice(1, -1)
      .split("|")
      .map((cell) => stripMd(cell.trim()));

  const headers = splitRow(lines[0]);
  const rows = [];

  for (const line of lines.slice(2)) {
    if (!line.includes("|")) {
      continue;
    }

    const cells = splitRow(line);
    if (cells.length !== headers.length) {
      continue;
    }

    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index];
    });
    rows.push(row);
  }

  return rows;
}

function isPlaceholderCell(value) {
  const text = cleanText(value);
  return !text || text === "-" || text === "无" || text === "N/A";
}

function sectionBetween(markdown, startPattern, endPattern) {
  const startMatch = markdown.match(startPattern);
  if (!startMatch || startMatch.index == null) {
    return "";
  }

  const startIndex = startMatch.index + startMatch[0].length;
  const rest = markdown.slice(startIndex);
  const endMatch = endPattern ? rest.match(endPattern) : null;
  const endIndex = endMatch?.index ?? rest.length;
  return rest.slice(0, endIndex).trim();
}

function sectionByHeading(markdown, headingPrefix) {
  const escaped = headingPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sectionBetween(markdown, new RegExp(`^## .*${escaped}.*$`, "m"), /^## /m);
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
      continue;
    }

    files.push(entryPath);
  }

  return files;
}

async function getSortedReportPaths(repoRoot) {
  const files = await walkFiles(path.join(repoRoot, "docs/daily-reports"));
  return files.filter((file) => file.endsWith(".md") && !file.endsWith("/README.md")).sort();
}

async function getLatestReportPath(repoRoot) {
  return (await getSortedReportPaths(repoRoot)).at(-1);
}

async function getPreviousReportPath(repoRoot, targetDate) {
  const files = await getSortedReportPaths(repoRoot);
  const targetIndex = files.findIndex((file) => path.basename(file, ".md") === targetDate);
  return targetIndex > 0 ? files[targetIndex - 1] : null;
}

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseReadme(readme) {
  const currentDayMatch = readme.match(/\| Day \/ 当前天数 \| `?(\d+) ?(?:\/|of) ?(\d+)`?/);
  const startingCapitalMatch = readme.match(/\| Starting capital \/ 起始资金 \| `?([\d,]+) HKD`?/);
  const currentEquityMatch = readme.match(/\| Current equity \/ 当前权益 \| `?HKD ([\d,.-]+)`?/);
  const netPnlMatch = readme.match(/\| Net PnL \/ 累计盈亏 \| ([^\n|]+)/);
  const latestMoveMatch =
    readme.match(/\| Latest move \/ 最新动作 \| ([^\n|]+)/) ??
    readme.match(/\| Latest decision \/ 最新决策 \| ([^\n|]+)/);
  const publicStartMatch = readme.match(/Public operation day 1 .*: `(\d{4}-\d{2}-\d{2})`/);
  const updatedMatch = readme.match(/- Updated \/ 更新时间: ([^\n]+)/);
  const rawTitle = readme.match(/^# (.+)$/m)?.[1]?.trim() ?? DEFAULT_SERIES_NAME;
  const seriesName = stripMd(rawTitle)
    .replace(/\s*!\[.*$/, "")
    .replace(/\s+⭐$/, "")
    .trim();

  return {
    day: currentDayMatch ? Number(currentDayMatch[1]) : null,
    totalDays: currentDayMatch ? Number(currentDayMatch[2]) : DEFAULT_CHALLENGE_TOTAL_DAYS,
    startingCapitalHkd: startingCapitalMatch ? Number(startingCapitalMatch[1].replace(/,/g, "")) : null,
    currentEquityHkd: currentEquityMatch ? Number(currentEquityMatch[1].replace(/,/g, "")) : null,
    netPnlHkd: parseCurrency(netPnlMatch?.[1] ?? ""),
    latestMove: cleanText(latestMoveMatch?.[1] ?? ""),
    openedAt: publicStartMatch?.[1] ?? null,
    updatedAt: updatedMatch?.[1] ?? null,
    seriesName
  };
}

function resolveSeriesTemplate(templates, day) {
  const ordered = [...templates]
    .filter((item) => Number.isFinite(Number(item?.day)))
    .sort((a, b) => Number(a.day) - Number(b.day));
  const exact = ordered.find((item) => Number(item.day) === Number(day));
  if (exact) {
    return exact;
  }

  const reusable = ordered.filter((item) => Number(item.day) < 30);
  const pool = reusable.length > 0 ? reusable : ordered;
  if (pool.length === 0) {
    return null;
  }

  const index = ((Math.max(1, Number(day) || 1) - 1) % pool.length + pool.length) % pool.length;
  return pool[index];
}

function parseSessionSummary(report) {
  const block = sectionBetween(report, /^## Session Summary .*$/m, /^## Holdings Detail .*$/m);
  const lines = block.split("\n").filter((line) => line.trim().startsWith("- "));
  const result = {};

  for (const line of lines) {
    const match = line.match(/^- (.+?): (.+)$/);
    if (!match) {
      continue;
    }

    const key = stripMd(match[1]).split("/")[0].trim().toLowerCase();
    result[key] = cleanText(match[2]);
  }

  return result;
}

function parseSimpleBullets(block) {
  const lines = block.split("\n").filter((line) => line.trim().startsWith("- "));
  const result = {};

  for (const line of lines) {
    const match = line.match(/^- (.+?): (.+)$/);
    if (!match) {
      continue;
    }

    const key = stripMd(match[1]).split("/")[0].trim().toLowerCase();
    result[key] = cleanText(match[2]);
  }

  return result;
}

function parseLessons(shortMemory, targetDate) {
  const marker = `## ${targetDate}`;
  const startIndex = shortMemory.indexOf(marker);
  if (startIndex === -1) {
    return [];
  }

  const nextIndex = shortMemory.indexOf("\n## ", startIndex + marker.length);
  const block = shortMemory.slice(startIndex, nextIndex === -1 ? undefined : nextIndex);
  const lessonsStart = block.indexOf("**Lessons Learned / 提取教训**");
  if (lessonsStart === -1) {
    return [];
  }

  const lines = block
    .slice(lessonsStart + "**Lessons Learned / 提取教训**".length)
    .trim()
    .split("\n");
  const lessons = [];
  let current = null;

  for (const line of lines) {
    const lessonMatch = line.match(/^- \*\*(.+?)\*\*: (.+)$/);
    if (lessonMatch) {
      current = {
        headline: sanitizePublicNarrative(lessonMatch[2]),
        detail: sanitizePublicNarrative(lessonMatch[2]),
        type: stripMd(lessonMatch[1])
      };
      lessons.push(current);
      continue;
    }

    const tagsMatch = line.match(/Tags .*: (.+)$/);
    if (tagsMatch && current) {
      current.tags = tagsMatch[1]
        .split(",")
        .map((tag) => stripMd(tag).trim())
        .filter(Boolean);
    }
  }

  return lessons;
}

function getEarliestPublicDate(shortMemory, tracker) {
  const shortMemoryDates = [...shortMemory.matchAll(/^## (\d{4}-\d{2}-\d{2})$/gm)].map((match) => match[1]);
  const trackerRows = parseMarkdownTable(tracker);
  const trackerDates = trackerRows.map((row) => row.Date).filter(Boolean);
  const dates = [...shortMemoryDates, ...trackerDates].sort();
  return dates[0] ?? null;
}

function parseDurableLessons(longMemory, leadSymbol, targetDate) {
  const sections = longMemory.split(/^## /m).slice(1);
  const lessons = [];

  for (const section of sections) {
    const id = section.split("\n")[0].trim();
    const lessonMatch = section.match(/\*\*Lesson(?: \/ 教训)?\*\*: (.+)$/m);
    const scopeMatch = section.match(/\*\*Scope \/ 作用域\*\*: `?(.+?)`?$/m);
    const lastSeenMatch = section.match(/\*\*Last Seen \/ 最后出现\*\*: (.+)$/m);
    if (!lessonMatch) {
      continue;
    }

    lessons.push({
      id,
      lesson: sanitizePublicNarrative(lessonMatch[1]),
      scope: stripMd(scopeMatch?.[1] ?? ""),
      lastSeen: stripMd(lastSeenMatch?.[1] ?? "")
    });
  }

  return lessons
    .filter(
      (item) =>
        item.scope === leadSymbol ||
        item.lastSeen === targetDate ||
        item.scope === "portfolio" ||
        item.id.includes(leadSymbol) ||
        !item.scope
    )
    .slice(0, 3)
    .map((item) => item.lesson);
}

function parseTracker(tracker, targetDate, day) {
  const rows = parseMarkdownTable(tracker);
  const row =
    rows.find((item) => item.Date === targetDate) ??
    rows.find((item) => Number(item.Day) === day) ??
    {};

  return {
    chapterTitle: stripMd(row.Chapter ?? ""),
    publicHighlight: sanitizePublicNarrative(row["Public Highlight"] ?? "")
  };
}

function buildFallbackLessons({ durableLessons, noTrade, review }) {
  const lessons = durableLessons.slice(0, 2).map((lesson) => ({
    headline: lesson,
    detail: lesson,
    type: "durable"
  }));

  if (review.execution) {
    lessons.push({
      headline: `当日执行侧重点：${sanitizePublicNarrative(review.execution)}`,
      detail: sanitizePublicNarrative(review.execution),
      type: "review"
    });
  }

  if (lessons.length === 0 && noTrade.reason) {
    lessons.push({
      headline: `观望也会留下经验：${sanitizePublicNarrative(noTrade.reason)}`,
      detail: sanitizePublicNarrative(noTrade.reason),
      type: "discipline"
    });
  }

  return lessons.slice(0, 3);
}

function buildStrategy({ noTrade, review }) {
  return {
    summary: "有信号才推进，没优势就继续等。",
    entry_rule: "候选标的要先跑过预期收益和风控阈值，过线才允许自动下单。",
    risk_rule: "仓位一旦超限就自动减仓，同时强制保留机动现金。",
    hold_rule: "没有把握就不交易，空仓和小仓都算有效决策。",
    today_context: selectPublicContext(noTrade.reason, review.plan)
  };
}

function buildStory({ readmeInfo, trackerInfo, template, leadSymbol, lessons, durableLessons, targetDate }) {
  const titleSeeds = [
    `养龙虾第${readmeInfo.day}天｜OpenClaw stock更新`,
    `养龙虾第${readmeInfo.day}天｜OpenClaw stock继续等`,
    `养龙虾第${readmeInfo.day}天｜OpenClaw stock log`
  ];

  return {
    mascot_name: "OpenClaw",
    mascot_emoji: "🦞",
    persona: "一只每天更新 current、PnL 和 stock side 记录的龙虾 agent",
    series_hook: "每天 1 篇，直接看 OpenClaw 这只龙虾今天的 stock log。",
    chapter_title: trackerInfo.chapterTitle || template?.id || `Day ${readmeInfo.day}`,
    public_highlight: sanitizePublicNarrative(trackerInfo.publicHighlight || `${targetDate} 重点看 ${leadSymbol}。`),
    narrative_stage: template?.stage ?? "launch",
    creator_themes: [
      "养龙虾",
      "OpenClaw",
      "stock",
      "PnL",
      "current"
    ],
    audience_promises: [
      "每天更新 current、PnL、今天有没有动作和 learning",
      "每篇都能看懂今天为什么动，或者为什么继续等",
      "合集连看 90 天，更容易看出整个 stock side 怎么变化"
    ],
    learning_focus: "重点看 agent 今天修正了什么，又保留了什么纪律。",
    title_seeds: titleSeeds,
    hashtag_seeds: [
      "养龙虾",
      "OpenClaw",
      "stock",
      "PnL",
      "AIAgent"
    ],
    durable_lessons: durableLessons,
    collection_name: DEFAULT_COLLECTION_NAME,
    collection_intro: DEFAULT_COLLECTION_INTRO
  };
}

function buildAssets(repoRoot, outputFile) {
  const outputDir = path.dirname(outputFile);
  return [
    {
      kind: "cover",
      path: path.relative(outputDir, path.join(repoRoot, "docs/assets/social-preview.png")),
      caption: "OpenClaw social preview"
    }
  ];
}

function normalizeTimestamp(value, fallbackDate) {
  const text = cleanText(value);
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2}|Z)$/);
  if (direct) {
    return text;
  }

  const cst = text.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}).*?\(UTC([+-]\d{2}:\d{2})\)/);
  if (cst) {
    return `${cst[1]}T${cst[2]}${cst[3]}`;
  }

  const dateOnly = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) {
    return `${dateOnly[1]}T00:00:00+08:00`;
  }

  return `${fallbackDate}T00:00:00+08:00`;
}

async function main() {
  const [repoRootArg, outputArg, ...restArgs] = process.argv.slice(2);
  if (!repoRootArg || !outputArg) {
    usage();
  }

  const repoRoot = path.resolve(process.cwd(), repoRootArg);
  const outputFile = path.resolve(process.cwd(), outputArg);
  const dateArg = restArgs.find((arg) => arg.startsWith("--date="))?.slice("--date=".length);
  const templates = JSON.parse(await fs.readFile(templatePath, "utf8"));

  const latestReportPath = dateArg
    ? path.join(repoRoot, "docs", "daily-reports", dateArg.slice(0, 4), `${dateArg}.md`)
    : await getLatestReportPath(repoRoot);

  if (!latestReportPath) {
    throw new Error("Could not find a daily report to build from.");
  }

  const targetDate = dateArg ?? path.basename(latestReportPath, ".md");
  const year = targetDate.slice(0, 4);
  const previousReportPath = await getPreviousReportPath(repoRoot, targetDate);
  const readmePath = path.join(repoRoot, "README.md");
  const monitorPath = path.join(repoRoot, "docs", "public-monitor", year, `${targetDate}.md`);
  const shortMemoryPath = path.join(repoRoot, "docs", "public-memory", "short-memory.md");
  const longMemoryPath = path.join(repoRoot, "docs", "public-memory", "long-memory.md");
  const trackerPath = path.join(repoRoot, "docs", "challenge-tracker.md");

  const [readme, report, previousReport, monitor, shortMemory, longMemory, tracker] = await Promise.all([
    fs.readFile(readmePath, "utf8"),
    fs.readFile(latestReportPath, "utf8"),
    readIfExists(previousReportPath),
    readIfExists(monitorPath),
    fs.readFile(shortMemoryPath, "utf8"),
    fs.readFile(longMemoryPath, "utf8"),
    fs.readFile(trackerPath, "utf8")
  ]);

  const readmeInfo = parseReadme(readme);
  const reportHeaderMatch = report.match(/^# Day (\d+) \/ (\d+) - (.+)$/m);
  const day = reportHeaderMatch ? Number(reportHeaderMatch[1]) : readmeInfo.day;
  const reportTotalDays = reportHeaderMatch ? Number(reportHeaderMatch[2]) : null;
  const totalDays = Math.max(
    DEFAULT_CHALLENGE_TOTAL_DAYS,
    Number(readmeInfo.totalDays ?? 0),
    Number(reportTotalDays ?? 0)
  );
  const chapterTitle = stripMd(reportHeaderMatch?.[3] ?? "");
  const sessionSummary = parseSessionSummary(report);
  const holdingsRows = parseMarkdownTable(
    sectionBetween(report, /^## Holdings Detail .*$/m, /^## Trade Activity .*$/m)
  );
  const tradeRows = parseMarkdownTable(sectionBetween(report, /^## Trade Activity .*$/m, /^## Trade Rationale .*$/m)).filter(
    (row) => !isPlaceholderCell(row.Action) && !isPlaceholderCell(row.Symbol)
  );
  const noTrade = parseSimpleBullets(
    sectionBetween(report, /^## Latest No-Trade Window .*$/m, /^## Review .*$/m)
  );
  const leadSymbol =
    stripMd(holdingsRows[0]?.Symbol ?? "") ||
    stripMd(tradeRows[tradeRows.length - 1]?.Symbol ?? "") ||
    stripMd(sessionSummary["latest decision"] ?? "").replace(/\[.*?\]\s*/, "") ||
    "BABA";
  const durableLessons = parseDurableLessons(longMemory, leadSymbol, targetDate);
  const review = parseSimpleBullets(sectionBetween(report, /^## Review .*$/m, null));
  const lessons = parseLessons(shortMemory, targetDate);
  const finalLessons = lessons.length > 0 ? lessons : buildFallbackLessons({ durableLessons, noTrade, review });
  const trackerInfo = parseTracker(tracker, targetDate, day);
  const template = resolveSeriesTemplate(templates, day);
  const monitorBullets = monitor ? parseSimpleBullets(sectionBetween(monitor, /^## Latest Decision .*$/m, null)) : {};
  const previousSessionSummary = previousReport ? parseSessionSummary(previousReport) : {};
  const currentEquity =
    parseCurrency(sessionSummary["current equity"]) ?? readmeInfo.currentEquityHkd ?? parseCurrency(noTrade["equity"]);
  const startingCapital = readmeInfo.startingCapitalHkd ?? 10000;
  const netPnl = parseCurrency(sessionSummary["net pnl"]) ?? readmeInfo.netPnlHkd ?? currentEquity - startingCapital;
  const previousEquity = parseCurrency(previousSessionSummary["current equity"]);
  const dailyPnl = Number(((previousEquity == null ? netPnl : currentEquity - previousEquity) ?? 0).toFixed(2));
  const dailyPnlPct =
    previousEquity && previousEquity !== 0
      ? Number((dailyPnl / previousEquity).toFixed(4))
      : Number((netPnl / startingCapital).toFixed(4));
  const snapshotAtLine =
    sessionSummary["last snapshot"] ??
    monitor?.match(/Updated \/ 更新时间: ([^\n]+)/)?.[1] ??
    readmeInfo.updatedAt ??
    `${targetDate} 23:59:00 CST (UTC+08:00)`;
  const snapshotAt = normalizeTimestamp(snapshotAtLine, targetDate);
  const openedAt = readmeInfo.openedAt ?? getEarliestPublicDate(shortMemory, tracker) ?? targetDate;

  const publicSnapshot = {
    version: 1,
    challenge: {
      id: "openclaw-90d",
      series_name: readmeInfo.seriesName,
      day,
      total_days: totalDays,
      timezone: "Asia/Shanghai",
      opened_at: openedAt,
      source_repo: path.basename(repoRoot)
    },
    snapshot_at: snapshotAt,
    market: {
      primary: "US"
    },
    performance: {
      starting_capital_hkd: startingCapital,
      current_equity_hkd: currentEquity,
      net_pnl_hkd: netPnl,
      net_pnl_pct: startingCapital ? Number((netPnl / startingCapital).toFixed(4)) : 0,
      daily_pnl_hkd: dailyPnl,
      daily_pnl_pct: dailyPnlPct
    },
    strategy: buildStrategy({ noTrade, review }),
    session: {
      research_cycles: parseInteger(sessionSummary["research cycles"]),
      order_submissions: parseInteger(sessionSummary["order submissions"]),
      filled_trades: parseInteger(sessionSummary["filled trades"]),
      latest_decision: normalizeDecisionText(
        pickPreferredText(sessionSummary["latest decision"] ?? monitorBullets.decision ?? readmeInfo.latestMove)
      ),
      latest_action_symbol: stripMd(tradeRows[tradeRows.length - 1]?.Symbol ?? leadSymbol),
      latest_no_trade_reason: selectPublicContext(
        (noTrade.reason ?? monitorBullets["no-trade rationale"] ?? "").replace(/\bHOLD\b/gu, "继续等待"),
        review.plan
      ),
      next_watch: sanitizePublicNarrative(noTrade.watch ?? monitorBullets["watch next"] ?? review.watch ?? "")
    },
    holdings: holdingsRows.map((row) => ({
      symbol: stripMd(row.Symbol ?? ""),
      qty: Number(stripMd(row.Qty ?? "0")),
      value_hkd: parseCurrency(row.Value ?? "0"),
      floating_pnl_hkd: parseCurrency(row["Floating PnL"] ?? "0"),
      status: stripMd(row.Status ?? "")
    })),
    trades: tradeRows.map((row) => ({
      time: stripMd(row.Time ?? "").replace(" CST (UTC+08:00)", "+08:00").replace(" ", "T"),
      action: stripMd(row.Action ?? ""),
      symbol: stripMd(row.Symbol ?? ""),
      qty: Number(stripMd(row.Qty ?? "0")),
      avg_fill: Number(stripMd(row["Avg Fill"] ?? "0")),
      rationale: sanitizePublicNarrative(row["Timing Rationale / 时机理由"] ?? "")
    })),
    lessons: finalLessons.map((lesson) => ({
      headline: lesson.headline,
      detail: lesson.detail,
      type: lesson.type
    })),
    source_refs: [
      path.relative(path.dirname(outputFile), readmePath),
      path.relative(path.dirname(outputFile), latestReportPath),
      monitor ? path.relative(path.dirname(outputFile), monitorPath) : null,
      path.relative(path.dirname(outputFile), shortMemoryPath),
      path.relative(path.dirname(outputFile), longMemoryPath),
      path.relative(path.dirname(outputFile), trackerPath)
    ].filter(Boolean),
    assets: buildAssets(repoRoot, outputFile),
    story: buildStory({
      readmeInfo: { ...readmeInfo, day },
      trackerInfo: {
        chapterTitle: trackerInfo.chapterTitle || chapterTitle,
        publicHighlight: trackerInfo.publicHighlight
      },
      template,
      leadSymbol,
      lessons: finalLessons,
      durableLessons,
      targetDate
    })
  };

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(publicSnapshot, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outputFile}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
