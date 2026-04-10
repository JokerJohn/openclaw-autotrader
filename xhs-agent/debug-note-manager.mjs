import path from "node:path";
import { readJson } from "./src/lib/runtime-utils.mjs";
import { loadPlaywright } from "./src/executors/xhs-web/shared/browser-utils.mjs";

async function debugNoteManager(configPath, noteId) {
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
    
    // 访问笔记管理页
    console.log(`访问笔记管理页...`);
    await page.goto("https://creator.xiaohongshu.com/new/note-manager", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    console.log(`等待页面加载...`);
    await page.waitForTimeout(5000);
    
    // 截图当前页面
    const screenshotPath = `/Users/xhubd/.openclaw/workspaces/xhs-agent/debug-note-manager.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`已保存截图: ${screenshotPath}`);
    
    // 查找包含笔记ID的元素
    console.log(`\n=== 查找笔记ID ${noteId} ===`);
    
    // 方法1: 查找包含noteId的链接
    const noteLinks = await page.locator(`a[href*="${noteId}"]`).all();
    console.log(`找到包含noteId的链接: ${noteLinks.length}个`);
    
    for (let i = 0; i < noteLinks.length; i++) {
      const link = noteLinks[i];
      const href = await link.getAttribute('href');
      console.log(`  链接 ${i}: ${href}`);
    }
    
    // 方法2: 查找所有包含"更多"、"操作"、"..."等文本的按钮
    console.log('\n=== 查找操作按钮 ===');
    const actionButtonSelectors = [
      'button:has-text("更多")',
      'button:has-text("操作")',
      'button:has-text("...")',
      'button:has-text("⋮")',
      'button:has-text("︙")',
      '[class*="more"]',
      '[class*="ellipsis"]',
      '[class*="dropdown"]'
    ];
    
    for (const selector of actionButtonSelectors) {
      const buttons = await page.locator(selector).all();
      if (buttons.length > 0) {
        console.log(`选择器 "${selector}": ${buttons.length}个`);
        for (let i = 0; i < Math.min(buttons.length, 5); i++) {
          try {
            const btn = buttons[i];
            const text = await btn.textContent();
            const className = await btn.getAttribute('class');
            const visible = await btn.isVisible();
            console.log(`  按钮 ${i}: "${text}" (visible: ${visible}, class: ${className?.substring(0, 50)})`);
          } catch (error) {
            console.log(`  按钮 ${i}: 无法读取`);
          }
        }
      }
    }
    
    // 方法3: 查找所有SVG图标（可能是更多按钮）
    console.log('\n=== 查找SVG图标 ===');
    const svgs = await page.locator('svg').all();
    console.log(`页面上共有 ${svgs.length} 个SVG图标`);
    
    // 查找可能包含笔记标题的元素
    console.log('\n=== 查找笔记标题 ===');
    const titles = await page.locator('[class*="title"], [class*="note-title"], .note-name, h1, h2, h3').all();
    console.log(`找到 ${titles.length} 个可能的标题元素`);
    for (let i = 0; i < Math.min(titles.length, 10); i++) {
      try {
        const title = titles[i];
        const text = await title.textContent();
        if (text && text.trim() && text.trim().length < 100) {
          console.log(`  标题 ${i}: "${text.trim()}"`);
        }
      } catch (error) {
        // 忽略错误
      }
    }
    
    // 获取页面HTML的前几行，看看结构
    console.log('\n=== 页面HTML结构（前2000字符）===');
    const html = await page.content();
    console.log(html.substring(0, 2000));
    
    console.log(`\n浏览器保持打开状态，请手动检查页面...`);
    console.log(`按 Ctrl+C 关闭浏览器`);
    
    // 等待用户手动关闭
    await new Promise(() => {});
    
  } catch (error) {
    console.error(`调试出错:`, error.message);
    console.error(error.stack);
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  const configPath = 'config/example.config.json';
  const noteId = '69b2aaf9000000001d011a3c'; // day-3
  
  await debugNoteManager(configPath, noteId);
}

main().catch(console.error);
