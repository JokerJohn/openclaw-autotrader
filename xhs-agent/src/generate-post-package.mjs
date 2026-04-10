import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultTemplatePath = path.resolve(scriptDir, "../templates/30-day-series.json");
const feedbackStrategyPath = path.resolve(scriptDir, "../state/xhs-feedback-strategy.json");
const analyticsStatePath = path.resolve(scriptDir, "../state/xhs-note-analytics.latest.json");
const fallbackAssetPath = path.resolve(scriptDir, "../../docs/assets/social-preview.png");
const supportedAssetExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const defaultDisclaimer = "";
const SERIES_RECORD_LABEL = "90天记录";

function usage() {
  console.error(
    "Usage: node ./src/generate-post-package.mjs <public-snapshot.json> <output.json> [template.json]"
  );
  process.exit(1);
}

function sentence(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function plainSentence(value) {
  return sentence(value).replace(/[。.!！?？]+$/u, "");
}

function truncateText(value, max) {
  const text = sentence(value);
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

function hashToUint32(seed) {
  const digest = crypto.createHash("sha256").update(String(seed ?? "")).digest();
  return digest.readUInt32BE(0);
}

function createSeededRng(seed) {
  let state = hashToUint32(seed) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick(rng, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  return items[Math.floor(rng() * items.length)] ?? items[0];
}

function maybe(rng, probability) {
  return rng() < probability;
}

function sanitizeHashtag(value) {
  return sentence(value)
    .replace(/^#+/u, "")
    .replace(/\[话题\]/gu, "")
    .replace(/\s+/gu, "");
}

function formatMoney(value) {
  const amount = Number(value ?? 0);
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${sign}HKD ${Math.abs(amount).toFixed(2)}`;
}

function formatMoneyWithoutSign(value) {
  return `HK$ ${Math.abs(Number(value ?? 0)).toFixed(2)}`;
}

function formatPercent(value) {
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  const sign = normalized > 0 ? "+" : normalized < 0 ? "-" : "";
  return `${sign}${Math.abs(normalized).toFixed(2)}%`;
}

function formatQty(value) {
  return Number(Number(value ?? 0).toFixed(3))
    .toString()
    .replace(/\.0+$/u, "");
}

function formatFill(value) {
  return Number(value ?? 0).toFixed(2);
}

function formatClock(value) {
  const text = sentence(value);
  if (!text) {
    return "--:--";
  }

  const match = text.match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? text.slice(11, 16) ?? "--:--";
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function nextMorning(snapshotAt) {
  const [, datePart, offset = "+08:00"] =
    snapshotAt.match(/^(\d{4}-\d{2}-\d{2})T.*([+-]\d{2}:\d{2}|Z)$/) ?? [];

  if (!datePart) {
    return snapshotAt;
  }

  const [year, month, day] = datePart.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = next.getUTCFullYear();
  const nextMonth = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(next.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}T09:00:00${offset}`;
}

function buildLeadSymbol(snapshot) {
  return (
    snapshot.session.latest_action_symbol ??
    snapshot.holdings[0]?.symbol ??
    snapshot.trades[0]?.symbol ??
    "观察中"
  );
}

function normalizeDecision(value) {
  return sentence(value)
    .replace(/\s+无$/u, "")
    .replace(/\bHOLD\b/gu, "观望")
    .trim() || "继续等待";
}

function dedupeNarrative(value) {
  const clauses =
    String(value ?? "")
      .replace(/\s+/g, " ")
      .match(/[^。！？!?；;\n]+[。！？!?；;]?/gu) ?? [];
  const seen = new Set();
  const kept = [];

  for (const clause of clauses) {
    const normalized = sentence(clause).replace(/[。！？!?；;]+$/u, "");
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

  return sentence(kept.join(" "));
}

function sanitizePublicText(value) {
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
    [/expected edge/giu, "预期优势"],
    [/round-trip cost/giu, "往返交易成本"],
    [/win_prob/giu, "胜率"],
    [/proxy_edge_pct/giu, "代理优势"],
    [/blended_edge_pct/giu, "综合优势"],
    [/fee_floor_pct/giu, "手续费底线"],
    [/pocket_cash_hkd/giu, "可用现金"],
    [/min_trade_notional_hkd/giu, "最小交易金额"],
    [/min_residual_position_hkd/giu, "最小剩余持仓金额"],
    [/block_new_buys\s*=\s*true/giu, "当前禁止新增买入"],
    [/block_new_buys/giu, "禁止新增买入"],
    [/neutral_earnings_caution/giu, "财报中性谨慎"],
    [/geopolitics_risk/giu, "地缘风险"],
    [/shipping_disruption/giu, "航运扰动"],
    [/\bgate\b/giu, "门控"],
    [/dry-run/giu, "快速评估"],
    [/\bHOLD\s+无\b/giu, "观望"],
    [/\bHOLD\b/gu, "观望"],
    [/\s+/gu, " "]
  ];

  let text = sentence(value);
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  return dedupeNarrative(text).replace(/\b观望\s+无\b/gu, "观望").trim();
}

function compressNoTradeReason(value) {
  const raw = sentence(value);
  if (!raw) {
    return "没优势就继续等，别为了更新硬做。";
  }

  if (/negative fee-adjusted expectancy|min_expected_edge_multiple_roundtrip_cost|round-trip trading cost|net-profit-after-fees/i.test(raw)) {
    return "当前候选都没跑赢手续费和安全边际，最优动作还是继续等。";
  }

  if (/high-volatility|volatility regime/i.test(raw)) {
    return "当前波动太脏，先不扩动作。";
  }

  if (/market closed|outside trading hours|non-trading|非交易时段|未开盘/i.test(raw)) {
    return "当前不在可执行时段，先不硬做。";
  }

  if (/top_score|机会评分不足|score=-/i.test(raw)) {
    return sanitizePublicText(raw);
  }

  return sanitizePublicText(raw);
}

function buildVoiceProfile(analytics, feedbackStrategy) {
  const notes = (analytics?.notes ?? []).filter((note) => sentence(note?.body).length > 0);
  const sourceNotes = notes.filter((note) => !/养龙虾第\d+天|OpenClaw/iu.test(sentence(note?.title)));
  const corpus = sourceNotes.length > 0 ? sourceNotes : notes;
  const total = corpus.length || 1;
  const countMatches = (pattern) => corpus.filter((note) => pattern.test(`${note.title ?? ""}\n${note.body ?? ""}`)).length;
  const englishMixRatio = countMatches(/\bSLAM\b|\bopenclaw\b|\bOpenClaw\b|\bPnL\b|\bcurrent\b|\bstock\b|\bbase\b|\bwlb\b/i) / total;
  const directRatio = countMatches(/^(如题|最近|今天|先|直接|目前|港校|SLAMer|做SLAMer)/mu) / total;
  const listRatio = countMatches(/1[.、]|1️⃣|①/u) / total;
  const selfMockRatio = countMatches(/延毕|待业|卷不动|黑化|精神状态|没前途|求职/u) / total;

  const toneTraits = [
    englishMixRatio >= 0.45 ? "中英自然混写" : "中文直给",
    directRatio >= 0.18 ? "开头先抛结论" : "先铺场景再落结论",
    listRatio >= 0.15 ? "喜欢清单化表达" : "偏短段落表达",
    selfMockRatio >= 0.3 ? "有轻微自嘲和活人感" : "克制冷静"
  ];
  const persona = feedbackStrategy?.creator_persona ?? {};
  const personaVoiceTraits = Array.isArray(persona.voice_traits) ? persona.voice_traits : [];
  const hasSelfMockPersona = personaVoiceTraits.some((item) => /自嘲|幽默|调侃/u.test(String(item)));
  const hasDiaryPersona = personaVoiceTraits.some((item) => /记录式|日记/u.test(String(item)));
  const hasDirectPersona = personaVoiceTraits.some((item) => /直白|坦诚|直给/u.test(String(item)));

  return {
    source_note_count: corpus.length,
    english_mix_ratio: Number(englishMixRatio.toFixed(2)),
    direct_ratio: Number(directRatio.toFixed(2)),
    list_ratio: Number(listRatio.toFixed(2)),
    self_mock_ratio: Number(selfMockRatio.toFixed(2)),
    tone_traits: [...toneTraits, ...personaVoiceTraits].slice(0, 8),
    titleTemplates: [
      "养龙虾{day}｜OpenClaw{state}",
      "养龙虾{day}｜OpenClaw今天{state}",
      "养龙虾{day}，OpenClaw{state}",
      "养龙虾{day}｜今天{state}，OpenClaw继续记"
    ],
    resultOpeners: [
      "如题，今天先报账。",
      "先更新结果，不拐弯。",
      "今天这篇先把数字摆出来。",
      "先记账，别的后面再说。"
    ],
    resultMiddleNoTrade: [
      "今天没动，但该看的条件我都盯了一遍。",
      "今天是 0 fill，不过不是发呆，是在守条件。",
      "今天没下手，主要在看链路和卡点。",
      "动作没发生，但我没有离场。"
    ],
    resultMiddleTrade: [
      "今天有动作，但 size 还是压着走。",
      "今天有 fill，不过我没把手放太大。",
      "今天确实动了，但更多是在确认执行端。",
      "今天有几笔动作，先看链路有没有掉。"
    ],
    holdingClosers: [
      "手里先留 {holding}，今天不乱切。",
      "仓位先挂着 {holding}，我没再折腾。",
      "当前位置就先放 {holding}，够了。",
      "今天先留 {holding}，别把节奏搞坏。"
    ],
    emptyClosers: [
      "仓位先空着，不为了更新硬做。",
      "今天还是空仓，这种日子把手收住更值钱。",
      "账上先空着，忍住不乱上也是进度。",
      "今天先空着，手痒也得忍。"
    ],
    noTradeOpeners: [
      "我今天就是盯条件，没过线就直接 skip。",
      "今天这种盘面，硬上真没必要。",
      "这天没有博弈空间，我的处理很直接：不过线，不出手。",
      "今天没想证明什么，条件不够就停。"
    ],
    noTradeClosers: [
      "这种 0 操作的日子，反而最考验手痒。",
      "表面上没动作，但这种时候最能看出规则硬不硬。",
      "没 fill 不等于没产出，至少节奏没被我做坏。",
      hasSelfMockPersona ? "这种日子再手痒，也不能把自己做黑化。": "这种日子先稳住，比硬做一单值钱。"
    ],
    tradeOpeners: [
      "今天主看 {symbol}，我先小 size 走一遍链路。",
      "我今天主要盯 {symbol}，先做一笔小动作确认执行没掉链子。",
      "今天轮到 {symbol}，我先小仓位试，不急着放大。",
      "今天的注意力基本都在 {symbol}，先小量推进。"
    ],
    tradeClosers: [
      "重点不是赌一把，是确认执行端能顺着跑完。",
      "这类日子先看执行质量，不急着把单日数字想太满。",
      "先把链路跑通，再谈后面能不能放大。",
      hasDiaryPersona ? "今天更像记一次有效更新，不像冲动出手。": "今天更像打样，不像梭哈。"
    ],
    ledgerOpeners: [
      "今日记录我单独放一下：",
      "stock log 放这里：",
      "数字拆开记会更清楚：",
      "今天的记录就这几行："
    ],
    hookTemplates: [
      "如题，Day {day} 先更新，今天 {state}。",
      "养龙虾 Day {day}，先把账放出来。",
      "今天这篇不讲大道理，先报结果。",
      hasDirectPersona ? "今天先更新，结果和动作都直接放前面。": "Day {day} 先更新，今天是 {state}。"
    ],
    coverModes: ["ledger", "chapter", "signal"]
  };
}

function describeHoldings(snapshot) {
  if (!snapshot.holdings?.length) {
    return "none";
  }

  const holding = snapshot.holdings[0];
  return `${holding.symbol} ${formatQty(holding.qty)}`;
}

function describeTradeCount(snapshot) {
  return `${snapshot.session.filled_trades ?? 0} 笔`;
}

function formatTemplate(text, values) {
  return String(text ?? "").replace(/\{(\w+)\}/g, (_, key) => values?.[key] ?? "");
}

function buildHumanPulse(snapshot, rng) {
  const trades = Number(snapshot.session.filled_trades ?? 0);
  if (trades > 0) {
    return pick(rng, [
      "今天更像打样，不像拼命冲结果。",
      "先把执行链路跑顺，比单日数字更重要。",
      "有动作的一天，最怕的是手比规则快。",
      "今天不是猛冲的一天，重点还是动作质量。"
    ]);
  }

  return pick(rng, [
    "这种 0 操作的日子，反而最考验手痒。",
    "没动作不代表没内容，至少我没把节奏做坏。",
    "不下手的时候，规则反而更容易暴露问题。",
    "今天看着平，但守住不乱动本身就是进度。"
  ]);
}

function buildNumberedLabel(baseLabel, styleSet, index) {
  const prefix = styleSet[index] ?? `${index + 1}.`;
  return `${prefix} ${baseLabel}`;
}

function buildResultSection(snapshot, voiceProfile, rng) {
  const actions = snapshot.session.filled_trades ?? 0;
  const holding = describeHoldings(snapshot);
  const dailyPnlValue = Number(snapshot.performance.daily_pnl_hkd ?? 0);
  const dailyPnl = formatMoney(snapshot.performance.daily_pnl_hkd);
  const equity = formatMoneyWithoutSign(snapshot.performance.current_equity_hkd);
  const opener = pick(rng, voiceProfile.resultOpeners);
  const actionLine =
    actions > 0
      ? `${pick(rng, voiceProfile.resultMiddleTrade)} 今天做了 ${actions} 次操作，research 跑了 ${snapshot.session.research_cycles ?? 0} 轮。`
      : `${pick(rng, voiceProfile.resultMiddleNoTrade)} research 跑了 ${snapshot.session.research_cycles ?? 0} 轮。`.replace(
          "。 research",
          "，research"
        );
  const holdingLine =
    holding === "none"
      ? pick(rng, voiceProfile.emptyClosers)
      : formatTemplate(pick(rng, voiceProfile.holdingClosers), { holding });

  return [
    `${opener}今天 ${dailyPnlValue >= 0 ? "小盈" : "小亏"} ${dailyPnl}，current 落在 ${equity}。`,
    actionLine,
    holdingLine
  ].join("\n");
}

function buildStrategySection(snapshot, leadSymbol, voiceProfile, rng) {
  if (!snapshot.trades?.length) {
    const noTradeReason = compressNoTradeReason(
      snapshot.session.latest_no_trade_reason || "没优势就继续等，别为了更新硬做。"
    );
    return [
      pick(rng, voiceProfile.noTradeOpeners).trim(),
      `具体卡点是：${truncateText(noTradeReason, 54)}`,
      pick(rng, voiceProfile.noTradeClosers)
    ].join("\n");
  }

  return [
    formatTemplate(pick(rng, voiceProfile.tradeOpeners), { symbol: leadSymbol }),
    pick(rng, [
      "有 signal 我才推，没边际就停。",
      "今天不是冲结果，是先确认这笔动作值不值得做。",
      "能做不等于该做，今天还是先看动作质量。",
      "这笔能推下去的前提，是规则先点头。"
    ]),
    pick(rng, voiceProfile.tradeClosers)
  ].join("\n");
}

function buildTradeSection(snapshot, voiceProfile, rng) {
  const opener = pick(rng, voiceProfile.ledgerOpeners);
  const holding = describeHoldings(snapshot);
  const line1 = [
    `start ${formatMoneyWithoutSign(snapshot.performance.starting_capital_hkd)}`,
    `current ${formatMoneyWithoutSign(snapshot.performance.current_equity_hkd)}`,
    `net ${formatMoney(snapshot.performance.net_pnl_hkd)}`
  ].join(" | ");
  const line2 = [
    `today ${snapshot.session.filled_trades ?? 0} 次操作`,
    holding === "none" ? "当前空仓" : `当前 ${holding}`
  ].join(" | ");
  return [opener, line1, line2].join("\n");
}

function naturalizeLesson(lesson) {
  const replacements = [
    [/现金不足|现金太少/gu, "现金 buffer 太薄"],
    [/后续决策与轮动/gu, "后面选择空间"],
    [/必须保留至少20%机动现金/gu, "20% buffer 还是得留"],
    [/至少20%机动现金/gu, "20% buffer"],
    [/需要实时行情或明确的开盘状态才能进入实盘决策，缺行情时不要强行交易。?/gu, "没实时输入就别硬上。"],
    [/实时行情或明确的开盘状态/gu, "实时输入"],
    [/实盘决策/gu, "继续跑"],
    [/强行交易/gu, "硬上"],
    [/换汇失败/gu, "前置步骤掉链子"],
    [/目标币种已到账/gu, "状态确认完成"],
    [/股票下单/gu, "下一步"],
    [/订单提交/gu, "提交"],
    [/成交/gu, "操作"],
    [/买入后的延续较弱/gu, "后续延续一般"],
    [/不要继续追高/gu, "别继续追"],
    [/当日记录到 0 笔动作、0 次动作提交。?/gu, "今天 0 操作，忍住不动也算有效输出。"],
    [/当日记录到 1 笔成交、1 次订单提交。?/gu, "今天 1 次操作，链路是通的。"],
    [/当日记录到 \d+ 笔成交、\d+ 次订单提交。?/gu, "今天有动作，但先把链路跑顺更重要。"]
  ];
  let text = plainSentence(sanitizePublicText(lesson?.headline ?? lesson?.detail ?? ""));
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  text = text
    .replace(/现金 buffer 太薄会直接阻断后面选择空间，必须保留至少留 20% buffer/gu, "现金 buffer 太薄，20% buffer 还是得留")
    .replace(/要输入得先完整才能进入继续跑，缺行情时不要硬上/gu, "没实时输入就别硬上")
    .replace(/当日记录到 1 笔fill、1 次提交/gu, "今天 1 次 fill，链路是通的")
    .replace(/当日记录到 0 笔fill、0 次提交/gu, "今天 0 fill，忍住不动也算有效输出")
    .replace(/当日记录到 \d+ 笔fill、\d+ 次提交/gu, "今天有动作，但先把链路跑顺更重要");
  return truncateText(
    text.replace(/^当日执行侧重点[:：]/u, "").replace(/^观望也会留下经验[:：]/u, "").replace(/^需要/u, "要").trim(),
    42
  );
}

function buildSections(snapshot, leadSymbol, voiceProfile, rng) {
  const numbering = pick(rng, [
    ["1️⃣", "2️⃣", "3️⃣"],
    ["①", "②", "③"],
    ["1.", "2.", "3."]
  ]);
  return [
    {
      label: buildNumberedLabel("今天结果", numbering, 0),
      text: buildResultSection(snapshot, voiceProfile, rng)
    },
    {
      label: buildNumberedLabel("今天怎么做", numbering, 1),
      text: buildStrategySection(snapshot, leadSymbol, voiceProfile, rng)
    },
    {
      label: buildNumberedLabel("今日记录", numbering, 2),
      text: buildTradeSection(snapshot, voiceProfile, rng)
    }
  ];
}

function buildHooks(snapshot, voiceProfile, rng) {
  const state = Number(snapshot.performance.daily_pnl_hkd) >= 0 ? "小盈" : "小亏";
  return [
    formatTemplate(pick(rng, voiceProfile.hookTemplates), { day: snapshot.challenge.day, state }).trim(),
    buildHumanPulse(snapshot, rng)
  ]
    .filter(Boolean)
    .slice(0, 2);
}

function buildPnlStateLabel(snapshot) {
  const dailyPnl = Number(snapshot.performance.daily_pnl_hkd ?? 0);
  if (dailyPnl >= 0.01) {
    return "小盈";
  }
  if (dailyPnl <= -150) {
    return "大亏";
  }
  if (dailyPnl < -0.01) {
    return "小亏";
  }
  return "持平";
}

function buildTitle(snapshot, voiceProfile, rng) {
  const dayLabel = snapshot.challenge.day < 10 ? `第${snapshot.challenge.day}天` : `${snapshot.challenge.day}天`;
  const state = buildPnlStateLabel(snapshot);
  const templates = voiceProfile.titleTemplates ?? ["养龙虾{day}｜OpenClaw{state}"];
  return formatTemplate(pick(rng, templates), { day: dayLabel, state });
}

function buildHashtags(snapshot, feedbackStrategy) {
  const preferred = [
    "slam",
    "机器人",
    "养龙虾",
    "小龙虾",
    "OpenClaw",
    "AIAgent",
    "openclaw",
    "养虾的正确打开方式"
  ];

  return [...new Set(preferred.map((item) => `#${sanitizeHashtag(item)}`))]
    .filter((item) => item.length > 1)
    .slice(0, 8);
}

function buildCoverText(snapshot, coverMode, rng) {
  const options = {
    ledger: [
      `养龙虾\nDay ${snapshot.challenge.day}\n${SERIES_RECORD_LABEL}`,
      `OpenClaw\nDay ${snapshot.challenge.day}\n先记账`,
      `养龙虾\nDay ${snapshot.challenge.day}\n今日进度`
    ],
    chapter: [
      `养龙虾\nDay ${snapshot.challenge.day}\n今天更新`,
      `OpenClaw\nDay ${snapshot.challenge.day}\n继续跑`,
      `养龙虾\nDay ${snapshot.challenge.day}\n当天小结`
    ],
    signal: [
      `养龙虾\nDay ${snapshot.challenge.day}\n看执行`,
      `OpenClaw\nDay ${snapshot.challenge.day}\n守纪律`,
      `养龙虾\nDay ${snapshot.challenge.day}\n链路日志`
    ]
  };
  return pick(rng, options[coverMode] ?? options.ledger);
}

function buildNetPnlLabel(value) {
  const amount = Number(value ?? 0);
  const prefix = amount >= 0 ? "Profit" : "Loss";
  return `${prefix} ${formatMoneyWithoutSign(amount)}`;
}

function buildMoveLabel(snapshot) {
  const decision = normalizeDecision(snapshot.session.latest_decision);
  const symbol = buildLeadSymbol(snapshot);
  if (decision === "HOLD") {
    return "继续等待";
  }

  return `${decision} ${symbol}`.trim();
}

function buildCoverSvg(snapshot, coverMode, rng) {
  const progress = Number(((snapshot.challenge.day / snapshot.challenge.total_days) * 100).toFixed(1));
  const dayText = `Day ${snapshot.challenge.day} / ${snapshot.challenge.total_days}`;
  const episode = truncateText(snapshot.story?.chapter_title ?? `Day ${snapshot.challenge.day}`, 22);
  const status = snapshot.session.filled_trades > 0 ? "进行中" : "等待中";
  const researchCycles = String(snapshot.session.research_cycles ?? 0);
  const fills = String(snapshot.session.filled_trades ?? 0);
  const current = formatMoneyWithoutSign(snapshot.performance.current_equity_hkd);
  const pnl = formatMoney(snapshot.performance.net_pnl_hkd);
  const start = formatMoneyWithoutSign(snapshot.performance.starting_capital_hkd);
  const leadSymbol = buildLeadSymbol(snapshot);
  const theme = {
    ledger: {
      accentStart: "#FF9549",
      accentEnd: "#D6541E",
      badge: "90-DAY PUBLIC LOG",
      headlineA: "90-Day OpenClaw",
      headlineB: "daily ledger",
      subline: "先看 current、PnL，再看今天有没有动作。",
      footerTitle: "养龙虾 · OpenClaw · 90天记录",
      footer: "养龙虾 / OpenClaw / 90天记录"
    },
    chapter: {
      accentStart: "#6DD3C7",
      accentEnd: "#0E9F8A",
      badge: "OPENCLAW DAILY NOTE",
      headlineA: "OpenClaw",
      headlineB: "chapter log",
      subline: "每天一篇，记录进度、动作和当天修正。",
      footerTitle: "养龙虾 · OpenClaw · 当天小结",
      footer: "养龙虾 / OpenClaw / 当天小结"
    },
    signal: {
      accentStart: "#F7B955",
      accentEnd: "#D77A1F",
      badge: "HUMAN-RUN SERIES",
      headlineA: "OpenClaw",
      headlineB: "signal diary",
      subline: "不追模板感，按当天状态写清楚结果和判断。",
      footerTitle: "养龙虾 · OpenClaw · 今日进度",
      footer: "养龙虾 / OpenClaw / 今日进度"
    }
  }[coverMode] ?? {
    accentStart: "#FF9549",
    accentEnd: "#D6541E",
    badge: "90-DAY PUBLIC LOG",
    headlineA: "90-Day OpenClaw",
    headlineB: "daily ledger",
    subline: "先看 current、PnL，再看今天有没有动作。",
    footerTitle: "养龙虾 · OpenClaw · 90天记录",
    footer: "养龙虾 / OpenClaw / 90天记录"
  };
  const footer = theme.footer;
  const pulse = truncateText(buildHumanPulse(snapshot, rng), 26);

  return `<svg width="1080" height="1440" viewBox="0 0 1080 1440" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="82" y1="72" x2="1016" y2="1368" gradientUnits="userSpaceOnUse">
      <stop stop-color="#071B2C"/>
      <stop offset="1" stop-color="#173552"/>
    </linearGradient>
    <linearGradient id="card" x1="92" y1="720" x2="980" y2="1308" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0D2640"/>
      <stop offset="1" stop-color="#102A43"/>
    </linearGradient>
    <linearGradient id="accent" x1="706" y1="148" x2="1010" y2="460" gradientUnits="userSpaceOnUse">
      <stop stop-color="${theme.accentStart}"/>
      <stop offset="1" stop-color="${theme.accentEnd}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1440" rx="40" fill="url(#bg)"/>
  <circle cx="874" cy="246" r="126" fill="#0D2741" opacity="0.72"/>
  <circle cx="962" cy="396" r="178" fill="#102A43" opacity="0.92"/>
  <path d="M742 448C790 344 900 278 996 286C1082 294 1146 368 1156 464C1074 506 962 504 872 462C816 436 768 430 742 448Z" fill="url(#accent)"/>
  <path d="M792 288C828 240 884 212 932 216C922 262 892 300 844 326C800 350 748 344 720 326C738 308 760 300 792 288Z" fill="#FFB977"/>
  <path d="M930 520C980 568 1048 586 1112 578C1076 634 1012 668 938 670C862 672 792 642 754 602C812 594 878 572 930 520Z" fill="#FFB977"/>
  <rect x="92" y="84" width="310" height="46" rx="23" fill="#0E2943"/>
  <text x="124" y="114" fill="#FFB06B" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">${escapeXml(
    theme.badge
  )}</text>
  <text x="92" y="204" fill="#F8FAFC" font-family="Georgia, 'Times New Roman', serif" font-size="82" font-weight="700">${escapeXml(
    dayText
  )}</text>
  <text x="92" y="264" fill="#8FB3CF" font-family="Arial, Helvetica, sans-serif" font-size="28">${escapeXml(
    `${progress}% through the run`
  )}</text>
  <text x="92" y="362" fill="#F8FAFC" font-family="Georgia, 'Times New Roman', serif" font-size="62" font-weight="700">${escapeXml(
    theme.headlineA
  )}</text>
  <text x="92" y="430" fill="#F8FAFC" font-family="Georgia, 'Times New Roman', serif" font-size="62" font-weight="700">${escapeXml(
    theme.headlineB
  )}</text>
  <text x="92" y="498" fill="#C4D4E3" font-family="Arial, Helvetica, sans-serif" font-size="28">${escapeXml(
    theme.subline
  )}</text>
  <text x="92" y="544" fill="#7FA9C8" font-family="'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-size="24">${escapeXml(
    pulse
  )}</text>
  <rect x="92" y="592" width="404" height="218" rx="28" fill="url(#card)" stroke="#21496B" stroke-width="2"/>
  <text x="124" y="646" fill="#FFB06B" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">Episode</text>
  <text x="124" y="712" fill="#F8FAFC" font-family="Georgia, 'Times New Roman', serif" font-size="36" font-weight="700">${escapeXml(
    episode
  )}</text>
  <text x="124" y="766" fill="#9EC1DB" font-family="'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-size="24">今天主看 ${escapeXml(
    leadSymbol
  )}</text>
  <rect x="530" y="592" width="458" height="218" rx="28" fill="url(#card)" stroke="#21496B" stroke-width="2"/>
  <text x="562" y="646" fill="#FFB06B" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">Current</text>
  <text x="562" y="724" fill="#F8FAFC" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="700">${escapeXml(
    current
  )}</text>
  <text x="562" y="770" fill="#9EC1DB" font-family="'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-size="24">current equity</text>
  <rect x="92" y="848" width="404" height="218" rx="28" fill="url(#card)" stroke="#21496B" stroke-width="2"/>
  <text x="124" y="902" fill="#FFB06B" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">PnL</text>
  <text x="124" y="980" fill="#F8FAFC" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700">${escapeXml(
    pnl
  )}</text>
  <text x="124" y="1028" fill="#9EC1DB" font-family="'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-size="24">net pnl</text>
  <rect x="530" y="848" width="458" height="218" rx="28" fill="url(#card)" stroke="#21496B" stroke-width="2"/>
  <text x="562" y="902" fill="#FFB06B" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">今日操作</text>
  <text x="562" y="980" fill="#F8FAFC" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700">${escapeXml(
    `${fills} 次操作 | ${status}`
  )}</text>
  <text x="562" y="1028" fill="#9EC1DB" font-family="'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-size="24">本金 ${escapeXml(
    start
  )} · cycles ${escapeXml(researchCycles)}</text>
  <rect x="92" y="1110" width="896" height="182" rx="28" fill="url(#card)" stroke="#21496B" stroke-width="2"/>
  <text x="124" y="1170" fill="#FFB06B" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">OpenClaw XHS Series</text>
  <text x="124" y="1242" fill="#F8FAFC" font-family="'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-size="46" font-weight="700">${escapeXml(
    theme.footerTitle
  )}</text>
  <text x="124" y="1294" fill="#9EC1DB" font-family="'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-size="24">${escapeXml(
    footer
  )}</text>
</svg>`;
}

async function renderCoverAsset(snapshot, outputFile, coverMode, rng) {
  const targetDate = snapshot.snapshot_at.slice(0, 10);
  const year = targetDate.slice(0, 4);
  const outputDir = path.dirname(outputFile);
  const assetDir = path.resolve(scriptDir, "../out/assets", year);
  const svgPath = path.join(assetDir, `${targetDate}.xhs-cover.svg`);
  const pngPath = path.join(assetDir, `${targetDate}.xhs-cover.png`);
  const svg = buildCoverSvg(snapshot, coverMode, rng);

  await fs.mkdir(assetDir, { recursive: true });
  await fs.writeFile(svgPath, `${svg}\n`, "utf8");
  await execFileAsync("sips", ["-s", "format", "png", svgPath, "--out", pngPath]);

  return {
    kind: "cover",
    path: path.relative(outputDir, pngPath) || path.basename(pngPath),
    caption: "OpenClaw GitHub poster portrait cover",
    required: true
  };
}

async function resolveAssets(snapshot, inputFile, outputFile, generatedCover) {
  const inputDir = path.dirname(inputFile);
  const outputDir = path.dirname(outputFile);
  const assets = [];
  const seenPaths = new Set();

  // 只保留一张封面图：优先使用生成的封面，否则使用 snapshot 中的第一张图
  if (generatedCover) {
    assets.push(generatedCover);
    seenPaths.add(path.resolve(outputDir, generatedCover.path));
  } else {
    // 如果没有生成封面，尝试从 snapshot 中找到第一张图片作为封面
    for (const asset of snapshot.assets ?? []) {
      const absolutePath = path.resolve(inputDir, asset.path);
      const extension = path.extname(absolutePath).toLowerCase();
      if (!supportedAssetExtensions.has(extension)) {
        continue;
      }

      try {
        await fs.access(absolutePath);
        assets.push({
          kind: "cover",
          path: path.relative(outputDir, absolutePath) || path.basename(absolutePath),
          caption: asset.caption || "Cover image",
          required: true
        });
        seenPaths.add(absolutePath);
        break; // 只取第一张
      } catch {
        continue;
      }
    }
  }

  // 确保至少有一张图
  if (assets.length > 0) {
    return assets;
  }

  await fs.access(fallbackAssetPath);
  return [
    {
      kind: "cover",
      path: path.relative(outputDir, fallbackAssetPath) || path.basename(fallbackAssetPath),
      caption: "Fallback challenge preview",
      required: true
    }
  ];
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

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const [inputArg, outputArg, templateArg] = process.argv.slice(2);
  if (!inputArg || !outputArg) {
    usage();
  }

  const inputFile = path.resolve(process.cwd(), inputArg);
  const outputFile = path.resolve(process.cwd(), outputArg);
  const templateFile = templateArg
    ? path.resolve(process.cwd(), templateArg)
    : defaultTemplatePath;

  const [snapshotRaw, templatesRaw, feedbackStrategy, analytics] = await Promise.all([
    fs.readFile(inputFile, "utf8"),
    fs.readFile(templateFile, "utf8"),
    readJsonIfExists(feedbackStrategyPath),
    readJsonIfExists(analyticsStatePath)
  ]);
  const snapshot = JSON.parse(snapshotRaw);
  const templates = JSON.parse(templatesRaw);
  const template = resolveSeriesTemplate(templates, snapshot.challenge.day);

  if (!template) {
    throw new Error(`No template found for day ${snapshot.challenge.day}`);
  }

  const leadSymbol = buildLeadSymbol(snapshot);
  const voiceProfile = buildVoiceProfile(analytics, feedbackStrategy);
  const rng = createSeededRng(`${snapshot.challenge.id}:${snapshot.challenge.day}:${snapshot.snapshot_at}`);
  const coverMode = pick(rng, voiceProfile.coverModes);
  const sections = buildSections(snapshot, leadSymbol, voiceProfile, rng);
  const title = buildTitle(snapshot, voiceProfile, rng);
  const coverText = buildCoverText(snapshot, coverMode, rng);
  const body = [...sections.map((section) => `${section.label}\n${section.text}`), defaultDisclaimer]
    .join("\n\n")
    .trim();
  const packageId = crypto
    .createHash("sha256")
    .update(`${snapshot.challenge.id}:${snapshot.challenge.day}:${snapshot.snapshot_at}`)
    .digest("hex")
    .slice(0, 16);

  let generatedCover = null;
  try {
    generatedCover = await renderCoverAsset(snapshot, outputFile, coverMode, rng);
  } catch (error) {
    console.warn(`Falling back to static cover asset: ${error.message}`);
  }

  const assets = await resolveAssets(snapshot, inputFile, outputFile, generatedCover);

  const postPackage = {
    version: 1,
    package_id: `xhs-${packageId}`,
    series: {
      id: snapshot.challenge.id,
      name: snapshot.challenge.series_name,
      day: snapshot.challenge.day,
      total_days: snapshot.challenge.total_days,
      stage: template.stage,
      template_id: template.id
    },
    content: {
      title,
      body,
      cover_text: coverText,
      hooks: buildHooks(snapshot, voiceProfile, rng),
      sections,
      hashtags: buildHashtags(snapshot, feedbackStrategy),
      disclaimer: defaultDisclaimer
    },
    assets,
    publish: {
      platform: "xiaohongshu",
      mode: "draft",
      target_time: nextMorning(snapshot.snapshot_at),
      // 不设置具体的合集配置，避免重复创建合集
      // 使用 config.collection 中定义的默认合集配置
      collection: null
    },
    source_refs: snapshot.source_refs,
    audit: {
      generated_at: new Date().toISOString(),
      generator: "xhs-agent/generate-post-package.mjs",
      snapshot_at: snapshot.snapshot_at,
      voice_profile: {
        source_note_count: voiceProfile.source_note_count,
        english_mix_ratio: voiceProfile.english_mix_ratio,
        direct_ratio: voiceProfile.direct_ratio,
        list_ratio: voiceProfile.list_ratio,
        self_mock_ratio: voiceProfile.self_mock_ratio,
        tone_traits: voiceProfile.tone_traits,
        cover_mode: coverMode
      }
    }
  };

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(postPackage, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outputFile}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
