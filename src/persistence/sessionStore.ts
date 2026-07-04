import { normalizePath, TFile, type App } from "obsidian";
import type { Note } from "../model/schema";
import { characterFileName } from "./characterNote";
import { ensureFolder } from "./characterStore";
import {
  parseSessionNote,
  serializeSessionNote,
  type NoteParseResult,
} from "./sessionNote";

/**
 * Vault-facing side of session-note persistence (T-10). Format knowledge
 * lives in `sessionNote.ts`; this module only touches the Obsidian vault API.
 */

/**
 * Create a new session note file in `folderPath`, named after the note's
 * title. An existing file with that name gets a numbered sibling — session
 * notes are never overwritten.
 */
export async function createSessionNote(
  app: App,
  note: Note,
  folderPath: string,
): Promise<TFile> {
  await ensureFolder(app, folderPath);
  const folder = normalizePath(folderPath);
  const base = characterFileName(note.title);

  for (let suffix = 1; ; suffix++) {
    const path = normalizePath(
      `${folder ? `${folder}/` : ""}${base}${suffix > 1 ? ` ${suffix}` : ""}.md`,
    );
    if (!app.vault.getAbstractFileByPath(path)) {
      return app.vault.create(path, serializeSessionNote(note));
    }
  }
}

/** Read and validate the session note stored in `file`. */
export async function loadSessionNote(
  app: App,
  file: TFile,
): Promise<NoteParseResult> {
  return parseSessionNote(await app.vault.read(file), file.basename);
}
