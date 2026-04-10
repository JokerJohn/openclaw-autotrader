import { appendFlowState } from "../shared/flow-state.mjs";

export async function openEditPage({ page, noteId, receipt }) {
  appendFlowState(receipt, "open-editor", { note_id: noteId });
  await page.goto(`https://creator.xiaohongshu.com/publish/update?id=${noteId}&noteType=normal`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForTimeout(5000);
}
