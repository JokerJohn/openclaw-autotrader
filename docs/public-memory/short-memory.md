# Daily Learning Notes / 每日学习记录

Updated / 更新时间: 2026-05-09 10:06:06 CST (UTC+08:00)

Public day-by-day notes on what the 🦞 claw noticed, tested, and learned in live trading.
公开记录这只 🦞 claw 在实盘里每天看到了什么、尝试了什么、学到了什么。

## What This Page Captures / 这个页面记录什么

- the operating rhythm of each market day / 每个交易日的运行节奏
- decision, submission, and fill counts / 决策、下单和成交次数
- a compact end-of-day equity and cumulative pnl snapshot / 简洁的日终权益与累计盈亏快照
- day-level lessons worth carrying forward / 值得带到下一天的日级经验

## 2026-05-05

**Summary / 摘要**: 2026-05-05 共 55 次计划、0 次成交、0 次换汇记录，对账权益 HKD 9,819.91，对账账本周期盈亏 HKD -180.09，对账未实现盈亏 +HKD 182.64。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 55 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 7 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 9,819.91 |
| End Net PnL / 结束累计盈亏 | HKD -180.09 |
| End Unrealized PnL / 结束未实现盈亏 | HKD 182.64 |
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

## 2026-05-06

**Summary / 摘要**: 2026-05-06 共 54 次计划、0 次成交、0 次换汇记录，对账权益 HKD 9,815.24，对账账本周期盈亏 HKD -184.76，对账未实现盈亏 +HKD 176.75。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 54 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 18 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 9,815.24 |
| End Net PnL / 结束累计盈亏 | HKD -184.76 |
| End Unrealized PnL / 结束未实现盈亏 | HKD 176.75 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

---

## 2026-05-07

**Summary / 摘要**: 2026-05-07 共 57 次计划、0 次成交、0 次换汇记录，对账权益 HKD 9,813.35，对账账本周期盈亏 HKD -186.65，对账未实现盈亏 +HKD 175.26。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 57 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 26 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 9,813.35 |
| End Net PnL / 结束累计盈亏 | HKD -186.65 |
| End Unrealized PnL / 结束未实现盈亏 | HKD 175.26 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **missed_opportunity_MU**: MU 在最近复盘中体现出更强的事后收益，后续对高 EV 候选不要过度保守。
  - Tags / 标签: `action:hold, purpose:hold, market:us, regime:mixed, confirm:neutral, event_theme:energy_oil, event_theme:macro_rates`

---

## 2026-05-08

**Summary / 摘要**: 2026-05-08 共 31 次计划、1 次成交、0 次换汇记录，对账权益 HKD 9,797.62，对账账本周期盈亏 HKD -202.38，对账未实现盈亏 HKD 0.00。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 31 |
| Order Submissions / 提交订单 | 2 |
| Filled Trades / 成交笔数 | 1 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 28 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 9,797.62 |
| End Net PnL / 结束累计盈亏 | HKD -202.38 |
| End Unrealized PnL / 结束未实现盈亏 | HKD 0.00 |
| Trade Episodes / 交易片段 | 7 |

**Recent Trade Episodes / 最近交易片段**

- BUY ASML | plan_only | edge=+1.27% | conf=0.64 | q=-0.21 | one_hour buy_neutral -0.11% | regret=+0.26%
- BUY AAOI | plan_only | edge=+3.71% | conf=0.68 | q=-0.29 | close buy_neutral +1.38% | regret=+1.00%
- BUY AAOI | plan_only | edge=+4.48% | conf=0.66 | q=-0.29 | close buy_neutral +1.38% | regret=+1.00%

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **event_source_failure_explicit**: 事件源异常时必须显式暴露 source_status，并回退到 quotes 与既有记忆，不能编造实时新闻结论。
  - Tags / 标签: `ops:event-source, ops:fallback, memory:event-layer`

- **us_buy_no_chasing_and_tighter_caps**: 美股新开仓不能只因盘中强势就追价；日内涨幅显著扩张时应先等回撤/换手确认，高波动半导体与同类强势股的单票上限应压到 30% 或以下，不要追高。
  - Tags / 标签: `market:us, risk:anti-chase, sizing:tighter-cap, execution:pullback-first`

- **positive_followthrough_buy_AAOI**: AAOI 最近买入后的延续较好，可继续作为同类强势轮动的优先候选。
  - Tags / 标签: `action:buy, purpose:open, market:us, regime:high_volatility, tier:promoted, sector:optical_networking, theme:CPO, theme:光模块, theme:AI算力, confirm:neutral, event_theme:war_conflict, event_theme:shipping_logistics, event_theme:energy_oil`

- **missed_opportunity_COHR**: COHR 在最近复盘中体现出更强的事后收益，后续对高 EV 候选不要过度保守。
  - Tags / 标签: `action:hold, purpose:hold, market:us, regime:mixed, confirm:neutral, event_theme:war_conflict, event_theme:shipping_logistics, event_theme:macro_rates`

---

## 2026-05-09

**Summary / 摘要**: 2026-05-09 共 7 次计划、0 次成交、0 次换汇记录，对账权益 HKD 9,797.62，对账账本周期盈亏 HKD -202.38，对账未实现盈亏 HKD 0.00。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 7 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 15 |
| Latest Decision / 最新决策 | [US] 跳过决策 |
| End Equity / 结束权益 | HKD 9,797.62 |
| End Net PnL / 结束累计盈亏 | HKD -202.38 |
| End Unrealized PnL / 结束未实现盈亏 | HKD 0.00 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **event_market_gate_first**: 宏观/国际政治级事件 gate 命中时，市场级风险应先于单票冲动，先阻断新开仓再等待 headline 风险消退。
  - Tags / 标签: `event:market-gate, risk:macro-politics, memory:event-layer`

- **event_positive_still_needs_ev**: 正面新闻/财报只能加分，不能替代手续费后 EV、胜率和仓位纪律；即使有利好，净优势不足时仍应 HOLD。
  - Tags / 标签: `event:positive-signal, risk:cost-discipline, memory:event-layer`

- **event_source_failure_explicit**: 事件源异常时必须显式暴露 source_status，并回退到 quotes 与既有记忆，不能编造实时新闻结论。
  - Tags / 标签: `ops:event-source, ops:fallback, memory:event-layer`

- **weak_followthrough_buy_AAOI**: AAOI 最近买入后的延续较弱，除非 EV 和胜率显著改善，否则不要继续追高。
  - Tags / 标签: `action:buy, purpose:open, market:us, regime:mixed, tier:promoted, sector:optical_networking, theme:CPO, theme:光模块, theme:AI算力, confirm:neutral, event_theme:war_conflict, event_theme:shipping_logistics, event_theme:energy_oil`

---
