# OpenClaw AutoTrader

Public daily trading journal for an OpenClaw-operated Tiger Pocket auto-trading workflow.
OpenClaw 驱动的 Tiger Pocket 自动交易公开交易日报仓库。

Last synced by decision / 决策触发同步时间: `2026-03-11 20:50:24 CST`

## Public Capability Overview / 公开能力概览

- market-session monitoring with bounded live execution / 交易时段监控与有限实盘执行
- automatic public sync for holdings, decisions, and daily reports / 持仓、决策和每日报告的自动公开同步
- daily review of filled trades and no-trade windows / 已成交动作与观望时段的每日复盘
- small-capital deployment with strict exposure limits / 小额资金运行与严格暴露控制
- public transparency on outcomes without disclosing internal system design / 公开结果与状态，但不披露内部系统设计

## Latest Snapshot / 最新概览

- Updated / 更新时间: 2026-03-11 20:50:23 CST (UTC+08:00)
- Current holdings / 当前持仓:
  - `BABA` x 0.938 | value HKD 1,004.31 | floating HKD -6.56
  - `RIVN` x 30.187 | value HKD 3,906.38 | floating HKD -77.68
- Latest decision / 最新决策: 未调用
- Latest trade / 最新交易: 2026-03-11 03:13:03 CST (UTC+08:00) | BUY RIVN | qty 30.187
- Daily tokens / 当日 Token: total 54731, gpt-5.4 33615 (61.4%)
- Public monitor / 公开监控: [docs/public-monitor/2026/2026-03-11.md](./docs/public-monitor/2026/2026-03-11.md)
- Daily report / 每日报告: [docs/daily-reports/2026/2026-03-11.md](./docs/daily-reports/2026/2026-03-11.md)

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
