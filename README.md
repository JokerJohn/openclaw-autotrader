![Day 45 Poster](./docs/assets/challenge-poster.svg)

# 30-Day OpenClaw AutoTrader Challenge

Watch a 5000 HKD 🦞 claw take on 30 public market days in U.S. stocks.
看一只起步于 5000 HKD 的 🦞 claw，连续 30 天公开挑战美股市场。

Last synced by decision / 决策触发同步时间: `2026-04-23 03:09:13 CST`

## Why Follow This Repo / 为什么值得关注

- a real 30-day live challenge, not backtest theater / 一个真实连续 30 天的实盘挑战，不是回测表演
- public updates on decisions, recaps, and turning points / 决策变化、每日复盘和关键转折都会公开更新
- a visible learning log that shows how the 🦞 claw updates its lessons over time / 一个公开学习日志，能看到 🦞 claw 如何随着挑战推进不断更新经验

## Challenge Dashboard / 首页进度看板

| Metric | Value |
| --- | --- |
| Day / 当前天数 | `45 / 30` (150.0%) |
| Starting capital / 起始资金 | `5000 HKD` |
| Current equity / 当前权益 | HKD 4,836.66 |
| Net PnL / 累计盈亏 | -HKD 163.34 |
| Open positions / 当前持仓标的 | 0 open: No live positions / 暂无公开持仓 |
| Latest move / 最新动作 | [US] HOLD / [US] 观望 |

## 30-Day Tracker / 30 天挑战总览

- Full challenge index / 全部挑战索引: [docs/challenge-tracker.md](./docs/challenge-tracker.md)
- Public memory / 公开记忆: [docs/public-memory/README.md](./docs/public-memory/README.md)

## Learning Log / 学习日志

Follow how the 🦞 claw turns finished trades, missed timing, and quiet sessions into reusable lessons.
看这只 🦞 claw 如何把已完成交易、时机判断和观望时段，沉淀成可复用的公开经验。

- Latest learning log / 最新学习日志: [docs/public-memory/README.md](./docs/public-memory/README.md)
- Daily notes / 每日学习记录: [docs/public-memory/short-memory.md](./docs/public-memory/short-memory.md)
- Durable lessons / 长期经验库: [docs/public-memory/long-memory.md](./docs/public-memory/long-memory.md)

## Latest Snapshot / 最新概览

- Updated / 更新时间: 2026-04-23 03:09:13 CST
- Current book / 当前组合: No live positions / 暂无公开持仓
- Floating PnL / 当前浮动盈亏: +HKD 109.78
- Latest decision / 最新决策: [US] HOLD / [US] 观望
- Next milestone / 下一阶段: Day `30` of `30`
- Public monitor / 公开监控: [docs/public-monitor/2026/2026-04-23.md](./docs/public-monitor/2026/2026-04-23.md)
- Daily report / 每日报告: [docs/daily-reports/2026/2026-04-23.md](./docs/daily-reports/2026/2026-04-23.md)

## Today's Trading Rules & Adjustments / 今日交易规则与策略调整

- Execution objective / 执行目标: deploy pocket capital only when the expected edge remains meaningfully above fees and sizing limits, with no leverage and no shorting. 仅在预期优势明显高于手续费且满足仓位上限时动用口袋资金，不加杠杆、不做空。
- Session discipline / 时段纪律: live decisions stay inside regular sessions, capped at 5 trade(s) per hour, with a 8% cash reserve and HKD 5000 daily loss stop. 实盘决策仅在常规交易时段内执行，每小时最多 5 笔，并保留 8% 现金缓冲，单日亏损达到 HKD 5000 即停止扩张。
- Live pools today / 今日实盘池: US: `AAPL`, `MSFT`, `META`, `GOOGL`, `AMZN`, `NVDA`, `AVGO`, `MU`, `BABA`, `RIVN`, `AMD`, `QCOM`, `TSM`, `TSLA`, `ORCL`, `WMT`, `LLY`, `JPM`, `XOM`, `V`, `MA`, `ASML`, `JNJ`, `ABBV`, `PG`, `BAC`, `HD`, `COST` | HK: `0388.HK`, `1810.HK`, `1024.HK`, `1211.HK`, `3750.HK`, `0700.HK`, `9988.HK`, `3690.HK`, `9999.HK`, `9618.HK`, `9888.HK`. 今日实盘池如上，按市场分别执行。
- Observation focus today / 今日观察重点: themes `半导体`, `AI芯片`, `云软件`, `中概`, `电动车`, `手机链`, `消费电子`, `CPO`, `光模块`, `存储`; public observation pool US: none / 暂无 | HK: none / 暂无. 今日观察主题为 `半导体`, `AI芯片`, `云软件`, `中概`, `电动车`, `手机链`, `消费电子`, `CPO`, `光模块`, `存储`，并同步公开观察池变化。
- Explicit exclusions / 明确排除: `智谱`, `MiniMax`, `三星电子`, `SK 海力士`, `7709.HK` stay out of the live universe when they violate the rules. 凡与规则冲突的标的（如上）均不进入实盘池。
- Latest gate result / 最新门槛结论: No US candidate cleared the live entry bar. The strongest name, `ORCL`, still showed score -1.32, post-fee EV +0.21%, and win probability 57.3%. / 虽然市场处于 Bullish 趋势，但最新的事件层信号显示国际政治风险等级为 severe（geopolitics_risk, shipping_disruption），中东局势对风险偏好构成了直接阻碍。对比当前美股候选标的，ORCL 和 AAPL 的费后 EV 分别为 0.211% 和 -0.259%，均未达到 entry_live 要求的 0.36% 准入门槛。虽然核心探测（core_probe）在 severe 风险下理论上允许对白名单标的（如 ORCL/AAPL）进行小额采样，但当前所有候选股的 local_score 均为负值（ORCL -1.32, ASML -1.50, AAPL -1.96），且 memory_profile 显示它们的平均质量得分（avg_quality_score）在当前混合（mixed）环境中表现欠佳。基于小账户费后纪律、事件避险逻辑以及对 AMZN 现有持仓的保护，选择继续 HOLD 观察，不进行非必要的样本采集。

## Latest Decision Basis / 最新决策依据

- Result / 结果: [US] HOLD / [US] 观望
- Rationale / 理由: No US candidate cleared the live entry bar. The strongest name, `ORCL`, still showed score -1.32, post-fee EV +0.21%, and win probability 57.3%. / 虽然市场处于 Bullish 趋势，但最新的事件层信号显示国际政治风险等级为 severe（geopolitics_risk, shipping_disruption），中东局势对风险偏好构成了直接阻碍。对比当前美股候选标的，ORCL 和 AAPL 的费后 EV 分别为 0.211% 和 -0.259%，均未达到 entry_live 要求的 0.36% 准入门槛。虽然核心探测（core_probe）在 severe 风险下理论上允许对白名单标的（如 ORCL/AAPL）进行小额采样，但当前所有候选股的 local_score 均为负值（ORCL -1.32, ASML -1.50, AAPL -1.96），且 memory_profile 显示它们的平均质量得分（avg_quality_score）在当前混合（mixed）环境中表现欠佳。基于小账户费后纪律、事件避险逻辑以及对 AMZN 现有持仓的保护，选择继续 HOLD 观察，不进行非必要的样本采集。
- Decision basis / 决策依据: Regime: high volatility; Path: compare-stage hold review; Model: Gemini 3 Flash Preview; Purpose: hold discipline; confidence 0.48. / 市场状态：高波动；决策链路：候选比较后维持观望；模型：Gemini 3 Flash Preview；目的：观望纪律；置信度 0.48。
- Candidate check / 候选检查: Reviewed 5 active candidate(s). Top checks: `ORCL` (cloud software) | score -1.32 | post-fee EV +0.21% | win 57.3%; `ASML` (semiconductor) | score -1.50 | post-fee EV -0.60% | win 47.1%; `AAPL` (consumer hardware) | score -1.96 | post-fee EV -0.26% | win 60.8%. / 共检查 5 只活跃候选。靠前检查结果：`ORCL`（云软件） | 评分 -1.32 | 扣费后 EV +0.21% | 胜率 57.3%；`ASML`（半导体） | 评分 -1.50 | 扣费后 EV -0.60% | 胜率 47.1%；`AAPL`（消费硬件） | 评分 -1.96 | 扣费后 EV -0.26% | 胜率 60.8%。
- Watch next / 下一步观察: Wait for at least one active candidate to turn fee-adjusted expectancy positive and clear the live score buffer. / 等待至少一只活跃候选的扣费后预期收益转正，并越过实盘评分缓冲区。

## Core Rules / 基本规则

- Starting pocket capital / 起始口袋资金: `5000 HKD`
- Default market / 默认市场: `US` equities first, with HK monitoring when relevant / 以 `US` 市场为主，必要时监控港股
- Public operation day 1 / 公开运行首日: `2026-03-10`
- Guardrails / 约束: whitelist-only, bounded deployment, no leverage, no short / 白名单、有限资金、不加杠杆、不做空
- Disclosure boundary / 披露边界: publish strategy, holdings status, decision status, and daily activity only / 只披露策略、持仓状态、决策状态和每日交易活动

## What This Repo Publishes / 这个仓库公开什么

- current holdings with quantity / 当前持仓与数量
- latest trade timing and execution rationale / 最新交易时机与执行理由
- latest no-trade reason and next watch item / 最新观望理由与下一步观察点
- public operating rules / 对外可披露的操作规则
