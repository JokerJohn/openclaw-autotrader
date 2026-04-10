import {
  clickFirstButton,
  firstVisibleLocator,
  waitForAnyText
} from "../../shared/browser-utils.mjs";
import { verifyDraftState } from "../shared/draft-verification.mjs";
import { appendFlowState } from "../shared/flow-state.mjs";

async function waitForUpdateResponse(page, timeout = 15000) {
  try {
    const response = await page.waitForResponse(
      (candidate) => candidate.url().includes("/web_api/sns/capa/postgw/note/update"),
      { timeout }
    );
    const body = await response.text().catch(() => null);
    const parsed = body ? JSON.parse(body) : null;

    return {
      status: response.status(),
      success: parsed?.success ?? null,
      result: parsed?.result ?? null,
      message: parsed?.msg ?? null
    };
  } catch {
    return null;
  }
}

async function verifyEditedNote(page, selectors, noteId, postPackage) {
  const updateUrl = `https://creator.xiaohongshu.com/publish/update?id=${noteId}&noteType=normal`;
  await page.goto(updateUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const titleInput = await firstVisibleLocator(page, selectors.titleInput, 10000);
  const bodyEditor = await firstVisibleLocator(page, selectors.bodyEditor, 10000);
  if (!titleInput || !bodyEditor) {
    return {
      ok: false,
      reason: "title-or-body-missing-after-refresh"
    };
  }

  return verifyDraftState({ page, titleInput, bodyEditor, postPackage });
}

export async function finalizeEditAction({ page, config, noteId, postPackage, mode, receipt }) {
  if (mode === "dry-run") {
    appendFlowState(receipt, "dry-run-complete");
    return {
      updateResponse: null,
      successText: null,
      verification: null
    };
  }

  const updateResponsePromise = waitForUpdateResponse(page);
  const clickedLabel = await clickFirstButton(page, config.xhs.selectors.publishButtonText, 10000);
  if (!clickedLabel) {
    throw new Error("Could not find the publish button on the edit page.");
  }

  appendFlowState(receipt, "submit-edit");
  await clickFirstButton(page, config.xhs.selectors.confirmButtonText, 5000);
  const successText = await waitForAnyText(page, config.xhs.selectors.successTexts, 10000);
  const updateResponse = await updateResponsePromise;
  if (updateResponse) {
    receipt.submit_response = updateResponse;
  }
  const verification = await verifyEditedNote(page, config.xhs.selectors, noteId, postPackage);

  if (updateResponse && updateResponse.success === false) {
    throw new Error(updateResponse.message ? `XHS rejected the edit: ${updateResponse.message}` : "XHS rejected the edit.");
  }

  if (!successText && !verification.ok) {
    throw new Error("Edit submit was triggered but the updated content could not be verified.");
  }

  appendFlowState(receipt, "submit-complete", {
    success_text: successText ?? null,
    verification_ok: verification.ok
  });

  return {
    updateResponse,
    successText,
    verification
  };
}
