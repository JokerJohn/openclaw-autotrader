import fs from "node:fs/promises";
import path from "node:path";
import {
  firstAttachedLocator,
  firstVisibleLocator
} from "../../shared/browser-utils.mjs";
import { appendFlowState } from "../shared/flow-state.mjs";

async function collectExistingImageSources(page) {
  return page
    .locator(".img-preview-area .img-container .img.preview")
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("src")).filter(Boolean))
    .catch(() => []);
}

function guessExtensionFromUrl(url) {
  const cleanUrl = String(url ?? "").split("?")[0];
  const extension = path.extname(cleanUrl).toLowerCase();
  return extension || ".jpg";
}

async function downloadLegacyImages(urls, tempDir, maxCount = urls.length) {
  const files = [];
  await fs.mkdir(tempDir, { recursive: true });

  for (const [index, url] of urls.slice(0, maxCount).entries()) {
    const response = await fetch(url);
    if (!response.ok) {
      continue;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const filePath = path.join(tempDir, `legacy-${String(index + 1).padStart(2, "0")}${guessExtensionFromUrl(url)}`);
    await fs.writeFile(filePath, buffer);
    files.push(filePath);
  }

  return files;
}

async function removeImagesUntilCount(page, targetCount, strategy = "last") {
  const countPreviewImages = async () => page.locator(".img-preview-area .img-container").count().catch(() => 0);
  let removed = 0;

  for (let iteration = 0; iteration < 16; iteration += 1) {
    const currentCount = await countPreviewImages();
    if (currentCount <= targetCount) {
      break;
    }

    const containers = page.locator(".img-preview-area .img-container");
    const targetIndex = strategy === "first" ? 0 : Math.max(currentCount - 1, 0);
    const target = containers.nth(targetIndex);
    await target.hover().catch(() => {});
    const button = target.locator(".close-btn.hoverShow, .close-btn").first();
    if (!(await button.count())) {
      break;
    }

    const clicked = await button
      .click({ force: true })
      .then(() => true)
      .catch(() => false);
    if (!clicked) {
      break;
    }

    await page.waitForTimeout(900);
    const nextCount = await countPreviewImages();
    if (nextCount >= currentCount) {
      break;
    }

    removed += currentCount - nextCount;
  }

  return removed;
}

async function clearExistingImages(page, selectors) {
  const previewArea = await firstVisibleLocator(page, selectors.imagePreviewArea, 10000);
  if (!previewArea) {
    return 0;
  }

  await previewArea.hover().catch(() => {});
  return removeImagesUntilCount(page, 1, "last");
}

export async function prepareEditAssets({
  page,
  config,
  postPackage,
  noteId,
  artifactDir,
  assets,
  receipt
}) {
  const titleInput = await firstVisibleLocator(page, config.xhs.selectors.titleInput, 15000);
  const bodyEditor = await firstVisibleLocator(page, config.xhs.selectors.bodyEditor, 15000);
  if (!titleInput || !bodyEditor) {
    throw new Error("Edit page loaded but title/body editors were not ready.");
  }

  const preserveLegacyImages = config.maintenance?.preserveLegacyImages !== false;
  const maxImages = config.limits?.maxImages ?? 9;
  const legacySlots = preserveLegacyImages ? Math.max(0, maxImages - assets.length) : 0;
  const legacyImageUrls = preserveLegacyImages ? await collectExistingImageSources(page) : [];
  const tempDownloadDir = path.join(artifactDir, "tmp", postPackage.package_id, noteId);
  const legacyImageFiles =
    preserveLegacyImages && legacySlots > 0
      ? await downloadLegacyImages(legacyImageUrls, tempDownloadDir, legacySlots)
      : [];
  receipt.legacy_images_found = legacyImageUrls.length;
  receipt.legacy_images_downloaded = legacyImageFiles.length;
  receipt.legacy_images_preserved = legacyImageFiles.length;

  appendFlowState(receipt, "clear-existing-images", {
    legacy_images_found: legacyImageUrls.length,
    legacy_images_downloaded: legacyImageFiles.length,
    legacy_slots: legacySlots
  });
  receipt.removed_assets = await clearExistingImages(page, config.xhs.selectors);

  const uploadInput = await firstAttachedLocator(page, config.xhs.selectors.uploadInput, 15000);
  if (!uploadInput) {
    throw new Error("Upload control did not become ready on the edit page.");
  }

  const uploadFiles = [...assets.map((asset) => asset.absolutePath), ...legacyImageFiles];
  appendFlowState(receipt, "upload-assets", { asset_count: uploadFiles.length });
  await uploadInput.setInputFiles(uploadFiles);
  await page.waitForTimeout(5000);
  receipt.removed_assets += await removeImagesUntilCount(page, uploadFiles.length, "first");
  postPackage.publish = {
    ...(postPackage.publish ?? {}),
    expected_image_count: uploadFiles.length
  };

  return {
    titleInput,
    bodyEditor,
    uploadFiles
  };
}
