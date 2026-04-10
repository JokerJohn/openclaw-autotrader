import path from "node:path";
import { readJson } from "./src/lib/runtime-utils.mjs";
import { loadPlaywright } from "./src/executors/xhs-web/shared/browser-utils.mjs";

async function debugDeleteButtons(configPath, noteId) {
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
    
    // 访问编辑页面
    await page.goto(`https://creator.xiaohongshu.com/publish/update?id=${noteId}&noteType=normal`, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    console.log(`等待页面加载...`);
    await page.waitForTimeout(5000);
    
    // 截图当前页面
    const screenshotPath = `/Users/xhubd/.openclaw/workspaces/xhs-agent/debug-delete-${noteId}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`已保存截图: ${screenshotPath}`);
    
    // 获取页面上所有按钮的文本
    console.log('\n=== 页面上的所有按钮 ===');
    const buttons = await page.locator('button').all();
    for (let i = 0; i < buttons.length; i++) {
      try {
        const button = buttons[i];
        const text = await button.textContent();
        const className = await button.getAttribute('class');
        const visible = await button.isVisible();
        
        if (text && text.trim()) {
          console.log(`按钮 ${i}: "${text.trim()}" (visible: ${visible}, class: ${className})`);
        }
      } catch (error) {
        // 忽略错误
      }
    }
    
    // 查找包含"删除"、"撤回"、"下架"等关键词的按钮
    console.log('\n=== 查找操作相关的按钮 ===');
    const keywords = ['删除', '撤回', '下架', '隐藏', '私密', '更多', '设置', '操作'];
    for (const keyword of keywords) {
      const keywordButtons = await page.locator(`button:has-text("${keyword}")`).all();
      if (keywordButtons.length > 0) {
        console.log(`找到包含"${keyword}"的按钮: ${keywordButtons.length}个`);
        for (let i = 0; i < keywordButtons.length; i++) {
          const btn = keywordButtons[i];
          const text = await btn.textContent();
          const className = await btn.getAttribute('class');
          console.log(`  - "${text}" (class: ${className})`);
        }
      }
    }
    
    // 查找菜单或下拉项
    console.log('\n=== 查找菜单项 ===');
    const menuItems = await page.locator('.d-dropdown-item, .menu-item, [role="menuitem"]').all();
    for (let i = 0; i < menuItems.length; i++) {
      try {
        const item = menuItems[i];
        const text = await item.textContent();
        if (text && text.trim()) {
          console.log(`菜单项 ${i}: "${text.trim()}"`);
        }
      } catch (error) {
        // 忽略错误
      }
    }
    
    // 保持浏览器打开以便手动检查
    console.log(`\n浏览器保持打开状态，请手动检查页面...`);
    console.log(`按 Ctrl+C 关闭浏览器`);
    
    // 等待用户手动关闭
    await new Promise(() => {});
    
  } catch (error) {
    console.error(`调试出错:`, error.message);
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  const configPath = 'config/example.config.json';
  const noteId = '69b2aaf9000000001d011a3c'; // day-3，私密状态
  
  await debugDeleteButtons(configPath, noteId);
}

main().catch(console.error);
