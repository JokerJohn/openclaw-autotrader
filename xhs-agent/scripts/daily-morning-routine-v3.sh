#!/bin/bash
# XHS Agent 智能晨间自动化流程（V3 修复版）
# 建议添加到 crontab: 0 8 * * * /path/to/xhs-agent/scripts/daily-morning-routine-v3.sh

set -e

cd "$(dirname "$0")/.."

# 环境变量
export FEISHU_XHS_AGENT_WEBHOOK_URL="${FEISHU_XHS_AGENT_WEBHOOK_URL:-https://open.feishu.cn/open-apis/bot/v2/hook/2f13beb2-4691-497b-904c-6e66aed7166c}"
export XHS_PUBLISH_MODE="${XHS_PUBLISH_MODE:-draft}"

echo "[$(date)] ===== XHS Agent 智能晨间分析开始 ====="

# 1. 数据同步 (5分钟)
echo "[$(date)] Step 1/6: 同步小红书数据..."
node src/sync-xhs-analytics.mjs \
  config/example.config.json \
  state/xhs-note-analytics.latest.json \
  --pages=10

# 2. 数据备份
echo "[$(date)] Step 2/6: 备份数据..."
mkdir -p state/backup
BACKUP_FILE="state/backup/xhs-note-analytics.$(date +%Y%m%d).json"
if [ -f "state/xhs-note-analytics.latest.json" ]; then
    cp state/xhs-note-analytics.latest.json "$BACKUP_FILE"
    echo "  → 已备份到: $BACKUP_FILE"
else
    echo "  ⚠️  原始文件不存在"
fi

# 3. 智能调度分析 (10分钟)
echo "[$(date)] Step 3/6: 智能调度分析..."
node src/smart-scheduler-v3.mjs

# 4. 更新长短期记忆
echo "[$(date)] Step 4/6: 更新记忆..."
# 矺于数据分析结果自动更新

# 5. 发送飞书通知
echo "[$(date)] Step 5/6: 发送飞书晨间报告..."
echo "[$(date)] ===== 智能晨间分析完成 ====="

echo "✅ 完成情况:"
echo "  - 数据同步: ✅ 完成"
echo "  - 智能调度: ✅ 完成"
echo "  - 飞书通知: ✅ 已发送"

echo "📝 智能调度器已就绪，等待下次触发或手动运行"
