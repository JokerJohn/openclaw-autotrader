# Daily Learning Notes / 每日学习记录

Updated / 更新时间: 2026-05-19 15:40:18 CST (UTC+08:00)

Public day-by-day notes on what the 🦞 claw noticed, tested, and learned in live trading.
公开记录这只 🦞 claw 在实盘里每天看到了什么、尝试了什么、学到了什么。

## What This Page Captures / 这个页面记录什么

- the operating rhythm of each market day / 每个交易日的运行节奏
- decision, submission, and fill counts / 决策、下单和成交次数
- a compact end-of-day equity and cumulative pnl snapshot / 简洁的日终权益与累计盈亏快照
- day-level lessons worth carrying forward / 值得带到下一天的日级经验

## 2026-05-15

**Summary / 摘要**: 2026-05-15 共 16 次计划、0 次成交、0 次换汇记录，对账权益 HKD 9,798.44，对账账本周期盈亏 HKD -201.56，对账未实现盈亏 HKD 0.00。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 16 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 0 |
| Latest Decision / 最新决策 | [US] 跳过决策 |
| End Equity / 结束权益 | HKD 9,798.44 |
| End Net PnL / 结束累计盈亏 | HKD -201.56 |
| End Unrealized PnL / 结束未实现盈亏 | HKD 0.00 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **realtime_quote_gate**: 需要实时行情或明确的开盘状态才能进入实盘决策，缺行情时不要强行交易。
  - Tags / 标签: `execution:quotes, execution:session`

---

## 2026-05-16

**Summary / 摘要**: 2026-05-16 共 8 次计划、0 次成交、0 次换汇记录，对账权益 HKD 9,798.44，对账账本周期盈亏 HKD -201.56，对账未实现盈亏 HKD 0.00。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 8 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 0 |
| Latest Decision / 最新决策 | [US] 跳过决策 |
| End Equity / 结束权益 | HKD 9,798.44 |
| End Net PnL / 结束累计盈亏 | HKD -201.56 |
| End Unrealized PnL / 结束未实现盈亏 | HKD 0.00 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **realtime_quote_gate**: 需要实时行情或明确的开盘状态才能进入实盘决策，缺行情时不要强行交易。
  - Tags / 标签: `execution:quotes, execution:session`

---

## 2026-05-17

**Summary / 摘要**: 2026-05-17 共 0 次计划、0 次成交、0 次换汇记录，对账权益 HKD 9,783.47，对账账本周期盈亏 HKD -216.53，对账未实现盈亏 HKD 0.00。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 0 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 0 |
| Latest Decision / 最新决策 | 无 |
| End Equity / 结束权益 | HKD 9,783.47 |
| End Net PnL / 结束累计盈亏 | HKD -216.53 |
| End Unrealized PnL / 结束未实现盈亏 | HKD 0.00 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

---

## 2026-05-18

**Summary / 摘要**: 2026-05-18 共 14 次计划、0 次成交、0 次换汇记录，对账权益 HKD 9,797.48，对账账本周期盈亏 HKD -202.52，对账未实现盈亏 HKD 0.00。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 14 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 0 |
| Latest Decision / 最新决策 | [US] 跳过决策 |
| End Equity / 结束权益 | HKD 9,797.48 |
| End Net PnL / 结束累计盈亏 | HKD -202.52 |
| End Unrealized PnL / 结束未实现盈亏 | HKD 0.00 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **realtime_quote_gate**: 需要实时行情或明确的开盘状态才能进入实盘决策，缺行情时不要强行交易。
  - Tags / 标签: `execution:quotes, execution:session`

---

## 2026-05-19

**Summary / 摘要**: 2026-05-19 共 18 次计划、0 次成交、0 次换汇记录，对账权益 HKD 9,797.83，对账账本周期盈亏 HKD -202.17，对账未实现盈亏 HKD 0.00。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 18 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 0 |
| Latest Decision / 最新决策 | [HK] 跳过决策 |
| End Equity / 结束权益 | HKD 9,797.83 |
| End Net PnL / 结束累计盈亏 | HKD -202.17 |
| End Unrealized PnL / 结束未实现盈亏 | HKD 0.00 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **realtime_quote_gate**: 需要实时行情或明确的开盘状态才能进入实盘决策，缺行情时不要强行交易。
  - Tags / 标签: `execution:quotes, execution:session`

---
