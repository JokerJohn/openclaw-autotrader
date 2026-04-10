#!/usr/bin/env node
/**
 * XHS Agent 智能调度器
 * 基于帖子数据智能判断更新时间，避免小红书风控
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '../config/example.config.json');
const ANALYTICS_PATH = path.join(__dirname, '../state/xhs-note-analytics.latest.json');
const LOG_PATH = path.join(__dirname, '../logs/scheduler.log');

// 日志函数
function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  
  // 输出到控制台
  console.log(message);
  
  // 写入日志文件
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, logLine, 'utf8');
}

// 读取配置
function readConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return config;
  } catch (error) {
    log(`读取配置失败: ${error.message}`);
    return {};
  }
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
  const collects = note.collect_count || 0;
  const shares = note.share_count || 0;
  
  const engagement = likes + comments + collects + shares;
  return (engagement / note.read_count) * 100;
}

// 识别需要优化的帖子
function identifyLowPerformingNotes(notes) {
  if (notes.length === 0) return [];

  // 计算平均值
  const avgRead = notes.reduce((sum, n) => sum + (n.read_count || 0), 0) / notes.length;
  const avgEngagement = notes.reduce((sum, n) => sum + calculateEngagementRate(n), 0) / notes.length;

  log(`平均阅读量: ${avgRead.toFixed(0)}, 平均互动率: ${avgEngagement.toFixed(2)}%`);

  // 筛选条件
  return notes.filter(note => {
    const engagementRate = calculateEngagementRate(note);
    const readCount = note.read_count || 0;
    const ageDays = note.published_age_days || 0;

    // 低表现定义：
    // 1. 阅读量低于平均 50%
    // 2. 互动率低于 5%
    // 3. 发布时间超过 7 天（有足够数据）
    return (
      readCount < avgRead * 0.5 &&
      engagementRate < 5 &&
      ageDays > 7
    );
  });
}

// 智能选择更新时间
function selectSmartUpdateTime() {
  const now = new Date();
  const hour = now.getHours();
  
  log(`当前时间: ${hour}:00`);

  // 随机时间范围（避开高峰期，选择低峰期发布）
  // 策略：避免每天固定时间，采用随机但合理的范围
  
  // 避免时间段：9:00-11:00（上班高峰）、20:00-22:00（晚高峰）
  // 推荐时间段：
  // - 上午：10:00-11:30（午休前）
  // - 下午：14:00-16:00（下午中段）
  // - 晚上：22:00-23:59（夜猫时间）
  // - 周末：8:00-10:00（周末早晨）

  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  
  const timeSlots = isWeekend
    ? [
        { min: 8, max: 10 },    // 周末早晨
        { min: 14, max: 16 },   // 周末下午
        { min: 20, max: 22 },   // 周末晚上
      ]
    : [
        { min: 10, max: 11.5 },  // 工作日午休前
        { min: 14, max: 16 },   // 工作日下午
        { min: 22, max: 23.5 }, // 工作日晚猫
      ];

  // 随机选择一个时间段
  const randomSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
  
  // 在随机时间段内随机选择具体时间
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

  log(`选择时间段: ${Math.floor(randomSlot.min)}:00-${randomSlot.max}:00`);
  log(`随机更新时间: ${scheduledTime.toLocaleTimeString('zh-CN', { hour12: false })}`);

  return scheduledTime;
}

// 检查更新冷却期
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
📝 XHS Agent 智能调度报告

${summary}

---
  `.trim();

  try {
    // 这里使用 fetch 发送 Webhook 通知
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
  log('===== XHS Agent 智能调度器启动 =====');

  // 读取数据
  const notes = readAnalytics();
  
  if (notes.length === 0) {
    log('没有帖子数据，退出');
    return;
  }

  log(`已加载 ${notes.length} 条帖子数据`);

  // 识别低表现帖子
  const lowPerformingNotes = identifyLowPerformingNotes(notes);
  
  if (lowPerformingNotes.length === 0) {
    log('🎉 没有需要优化的帖子');
    return;
  }

  log(`识别出 ${lowPerformingNotes.length} 条需要优化的帖子`);

  // 智能选择更新时间
  const scheduledTime = selectSmartUpdateTime();
  const hoursUntilUpdate = Math.ceil((scheduledTime.getTime() - Date.now()) / (1000 * 60 * 60));

  // 生成报告
  const summary = lowPerformingNotes.map((note, index) => {
    const engagementRate = calculateEngagementRate(note);
    const readCount = note.read_count || 0;
    const noteId = note.note_id || '未知';

    // 检查冷却期
    const cooldownCheck = checkEditCooldown(noteId);

    return `
帖子 ${index + 1}: ${note.title}
Note ID: ${noteId}
当前数据: ${readCount} 阅读, ${engagementRate.toFixed(2)}% 互动率
问题诊断: 阅读量低于平均 50%, 互动率 < 5%
${cooldownCheck.canEdit 
  ? `⏰ 建议更新时间: ${scheduledTime.toLocaleString('zh-CN')}`
  : `⚠️ 冷却期中，剩余 ${cooldownCheck.remainingHours} 小时\n   最后编辑: ${cooldownCheck.lastEditTime}`
}
    `.trim();
  }).join('\n\n---\n\n');

  const report = `
📝 待优化帖子清单

共 ${lowPerformingNotes.length} 条帖子需要优化
建议更新时间: ${scheduledTime.toLocaleString('zh-CN')}
距离现在: ${hoursUntilUpdate} 小时

${summary}

---
下次运行将根据数据重新计算最优更新时间
  `.trim();

  log(report);

  // 发送飞书通知
  const webhookUrl = process.env.FEISHU_XHS_AGENT_WEBHOOK_URL || 
                    process.env.FEISHU_XHS_AGENT_WEBHOOK_URL;
  sendFeishuReport(report, webhookUrl);

  log('===== 智能调度分析完成 =====');
}

// 运行
main().catch(error => {
  log(`错误: ${error.message}`);
  process.exit(1);
});
