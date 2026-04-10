import {
  ensureCollection,
  fillBodyField,
  fillTitleField,
  firstVisibleLocator
} from "../../shared/browser-utils.mjs";
import { verifyDraftState } from "../shared/draft-verification.mjs";
import { appendFlowState } from "../shared/flow-state.mjs";

export async function fillPublishDraft({ page, config, postPackage, collectionConfig, mode, receipt }) {
  appendFlowState(receipt, "fill-content");
  const titleInput = await firstVisibleLocator(page, config.xhs.selectors.titleInput, 15000);
  const bodyEditor = await firstVisibleLocator(page, config.xhs.selectors.bodyEditor, 15000);

  if (!titleInput || !bodyEditor) {
    throw new Error("Assets uploaded, but title/body editors did not become ready.");
  }

  await fillBodyField(bodyEditor, postPackage.content.body, postPackage.content.hashtags);
  await fillTitleField(titleInput, postPackage.content.title);
  await bodyEditor.click().catch(() => {});
  await page.waitForTimeout(400);

  if (mode !== "dry-run") {
    appendFlowState(receipt, "ensure-collection");
    receipt.collection = await ensureCollection(page, config.xhs.selectors, collectionConfig);
  }

  const verification = await verifyDraftState({
    page,
    titleInput,
    bodyEditor,
    postPackage,
    collectionConfig,
    selectors: config.xhs.selectors,
    requireCollection: mode !== "dry-run"
  });
  receipt.prefill_verification = verification;
  appendFlowState(receipt, "verify-prefill", verification);
  if (!verification.ok) {
    throw new Error("Draft fields did not retain the expected title/body/assets/collection before submit.");
  }
}
