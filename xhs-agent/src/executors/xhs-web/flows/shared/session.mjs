import {
  acquireChromePage,
  launchPersistentChromeContext
} from "../../shared/browser-utils.mjs";

export async function openPersistentChromeSession({ configPath, config }) {
  const context = await launchPersistentChromeContext({
    configPath,
    config,
    headless: Boolean(config.xhs.headless),
    viewport: { width: 1440, height: 960 }
  });
  const page = await acquireChromePage(context);

  return {
    context,
    page
  };
}
