import {
  CharacterSchema,
  EnvelopeSchema,
  SCHEMA_VERSION,
  type Character,
} from "../model/schema";

/**
 * Character-note format: a normal Markdown note whose frontmatter carries a
 * `dnd-vtt: character` marker and whose body holds the character data inside
 * a ```dnd-vtt-character fenced block (a versioned Envelope as JSON).
 *
 * The note stays human-owned: everything outside the fenced block — prose,
 * headings, links, and any frontmatter keys other than the marker (e.g. the
 * user's own `campaign:` / `player:` keys) — is preserved on every save.
 * This module is pure string-in/string-out so it can be unit tested without
 * Obsidian.
 */

const FENCE_LANG = "dnd-vtt-character";
const FENCE_RE = /```dnd-vtt-character[^\n]*\n([\s\S]*?)\n```/;
const MARKER_KEY = "dnd-vtt";

export type ParseResult =
  | { ok: true; character: Character }
  | { ok: false; error: string };

function characterBlock(character: Character): string {
  const envelope = {
    schemaVersion: SCHEMA_VERSION,
    kind: "character",
    payload: character,
  };
  return `\`\`\`${FENCE_LANG}\n${JSON.stringify(envelope, null, 2)}\n\`\`\``;
}

/**
 * Render the note content for a character. When `existing` is given, only
 * the fenced data block (and the frontmatter marker) are touched; the rest
 * of the note is preserved. Without it, a fresh note skeleton is produced.
 */
export function serializeCharacterNote(
  character: Character,
  existing?: string,
): string {
  const block = characterBlock(character);

  if (!existing || !existing.trim()) {
    return [
      "---",
      `${MARKER_KEY}: character`,
      "---",
      "",
      `# ${character.name}`,
      "",
      block,
      "",
    ].join("\n");
  }

  let content = existing;
  content = FENCE_RE.test(content)
    ? content.replace(FENCE_RE, () => block)
    : `${content.trimEnd()}\n\n${block}\n`;
  return ensureMarker(content);
}

/** Make sure the frontmatter contains `dnd-vtt: character`. */
function ensureMarker(content: string): string {
  if (!content.startsWith("---\n")) {
    return `---\n${MARKER_KEY}: character\n---\n\n${content}`;
  }
  const end = content.indexOf("\n---", 4);
  if (end === -1) {
    // Malformed frontmatter; prepend a fresh block rather than guessing.
    return `---\n${MARKER_KEY}: character\n---\n\n${content}`;
  }
  const frontmatter = content.slice(4, end);
  const markerLine = new RegExp(`^${MARKER_KEY}:.*$`, "m");
  if (!markerLine.test(frontmatter)) {
    return `---\n${MARKER_KEY}: character\n${content.slice(4)}`;
  }
  const fixed = frontmatter.replace(markerLine, `${MARKER_KEY}: character`);
  return `---\n${fixed}${content.slice(end)}`;
}

/**
 * Extract and validate the character from note content. Returns a
 * user-facing error message (never throws) so malformed or hand-edited
 * notes degrade gracefully.
 */
export function parseCharacterNote(content: string): ParseResult {
  const match = content.match(FENCE_RE);
  if (!match) {
    return {
      ok: false,
      error: "This note has no dnd-vtt-character data block.",
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(match[1]);
  } catch {
    return {
      ok: false,
      error: "The character data block is not valid JSON.",
    };
  }

  const envelope = EnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    return {
      ok: false,
      error: "The character data block is not a valid document envelope.",
    };
  }
  if (envelope.data.kind !== "character") {
    return {
      ok: false,
      error: `Expected a character document, found "${envelope.data.kind}".`,
    };
  }
  if (envelope.data.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error:
        `This character uses schema version ${envelope.data.schemaVersion}, ` +
        `but this plugin version supports ${SCHEMA_VERSION}.`,
    };
  }

  const character = CharacterSchema.safeParse(envelope.data.payload);
  if (!character.success) {
    const issue = character.error.issues[0];
    const where = issue.path.join(".") || "character";
    return {
      ok: false,
      error: `Character data failed validation at "${where}": ${issue.message}`,
    };
  }

  return { ok: true, character: character.data };
}

/** A vault-safe file basename for a character (no extension). */
export function characterFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|#^[\]]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Character";
}
