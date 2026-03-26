# Daily Learning Notes / 每日学习记录

Updated / 更新时间: 2026-03-26 08:39:34 CST (UTC+08:00)

Public day-by-day notes on what the 🦞 claw noticed, tested, and learned in live trading.
公开记录这只 🦞 claw 在实盘里每天看到了什么、尝试了什么、学到了什么。

## What This Page Captures / 这个页面记录什么

- the operating rhythm of each market day / 每个交易日的运行节奏
- decision, submission, and fill counts / 决策、下单和成交次数
- a compact end-of-day equity and cumulative pnl snapshot / 简洁的日终权益与累计盈亏快照
- day-level lessons worth carrying forward / 值得带到下一天的日级经验

## 2026-03-22

**Summary / 摘要**: 2026-03-22 共 4 次计划、0 次成交、0 次换汇记录，对账权益 HKD 4,710.79，对账累计盈亏 HKD -289.21，对账未实现盈亏 HKD -88.27。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 4 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 7 |
| Latest Decision / 最新决策 | [HK] 跳过决策 |
| End Equity / 结束权益 | HKD 4,710.79 |
| End Net PnL / 结束累计盈亏 | HKD -289.21 |
| End Unrealized PnL / 结束未实现盈亏 | HKD -88.27 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

---

## 2026-03-23

**Summary / 摘要**: 2026-03-23 共 15 次计划、0 次成交、0 次换汇记录，对账权益 HKD 4,667.02，对账累计盈亏 HKD -332.98，对账未实现盈亏 HKD -147.90。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 15 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 2 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 4,667.02 |
| End Net PnL / 结束累计盈亏 | HKD -332.98 |
| End Unrealized PnL / 结束未实现盈亏 | HKD -147.90 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **event_market_gate_first**: 宏观/国际政治级事件 gate 命中时，市场级风险应先于单票冲动，先阻断新开仓再等待 headline 风险消退。
  - Tags / 标签: `event:market-gate, risk:macro-politics, memory:event-layer`

---

## 2026-03-24

**Summary / 摘要**: 2026-03-24 共 21 次计划、0 次成交、0 次换汇记录，对账权益 HKD 4,629.33，对账累计盈亏 HKD -370.67，对账未实现盈亏 HKD -185.39。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 21 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 25 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 4,629.33 |
| End Net PnL / 结束累计盈亏 | HKD -370.67 |
| End Unrealized PnL / 结束未实现盈亏 | HKD -185.39 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **event_market_gate_first**: 宏观/国际政治级事件 gate 命中时，市场级风险应先于单票冲动，先阻断新开仓再等待 headline 风险消退。
  - Tags / 标签: `event:market-gate, risk:macro-politics, memory:event-layer`

---

## 2026-03-25

**Summary / 摘要**: 2026-03-25 共 22 次计划、0 次成交、0 次换汇记录，对账权益 HKD 4,582.44，对账累计盈亏 HKD -417.56，对账未实现盈亏 HKD -229.34。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 22 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 32 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 4,582.44 |
| End Net PnL / 结束累计盈亏 | HKD -417.56 |
| End Unrealized PnL / 结束未实现盈亏 | HKD -229.34 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **missed_opportunity_RIVN**: RIVN 在最近复盘中体现出更强的事后收益，后续对高 EV 候选不要过度保守。
  - Tags / 标签: `action:hold, purpose:hold, market:us, regime:mixed, confirm:risk_on, event_theme:war_conflict, event_theme:shipping_logistics, event_theme:macro_rates`

---

## 2026-03-26

**Summary / 摘要**: 2026-03-26 共 1 次计划、0 次成交、0 次换汇记录，对账权益 HKD 4,586.31，对账累计盈亏 HKD -413.69，对账未实现盈亏 HKD -220.87。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 1 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 27 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 4,586.31 |
| End Net PnL / 结束累计盈亏 | HKD -413.69 |
| End Unrealized PnL / 结束未实现盈亏 | HKD -220.87 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

---
