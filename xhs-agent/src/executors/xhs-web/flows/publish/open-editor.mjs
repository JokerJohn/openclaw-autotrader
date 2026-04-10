import {
  clickFirstText,
  firstAttachedLocator,
  firstVisibleLocator,
  normalizeArray
} from "../../shared/browser-utils.mjs";
import { appendFlowState } from "../shared/flow-state.mjs";

async function ensureImageNoteTab(page, labels) {
  const normalizedLabels = normalizeArray(labels);
  const headerTabs = page.locator(".header-tabs .creator-tab");
  await headerTabs.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});

  const isImageEditorReady = async () => {
    const activeText = String(
      (await page.locator(".header-tabs .creator-tab.active").textContent().catch(() => "")) ?? ""
    ).trim();
    if (normalizedLabels.some((label) => activeText.includes(label))) {
      return true;
    }

    return await page
      .getByText("上传图片", { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
  };

  const tabCount = await headerTabs.count().catch(() => 0);

  for (let index = 0; index < tabCount; index += 1) {
    const tab = headerTabs.nth(index);
    const text = String((await tab.textContent().catch(() => "")) ?? "").trim();
    if (!normalizedLabels.some((label) => text.includes(label))) {
      continue;
    }

    await tab.click().catch(() => {});
    await page.waitForTimeout(800);
    if (await isImageEditorReady()) {
      return true;
    }
  }

  const fallbackClick = await clickFirstText(page, normalizedLabels, 3000);
  if (!fallbackClick) {
    return false;
  }

  await page.waitForTimeout(800);
  return await isImageEditorReady();
}

export async function openPublishEditor({ page, config, assets, receipt }) {
  appendFlowState(receipt, "open-editor");
  await page.goto(config.xhs.creatorUrl, { waitUntil: "domcontentloaded" });
  const tabReady = await ensureImageNoteTab(page, config.xhs.selectors.contentTabText);
  if (!tabReady) {
    throw new Error("Could not switch into the image-note editor before upload.");
  }

  const uploadInput = await firstAttachedLocator(page, config.xhs.selectors.uploadInput, 15000);
  if (!uploadInput) {
    throw new Error(
      "Upload control did not become ready. This usually means the page is not in the image-note editor or selectors drifted."
    );
  }

  appendFlowState(receipt, "upload-assets", { asset_count: assets.length });
  await uploadInput.setInputFiles(assets.map((asset) => asset.absolutePath));
  await page.waitForTimeout(5000);
}
