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
    expect(note.startsWith("---\ndnd-vtt: character\n")).toBe(true);
    expect(note).toContain("Plain text.");
    expect(note.match(/^---$/gm)?.length).toBe(2);
  });
});

describe("frontmatter projection (T-23)", () => {
  it("projects key data into frontmatter on every save", () => {
    const character = {
      ...sampleCharacter(),
      race: "Dwarf",
      classes: [{ name: "Fighter", level: 3, subclass: "Champion" }],
    };
    const note = serializeCharacterNote(character);
    const frontmatter = note.split("---")[1];

    expect(frontmatter).toContain("hp: 21");
    expect(frontmatter).toContain("hp_max: 28");
    expect(frontmatter).toContain("race: Dwarf");
    expect(frontmatter).toContain("level: 3");
    expect(frontmatter).toContain("class: Fighter (Champion) 3");
    expect(frontmatter).toMatch(/ac: \d+/);
  });

  it("updates projected values in place without duplicating keys", () => {
    const character = sampleCharacter();
    let note = serializeCharacterNote(character);
    note = serializeCharacterNote({ ...character, currentHp: 9 }, note);

    expect(note.match(/^hp: /gm)).toHaveLength(1);
    expect(note).toContain("hp: 9");
  });

  it("keeps the user's own frontmatter keys while projecting", () => {
    const existing = [
      "---",
      "campaign: Hell",
      "player: Mehras",
      "---",
      "",
      "# Borin",
    ].join("\n");
    const note = serializeCharacterNote(sampleCharacter(), existing);
    expect(note).toContain("campaign: Hell");
    expect(note).toContain("player: Mehras");
    expect(note).toContain("hp: 21");
    expect(note.match(/^---$/gm)?.length).toBe(2);
  });

  it("folds a hand-edited two-way field back into the character", () => {
    const note = serializeCharacterNote(sampleCharacter());
    const edited = note
      .replace(/^hp: 21$/m, "hp: 5")
      .replace(/^hp_max: 28$/m, "hp_max: 30")
      .replace(/^race: $/m, "race: Mountain Dwarf");

    const result = parseCharacterNote(edited);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.character.currentHp).toBe(5);
      expect(result.character.maxHp).toBe(30);
      expect(result.character.race).toBe("Mountain Dwarf");
    }
  });

  it("hand edit then save: the edit round-trips into the envelope", () => {
    const note = serializeCharacterNote(sampleCharacter());
    const edited = note.replace(/^hp: 21$/m, "hp: 5");

    const parsed = parseCharacterNote(edited);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const saved = serializeCharacterNote(parsed.character, edited);
    const again = parseCharacterNote(saved);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.character.currentHp).toBe(5);
    // The envelope now carries the value too, not just the frontmatter.
    expect(saved).toContain('"currentHp": 5');
  });

  it("ignores hand edits to derived write-only fields", () => {
    const note = serializeCharacterNote(sampleCharacter());
    const edited = note
      .replace(/^ac: \d+$/m, "ac: 99")
      .replace(/^level: \d+$/m, "level: 20")
      .replace(/^class: .*$/m, "class: God-Emperor 20");

    const result = parseCharacterNote(edited);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.character.classes).toEqual([{ name: "Fighter", level: 3 }]);
      expect(result.character.armorClassOverride).toBeUndefined();
    }
    // And the next save rewrites them.
    if (result.ok) {
      const saved = serializeCharacterNote(result.character, edited);
      expect(saved).not.toContain("ac: 99");
      expect(saved).toContain("level: 3");
    }
  });

  it("ignores invalid hand edits (rewritten on next save)", () => {
    const note = serializeCharacterNote(sampleCharacter());
    const edited = note
      .replace(/^hp: 21$/m, "hp: banana")
      .replace(/^hp_max: 28$/m, "hp_max: -4");

    const result = parseCharacterNote(edited);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.character.currentHp).toBe(21);
      expect(result.character.maxHp).toBe(28);
    }
  });

  it("envelope wins ties: matching values change nothing", () => {
    const character = sampleCharacter();
    const note = serializeCharacterNote(character);
    const result = parseCharacterNote(note);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.character).toEqual(character);
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
