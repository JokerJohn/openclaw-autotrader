
import { deleteNotes } from "../../delete-note-job.mjs";

export async function runDeleteNoteJob({ configPath, noteIds }) {
  return deleteNotes({ configPath, noteIds });
}
