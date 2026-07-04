/**
 * Shared frontmatter plumbing + the declarative projection mechanism
 * (T-23). Entity data stays canonical in its JSON envelope; a projection
 * table mirrors chosen fields into note frontmatter so Obsidian-native
 * tools (Dataview, Meta Bind, Templater) can read — and for two-way
 * fields, write — them as plain Markdown.
 *
 * Conflict rule (deterministic): the serializer always writes envelope and
 * frontmatter in sync, so any difference found at parse time means a hand
 * edit happened after the last save — the hand edit wins for `two-way`
 * fields. Equal values change nothing (the envelope wins ties), and
 * `write-only` (derived) fields are ignored on read and rewritten on save.
 *
 * All functions are pure string/array manipulation; only the plugin's own
 * keys are ever touched, so foreign frontmatter (the user's `campaign` /
 * `player` / `type` keys, tags, comments) survives untouched. The same
 * mechanism serves any future entity type (session notes, NPCs) — supply a
 * different projection table, not a new serializer.
 */

/** Split `content` into its frontmatter lines (if any) and the body. */
export function splitFrontmatter(content: string): {
  frontmatter: string[] | null;
  body: string;
} {
  if (!content.startsWith("---\n")) return { frontmatter: null, body: content };
  const end = content.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: null, body: content };
  const afterClose = content.indexOf("\n", end + 1);
  return {
    frontmatter: content.slice(4, end).split("\n"),
    body: afterClose === -1 ? "" : content.slice(afterClose + 1),
  };
}

/** Reassemble a note from frontmatter lines and body. */
export function joinFrontmatter(lines: string[], body: string): string {
  const separator = body === "" || body.startsWith("\n") ? "" : "\n";
  return `---\n${lines.join("\n")}\n---\n${separator}${body}`;
}

/** Read a simple scalar `key: value` from frontmatter lines. */
export function frontmatterValue(
  lines: string[],
  key: string,
): string | undefined {
  const re = new RegExp(`^${key}:\\s*(.*)$`);
  for (const line of lines) {
    const match = line.match(re);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

/** Set (or append) a scalar `key: value` line, preserving all others. */
export function withFrontmatterValue(
  lines: string[],
  key: string,
  value: string,
): string[] {
  const re = new RegExp(`^${key}:`);
  const index = lines.findIndex((line) => re.test(line));
  if (index !== -1) {
    const next = [...lines];
    next[index] = `${key}: ${value}`;
    return next;
  }
  return [...lines, `${key}: ${value}`];
}

/** One projected field of an entity. */
export interface ProjectionField<T> {
  /** Frontmatter key, e.g. "hp". */
  key: string;
  /**
   * `two-way`: hand edits flow back into the entity on parse.
   * `write-only`: derived values, rewritten on every save and ignored on
   * read (documented in the note skeleton).
   */
  direction: "two-way" | "write-only";
  /** Current value as it should appear in frontmatter. */
  get: (entity: T) => string | number;
  /**
   * Apply a hand-edited raw string; return the updated entity, or
   * `undefined` to reject the edit (it will be rewritten on next save).
   * Required for `two-way` fields.
   */
  set?: (entity: T, raw: string) => T | undefined;
}

/** Write every projected field into the note's frontmatter. */
export function writeProjection<T>(
  content: string,
  entity: T,
  fields: ProjectionField<T>[],
): string {
  const { frontmatter, body } = splitFrontmatter(content);
  let lines = frontmatter ?? [];
  for (const field of fields) {
    lines = withFrontmatterValue(lines, field.key, String(field.get(entity)));
  }
  return joinFrontmatter(lines, frontmatter ? body : content);
}

/**
 * Fold hand-edited two-way frontmatter values back into the entity.
 * Values equal to the entity's own are no-ops (envelope wins ties);
 * rejected edits leave the entity unchanged.
 */
export function readProjection<T>(
  content: string,
  entity: T,
  fields: ProjectionField<T>[],
): T {
  const { frontmatter } = splitFrontmatter(content);
  if (!frontmatter) return entity;
  let current = entity;
  for (const field of fields) {
    if (field.direction !== "two-way" || !field.set) continue;
    const raw = frontmatterValue(frontmatter, field.key);
    if (raw === undefined) continue;
    if (raw === String(field.get(current))) continue;
    const next = field.set(current, raw);
    if (next !== undefined) current = next;
  }
  return current;
}
