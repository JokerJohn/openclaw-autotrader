import { runEditNoteJob } from "./xhs-web/edit-note.mjs";
import { runPublishJob } from "./xhs-web/publish-note.mjs";
import { syncXhsAnalytics } from "./xhs-web/sync-analytics.mjs";
import { runDeleteNoteJob } from "./xhs-web/delete-note.mjs";

export function createXhsWebExecutor({ agentRoot, config }) {
  return {
    id: config.platformExecutor?.type ?? "xhs-web",
    async publishPackage({ configPath, packagePath, mode, force = false }) {
      return {
        step: "executor.publish",
        agent_root: agentRoot,
        ...(await runPublishJob({ configPath, packagePath, mode, force }))
      };
    },
    async editNote({ configPath, packagePath, noteId, mode, force = false }) {
      return {
        step: "executor.edit",
        agent_root: agentRoot,
        ...(await runEditNoteJob({ configPath, packagePath, noteId, mode, force }))
      };
    },
    async syncAnalytics({ configPath, outputPath, pages, detailLimit }) {
      return {
        step: "executor.sync-analytics",
        agent_root: agentRoot,
        ...(await syncXhsAnalytics({ configPath, outputPath, pages, detailLimit }))
      };
    },
    async deleteNotes({ configPath, noteIds }) {
      return {
        step: "executor.delete",
        agent_root: agentRoot,
        ...(await runDeleteNoteJob({ configPath, noteIds }))
      };
    }
  };
}
