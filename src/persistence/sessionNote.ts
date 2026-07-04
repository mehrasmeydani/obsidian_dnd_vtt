import {
  NoteSchema,
  NoteVisibilitySchema,
  type Note,
  type NoteVisibility,
} from "../model/schema";
import {
  frontmatterValue,
  joinFrontmatter,
  splitFrontmatter,
  withFrontmatterValue,
} from "./frontmatter";

/**
 * Session/campaign-note format (T-10): an ordinary Markdown note whose
 * machine-readable data lives entirely in frontmatter — a `dnd-vtt: note`
 * marker, a stable `note-id`, and a `visibility` level (private/party/dm).
 * The body is user prose and is never rewritten by the plugin; that keeps
 * journals fully Obsidian-native (Dataview can query `visibility` directly)
 * while Phase 3 sync can still address and filter notes.
 *
 * Visibility enforcement is client-side only until the sync server exists
 * (roadmap §2); this module is pure string-in/string-out like
 * `characterNote.ts`.
 */

const MARKER_KEY = "dnd-vtt";
const MARKER_VALUE = "note";
const ID_KEY = "note-id";
const VISIBILITY_KEY = "visibility";

export type NoteParseResult =
  | { ok: true; note: Note }
  | { ok: false; error: string };

/**
 * Render note content. Fresh notes get a skeleton (frontmatter + title +
 * body + a comment documenting the visibility field). With `existing`, only
 * the plugin's frontmatter keys are updated — the body and every foreign
 * frontmatter key are preserved verbatim.
 */
export function serializeSessionNote(note: Note, existing?: string): string {
  if (!existing || !existing.trim()) {
    return [
      "---",
      `${MARKER_KEY}: ${MARKER_VALUE}`,
      `${ID_KEY}: ${note.id}`,
      `${VISIBILITY_KEY}: ${note.visibility}`,
      "---",
      "",
      `# ${note.title}`,
      "",
      "<!-- visibility: private (only you) · party (all players) · dm (you + DM). Edit the frontmatter above. -->",
      "",
      note.body,
    ].join("\n");
  }

  const { frontmatter, body } = splitFrontmatter(existing);
  let lines = frontmatter ?? [];
  lines = withFrontmatterValue(lines, MARKER_KEY, MARKER_VALUE);
  lines = withFrontmatterValue(lines, ID_KEY, note.id);
  lines = withFrontmatterValue(lines, VISIBILITY_KEY, note.visibility);
  return joinFrontmatter(lines, frontmatter ? body : `\n${existing}`);
}

/**
 * Parse note content into a `Note`. Malformed or hand-edited frontmatter
 * degrades into a readable error (never throws). `fallbackTitle` is used
 * when the body has no leading `# heading` (typically the file basename).
 */
export function parseSessionNote(
  content: string,
  fallbackTitle = "Untitled note",
): NoteParseResult {
  const { frontmatter, body } = splitFrontmatter(content);
  if (!frontmatter || frontmatterValue(frontmatter, MARKER_KEY) !== MARKER_VALUE) {
    return {
      ok: false,
      error: `This note has no "${MARKER_KEY}: ${MARKER_VALUE}" frontmatter marker.`,
    };
  }

  const id = frontmatterValue(frontmatter, ID_KEY);
  if (!id) {
    return {
      ok: false,
      error: `This note is missing its "${ID_KEY}" frontmatter field.`,
    };
  }

  const rawVisibility = frontmatterValue(frontmatter, VISIBILITY_KEY) ?? "private";
  const visibility = NoteVisibilitySchema.safeParse(rawVisibility);
  if (!visibility.success) {
    return {
      ok: false,
      error:
        `Invalid visibility "${rawVisibility}" — use one of: ` +
        `${NoteVisibilitySchema.options.join(", ")}.`,
    };
  }

  const heading = body.match(/^#\s+(.+)$/m);
  const note = NoteSchema.safeParse({
    id,
    title: heading ? heading[1].trim() : fallbackTitle,
    body,
    visibility: visibility.data,
  });
  if (!note.success) {
    const issue = note.error.issues[0];
    const where = issue.path.join(".") || "note";
    return {
      ok: false,
      error: `Note data failed validation at "${where}": ${issue.message}`,
    };
  }
  return { ok: true, note: note.data };
}

/** A fresh session note for today, ready to serialize. */
export function newSessionNote(
  id: string,
  date: Date,
  visibility: NoteVisibility = "private",
): Note {
  const iso = date.toISOString().slice(0, 10);
  return NoteSchema.parse({
    id,
    title: `Session ${iso}`,
    body: "",
    visibility,
  });
}
