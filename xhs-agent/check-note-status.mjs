import path from "node:path";
import { readJson } from "./src/lib/runtime-utils.mjs";
import { loadPlaywright } from "./src/executors/xhs-web/shared/browser-utils.mjs";

async function checkNoteStatus(configPath, noteId) {
  const config = await readJson(configPath);
  const playwright = await loadPlaywright();
  const userDataDir = path.resolve(path.dirname(configPath), config.xhs.userDataDir);
  const context = await playwright.chromium.launchPersistentContext(userDataDir, {
    channel: config.xhs.channel ?? "chrome",
    headless: false,
    viewport: { width: 1440, height: 960 }
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    
    // 访问编辑页面来检查笔记是否存在
    const editUrl = `https://creator.xiaohongshu.com/publish/update?id=${noteId}&noteType=normal`;
    console.log(`访问编辑页面: ${editUrl}`);
    
    const response = await page.goto(editUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });
    
    console.log(`响应状态: ${response?.status()}`);
    console.log(`当前URL: ${page.url()}`);
    
    await page.waitForTimeout(5000);
    
    // 检查页面内容
    const pageTitle = await page.title();
    console.log(`页面标题: ${pageTitle}`);
    
    // 检查是否有特定的错误信息
    const bodyText = await page.textContent('body');
    
    if (bodyText.includes('笔记不存在') || bodyText.includes('笔记已被删除') || bodyText.includes('笔记已下架')) {
      console.log(`笔记 ${noteId} 不存在或已被删除`);
      return { noteId, status: 'deleted' };
    }
    
    if (bodyText.includes('笔记审核中') || bodyText.includes('审核')) {
      console.log(`笔记 ${noteId} 正在审核中`);
      return { noteId, status: 'reviewing' };
    }
    
    if (bodyText.includes('私密') || bodyText.includes('仅自己可见')) {
      console.log(`笔记 ${noteId} 是私密状态`);
      return { noteId, status: 'private' };
    }
    
    console.log(`笔记 ${noteId} 状态正常`);
    return { noteId, status: 'normal', url: editUrl };
    
  } catch (error) {
    console.error(`检查笔记 ${noteId} 时出错:`, error.message);
    return { noteId, status: 'error', error: error.message };
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  const configPath = 'config/example.config.json';
  const noteIds = [
    '69b28178000002603dd10',  // day-1 (正确的note_id)
    '69b2aa8b000000000c009c25', // day-2
    '69b2aaf9000000001d011a3c'  // day-3
  ];
  
  const results = [];
  for (const noteId of noteIds) {
    const result = await checkNoteStatus(configPath, noteId);
    results.push(result);
  }
  
  console.log('\n=== 检查结果 ===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
