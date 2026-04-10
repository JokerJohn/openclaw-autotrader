import {
  ensureCollection,
  fillBodyField,
  fillTitleField
} from "../../shared/browser-utils.mjs";
import { verifyDraftState } from "../shared/draft-verification.mjs";
import { appendFlowState } from "../shared/flow-state.mjs";

export async function fillEditDraft({ page, config, postPackage, collectionConfig, titleInput, bodyEditor, receipt }) {
  appendFlowState(receipt, "fill-content");
  await fillBodyField(bodyEditor, postPackage.content.body, postPackage.content.hashtags);
  await fillTitleField(titleInput, postPackage.content.title);
  await bodyEditor.click().catch(() => {});
  await page.waitForTimeout(400);

  appendFlowState(receipt, "ensure-collection");
  receipt.collection = await ensureCollection(page, config.xhs.selectors, collectionConfig);

  const verification = await verifyDraftState({
    page,
    titleInput,
    bodyEditor,
    postPackage,
    collectionConfig,
    selectors: config.xhs.selectors
  });
  receipt.prefill_verification = verification;
  appendFlowState(receipt, "verify-prefill", verification);
  if (!verification.ok) {
    throw new Error("Draft fields did not retain the expected title/body/assets/collection before submit.");
  }
}
