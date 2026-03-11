# OpenClaw AutoTrader

这是一个面向公众的 OpenClaw 自动交易公开仓库，只披露公开策略说明、当前持仓状态和交易进展，不上传代码与私有运行细节。

[English README](./README.md)

## 最新概览

- 更新时间：2026-03-11 14:02:22 CST (UTC+08:00)
- 当前持仓：`BABA`, `RIVN`
- 最新决策：[HK] HOLD 无
- 最新交易状态：BUY RIVN
- 公开监控卡片：[docs/public-monitor/2026/2026-03-11.md](./docs/public-monitor/2026/2026-03-11.md)
- 每日报告：[docs/daily-reports/2026/2026-03-11.md](./docs/daily-reports/2026/2026-03-11.md)

## 公开策略

- 自动监控持续运行，但只有在机会质量与执行约束同时满足时才会推进动作。
- 整个流程坚持白名单、有限资金、不加杠杆、不做空。
- 原始日志、源代码、账户标识、价格数量细节和私有配置不会上传到这个仓库。

## 这个仓库会公开什么

- 最新持仓状态
- 最新交易决策和会话状态
- 每日交易报告中的公开交易情况
- 对外可披露的操作策略

## 这个仓库不会公开什么

- 源代码和自动化脚本
- 原始日志和 broker 返回
- 余额、价格、数量、PnL 数字
- 密钥、身份信息、本机路径、模型或供应商内部细节

## 仓库结构

- `README.md` / `README.zh-CN.md`：项目首页与最新概览
- `docs/public-monitor/`：公开监控卡片
- `docs/daily-reports/`：逐日交易报告
- `strategies/README.md`：公开操作策略
