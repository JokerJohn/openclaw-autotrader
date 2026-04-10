
import path from "node:path";
import { loadPlaywright } from "./src/executors/xhs-web/shared/browser-utils.mjs";
import { readJson } from "./src/lib/runtime-utils.mjs";

async function testDelete() {
  const config = await readJson(path.resolve(process.cwd(), "config/example.config.json"));
  const playwright = await loadPlaywright();
  const userDataDir = path.resolve(process.cwd(), config.xhs.userDataDir);
  const context = await playwright.chromium.launchPersistentContext(userDataDir, {
    channel: config.xhs.channel ?? "chrome",
    headless: false,
    viewport: { width: 1440, height: 960 }
  });
  
  const page = context.pages()[0] ?? (await context.newPage());
  
  // 访问小红书创作后台笔记管理页
  await page.goto("https://creator.xiaohongshu.com/new/note-manager", { waitUntil: "domcontentloaded" });
  console.log("已打开笔记管理页:", page.url());
  
  await page.waitForTimeout(5000);
  
  // 获取页面HTML内容
  const html = await page.content();
  console.log("页面HTML内容:\n", html);
  
  // 关闭浏览器
  await context.close();
}

testDelete().catch(console.error);
