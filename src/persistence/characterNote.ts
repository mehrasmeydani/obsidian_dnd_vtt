import {
  CharacterSchema,
  EnvelopeSchema,
  SCHEMA_VERSION,
  type Character,
} from "../model/schema";
import { totalLevel } from "../rules/abilityMath";
import { armorClass } from "../rules/armorClass";
import {
  readProjection,
  writeProjection,
  type ProjectionField,
} from "./frontmatter";

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

/** A validated single-field patch, or undefined to reject the hand edit. */
function patched(
  character: Character,
  patch: Partial<Character>,
): Character | undefined {
  const next = CharacterSchema.safeParse({ ...character, ...patch });
  return next.success ? next.data : undefined;
}

function intOr(raw: string): number | undefined {
  const value = Number(raw);
  return Number.isInteger(value) ? value : undefined;
}

/**
 * The frontmatter projection (T-23): key data mirrored as plain Markdown
 * so Dataview/Meta Bind/Templater keep working. `two-way` fields accept
 * hand edits (validated; bad values are rewritten on next save);
 * `write-only` fields are derived and always rewritten. The JSON envelope
 * stays the single source of truth — see `frontmatter.ts` for the
 * conflict rule.
 */
export const CHARACTER_PROJECTION: ProjectionField<Character>[] = [
  {
    key: "hp",
    direction: "two-way",
    get: (c) => c.currentHp,
    set: (c, raw) => {
      const currentHp = intOr(raw);
      return currentHp === undefined ? undefined : patched(c, { currentHp });
    },
  },
  {
    key: "hp_max",
    direction: "two-way",
    get: (c) => c.maxHp,
    set: (c, raw) => {
      const maxHp = intOr(raw);
      return maxHp === undefined ? undefined : patched(c, { maxHp });
    },
  },
  {
    key: "race",
    direction: "two-way",
    get: (c) => c.race,
    set: (c, raw) => patched(c, { race: raw }),
  },
  { key: "ac", direction: "write-only", get: (c) => armorClass(c) },
  { key: "level", direction: "write-only", get: (c) => totalLevel(c) },
  { key: "edition", direction: "write-only", get: (c) => c.edition },
  {
    key: "class",
    direction: "write-only",
    get: (c) =>
      c.classes
        .map((cls) =>
          cls.subclass
            ? `${cls.name} (${cls.subclass}) ${cls.level}`
            : `${cls.name} ${cls.level}`,
        )
        .join(" / "),
  },
];

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
    const skeleton = [
      "---",
      `${MARKER_KEY}: character`,
      "# hp, hp_max, race sync both ways; ac, level, class are derived and rewritten.",
      "---",
      "",
      `# ${character.name}`,
      "",
      block,
      "",
    ].join("\n");
    return writeProjection(skeleton, character, CHARACTER_PROJECTION);
  }

  let content = existing;
  content = FENCE_RE.test(content)
    ? content.replace(FENCE_RE, () => block)
    : `${content.trimEnd()}\n\n${block}\n`;
  return writeProjection(ensureMarker(content), character, CHARACTER_PROJECTION);
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

  // Fold hand-edited two-way frontmatter back in (T-23): the serializer
  // writes envelope and frontmatter in sync, so a difference here is a
  // newer hand edit and wins; invalid edits are ignored (and rewritten on
  // the next save).
  return {
    ok: true,
    character: readProjection(content, character.data, CHARACTER_PROJECTION),
  };
}

/** A vault-safe file basename for a character (no extension). */
export function characterFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|#^[\]]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Character";
}
