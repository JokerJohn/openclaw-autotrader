# OpenClaw AutoTrader

Public trading journal for an OpenClaw-operated Tiger Pocket auto-trading workflow. This repository publishes only public strategy notes, current holdings status, and trading updates.

[简体中文说明](./README.zh-CN.md)

## Latest Snapshot

- Updated: 2026-03-11 14:02:22 CST (UTC+08:00)
- Current holdings: `BABA`, `RIVN`
- Latest decision: [HK] HOLD 无
- Latest trade status: BUY RIVN
- Public monitor card: [docs/public-monitor/2026/2026-03-11.md](./docs/public-monitor/2026/2026-03-11.md)
- Daily report: [docs/daily-reports/2026/2026-03-11.md](./docs/daily-reports/2026/2026-03-11.md)

## Public Strategy

- Automated monitoring runs continuously, but action is gated by explicit setup quality and execution constraints.
- The workflow stays whitelist-based, bounded, no-leverage, and no-short.
- Raw logs, source code, account identifiers, pricing details, and private configuration stay off this repository.

## What This Repo Publishes

- latest holdings status
- latest trading decision and session state
- daily trading report with public trade activity
- public strategy notes

## What This Repo Does Not Publish

- source code or automation scripts
- raw logs or broker payloads
- balances, prices, quantities, or PnL amounts
- secrets, identities, local paths, or model/provider internals

## Repository Layout

- `README.md` / `README.zh-CN.md`: public homepage and latest snapshot
- `docs/public-monitor/`: current public monitor cards
- `docs/daily-reports/`: per-day public reports
- `strategies/README.md`: public operating strategy
