#!/bin/bash
# 每日小红书数据同步脚本
# 建议添加到 crontab: 0 9 * * * /path/to/daily-sync.sh

set -e

cd "$(dirname "$0")/.."

export FEISHU_XHS_AGENT_WEBHOOK_URL="${FEISHU_XHS_AGENT_WEBHOOK_URL:-https://open.feishu.cn/open-apis/bot/v2/hook/d2f57a5e-2a24-47e3-b46c-59dea44d2cac}"

echo "[$(date)] Starting daily XHS analytics sync..."

node src/sync-xhs-analytics.mjs \
  config/example.config.json \
  state/xhs-note-analytics.latest.json \
  --pages=3

echo "[$(date)] Daily sync completed."
