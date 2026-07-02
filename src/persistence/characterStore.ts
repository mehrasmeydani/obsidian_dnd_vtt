import { normalizePath, TFile, type App } from "obsidian";
import type { Character } from "../model/schema";
import {
  characterFileName,
  parseCharacterNote,
  serializeCharacterNote,
  type ParseResult,
} from "./characterNote";

/**
 * Vault-facing side of character persistence: where notes live and how they
 * are created, updated, and read. All format knowledge lives in
 * `characterNote.ts`; this module only touches the Obsidian vault API.
 */

/** Create every missing segment of `folderPath` ("a/b/c" style). */
async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  if (!normalized || normalized === "/" || normalized === ".") return;

  let current = "";
  for (const segment of normalized.split("/")) {
    current = current ? `${current}/${segment}` : segment;
    if (!app.vault.getAbstractFileByPath(current)) {
      // Another writer may have created it between check and create.
      await app.vault.createFolder(current).catch(() => {});
    }
  }
}

/**
 * Save a character as a vault note in `folderPath`. If a note for this
 * character (matched by id) already exists at the target name, it is updated
 * in place, preserving the user's prose; a different character with the same
 * name gets a numbered file instead.
 */
export async function saveCharacterNote(
  app: App,
  character: Character,
  folderPath: string,
): Promise<TFile> {
  await ensureFolder(app, folderPath);
  const folder = normalizePath(folderPath);
  const base = characterFileName(character.name);
  const pathFor = (suffix: number): string =>
    normalizePath(
      `${folder ? `${folder}/` : ""}${base}${suffix > 1 ? ` ${suffix}` : ""}.md`,
    );

  for (let suffix = 1; ; suffix++) {
    const path = pathFor(suffix);
    const existing = app.vault.getAbstractFileByPath(path);
    if (!(existing instanceof TFile)) {
      return app.vault.create(path, serializeCharacterNote(character));
    }
    const content = await app.vault.read(existing);
    const parsed = parseCharacterNote(content);
    if (parsed.ok && parsed.character.id === character.id) {
      await app.vault.modify(
        existing,
        serializeCharacterNote(character, content),
      );
      return existing;
    }
  }
}

/** Read and validate the character stored in `file`. */
export async function loadCharacterNote(
  app: App,
  file: TFile,
): Promise<ParseResult> {
  return parseCharacterNote(await app.vault.read(file));
}
