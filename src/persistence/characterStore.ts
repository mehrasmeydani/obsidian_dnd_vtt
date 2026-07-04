import { normalizePath, TFile, type App } from "obsidian";
import type { Character } from "../model/schema";
import {
  characterFileName,
  parseCharacterNote,
  serializeCharacterNote,
  type ParseResult,
} from "./characterNote";
import { stampFrontmatterValue } from "./frontmatter";

/**
 * Vault-facing side of character persistence: where notes live and how they
 * are created, updated, and read. All format knowledge lives in
 * `characterNote.ts`; this module only touches the Obsidian vault API.
 */

/** Create every missing segment of `folderPath` ("a/b/c" style). */
export async function ensureFolder(app: App, folderPath: string): Promise<void> {
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
 * name gets a numbered file instead. When `campaign` is given, a `campaign`
 * frontmatter key is stamped — but only when absent, since the user's own
 * templates write that key too (T-24).
 */
export async function saveCharacterNote(
  app: App,
  character: Character,
  folderPath: string,
  campaign?: string,
): Promise<TFile> {
  await ensureFolder(app, folderPath);
  const folder = normalizePath(folderPath);
  const base = characterFileName(character.name);
  const pathFor = (suffix: number): string =>
    normalizePath(
      `${folder ? `${folder}/` : ""}${base}${suffix > 1 ? ` ${suffix}` : ""}.md`,
    );
  const withCampaign = (content: string): string =>
    campaign ? stampFrontmatterValue(content, "campaign", campaign) : content;

  for (let suffix = 1; ; suffix++) {
    const path = pathFor(suffix);
    const existing = app.vault.getAbstractFileByPath(path);
    if (!(existing instanceof TFile)) {
      return app.vault.create(path, withCampaign(serializeCharacterNote(character)));
    }
    const content = await app.vault.read(existing);
    const parsed = parseCharacterNote(content);
    if (parsed.ok && parsed.character.id === character.id) {
      await app.vault.modify(
        existing,
        withCampaign(serializeCharacterNote(character, content)),
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
