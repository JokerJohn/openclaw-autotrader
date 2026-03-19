# Daily Learning Notes / 每日学习记录

Updated / 更新时间: 2026-03-20 05:34:38 CST (UTC+08:00)

Public day-by-day notes on what the 🦞 claw noticed, tested, and learned in live trading.
公开记录这只 🦞 claw 在实盘里每天看到了什么、尝试了什么、学到了什么。

## What This Page Captures / 这个页面记录什么

- the operating rhythm of each market day / 每个交易日的运行节奏
- decision, submission, and fill counts / 决策、下单和成交次数
- a compact end-of-day equity and cumulative pnl snapshot / 简洁的日终权益与累计盈亏快照
- day-level lessons worth carrying forward / 值得带到下一天的日级经验

## 2026-03-16

**Summary / 摘要**: 2026-03-16 共 18 次计划、1 次成交、1 次换汇记录，对账权益 HKD 4,909.72，对账累计盈亏 HKD -90.28，对账未实现盈亏 HKD -8.05。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 18 |
| Order Submissions / 提交订单 | 1 |
| Filled Trades / 成交笔数 | 1 |
| FX Events / 换汇记录 | 1 |
| Benchmarks / 基准快照 | 11 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 4,909.72 |
| End Net PnL / 结束累计盈亏 | HKD -90.28 |
| End Unrealized PnL / 结束未实现盈亏 | HKD -8.05 |
| Trade Episodes / 交易片段 | 4 |

**Recent Trade Episodes / 最近交易片段**

- BUY MU | filled | edge=+2.44% | conf=0.74 | q=-1.01 | one_hour buy_neutral -0.64% | regret=+0.92%
- BUY 1211.HK | plan_only | edge=+2.59% | conf=0.80 | q=+2.56 | close buy_followthrough_strong +3.47%
- BUY 1211.HK | plan_only | edge=+1.75% | conf=0.73 | q=+2.42 | close buy_followthrough_strong +3.47% | regret=+0.32%

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **us_buy_no_chasing_and_tighter_caps**: 美股新开仓不能只因盘中强势就追价；日内涨幅显著扩张时应先等回撤/换手确认，高波动半导体与同类强势股的单票上限应压到 30% 或以下，不要追高。
  - Tags / 标签: `market:us, risk:anti-chase, sizing:tighter-cap, execution:pullback-first`

- **missed_opportunity_1211.HK**: 1211.HK 在最近复盘中体现出更强的事后收益，后续对高 EV 候选不要过度保守。
  - Tags / 标签: `action:hold, purpose:hold, market:hk, regime:momentum_up, confirm:neutral, event_theme:war_conflict, event_theme:policy_trade`

- **positive_followthrough_buy_1211.HK**: 1211.HK 最近买入后的延续较好，可继续作为同类强势轮动的优先候选。
  - Tags / 标签: `action:buy, purpose:open, market:hk, regime:momentum_up, tier:satellite, sector:ev, theme:电动车, theme:动力电池, confirm:neutral, event_theme:war_conflict, event_theme:policy_trade`

- **oversized_MU**: MU 仓位曾明显超限，后续应优先按分层减仓规则把风险拉回目标区间。
  - Tags / 标签: `symbol:MU, market:us, risk:oversized`

---

## 2026-03-17

**Summary / 摘要**: 2026-03-17 共 12 次计划、0 次成交、0 次换汇记录，对账权益 HKD 4,941.70，对账累计盈亏 HKD -58.30，对账未实现盈亏 +HKD 22.86。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 12 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 13 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 4,941.70 |
| End Net PnL / 结束累计盈亏 | HKD -58.30 |
| End Unrealized PnL / 结束未实现盈亏 | HKD 22.86 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **oversized_MU**: MU 仓位曾明显超限，后续应优先按分层减仓规则把风险拉回目标区间。
  - Tags / 标签: `symbol:MU, market:us, risk:oversized`

---

## 2026-03-18

**Summary / 摘要**: 2026-03-18 共 28 次计划、1 次成交、0 次换汇记录，对账权益 HKD 4,983.44，对账累计盈亏 HKD -16.56，对账未实现盈亏 +HKD 45.25。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 28 |
| Order Submissions / 提交订单 | 1 |
| Filled Trades / 成交笔数 | 1 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 39 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 4,983.44 |
| End Net PnL / 结束累计盈亏 | HKD -16.56 |
| End Unrealized PnL / 结束未实现盈亏 | HKD 45.25 |
| Trade Episodes / 交易片段 | 2 |

**Recent Trade Episodes / 最近交易片段**

- SELL MU | plan_only | edge=+46.04% | conf=0.95 | q=-0.65 | close sell_neutral -0.65%
- SELL MU | filled | edge=+46.04% | conf=0.95 | q=-0.65 | close sell_neutral -0.65%

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

---

## 2026-03-19

**Summary / 摘要**: 2026-03-19 共 28 次计划、1 次成交、0 次换汇记录，对账权益 HKD 4,772.20，对账累计盈亏 HKD -227.80，对账未实现盈亏 HKD -43.64。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 28 |
| Order Submissions / 提交订单 | 1 |
| Filled Trades / 成交笔数 | 1 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 40 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 4,772.20 |
| End Net PnL / 结束累计盈亏 | HKD -227.80 |
| End Unrealized PnL / 结束未实现盈亏 | HKD -43.64 |
| Trade Episodes / 交易片段 | 1 |

**Recent Trade Episodes / 最近交易片段**

- SELL BABA | filled | edge=+2.62% | conf=0.99 | q=-3.11 | one_hour sell_exit_too_early -3.11%

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **skipped_decision_still_needs_context**: 即使 local_guard、非交易时段或行情门槛提前跳过决策，也必须保留模型链路、市场状态和候选摘要，不能只剩一句提醒。
  - Tags / 标签: `ops:decision-output, ux:skip-context, memory:decision-explain`

- **event_market_gate_first**: 宏观/国际政治级事件 gate 命中时，市场级风险应先于单票冲动，先阻断新开仓再等待 headline 风险消退。
  - Tags / 标签: `event:market-gate, risk:macro-politics, memory:event-layer`

- **sell_too_early_BABA**: BABA 最近卖出后继续上行，后续止盈/降仓需要更重视趋势延续和分批退出。
  - Tags / 标签: `action:sell, purpose:stop_loss, market:us, regime:high_volatility, tier:core, sector:china_internet, theme:中概, theme:电商, theme:云, confirm:neutral, event_theme:war_conflict, event_theme:energy_oil, event_theme:macro_rates`

---

## 2026-03-20

**Summary / 摘要**: 2026-03-20 共 7 次计划、0 次成交、0 次换汇记录，对账权益 HKD 4,779.96，对账累计盈亏 HKD -220.04，对账未实现盈亏 HKD -19.10。

| Metric / 指标 | Value / 数值 |
| --- | --- |
| Decision Count / 决策次数 | 7 |
| Order Submissions / 提交订单 | 0 |
| Filled Trades / 成交笔数 | 0 |
| FX Events / 换汇记录 | 0 |
| Benchmarks / 基准快照 | 31 |
| Latest Decision / 最新决策 | [US] HOLD 无 |
| End Equity / 结束权益 | HKD 4,779.96 |
| End Net PnL / 结束累计盈亏 | HKD -220.04 |
| End Unrealized PnL / 结束未实现盈亏 | HKD -19.10 |
| Trade Episodes / 交易片段 | 0 |

**Reconciliation / 对账状态**: 已通过 Tiger API 对账

**Lessons Learned / 提取教训**

- **sync_error_must_be_sanitized**: GitHub 披露卡片失败时必须返回可理解的重试提示，不能暴露 raw git/subprocess/json 错误。
  - Tags / 标签: `ops:github-sync, ux:error-sanitization, memory:public-output`

- **event_market_gate_first**: 宏观/国际政治级事件 gate 命中时，市场级风险应先于单票冲动，先阻断新开仓再等待 headline 风险消退。
  - Tags / 标签: `event:market-gate, risk:macro-politics, memory:event-layer`

---
