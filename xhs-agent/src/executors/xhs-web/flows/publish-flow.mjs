import {
  takeScreenshot,
  writeReceipt
} from "../shared/browser-utils.mjs";
import { openPersistentChromeSession } from "./shared/session.mjs";
import { openPublishEditor } from "./publish/open-editor.mjs";
import { fillPublishDraft } from "./publish/fill-draft.mjs";
import { finalizePublishAction } from "./publish/finalize-submit.mjs";

export async function executePublishFlow({
  configPath,
  config,
  postPackage,
  collectionConfig,
  mode,
  assets,
  artifactDir,
  receipt,
  receiptPath
}) {
  let context;
  let page;

  try {
    ({ context, page } = await openPersistentChromeSession({ configPath, config }));

    await openPublishEditor({ page, config, assets, receipt });
    await fillPublishDraft({ page, config, postPackage, collectionConfig, mode, receipt });

    receipt.prefill_screenshot = await takeScreenshot(page, artifactDir, `${postPackage.package_id}-prefill`);
    await writeReceipt(receiptPath, receipt);

    const submitResult = await finalizePublishAction({ page, config, postPackage, mode, receipt });
    receipt.page_url = page.url();

    if (mode !== "dry-run") {
      receipt.success_text = submitResult.successText;
      receipt.draft_completion = submitResult.draftCompletion;
      receipt.publish_verification = submitResult.publishVerification;
      receipt.final_screenshot = await takeScreenshot(page, artifactDir, `${postPackage.package_id}-success`);
      await writeReceipt(receiptPath, receipt);
    }

    return {
      page,
      context,
      submitResult
    };
  } catch (error) {
    if (page) {
      try {
        receipt.error_screenshot = await takeScreenshot(page, artifactDir, `${postPackage.package_id}-error`);
      } catch {
        receipt.error_screenshot = null;
      }
    }

    throw Object.assign(error, {
      page,
      context
    });
  }
}
