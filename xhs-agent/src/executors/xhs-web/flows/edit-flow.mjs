import {
  takeScreenshot,
  writeReceipt
} from "../shared/browser-utils.mjs";
import { openPersistentChromeSession } from "./shared/session.mjs";
import { openEditPage } from "./edit/open-editor.mjs";
import { prepareEditAssets } from "./edit/prepare-assets.mjs";
import { fillEditDraft } from "./edit/fill-draft.mjs";
import { finalizeEditAction } from "./edit/finalize-submit.mjs";

export async function executeEditFlow({
  configPath,
  config,
  postPackage,
  collectionConfig,
  noteId,
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

    await openEditPage({ page, noteId, receipt });
    const prepared = await prepareEditAssets({
      page,
      config,
      postPackage,
      noteId,
      artifactDir,
      assets,
      receipt
    });
    await fillEditDraft({
      page,
      config,
      postPackage,
      collectionConfig,
      titleInput: prepared.titleInput,
      bodyEditor: prepared.bodyEditor,
      receipt
    });

    receipt.prefill_screenshot = await takeScreenshot(page, artifactDir, `${postPackage.package_id}-edit-${noteId}-prefill`);
    await writeReceipt(receiptPath, receipt);

    const submitResult = await finalizeEditAction({ page, config, noteId, postPackage, mode, receipt });
    if (mode !== "dry-run") {
      receipt.success_text = submitResult.successText;
      receipt.verification = submitResult.verification;
      receipt.final_screenshot = await takeScreenshot(page, artifactDir, `${postPackage.package_id}-edit-${noteId}-success`);
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
        receipt.error_screenshot = await takeScreenshot(page, artifactDir, `${postPackage.package_id}-edit-${noteId}-error`);
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
