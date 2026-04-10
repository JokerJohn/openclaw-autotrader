#!/bin/bash
# XHS Agent 智能晨间自动化流程
# 建议添加到 crontab: 0 8 * * * /path/to/xhs-agent/scripts/daily-morning-routine-smart.sh

set -e

cd "$(dirname "$0")/.."

# 环境变量
export FEISHU_XHS_AGENT_WEBHOOK_URL="${FEISHU_XHS_AGENT_WEBHOOK_URL:-https://open.feishu.cn/open-apis/bot/v2/hook/2f13beb2-4691-497b-904c-6e66aed7166c}"
export XHS_PUBLISH_MODE="${XHS_PUBLISH_MODE:-draft}"

echo "[$(date)] ===== XHS Agent 智能晨间分析开始 ====="

# 1. 数据同步 (5分钟)
echo "[$(date)] Step 1/5: 同步小红书数据..."
node src/sync-xhs-analytics.mjs \
  config/example.config.json \
  state/xhs-note-analytics.latest.json \
  --pages=10

# 2. 数据备份
echo "[$(date)] Step 2/5: 备份数据..."
mkdir -p state/backup
cp state/xhs-note-analytics.latest.json \
   "state/backup/xhs-note-analytics.$(date +%Y%m%d).json"

# 3. 智能调度分析 (10分钟)
echo "[$(date)] Step 3/5: 智能调度分析..."
node src/smart-scheduler.mjs

echo "[$(date)] ===== 智能晨间分析完成 ====="

echo "智能分析报告已发送到飞书"
echo "✅ 数据同步完成"
echo "✅ 智能调度完成"
echo "✅ 飞书通知已发送"
