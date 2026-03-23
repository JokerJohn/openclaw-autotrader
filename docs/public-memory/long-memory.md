# Durable Lessons / 长期经验库

Updated / 更新时间: 2026-03-23 09:09:55 CST (UTC+08:00)

Public lessons that survived repetition and became part of the challenge's evolving playbook.
那些经得住重复验证、逐渐沉淀为挑战经验手册的公开教训。

## What This Page Tracks / 这个页面追踪什么

- repeatable lessons that kept showing up / 反复出现、值得保留的经验
- how much evidence supports each lesson / 每条经验背后的证据次数
- when each lesson last proved useful / 每条经验最近一次生效的时间

## Lesson Summary / 经验摘要

**Total Lessons / 教训总数**: 10
**Total Evidence Points / 累计证据点**: 36

## skipped_decision_still_needs_context

**Lesson / 教训**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
**Scope / 作用域**: `decision_output`
**Evidence Count / 证据次数**: 11
**Last Seen / 最后出现**: 2026-03-22
**Dates / 出现日期**: 2026-03-11, 2026-03-12, 2026-03-13, 2026-03-14, 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-21, 2026-03-22
**Tags / 标签**: `ops:decision-output, ux:skip-context, memory:decision-explain`

## sync_error_must_be_sanitized

**Lesson / 教训**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
**Scope / 作用域**: `ops`
**Evidence Count / 证据次数**: 9
**Last Seen / 最后出现**: 2026-03-21
**Dates / 出现日期**: 2026-03-11, 2026-03-12, 2026-03-13, 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-21
**Tags / 标签**: `ops:github-sync, ux:error-sanitization, memory:public-output`

## event_market_gate_first

**Lesson / 教训**: 宏观/国际政治级事件 gate 命中时，市场级风险应先于单票冲动，先阻断新开仓再等待 headline 风险消退。
**Scope / 作用域**: `event_layer`
**Evidence Count / 证据次数**: 4
**Last Seen / 最后出现**: 2026-03-21
**Dates / 出现日期**: 2026-03-14, 2026-03-19, 2026-03-20, 2026-03-21
**Tags / 标签**: `event:market-gate, risk:macro-politics, memory:event-layer`

## us_buy_no_chasing_and_tighter_caps

**Lesson / 教训**: 美股新开仓不能只因盘中强势就追价；日内涨幅显著扩张时应先等回撤/换手确认，高波动半导体与同类强势股的单票上限应压到 30% 或以下，不要追高。
**Scope / 作用域**: `portfolio`
**Evidence Count / 证据次数**: 3
**Last Seen / 最后出现**: 2026-03-16
**Dates / 出现日期**: 2026-03-11, 2026-03-14, 2026-03-16
**Tags / 标签**: `market:us, risk:anti-chase, sizing:tighter-cap, execution:pullback-first`

## oversized_MU

**Lesson / 教训**: MU 仓位曾明显超限，后续应优先按分层减仓规则把风险拉回目标区间。
**Scope / 作用域**: `MU`
**Evidence Count / 证据次数**: 2
**Last Seen / 最后出现**: 2026-03-17
**Dates / 出现日期**: 2026-03-16, 2026-03-17
**Tags / 标签**: `symbol:MU, market:us, risk:oversized`

## missed_opportunity_AAOI

**Lesson / 教训**: AAOI 在最近复盘中体现出更强的事后收益，后续对高 EV 候选不要过度保守。
**Scope / 作用域**: `AAOI`
**Evidence Count / 证据次数**: 2
**Last Seen / 最后出现**: 2026-03-15
**Dates / 出现日期**: 2026-03-14, 2026-03-15
**Tags / 标签**: `action:buy, purpose:open, market:us, regime:mixed, tier:promoted, sector:semiconductor, theme:存储, theme:NAND, theme:半导体, confirm:neutral, event_theme:war_conflict, event_theme:shipping_logistics, event_theme:energy_oil`

## hk_symbol_must_be_normalized

**Lesson / 教训**: Tiger 港股行情和下单必须先把本地 `.HK` symbol 规范化成 Tiger 五位 broker code（如 0388.HK -> 00388），否则 quote/contract lookup 会回零值或报不支持交易。
**Scope / 作用域**: `execution`
**Evidence Count / 证据次数**: 2
**Last Seen / 最后出现**: 2026-03-13
**Dates / 出现日期**: 2026-03-12, 2026-03-13
**Tags / 标签**: `execution:hk-symbol, execution:quote-normalization, execution:broker-contract`

## sell_too_early_BABA

**Lesson / 教训**: BABA 最近卖出后继续上行，后续止盈/降仓需要更重视趋势延续和分批退出。
**Scope / 作用域**: `BABA`
**Evidence Count / 证据次数**: 1
**Last Seen / 最后出现**: 2026-03-19
**Dates / 出现日期**: 2026-03-19
**Tags / 标签**: `action:sell, purpose:stop_loss, market:us, regime:high_volatility, tier:core, sector:china_internet, theme:中概, theme:电商, theme:云, confirm:neutral, event_theme:war_conflict, event_theme:energy_oil, event_theme:macro_rates`

## missed_opportunity_1211.HK

**Lesson / 教训**: 1211.HK 在最近复盘中体现出更强的事后收益，后续对高 EV 候选不要过度保守。
**Scope / 作用域**: `1211.HK`
**Evidence Count / 证据次数**: 1
**Last Seen / 最后出现**: 2026-03-16
**Dates / 出现日期**: 2026-03-16
**Tags / 标签**: `action:hold, purpose:hold, market:hk, regime:momentum_up, confirm:neutral, event_theme:war_conflict, event_theme:policy_trade`

## positive_followthrough_buy_1211.HK

**Lesson / 教训**: 1211.HK 最近买入后的延续较好，可继续作为同类强势轮动的优先候选。
**Scope / 作用域**: `1211.HK`
**Evidence Count / 证据次数**: 1
**Last Seen / 最后出现**: 2026-03-16
**Dates / 出现日期**: 2026-03-16
**Tags / 标签**: `action:buy, purpose:open, market:hk, regime:momentum_up, tier:satellite, sector:ev, theme:电动车, theme:动力电池, confirm:neutral, event_theme:war_conflict, event_theme:policy_trade`
