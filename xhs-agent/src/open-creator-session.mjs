import path from "node:path";
import fs from "node:fs/promises";
import {
  acquireChromePage,
  closePersistentChromeContext,
  getChromeSessionMeta,
  launchPersistentChromeContext,
  resolveChromeRemoteDebuggingUrl,
  resolveChromeUserDataDir
} from "./executors/xhs-web/shared/browser-utils.mjs";

function usage() {
  console.error("Usage: node ./src/open-creator-session.mjs <config.json>");
  process.exit(1);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function main() {
  const [configArg] = process.argv.slice(2);
  if (!configArg) {
    usage();
  }

  const configPath = path.resolve(process.cwd(), configArg);
  const config = await readJson(configPath);
  const userDataDir = resolveChromeUserDataDir(configPath, config);
  const context = await launchPersistentChromeContext({
    configPath,
    config,
    headless: false,
    viewport: { width: 1440, height: 960 }
  });
  const sessionMeta = getChromeSessionMeta(context);

  const page = await acquireChromePage(context);
  await page.goto(config.xhs.creatorUrl, { waitUntil: "domcontentloaded" });

  console.log("XHS creator session opened.");
  if (sessionMeta?.mode === "attach") {
    console.log(`Browser mode: attached via CDP (${resolveChromeRemoteDebuggingUrl(config)})`);
  } else {
    console.log(`Browser mode: launched dedicated profile`);
    console.log(`Profile dir: ${userDataDir}`);
  }
  console.log("Complete manual login in the opened browser window, then keep it open until you are done testing.");
  console.log("Press Ctrl+C in this terminal when you want to close the session.");

  process.on("SIGINT", async () => {
    await closePersistentChromeContext({ context, configPath, config }).catch(() => {});
    process.exit(0);
  });

  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
