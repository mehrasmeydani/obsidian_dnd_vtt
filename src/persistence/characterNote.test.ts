import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, emptyCharacter, type Character } from "../model/schema";
import {
  characterFileName,
  parseCharacterNote,
  serializeCharacterNote,
} from "./characterNote";

/**
 * Regression tests for the character-note format: notes are user-owned
 * Markdown, so the serializer must round-trip character data losslessly
 * while never destroying prose or foreign frontmatter, and the parser must
 * turn every malformed input into a readable error instead of throwing.
 */

function sampleCharacter(): Character {
  return {
    ...emptyCharacter("abc-123", "Borin Ironfist"),
    classes: [{ name: "Fighter", level: 3 }],
    maxHp: 28,
    currentHp: 21,
    inventory: [
      { id: "rope-0", name: "Rope", quantity: 1, equipped: false },
    ],
  };
}

describe("round trip", () => {
  it("serializes a fresh note and parses the same character back", () => {
    const character = sampleCharacter();
    const note = serializeCharacterNote(character);

    expect(note).toContain("dnd-vtt: character");
    expect(note).toContain("# Borin Ironfist");

    const result = parseCharacterNote(note);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.character).toEqual(character);
  });

  it("survives repeated save/load cycles unchanged", () => {
    const character = sampleCharacter();
    let note = serializeCharacterNote(character);
    note = serializeCharacterNote(character, note);
    note = serializeCharacterNote(character, note);

    // Only one data block, still parseable.
    expect(note.match(/```dnd-vtt-character/g)).toHaveLength(1);
    const result = parseCharacterNote(note);
    expect(result.ok).toBe(true);
  });
});

describe("preserving the user's note", () => {
  const existing = [
    "---",
    "tags:",
    "  - ttrpg",
    "type:",
    "  - PC",
    "campaign: Hell",
    "player: Mehras",
    "---",
    "",
    "# Borin",
    "",
    "Born in the iron hills. See [[Hell dnd/Sessions/Session 1]].",
    "",
    "```dnd-vtt-character",
    JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      kind: "character",
      payload: sampleCharacter(),
    }),
    "```",
    "",
    "## DM notes",
    "Owes the Black Raven a favor.",
  ].join("\n");

  it("updates the data block without touching prose or foreign frontmatter", () => {
    const updated = { ...sampleCharacter(), currentHp: 5 };
    const note = serializeCharacterNote(updated, existing);

    expect(note).toContain("campaign: Hell");
    expect(note).toContain("player: Mehras");
    expect(note).toContain("Born in the iron hills");
    expect(note).toContain("## DM notes");
    expect(note).toContain("Owes the Black Raven a favor.");

    const result = parseCharacterNote(note);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.character.currentHp).toBe(5);
  });

  it("adds the marker to existing frontmatter without replacing it", () => {
    const note = serializeCharacterNote(sampleCharacter(), existing);
    expect(note.startsWith("---\ndnd-vtt: character\n")).toBe(true);
    expect(note).toContain("campaign: Hell");
    expect(note.match(/^---$/gm)?.length).toBe(2);
  });

  it("appends a data block to a note that has none", () => {
    const plain = "# Borin\n\nJust prose so far.";
    const note = serializeCharacterNote(sampleCharacter(), plain);
    expect(note).toContain("Just prose so far.");
    expect(parseCharacterNote(note).ok).toBe(true);
  });

  it("adds frontmatter to a note that has none", () => {
    const note = serializeCharacterNote(sampleCharacter(), "Plain text.");
    expect(note.startsWith("---\ndnd-vtt: character\n---\n")).toBe(true);
  });
});

describe("graceful failure on malformed notes", () => {
  it("reports a missing data block", () => {
    const result = parseCharacterNote("# Just a note\n\nNo data here.");
    expect(result).toEqual({
      ok: false,
      error: "This note has no dnd-vtt-character data block.",
    });
  });

  it("reports invalid JSON", () => {
    const result = parseCharacterNote(
      "```dnd-vtt-character\n{ not json }\n```",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not valid JSON/);
  });

  it("reports a non-character document", () => {
    const note = `\`\`\`dnd-vtt-character\n${JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      kind: "note",
      payload: {},
    })}\n\`\`\``;
    const result = parseCharacterNote(note);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/found "note"/);
  });

  it("reports an unsupported schema version", () => {
    const note = `\`\`\`dnd-vtt-character\n${JSON.stringify({
      schemaVersion: SCHEMA_VERSION + 1,
      kind: "character",
      payload: sampleCharacter(),
    })}\n\`\`\``;
    const result = parseCharacterNote(note);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/schema version/);
  });

  it("reports where hand-edited data fails validation", () => {
    const broken = {
      ...sampleCharacter(),
      abilityScores: { str: 99, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    };
    const note = `\`\`\`dnd-vtt-character\n${JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      kind: "character",
      payload: broken,
    })}\n\`\`\``;
    const result = parseCharacterNote(note);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("abilityScores.str");
  });
});

describe("characterFileName", () => {
  it("strips characters that are invalid in vault paths", () => {
    expect(characterFileName('Borin "The Wall" Iron/fist')).toBe(
      "Borin -The Wall- Iron-fist",
    );
    expect(characterFileName("   ")).toBe("Character");
  });
});
