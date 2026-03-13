# Durable Lessons / 长期经验库

Updated / 更新时间: 2026-03-13 14:47:36 CST (UTC+08:00)

Public lessons that survived repetition and became part of the challenge's evolving playbook.
那些经得住重复验证、逐渐沉淀为挑战经验手册的公开教训。

## What This Page Tracks / 这个页面追踪什么

- repeatable lessons that kept showing up / 反复出现、值得保留的经验
- how much evidence supports each lesson / 每条经验背后的证据次数
- when each lesson last proved useful / 每条经验最近一次生效的时间

## Lesson Summary / 经验摘要

**Total Lessons / 教训总数**: 7
**Total Evidence Points / 累计证据点**: 12

## sync_error_must_be_sanitized

**Lesson / 教训**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
**Scope / 作用域**: `ops`
**Evidence Count / 证据次数**: 3
**Last Seen / 最后出现**: 2026-03-13
**Dates / 出现日期**: 2026-03-11, 2026-03-12, 2026-03-13
**Tags / 标签**: `ops:github-sync, ux:error-sanitization, memory:public-output`

## skipped_decision_still_needs_context

**Lesson / 教训**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
**Scope / 作用域**: `decision_output`
**Evidence Count / 证据次数**: 3
**Last Seen / 最后出现**: 2026-03-13
**Dates / 出现日期**: 2026-03-11, 2026-03-12, 2026-03-13
**Tags / 标签**: `ops:decision-output, ux:skip-context, memory:decision-explain`

## hk_symbol_must_be_normalized

**Lesson / 教训**: Tiger 港股行情和下单必须先把本地 `.HK` symbol 规范化成 Tiger 五位 broker code（如 0388.HK -> 00388），否则 quote/contract lookup 会回零值或报不支持交易。
**Scope / 作用域**: `execution`
**Evidence Count / 证据次数**: 2
**Last Seen / 最后出现**: 2026-03-13
**Dates / 出现日期**: 2026-03-12, 2026-03-13
**Tags / 标签**: `execution:hk-symbol, execution:quote-normalization, execution:broker-contract`

## cash_reserve_block

**Lesson / 教训**: 现金不足会直接阻断后续决策与轮动，必须保留至少20%机动现金。
**Scope / 作用域**: `portfolio`
**Evidence Count / 证据次数**: 1
**Last Seen / 最后出现**: 2026-03-11
**Dates / 出现日期**: 2026-03-11
**Tags / 标签**: `portfolio:cash, risk:reserve`

## realtime_quote_gate

**Lesson / 教训**: 需要实时行情或明确的开盘状态才能进入实盘决策，缺行情时不要强行交易。
**Scope / 作用域**: `execution`
**Evidence Count / 证据次数**: 1
**Last Seen / 最后出现**: 2026-03-11
**Dates / 出现日期**: 2026-03-11
**Tags / 标签**: `execution:quotes, execution:session`

## fx_split_retry

**Lesson / 教训**: 换汇失败时应优先分批换汇并确认目标币种已到账，再继续股票下单。
**Scope / 作用域**: `execution`
**Evidence Count / 证据次数**: 1
**Last Seen / 最后出现**: 2026-03-11
**Dates / 出现日期**: 2026-03-11
**Tags / 标签**: `execution:fx, execution:sequencing`

## weak_followthrough_buy_RIVN

**Lesson / 教训**: RIVN 最近买入后的延续较弱，除非 EV 和胜率显著改善，否则不要继续追高。
**Scope / 作用域**: `RIVN`
**Evidence Count / 证据次数**: 1
**Last Seen / 最后出现**: 2026-03-11
**Dates / 出现日期**: 2026-03-11
**Tags / 标签**: `symbol:RIVN, market:us, tier:satellite, sector:ev, regime:unknown, context_action:buy, context_purpose:open, ref_type:decision, theme:电动车, theme:高波动, source:backfill, backfill_source:journal_backfill_v1, execution_status:plan_only`
