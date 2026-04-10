import path from "node:path";
import { pathToFileURL } from "node:url";
import { readJson, readJsonIfExists, writeJson } from "./lib/runtime-utils.mjs";
import {
  acquireChromePage,
  closePersistentChromeContext,
  launchPersistentChromeContext
} from "./executors/xhs-web/shared/browser-utils.mjs";

function parseArgs(argv) {
  const positionals = [];
  let noteIds = [];

  for (const arg of argv) {
    if (arg.startsWith("--note-ids=")) {
      noteIds = arg.slice("--note-ids=".length).split(",").map(id => id.trim()).filter(id => id.length > 0);
      continue;
    }

    positionals.push(arg);
  }

  if (positionals.length < 1) {
    usage();
  }

  return {
    configPath: path.resolve(process.cwd(), positionals[0]),
    noteIds
  };
}

function usage() {
  console.error("Usage: node ./src/delete-note-job.mjs <config.json> [--note-ids=id1,id2,id3]");
  process.exit(1);
}

async function deleteNoteByApi(page, noteId) {
  console.log(`尝试通过 creator API 删除笔记 ${noteId}...`);
  await page.goto("https://creator.xiaohongshu.com/new/note-manager", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  await page.waitForTimeout(3000);

  const result = await page.evaluate(async ({ noteId }) => {
    let req;
    self.webpackChunkugc.push([[Symbol("x")], {}, function(r) {
      req = r;
    }]);

    const noteApi = req(93753);
    if (!noteApi?.Iy) {
      throw new Error("DELETE_NOTE API is unavailable in the current creator bundle.");
    }

    const response = await noteApi.Iy({ note_id: noteId });
    return JSON.parse(JSON.stringify(response ?? null));
  }, { noteId });

  const success =
    result == null ||
    result?.success === true ||
    result?.code === 0 ||
    result?.data?.success === true ||
    result?.msg === "成功";

  if (!success) {
    throw new Error(`DELETE_NOTE API returned an unexpected payload: ${JSON.stringify(result)}`);
  }

  console.log(`笔记 ${noteId} 已通过 creator API 删除`);
  return true;
}

async function deleteNoteByIdFromNoteManager(page, noteId) {
  console.log(`正在从笔记管理页删除笔记 ${noteId}...`);
  
  // 访问笔记管理页
  await page.goto("https://creator.xiaohongshu.com/new/note-manager", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  // 等待页面加载
  await page.waitForTimeout(5000);

  // 查找包含该笔记ID的行或卡片
  // 小红书笔记管理页可能有多种布局，我们需要尝试多种方法
  
  // 方法1: 通过链接查找
  const noteLink = page.locator(`a[href*="${noteId}"]`).first();
  const linkCount = await noteLink.count();
  
  if (linkCount === 0) {
    console.log(`未找到笔记 ${noteId} 的链接`);
    throw new Error(`未找到笔记 ${noteId}`);
  }

  // 找到包含该链接的笔记卡片
  const noteCard = noteLink.locator('..');
  
  // 在笔记卡片中查找"更多"按钮（通常是三个点的图标）
  const moreButtonSelectors = [
    noteCard.locator('.more-btn'),
    noteCard.locator('[class*="more"]'),
    noteCard.locator('[class*="ellipsis"]'),
    noteCard.locator('button:has-text("更多")'),
    noteCard.locator('.d-dropdown-trigger')
  ];

  let moreButton;
  for (const selector of moreButtonSelectors) {
    const count = await selector.count();
    if (count > 0) {
      moreButton = selector.first();
      break;
    }
  }

  if (!moreButton) {
    console.log(`未找到笔记 ${noteId} 的更多按钮`);
    throw new Error(`未找到笔记 ${noteId} 的更多按钮`);
  }

  // 点击更多按钮
  await moreButton.click();
  await page.waitForTimeout(1000);

  // 在弹出的菜单中查找删除按钮
  const deleteButtonSelectors = [
    page.locator('text=删除'),
    page.locator('.d-dropdown-item:has-text("删除")'),
    page.locator('[class*="delete"]')
  ];

  let deleteButton;
  for (const selector of deleteButtonSelectors) {
    try {
      await selector.first().waitFor({ state: "visible", timeout: 3000 });
      deleteButton = selector.first();
      break;
    } catch (error) {
      // 继续尝试下一个选择器
    }
  }

  if (!deleteButton) {
    console.log(`未找到笔记 ${noteId} 的删除按钮`);
    throw new Error(`未找到笔记 ${noteId} 的删除按钮`);
  }

  // 点击删除按钮
  await deleteButton.click();
  await page.waitForTimeout(1000);

  // 查找并点击确认按钮
  const confirmButtonSelectors = [
    page.locator('text=确认'),
    page.locator('text=确定'),
    page.locator('.d-modal-footer .d-btn-primary'),
    page.locator('button:has-text("确认")'),
    page.locator('button:has-text("确定")')
  ];

  let confirmButton;
  for (const selector of confirmButtonSelectors) {
    try {
      await selector.first().waitFor({ state: "visible", timeout: 3000 });
      confirmButton = selector.first();
      break;
    } catch (error) {
      // 继续尝试下一个选择器
    }
  }

  if (!confirmButton) {
    console.log(`未找到确认按钮`);
    // 可能已经删除成功
    console.log(`笔记 ${noteId} 可能已删除`);
    return true;
  }

  // 点击确认按钮
  await confirmButton.click();
  await page.waitForTimeout(2000);

  console.log(`笔记 ${noteId} 删除成功`);
  return true;
}

async function deleteNote(page, config, noteId) {
  try {
    return await deleteNoteByApi(page, noteId);
  } catch (error) {
    console.log(`通过 creator API 删除失败: ${error.message}`);
  }

  try {
    // 先尝试从笔记管理页删除
    return await deleteNoteByIdFromNoteManager(page, noteId);
  } catch (error) {
    console.log(`从笔记管理页删除失败: ${error.message}`);
    
    // 如果笔记管理页删除失败，尝试从编辑页删除
    console.log(`尝试从编辑页删除笔记 ${noteId}...`);
    
    await page.goto(`https://creator.xiaohongshu.com/publish/update?id=${noteId}&noteType=normal`, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    // 查找页面上的所有按钮，检查文本内容
    const allButtons = await page.locator('button').all();
    
    for (const button of allButtons) {
      try {
        const text = await button.textContent();
        if (text && text.includes('删除')) {
          console.log(`找到删除按钮: ${text}`);
          await button.click();
          await page.waitForTimeout(1000);

          // 查找并点击确认按钮
          const confirmButtons = await page.locator('button').all();
          for (const confirmBtn of confirmButtons) {
            try {
              const confirmText = await confirmBtn.textContent();
              if (confirmText && (confirmText.includes('确认') || confirmText.includes('确定'))) {
                console.log(`找到确认按钮: ${confirmText}`);
                await confirmBtn.click();
                await page.waitForTimeout(2000);
                console.log(`笔记 ${noteId} 删除成功`);
                return true;
              }
            } catch (error) {
              // 继续尝试下一个按钮
            }
          }
        }
      } catch (error) {
        // 继续尝试下一个按钮
      }
    }
    
    throw new Error(`未找到笔记 ${noteId} 的删除按钮`);
  }
}

export async function deleteNotes({ configPath, noteIds }) {
  console.log(`开始删除 ${noteIds.length} 个笔记...`);
  
  const config = await readJson(configPath);
  const context = await launchPersistentChromeContext({
    configPath,
    config,
    headless: false,
    viewport: { width: 1440, height: 960 }
  });

  const results = [];

  try {
    const page = await acquireChromePage(context);

    for (const noteId of noteIds) {
      try {
        await deleteNote(page, config, noteId);
        results.push({ noteId, status: "success" });
      } catch (error) {
        console.error(`删除笔记 ${noteId} 失败:`, error.message);
        results.push({ noteId, status: "error", error: error.message });
      }
    }

    return {
      status: "success",
      results
    };
  } finally {
    await closePersistentChromeContext({ context, configPath, config }).catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await deleteNotes(args);
  console.log(
    JSON.stringify(
      {
        status: result.status,
        results: result.results
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
