import fs from "node:fs/promises";
import path from "node:path";
import {
  acquireChromePage,
  closePersistentChromeContext,
  launchPersistentChromeContext
} from "./executors/xhs-web/shared/browser-utils.mjs";

function usage() {
  console.error("Usage: node ./src/calibrate-xhs-config.mjs <config.json>");
  process.exit(1);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function resolveConfigPath(configPath, relativePath) {
  return path.resolve(path.dirname(configPath), relativePath);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function pickFirstWorking(page, selectors) {
  for (const selector of selectors ?? []) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: "visible", timeout: 3000 });
      return selector;
    } catch {
      continue;
    }
  }

  return null;
}

async function pickFirstAttached(page, selectors) {
  for (const selector of selectors ?? []) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: "attached", timeout: 3000 });
      return selector;
    } catch {
      continue;
    }
  }

  return null;
}

async function clickFirstText(page, labels) {
  for (const label of labels ?? []) {
    const locator = page.getByText(label, { exact: false }).first();
    try {
      await locator.waitFor({ state: "visible", timeout: 3000 });
      await locator.click();
      return label;
    } catch {
      continue;
    }
  }

  return null;
}

async function findButtonText(page, candidates) {
  for (const text of candidates ?? []) {
    try {
      await page.getByRole("button", { name: new RegExp(text, "i") }).first().waitFor({
        state: "visible",
        timeout: 2000
      });
      return text;
    } catch {
      continue;
    }
  }

  return null;
}

async function main() {
  const [configArg] = process.argv.slice(2);
  if (!configArg) {
    usage();
  }

  const configPath = path.resolve(process.cwd(), configArg);
  const config = await readJson(configPath);
  const userDataDir = resolveConfigPath(configPath, config.xhs.userDataDir);
  const artifactDir = resolveConfigPath(
    configPath,
    config.xhs.calibration?.artifactDir ?? "./artifacts/calibration"
  );
  await ensureDir(artifactDir);

  const context = await launchPersistentChromeContext({
    configPath,
    config,
    headless: false,
    viewport: { width: 1440, height: 960 }
  });

  try {
    const page = await acquireChromePage(context);
    await page.goto(config.xhs.creatorUrl, { waitUntil: "domcontentloaded" });

    const contentTabText = await clickFirstText(page, config.xhs.selectors.contentTabText);
    const uploadSelector = await pickFirstAttached(page, config.xhs.selectors.uploadInput);

    let titleSelector = null;
    let bodySelector = null;
    if (uploadSelector && config.xhs.calibration?.sampleImage) {
      const sampleImagePath = resolveConfigPath(configPath, config.xhs.calibration.sampleImage);
      await page.locator(uploadSelector).first().setInputFiles(sampleImagePath);
      await page.waitForTimeout(5000);
      titleSelector = await pickFirstWorking(page, config.xhs.selectors.titleInput);
      bodySelector = await pickFirstWorking(page, config.xhs.selectors.bodyEditor);
    }

    const draftButtonText = await findButtonText(page, config.xhs.selectors.draftButtonText);
    const publishButtonText = await findButtonText(page, config.xhs.selectors.publishButtonText);
    const confirmButtonText = await findButtonText(page, config.xhs.selectors.confirmButtonText);

    const screenshotPath = path.join(artifactDir, "creator-editor.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const calibration = {
      checked_at: new Date().toISOString(),
      page_url: page.url(),
      found: {
        contentTabText,
        titleInput: titleSelector,
        bodyEditor: bodySelector,
        uploadInput: uploadSelector,
        draftButtonText,
        publishButtonText,
        confirmButtonText
      },
      screenshot: screenshotPath
    };

    const calibratedConfig = structuredClone(config);
    if (contentTabText) {
      calibratedConfig.xhs.selectors.contentTabText = [contentTabText];
    }
    if (titleSelector) {
      calibratedConfig.xhs.selectors.titleInput = [titleSelector];
    }
    if (bodySelector) {
      calibratedConfig.xhs.selectors.bodyEditor = [bodySelector];
    }
    if (uploadSelector) {
      calibratedConfig.xhs.selectors.uploadInput = [uploadSelector];
    }
    if (draftButtonText) {
      calibratedConfig.xhs.selectors.draftButtonText = [draftButtonText];
    }
    if (publishButtonText) {
      calibratedConfig.xhs.selectors.publishButtonText = [publishButtonText];
    }
    if (confirmButtonText) {
      calibratedConfig.xhs.selectors.confirmButtonText = [confirmButtonText];
    }

    const calibrationReportPath = path.join(artifactDir, "selector-calibration.json");
    await fs.writeFile(calibrationReportPath, JSON.stringify(calibration, null, 2) + "\n", "utf8");
    await fs.writeFile(configPath, JSON.stringify(calibratedConfig, null, 2) + "\n", "utf8");

    if (!titleSelector || !bodySelector || !uploadSelector) {
      throw new Error(
        "Calibration reached the page but the editor was not fully detected. This usually means login is missing or the page is not the publish editor."
      );
    }

    console.log(`Updated ${configPath}`);
    console.log(`Calibration report: ${calibrationReportPath}`);
  } finally {
    await closePersistentChromeContext({ context, configPath, config }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
