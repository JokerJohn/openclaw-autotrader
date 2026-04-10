import fs from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileExists, writeJson } from "../../../lib/runtime-utils.mjs";

const execFile = promisify(execFileCallback);
const CHROME_PROFILE_LOCK_FILES = [
  "SingletonLock",
  "SingletonSocket",
  "SingletonCookie"
];
const DEFAULT_PROFILE_WAIT_TIMEOUT_MS = 15000;
const DEFAULT_PROFILE_WAIT_POLL_MS = 250;
const DEFAULT_REMOTE_DEBUGGING_URL = "http://127.0.0.1:9222";
const CHROME_SESSION_META = Symbol.for("openclaw.xhs.chromeSessionMeta");

export function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hasChromeProfileLockFiles(userDataDir) {
  for (const name of CHROME_PROFILE_LOCK_FILES) {
    try {
      await fs.lstat(path.join(userDataDir, name));
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

async function listChromeProcessesForProfile(userDataDir) {
  try {
    const { stdout } = await execFile("ps", ["-ax", "-o", "pid=,command="], {
      maxBuffer: 4 * 1024 * 1024
    });
    const needle = `--user-data-dir=${userDataDir}`;

    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(.*)$/);
        if (!match) {
          return null;
        }

        return {
          pid: Number(match[1]),
          command: match[2]
        };
      })
      .filter((entry) => entry && entry.command.includes(needle));
  } catch {
    return [];
  }
}

function formatChromeProfileBusyMessage(userDataDir, state) {
  const reasons = [];

  if (state.hasLockFiles) {
    reasons.push("Chrome singleton lock files are still present");
  }

  if (state.processes.length > 0) {
    const processPreview = state.processes
      .slice(0, 3)
      .map((entry) => `${entry.pid}:${entry.command.slice(0, 120)}`)
      .join("; ");
    reasons.push(`Chrome still has ${state.processes.length} process(es) using the profile (${processPreview})`);
  }

  return `Chrome profile '${userDataDir}' is still busy: ${reasons.join(" | ") || "unknown reason"}`;
}

export function resolveChromeUserDataDir(configPath, config) {
  return path.resolve(path.dirname(configPath), config.xhs.userDataDir);
}

function shouldAttachToExistingChrome(config) {
  return config.xhs.attachToExistingChrome !== false;
}

function shouldFallbackToLaunch(config) {
  return config.xhs.fallbackToLaunch !== false;
}

export function resolveChromeRemoteDebuggingUrl(config) {
  return (
    config.xhs.remoteDebuggingUrl ??
    process.env.XHS_REMOTE_DEBUGGING_URL ??
    DEFAULT_REMOTE_DEBUGGING_URL
  );
}

function decorateChromeContext(context, meta) {
  if (context[CHROME_SESSION_META]) {
    return context;
  }

  const sessionMeta = {
    managedPages: new Set(),
    ...meta
  };

  Object.defineProperty(context, CHROME_SESSION_META, {
    value: sessionMeta,
    enumerable: false,
    configurable: true
  });

  const originalNewPage = context.newPage.bind(context);
  Object.defineProperty(context, "newPage", {
    value: async (...args) => {
      const page = await originalNewPage(...args);
      sessionMeta.managedPages.add(page);
      return page;
    },
    enumerable: false,
    configurable: true,
    writable: true
  });

  return context;
}

export function getChromeSessionMeta(context) {
  return context?.[CHROME_SESSION_META] ?? null;
}

async function attachToExistingChrome({
  playwright,
  remoteDebuggingUrl
}) {
  const browser = await playwright.chromium.connectOverCDP(remoteDebuggingUrl);
  const context = browser.contexts()[0] ?? null;

  if (!context) {
    await browser.close().catch(() => {});
    throw new Error(`Chrome CDP endpoint '${remoteDebuggingUrl}' did not expose any browser context.`);
  }

  return decorateChromeContext(context, {
    mode: "attach",
    browser,
    remoteDebuggingUrl,
    userDataDir: null
  });
}

export async function waitForChromeProfileRelease(
  userDataDir,
  {
    timeoutMs = DEFAULT_PROFILE_WAIT_TIMEOUT_MS,
    pollMs = DEFAULT_PROFILE_WAIT_POLL_MS
  } = {}
) {
  await fs.mkdir(userDataDir, { recursive: true });
  const deadline = Date.now() + timeoutMs;
  let lastState = {
    hasLockFiles: false,
    processes: []
  };

  while (Date.now() <= deadline) {
    const [hasLockFiles, processes] = await Promise.all([
      hasChromeProfileLockFiles(userDataDir),
      listChromeProcessesForProfile(userDataDir)
    ]);
    lastState = { hasLockFiles, processes };

    if (!hasLockFiles && processes.length === 0) {
      return;
    }

    await sleep(pollMs);
  }

  throw new Error(formatChromeProfileBusyMessage(userDataDir, lastState));
}

export async function launchPersistentChromeContext({
  configPath,
  config,
  headless = Boolean(config.xhs.headless),
  viewport = { width: 1440, height: 960 },
  playwright = null,
  timeoutMs = DEFAULT_PROFILE_WAIT_TIMEOUT_MS,
  pollMs = DEFAULT_PROFILE_WAIT_POLL_MS
}) {
  const resolvedPlaywright = playwright ?? (await loadPlaywright());
  const remoteDebuggingUrl = resolveChromeRemoteDebuggingUrl(config);

  if (shouldAttachToExistingChrome(config)) {
    try {
      return await attachToExistingChrome({
        playwright: resolvedPlaywright,
        remoteDebuggingUrl
      });
    } catch (error) {
      if (!shouldFallbackToLaunch(config)) {
        throw new Error(
          `Failed to attach to existing Chrome via CDP at '${remoteDebuggingUrl}'. Original error: ${error.message}`
        );
      }
    }
  }

  const userDataDir = resolveChromeUserDataDir(configPath, config);
  await waitForChromeProfileRelease(userDataDir, { timeoutMs, pollMs });

  try {
    const context = await resolvedPlaywright.chromium.launchPersistentContext(userDataDir, {
      channel: config.xhs.channel ?? "chrome",
      headless,
      viewport
    });
    return decorateChromeContext(context, {
      mode: "launch",
      browser: null,
      remoteDebuggingUrl,
      userDataDir
    });
  } catch (error) {
    if (String(error?.message ?? "").includes("ProcessSingleton")) {
      throw new Error(
        `Failed to open Chrome profile '${userDataDir}' because another XHS browser session still owns it. Wait for Chrome to exit completely, then retry. Original error: ${error.message}`
      );
    }

    throw error;
  }
}

export async function closePersistentChromeContext({
  context,
  configPath,
  config,
  userDataDir = null,
  timeoutMs = DEFAULT_PROFILE_WAIT_TIMEOUT_MS,
  pollMs = DEFAULT_PROFILE_WAIT_POLL_MS
}) {
  if (!context) {
    return;
  }

  const sessionMeta = getChromeSessionMeta(context);
  if (sessionMeta?.mode === "attach") {
    for (const page of sessionMeta.managedPages) {
      if (page?.isClosed?.()) {
        continue;
      }
      await page.close({ runBeforeUnload: false }).catch(() => {});
    }
    sessionMeta.managedPages.clear();
    await sessionMeta.browser?.close?.().catch(() => {});
    return;
  }

  const resolvedUserDataDir = userDataDir ?? resolveChromeUserDataDir(configPath, config);
  let closeError = null;

  try {
    await context.close();
  } catch (error) {
    closeError = error;
  }

  try {
    await waitForChromeProfileRelease(resolvedUserDataDir, { timeoutMs, pollMs });
  } catch (releaseError) {
    if (closeError) {
      throw new Error(`${releaseError.message}. Context close error: ${closeError.message}`);
    }
    throw releaseError;
  }

  if (closeError) {
    throw closeError;
  }
}

export async function acquireChromePage(context) {
  const sessionMeta = getChromeSessionMeta(context);

  if (sessionMeta?.mode === "attach") {
    return await context.newPage();
  }

  const existingPage = context.pages()[0] ?? null;
  if (existingPage) {
    sessionMeta?.managedPages?.add(existingPage);
    return existingPage;
  }

  return await context.newPage();
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeEditorText(value) {
  const lines = String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim());

  const normalized = [];
  let lastBlank = false;

  for (const line of lines) {
    const blank = line.length === 0;
    if (blank) {
      if (!lastBlank && normalized.length > 0) {
        normalized.push("");
      }
    } else {
      normalized.push(line);
    }
    lastBlank = blank;
  }

  while (normalized.at(-1) === "") {
    normalized.pop();
  }

  return normalized.join("\n").trim();
}

function normalizeTopicTag(value) {
  return String(value ?? "")
    .replace(/^#+/u, "")
    .replace(/\[话题\]/gu, "")
    .replace(/\s+/gu, "")
    .trim();
}

export async function firstVisibleLocator(page, selectors, timeout = 8000) {
  for (const selector of normalizeArray(selectors)) {
    const locator = page.locator(selector);
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const count = await locator.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const candidate = locator.nth(index);
        if (await candidate.isVisible().catch(() => false)) {
          return candidate;
        }
      }

      await page.waitForTimeout(250);
    }
  }

  return null;
}

export async function firstAttachedLocator(page, selectors, timeout = 8000) {
  for (const selector of normalizeArray(selectors)) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: "attached", timeout });
      return locator;
    } catch {
      continue;
    }
  }

  return null;
}

export async function clickFirstButton(page, labels, timeout = 5000) {
  for (const label of normalizeArray(labels)) {
    const roleLocator = page
      .getByRole("button", { name: new RegExp(escapeRegex(label), "i") })
      .first();
    try {
      await roleLocator.waitFor({ state: "visible", timeout });
      await roleLocator.click();
      return label;
    } catch {
      const textLocator = page.locator(`text=${label}`).first();
      try {
        await textLocator.waitFor({ state: "visible", timeout: 1500 });
        await textLocator.click();
        return label;
      } catch {
        continue;
      }
    }
  }

  return null;
}

export async function clickFirstText(page, labels, timeout = 5000) {
  for (const label of normalizeArray(labels)) {
    const textLocator = page.getByText(label, { exact: false }).first();
    try {
      await textLocator.waitFor({ state: "visible", timeout });
      await textLocator.click();
      return label;
    } catch {
      continue;
    }
  }

  return null;
}

export async function waitForAnyText(page, texts, timeout = 15000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    for (const text of normalizeArray(texts)) {
      const locator = page.getByText(text, { exact: false }).first();
      if (await locator.count()) {
        return text;
      }
    }

    await page.waitForTimeout(500);
  }

  return null;
}

export async function fillTitleField(locator, text) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click();
  await locator.fill("");
  await locator.evaluate((element, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }, text);
  await locator.click().catch(() => {});

  let value;
  try {
    value = await locator.inputValue();
    if (value !== text) {
      await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
      await locator.type(text, { delay: 40 });
      await locator.dispatchEvent("change");
      await locator.dispatchEvent("blur");
      value = await locator.inputValue();
    }
  } catch (error) {
    throw new Error(`Failed to persist title field content: ${error.message}`);
  }

  if (!value.includes(text.slice(0, Math.min(4, text.length)))) {
    throw new Error("Title input did not retain the expected text.");
  }
}

async function typeConfirmedTopicTag(locator, tagText) {
  const normalized = normalizeTopicTag(tagText);
  if (!normalized) {
    return;
  }

  const page = locator.page();
  const countBefore = await locator.locator("a.tiptap-topic").count().catch(() => 0);
  const exactTopicText = `#${normalized}`;
  const topicOption = page
    .locator(".tippy-box .item")
    .filter({
      has: page.locator(".name", {
        hasText: new RegExp(`^${escapeRegex(exactTopicText)}$`)
      })
    })
    .first();

  await page.keyboard.type(exactTopicText, { delay: 50 });
  await page.waitForTimeout(200);
  await topicOption.waitFor({ state: "visible", timeout: 4000 });
  await topicOption.click();
  await page.waitForTimeout(300);

  const fallbackCount = await locator.locator("a.tiptap-topic").count().catch(() => 0);
  if (fallbackCount <= countBefore) {
    throw new Error(`Topic tag '#${normalized}' did not convert into a confirmed XHS topic chip.`);
  }
}

async function moveCaretToEditorEnd(locator) {
  await locator.evaluate((element) => {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    element.focus();
  }).catch(() => {});
}

export async function fillBodyField(locator, text, hashtags = []) {
  const expected = normalizeEditorText(text);
  const selectAllKey = process.platform === "darwin" ? "Meta+A" : "Control+A";
  const page = locator.page();
  const normalizedHashtags = normalizeArray(hashtags).map(normalizeTopicTag).filter(Boolean);

  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click().catch(() => {});
  await locator.press(selectAllKey).catch(() => {});
  await locator.press("Backspace").catch(() => {});
  await locator.press("Delete").catch(() => {});
  if (expected) {
    await page.keyboard.insertText(expected);
    await moveCaretToEditorEnd(locator);
  }
  if (normalizedHashtags.length > 0) {
    await moveCaretToEditorEnd(locator);
    if (expected) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(120);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(120);
    }

    for (const tag of normalizedHashtags) {
      await typeConfirmedTopicTag(locator, tag);
    }
  }
  await locator.evaluate((element) => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }).catch(() => {});
}

export async function readEditorText(locator) {
  const text = await locator
    .evaluate((element) => element.innerText ?? element.textContent ?? "")
    .catch(async () => (await locator.textContent()) ?? "");
  return normalizeEditorText(text);
}

export async function readSelectedCollectionName(page, selectors) {
  const entry = await firstVisibleLocator(page, selectors.collectionEntrySelector, 3000);
  if (!entry) {
    return null;
  }

  const rawText = await entry.textContent().catch(() => "");
  return String(rawText ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function ensureCollection(page, selectors, collectionConfig) {
  if (!collectionConfig?.enabled || !collectionConfig.name) {
    return null;
  }

  const selectedBefore = await readSelectedCollectionName(page, selectors);
  if (selectedBefore === collectionConfig.name) {
    return {
      selected: collectionConfig.name,
      created: false,
      verified: true
    };
  }

  const trigger = await clickFirstText(page, selectors.collectionTriggerText, 5000);
  if (!trigger) {
    const triggerLocator = await firstVisibleLocator(page, selectors.collectionEntrySelector, 3000);
    if (triggerLocator) {
      await triggerLocator.click();
    } else {
      throw new Error("Could not open the collection selector.");
    }
  }

  await page.waitForTimeout(1000);

  if (!(await page.getByText(collectionConfig.name, { exact: true }).count()) && !collectionConfig.autoCreate) {
    throw new Error(`Collection '${collectionConfig.name}' was not found.`);
  }

  const existingCollection = page.getByText(collectionConfig.name, { exact: true }).first();
  if (await existingCollection.count()) {
    await existingCollection.click();
    await page.waitForTimeout(1200);
    const selectedAfterPick = await readSelectedCollectionName(page, selectors);
    if (selectedAfterPick !== collectionConfig.name) {
      throw new Error(`Collection picker closed without selecting '${collectionConfig.name}'.`);
    }
    return {
      selected: collectionConfig.name,
      created: false,
      verified: true
    };
  }

  if (!collectionConfig.autoCreate) {
    throw new Error(`Collection '${collectionConfig.name}' was not found.`);
  }

  const createEntry = await clickFirstText(page, selectors.collectionCreateText, 3000);
  if (!createEntry) {
    throw new Error("Could not open the create-collection dialog.");
  }

  const nameInput = await firstVisibleLocator(page, selectors.collectionNameInput, 5000);
  const descInput = await firstVisibleLocator(page, selectors.collectionDescInput, 5000);
  if (!nameInput || !descInput) {
    throw new Error("Collection create dialog appeared without name/description inputs.");
  }

  await nameInput.fill(collectionConfig.name);
  await descInput.fill(collectionConfig.description ?? "");

  const created =
    (await clickFirstButton(page, selectors.collectionCreateAndJoinText, 5000)) ??
    (await clickFirstText(page, selectors.collectionCreateAndJoinText, 3000));
  if (!created) {
    throw new Error("Could not confirm collection creation.");
  }

  await page.waitForTimeout(1500);
  const selectedAfterCreate = await readSelectedCollectionName(page, selectors);
  if (selectedAfterCreate !== collectionConfig.name) {
    throw new Error(`Collection '${collectionConfig.name}' was created but is not selected on the draft.`);
  }
  return {
    selected: collectionConfig.name,
    created: true,
    verified: true
  };
}

export async function ensureAssets({ postPackage, packagePath, limits = {}, purpose = "publishing" }) {
  const packageDir = path.dirname(packagePath);
  const assets = (postPackage.assets ?? []).map((asset) => ({
    ...asset,
    absolutePath: path.resolve(packageDir, asset.path)
  }));

  if (assets.length < (limits.minImages ?? 1)) {
    throw new Error(`Not enough assets for ${purpose}`);
  }

  if (assets.length > (limits.maxImages ?? 9)) {
    throw new Error(`Too many assets for ${purpose}`);
  }

  for (const asset of assets) {
    if (!(await fileExists(asset.absolutePath))) {
      throw new Error(`Missing asset: ${asset.absolutePath}`);
    }
  }

  return assets;
}

export async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(
      `Playwright is not installed in xhs-agent. Run 'npm install playwright' in /Users/xhubd/Documents/New project/openclaw-autotrader/xhs-agent first. Original error: ${error.message}`
    );
  }
}

export async function writeReceipt(receiptPath, receipt) {
  await writeJson(receiptPath, receipt);
}

export async function takeScreenshot(page, artifactDir, name) {
  const filePath = path.join(artifactDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}
