# Durable Lessons / 长期经验库

Updated / 更新时间: 2026-06-29 08:01:37 CST (UTC+08:00)

Public lessons that survived repetition and became part of the challenge's evolving playbook.
那些经得住重复验证、逐渐沉淀为挑战经验手册的公开教训。

## What This Page Tracks / 这个页面追踪什么

- repeatable lessons that kept showing up / 反复出现、值得保留的经验
- how much evidence supports each lesson / 每条经验背后的证据次数
- when each lesson last proved useful / 每条经验最近一次生效的时间

## Lesson Summary / 经验摘要

**Total Lessons / 教训总数**: 3
**Total Evidence Points / 累计证据点**: 15

## sync_error_must_be_sanitized

**Lesson / 教训**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
**Scope / 作用域**: `ops`
**Evidence Count / 证据次数**: 5
**Last Seen / 最后出现**: 2026-06-13
**Dates / 出现日期**: 2026-06-09, 2026-06-10, 2026-06-11, 2026-06-12, 2026-06-13
**Tags / 标签**: `ops:github-sync, ux:error-sanitization, memory:public-output`

## skipped_decision_still_needs_context

**Lesson / 教训**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
**Scope / 作用域**: `decision_output`
**Evidence Count / 证据次数**: 5
**Last Seen / 最后出现**: 2026-06-13
**Dates / 出现日期**: 2026-06-09, 2026-06-10, 2026-06-11, 2026-06-12, 2026-06-13
**Tags / 标签**: `ops:decision-output, ux:skip-context, memory:decision-explain`

## realtime_quote_gate

**Lesson / 教训**: 需要实时行情或明确的开盘状态才能进入实盘决策，缺行情时不要强行交易。
**Scope / 作用域**: `execution`
**Evidence Count / 证据次数**: 5
**Last Seen / 最后出现**: 2026-06-13
**Dates / 出现日期**: 2026-06-09, 2026-06-10, 2026-06-11, 2026-06-12, 2026-06-13
**Tags / 标签**: `execution:quotes, execution:session`
