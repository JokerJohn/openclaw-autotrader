# Durable Lessons / 长期经验库

Updated / 更新时间: 2026-03-14 15:46:34 CST (UTC+08:00)

Public lessons that survived repetition and became part of the challenge's evolving playbook.
那些经得住重复验证、逐渐沉淀为挑战经验手册的公开教训。

## What This Page Tracks / 这个页面追踪什么

- repeatable lessons that kept showing up / 反复出现、值得保留的经验
- how much evidence supports each lesson / 每条经验背后的证据次数
- when each lesson last proved useful / 每条经验最近一次生效的时间

## Lesson Summary / 经验摘要

**Total Lessons / 教训总数**: 5
**Total Evidence Points / 累计证据点**: 9

## skipped_decision_still_needs_context

**Lesson / 教训**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
**Scope / 作用域**: `decision_output`
**Evidence Count / 证据次数**: 3
**Last Seen / 最后出现**: 2026-03-14
**Dates / 出现日期**: 2026-03-12, 2026-03-13, 2026-03-14
**Tags / 标签**: `ops:decision-output, ux:skip-context, memory:decision-explain`

## sync_error_must_be_sanitized

**Lesson / 教训**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
**Scope / 作用域**: `ops`
**Evidence Count / 证据次数**: 2
**Last Seen / 最后出现**: 2026-03-13
**Dates / 出现日期**: 2026-03-12, 2026-03-13
**Tags / 标签**: `ops:github-sync, ux:error-sanitization, memory:public-output`

## hk_symbol_must_be_normalized

**Lesson / 教训**: Tiger 港股行情和下单必须先把本地 `.HK` symbol 规范化成 Tiger 五位 broker code（如 0388.HK -> 00388），否则 quote/contract lookup 会回零值或报不支持交易。
**Scope / 作用域**: `execution`
**Evidence Count / 证据次数**: 2
**Last Seen / 最后出现**: 2026-03-13
**Dates / 出现日期**: 2026-03-12, 2026-03-13
**Tags / 标签**: `execution:hk-symbol, execution:quote-normalization, execution:broker-contract`

## event_market_gate_first

**Lesson / 教训**: 宏观/国际政治级事件 gate 命中时，市场级风险应先于单票冲动，先阻断新开仓再等待 headline 风险消退。
**Scope / 作用域**: `event_layer`
**Evidence Count / 证据次数**: 1
**Last Seen / 最后出现**: 2026-03-14
**Dates / 出现日期**: 2026-03-14
**Tags / 标签**: `event:market-gate, risk:macro-politics, memory:event-layer`

## missed_opportunity_AAOI

**Lesson / 教训**: AAOI 在最近复盘中体现出更强的事后收益，后续对高 EV 候选不要过度保守。
**Scope / 作用域**: `AAOI`
**Evidence Count / 证据次数**: 1
**Last Seen / 最后出现**: 2026-03-14
**Dates / 出现日期**: 2026-03-14
**Tags / 标签**: `action:buy, purpose:open, market:us, regime:mixed, tier:promoted, sector:semiconductor, theme:存储, theme:NAND, theme:半导体, confirm:neutral, event_theme:war_conflict, event_theme:shipping_logistics, event_theme:energy_oil`
