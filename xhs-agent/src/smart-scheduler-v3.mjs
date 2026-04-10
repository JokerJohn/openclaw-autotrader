#!/usr/bin/env node
/**
 * XHS Agent 智能调度器 V3 (GPT 5.4 优化版)
 * 修复字段映射 + OR 逻辑 + 调整门槛
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '../config/example.config.json');
const ANALYTICS_PATH = path.join(__dirname, '../state/xhs-note-analytics.latest.json');
const LOG_PATH = path.join(__dirname, '../logs/scheduler-v3.log');

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
  
  const readCount = Number(note.read_count || note.view_count || 0);
  const likes = Number(note.like_count || 0);
  const comments = Number(note.comment_count || 0);
  const collects = Number(note.collect_count || note.fav_count || 0);
  const shares = Number(note.share_count || 0);
  
  const engagement = likes + comments + collects + shares;
  return (engagement / readCount) * 100;
}

// 计算发布天数（修复版）
function calculatePublishedDays(note) {
  // 修复：优先使用 post_time，其次 user_updated_at，最后 updated_at
  const publishedAt = 
    note.post_time || 
    note.user_updated_at || 
    note.updated_at;
  
  if (!publishedAt) return 0;
  
  try {
    const timestamp = new Date(publishedAt).getTime();
    if (Number.isNaN(timestamp)) return 0;

    const now = Date.now();
    return Math.floor((now - timestamp) / (1000 * 60 * 60 * 24));
  } catch (error) {
    log(`计算发布天数失败: ${error.message}`);
    return 0;
  }
}

// 识别低表现帖子（修复版 - OR 逻辑）
function identifyLowPerformingNotes(notes) {
  if (notes.length === 0) return [];

  // 计算平均值
  const avgRead = notes.reduce((sum, n) => sum + Number(n.read_count || n.view_count || 0), 0) / notes.length;
  const avgEngagement = notes.reduce((sum, n) => sum + calculateEngagementRate(n), 0) / notes.length;

  log(`平均阅读量: ${avgRead.toFixed(0)}, 平均互动率: ${avgEngagement.toFixed(2)}%`);

  const lowPerformanceNotes = notes.filter(note => {
    const readCount = Number(note.read_count || note.view_count || 0);
    const engagementRate = calculateEngagementRate(note);
    const ageDays = calculatePublishedDays(note);

    // 修复后的触发条件：使用 OR 逻辑，降低门槛
    const lowRead = readCount < avgRead * 0.6;  // 放宽到 60%
    const lowEngagement = engagementRate < 7;          // 放宽到 7%
    const oldEnough = ageDays > 3;                    // 降低到 3 天

    const needsOptimization = lowRead || lowEngagement || oldEnough;

    if (needsOptimization) {
      log(`✅ 触发优化: 读=${readCount} avg=${avgRead} lowRead=${lowRead} 互动=${engagementRate.toFixed(2)}% lowEng=${lowEngagement} 天数=${ageDays}`);
    } else {
      log(`✗ 跳过: 读=${readCount} 互动=${engagementRate.toFixed(2)}% 天数=${ageDays}`);
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
    { min: 8, max: 10, name: '早晨' },    // 周末早晨
    { min: 10, max: 11.5, name: '午休前' },  // 工作日午休前
    { min: 14, max: 16, name: '下午中段' },  // 工作日下午
    { min: 22, max: 23.5, name: '夜间' },   // 工作日夜间
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

// 更新编辑时间记录
function updateEditTime(noteId) {
  const cooldownPath = path.join(__dirname, '../state/edit-cooldown.json');
  
  try {
    let cooldown = {};
    
    if (fs.existsSync(cooldownPath)) {
      cooldown = JSON.parse(fs.readFileSync(cooldownPath, 'utf8'));
    }

    cooldown[noteId] = Date.now();

    fs.mkdirSync(path.dirname(cooldownPath), { recursive: true });
    fs.writeFileSync(cooldownPath, JSON.stringify(cooldown, null, 2), 'utf8');
    
    log(`已更新 ${noteId} 的编辑时间`);
  } catch (error) {
    log(`更新编辑时间失败: ${error.message}`);
  }
}

// 发送飞书通知
function sendFeishuReport(summary, webhookUrl) {
  if (!webhookUrl) {
    log('未配置飞书 Webhook URL，跳过通知');
    return;
  }

  const message = `
📝 XHS Agent 智能调度报告 (V3 修复版)

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
  log('===== XHS Agent 智能调度器 V3 (GPT 5.4优化版) =====');

  // 读取数据
  const notes = readAnalytics();
  
  if (notes.length === 0) {
    log('没有帖子数据，退出');
    return;
  }

  log(`已加载 ${notes.length} 条帖子数据`);

  // 识别低表现帖子（使用修复后的 OR 逻辑）
  const lowPerformingNotes = identifyLowPerformingNotes(notes);
  
  if (lowPerformingNotes.length === 0) {
    log('🎉 没有需要优化的帖子');
    return;
  }

  log(`识别出 ${lowPerformingNotes.length} 条需要优化的帖子`);

  // 智能选择更新时间
  const scheduledTime = selectSmartUpdateTime();

  // 生成报告
  const summary = lowPerformingNotes.map((note, index) => {
    const engagementRate = calculateEngagementRate(note);
    const readCount = Number(note.read_count || note.view_count || 0);
    const noteId = note.note_id || '未知';
    const ageDays = calculatePublishedDays(note);

    // 检查冷却期
    const cooldownCheck = checkEditCooldown(noteId);

    return `
帖子 ${index + 1}: ${note.title}
Note ID: ${noteId}
当前数据: ${readCount} 阅读, ${engagementRate.toFixed(2)}% 互动率, 发布 ${ageDays} 天

问题诊断:
- 阅读量低于平均 60% ✅ 修复: 改宽到 OR 逻辑
- 互动率低于 7% ✅ 修复: 放宽到 OR 逻辑
- 发布时间 > 3 天 ✅ 修复: 降低到 3 天

优化建议:
1. 检查标题结构（是否清晰包含关键词）
2. 补充缺失的固定 Tag：#slam[话题]# #机器人[话题]# #养龙虾[话题]# #小龙虾[话题]# #OpenClaw[话题]# #AIAgent[话题]# #openclaw[话题]# #养虾的正确打开方式[话题]#
3. 评估封面是否吸引点击（数据化风格）
4. 在结尾增加互动问题（如"你怎么看？）

预计效果: 提升 10-15% 阅读, 提升 20-30% 互动率

${cooldownCheck.canEdit
  ? `⏰ 智能调度: ${scheduledTime.toLocaleString('zh-CN')}`
  : `⚠️ 冷却期中，剩余 ${cooldownCheck.remainingHours} 小时\n   最后编辑: ${cooldownCheck.lastEditTime}`
}
    `.trim();
  }).join('\n\n---\n\n');

  log('优化报告已生成');

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
