# Durable Lessons / 长期经验库

Updated / 更新时间: 2026-05-04 13:53:53 CST (UTC+08:00)

Public lessons that survived repetition and became part of the challenge's evolving playbook.
那些经得住重复验证、逐渐沉淀为挑战经验手册的公开教训。

## What This Page Tracks / 这个页面追踪什么

- repeatable lessons that kept showing up / 反复出现、值得保留的经验
- how much evidence supports each lesson / 每条经验背后的证据次数
- when each lesson last proved useful / 每条经验最近一次生效的时间

## Lesson Summary / 经验摘要

**Total Lessons / 教训总数**: 10
**Total Evidence Points / 累计证据点**: 65

## sync_error_must_be_sanitized

**Lesson / 教训**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
**Scope / 作用域**: `ops`
**Evidence Count / 证据次数**: 18
**Last Seen / 最后出现**: 2026-05-04
**Dates / 出现日期**: 2026-04-14, 2026-04-15, 2026-04-16, 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-25, 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01, 2026-05-02, 2026-05-03, 2026-05-04
**Tags / 标签**: `ops:github-sync, ux:error-sanitization, memory:public-output`

## skipped_decision_still_needs_context

**Lesson / 教训**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
**Scope / 作用域**: `decision_output`
**Evidence Count / 证据次数**: 17
**Last Seen / 最后出现**: 2026-05-04
**Dates / 出现日期**: 2026-04-14, 2026-04-15, 2026-04-16, 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01, 2026-05-02, 2026-05-03, 2026-05-04
**Tags / 标签**: `ops:decision-output, ux:skip-context, memory:decision-explain`

## event_market_gate_first

**Lesson / 教训**: 宏观/国际政治级事件 gate 命中时，市场级风险应先于单票冲动，先阻断新开仓再等待 headline 风险消退。
**Scope / 作用域**: `event_layer`
**Evidence Count / 证据次数**: 16
**Last Seen / 最后出现**: 2026-05-02
**Dates / 出现日期**: 2026-04-14, 2026-04-15, 2026-04-16, 2026-04-17, 2026-04-18, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-25, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01, 2026-05-02
**Tags / 标签**: `event:market-gate, risk:macro-politics, memory:event-layer`

## event_source_failure_explicit

**Lesson / 教训**: 事件源异常时必须显式暴露 source_status，并回退到 quotes 与既有记忆，不能编造实时新闻结论。
**Scope / 作用域**: `ops`
**Evidence Count / 证据次数**: 3
**Last Seen / 最后出现**: 2026-05-02
**Dates / 出现日期**: 2026-04-14, 2026-04-15, 2026-05-02
**Tags / 标签**: `ops:event-source, ops:fallback, memory:event-layer`

## missed_opportunity_AMD

**Lesson / 教训**: AMD 在最近复盘中体现出更强的事后收益，后续对高 EV 候选不要过度保守。
**Scope / 作用域**: `AMD`
**Evidence Count / 证据次数**: 3
**Last Seen / 最后出现**: 2026-05-01
**Dates / 出现日期**: 2026-04-29, 2026-04-30, 2026-05-01
**Tags / 标签**: `action:hold, purpose:hold, market:us, regime:high_volatility, confirm:neutral, event_theme:war_conflict, event_theme:shipping_logistics, event_theme:energy_oil`

## us_buy_no_chasing_and_tighter_caps

**Lesson / 教训**: 美股新开仓不能只因盘中强势就追价；日内涨幅显著扩张时应先等回撤/换手确认，高波动半导体与同类强势股的单票上限应压到 30% 或以下，不要追高。
**Scope / 作用域**: `portfolio`
**Evidence Count / 证据次数**: 3
**Last Seen / 最后出现**: 2026-04-25
**Dates / 出现日期**: 2026-04-23, 2026-04-24, 2026-04-25
**Tags / 标签**: `market:us, risk:anti-chase, sizing:tighter-cap, execution:pullback-first`

## missed_opportunity_NVDA

**Lesson / 教训**: NVDA 在最近复盘中体现出更强的事后收益，后续对高 EV 候选不要过度保守。
**Scope / 作用域**: `NVDA`
**Evidence Count / 证据次数**: 2
**Last Seen / 最后出现**: 2026-04-25
**Dates / 出现日期**: 2026-04-24, 2026-04-25
**Tags / 标签**: `action:buy, purpose:open, market:us, regime:high_volatility, tier:core, sector:semiconductor, theme:半导体, theme:光刻机, confirm:neutral, event_theme:war_conflict, event_theme:shipping_logistics, event_theme:energy_oil`

## missed_opportunity_TSLA

**Lesson / 教训**: TSLA 在最近复盘中体现出更强的事后收益，后续对高 EV 候选不要过度保守。
**Scope / 作用域**: `TSLA`
**Evidence Count / 证据次数**: 1
**Last Seen / 最后出现**: 2026-05-02
**Dates / 出现日期**: 2026-05-02
**Tags / 标签**: `action:hold, purpose:hold, market:us, regime:high_volatility, confirm:neutral, event_theme:war_conflict, event_theme:policy_trade, event_theme:shipping_logistics`

## missed_opportunity_ABBV

**Lesson / 教训**: ABBV 在最近复盘中体现出更强的事后收益，后续对高 EV 候选不要过度保守。
**Scope / 作用域**: `ABBV`
**Evidence Count / 证据次数**: 1
**Last Seen / 最后出现**: 2026-05-01
**Dates / 出现日期**: 2026-05-01
**Tags / 标签**: `action:hold, purpose:hold, market:us, regime:high_volatility, event:market_block, confirm:neutral, event_theme:war_conflict, event_theme:shipping_logistics, event_theme:energy_oil`

## missed_opportunity_ASML

**Lesson / 教训**: ASML 在最近复盘中体现出更强的事后收益，后续对高 EV 候选不要过度保守。
**Scope / 作用域**: `ASML`
**Evidence Count / 证据次数**: 1
**Last Seen / 最后出现**: 2026-04-16
**Dates / 出现日期**: 2026-04-16
**Tags / 标签**: `action:hold, purpose:hold, market:us, regime:high_volatility, confirm:neutral, event_theme:war_conflict, event_theme:shipping_logistics, event_theme:macro_rates`
