#!/usr/bin/env node
/**
 * XHS Agent 智能调度器 V2 (GPT-5.4优化版)
 * 修复优化触发条件，更精确的低表现识别
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '../config/example.config.json');
const ANALYTICS_PATH = path.join(__dirname, '../state/xhs-note-analytics.latest.json');
const LOG_PATH = path.join(__dirname, '../logs/scheduler.log');

const OPTIMIZATION_THRESHOLDS = {
  readRatio: 0.6,
  engagementRate: 5,
  minAgeDays: 3,
};

// 日志函数
function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, logLine, 'utf8');
}

// 读取分析数据
function readAnalytics() {
  try {
    const analytics = JSON.parse(fs.readFileSync(ANALYTICS_PATH, 'utf8'));
    return analytics.notes || [];
  } catch (error) {
    log(`读取分析数据失败: ${error.message}`);
    return [];
  }
}

// 计算互动率
function calculateEngagementRate(note) {
  if (!note.read_count || note.read_count === 0) return 0;
  
  const likes = note.like_count || 0;
  const comments = note.comment_count || 0;
  const collects = note.collect_count ?? note.fav_count ?? 0;
  const shares = note.share_count || 0;
  
  const engagement = likes + comments + collects + shares;
  return (engagement / note.read_count) * 100;
}

// 计算发布天数（优先使用真实发布时间）
function calculatePublishedDaysAgo(note) {
  const publishedAt = note.post_time || note.user_updated_at || note.updated_at;
  if (!publishedAt) return 0;
  
  const publishedDate = new Date(publishedAt);
  const timestamp = publishedDate.getTime();

  if (Number.isNaN(timestamp)) {
    log(`计算发布天数失败: 无法解析时间字段，note_id=${note.note_id || '未知'}，原始值=${publishedAt}`);
    return 0;
  }

  const now = Date.now();
  const diffTime = now - timestamp;
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

// 识别低表现帖子（修复版）
function identifyLowPerformingNotes(notes) {
  if (notes.length === 0) return [];

  // 计算平均值
  const avgRead = notes.reduce((sum, n) => sum + (n.read_count || 0), 0) / notes.length;
  const avgEngagement = notes.reduce((sum, n) => sum + calculateEngagementRate(n), 0) / notes.length;
  const readThreshold = avgRead * OPTIMIZATION_THRESHOLDS.readRatio;
  const engagementThreshold = OPTIMIZATION_THRESHOLDS.engagementRate;
  const ageThreshold = OPTIMIZATION_THRESHOLDS.minAgeDays;

  log(`平均阅读量: ${avgRead.toFixed(0)}, 平均互动率: ${avgEngagement.toFixed(2)}%`);
  log(`优化阈值: 阅读 < 平均 ${(OPTIMIZATION_THRESHOLDS.readRatio * 100).toFixed(0)}% (${readThreshold.toFixed(0)}), 互动率 < ${engagementThreshold}%, 发布时间 >= ${ageThreshold} 天`);

  const lowPerformanceNotes = notes.filter(note => {
    const readCount = note.read_count || 0;
    const engagementRate = calculateEngagementRate(note);
    const ageDays = calculatePublishedDaysAgo(note);

    const lowRead = readCount < readThreshold;
    const lowEngagement = engagementRate < engagementThreshold;
    const oldEnough = ageDays >= ageThreshold;

    log(
      `分析帖子: "${note.title}" | note_id=${note.note_id || '未知'} | 阅读=${readCount} (${lowRead ? '低' : '正常'}) | 互动=${engagementRate.toFixed(2)}% (${lowEngagement ? '低' : '正常'}) | 天数=${ageDays} (${oldEnough ? '满足' : '未满足'})`
    );

    // 修复后的触发逻辑：
    // 1. 发布时间达到最小观察窗口（默认 3 天）
    // 2. 阅读量或互动率任一项偏低即可触发
    const needsOptimization = oldEnough && (lowRead || lowEngagement);

    if (needsOptimization) {
      log(
        `✅ 触发优化: ageDays(${ageDays} >= ${ageThreshold}) && (阅读${lowRead ? '偏低' : '正常'} || 互动${lowEngagement ? '偏低' : '正常'})`
      );
    }

    return needsOptimization;
  });

  log(`识别出 ${lowPerformanceNotes.length} 条需要优化的帖子`);

  return lowPerformanceNotes;
}

// 智能选择更新时间
function selectSmartUpdateTime() {
  const now = new Date();
  const hour = now.getHours();
  
  log(`当前时间: ${hour}:00`);

  const timeSlots = [
    { min: 8, max: 10, name: '早晨' },
    { min: 10, max: 11.5, name: '午休前' },
    { min: 14, max: 16, name: '下午中段' },
    { min: 22, max: 23.5, name: '夜间' },
  ];

  const randomSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
  
  const randomMinutes = Math.floor(Math.random() * 60);
  const randomHour = randomSlot.min + Math.random() * (randomSlot.max - randomSlot.min);
  
  const scheduledTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Math.floor(randomHour),
    randomMinutes,
    0
  );

  log(`选择时间段: ${randomSlot.name} (${randomSlot.min}:00-${randomSlot.max}:00)`);
  log(`随机更新时间: ${scheduledTime.toLocaleTimeString('zh-CN', { hour12: false })}`);

  return scheduledTime;
}

// 检查编辑冷却期
function checkEditCooldown(noteId, cooldownHours = 48) {
  const cooldownPath = path.join(__dirname, '../state/edit-cooldown.json');
  
  try {
    if (!fs.existsSync(cooldownPath)) {
      return { canEdit: true };
    }

    const cooldown = JSON.parse(fs.readFileSync(cooldownPath, 'utf8'));
    const lastEdit = cooldown[noteId];

    if (!lastEdit) {
      return { canEdit: true };
    }

    const now = Date.now();
    const elapsedHours = (now - lastEdit) / (1000 * 60 * 60);

    if (elapsedHours < cooldownHours) {
      const remainingHours = Math.ceil(cooldownHours - elapsedHours);
      return {
        canEdit: false,
        remainingHours,
        lastEditTime: new Date(lastEdit).toLocaleString('zh-CN')
      };
    }

    return { canEdit: true };
  } catch (error) {
    log(`检查冷却期失败: ${error.message}`);
    return { canEdit: true };
  }
}

// 发送飞书通知
function sendFeishuReport(summary, webhookUrl) {
  if (!webhookUrl) {
    log('未配置飞书 Webhook URL，跳过通知');
    return;
  }

  const message = `
📝 XHS Agent 智能调度报告 (GPT-5.4优化版)

${summary}

---
  `.trim();

  try {
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msg_type: 'text',
        content: {
          text: message
        }
      }),
    });
    
    log('飞书通知已发送');
  } catch (error) {
    log(`发送飞书通知失败: ${error.message}`);
  }
}

// 主函数
async function main() {
  log('===== XHS Agent 智能调度器 V2 (GPT-5.4优化版) =====');

  // 读取数据
  const notes = readAnalytics();
  
  if (notes.length === 0) {
    log('没有帖子数据，退出');
    return;
  }

  log(`已加载 ${notes.length} 条帖子数据`);

  // 识别低表现帖子（使用修复后的条件）
  const lowPerformingNotes = identifyLowPerformingNotes(notes);
  
  if (lowPerformingNotes.length === 0) {
    log('🎉 没有需要优化的帖子');
    return;
  }

  // 智能选择更新时间
  const scheduledTime = selectSmartUpdateTime();

  // 生成报告
  const summary = lowPerformingNotes.map((note, index) => {
    const engagementRate = calculateEngagementRate(note);
    const readCount = note.read_count || 0;
    const noteId = note.note_id || '未知';
    const ageDays = calculatePublishedDaysAgo(note);

    // 检查冷却期
    const cooldownCheck = checkEditCooldown(noteId);

    return `
帖子 ${index + 1}: ${note.title}
Note ID: ${noteId}
当前数据: ${readCount} 阅读, ${engagementRate.toFixed(2)}% 互动率, 发布 ${ageDays} 天

问题诊断:
- 阅读量/互动率存在低表现信号 ❌
- 已超过最小观察窗口 ${OPTIMIZATION_THRESHOLDS.minAgeDays} 天 ❌

优化建议:
1. 检查标题结构（是否清晰包含关键词）
2. 补充缺失的固定 Tag
3. 评估封面是否吸引点击
4. 在结尾增加互动问题（如"你怎么看？"）

预计效果: 提升 10-15% 阅读, 提升 20-30% 互动率

${cooldownCheck.canEdit
  ? `⏰ 建议更新时间: ${scheduledTime.toLocaleString('zh-CN')}`
  : `⚠️ 冷却期中，剩余 ${cooldownCheck.remainingHours} 小时\n   最后编辑: ${cooldownCheck.lastEditTime}`}
    `.trim();
  }).join('\n\n---\n\n');

  log('智能优化报告已生成');

  // 发送飞书通知
  const webhookUrl = process.env.FEISHU_XHS_AGENT_WEBHOOK_URL || 
                    process.env.FEISHU_XHS_AGENT_WEBHOOK_URL;
  sendFeishuReport(summary, webhookUrl);

  log('===== 智能调度分析完成 =====');
}

// 运行
main().catch(error => {
  log(`错误: ${error.message}`);
  process.exit(1);
});
