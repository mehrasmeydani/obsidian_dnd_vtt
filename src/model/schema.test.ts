import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  AbilitySchema,
  CharacterSchema,
  EnvelopeSchema,
  ItemSchema,
  NoteSchema,
  SCHEMA_VERSION,
  SKILLS,
  emptyCharacter,
} from "./schema";

/**
 * Regression tests for the shared data contract. Characters, notes, and sync
 * payloads are all validated by these schemas, so silent changes here can
 * corrupt vault files or break clients — change these tests deliberately.
 */

describe("schema version", () => {
  it("is bumped consciously (migrations required on change)", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});

describe("CharacterSchema", () => {
  it("accepts emptyCharacter and applies defaults", () => {
    const c = emptyCharacter("id-1", "Nameless");
    expect(c.classes).toEqual([]);
    // AC is derived (rules/armorClass); only the override is stored.
    expect(c.armorClassOverride).toBeUndefined();
    expect(c.speed).toBe(30);
    expect(c.inventory).toEqual([]);
    expect(c.spells).toEqual([]);
    expect(c.features).toEqual([]);
    expect(c.notes).toBe("");
    expect(c.savingThrows).toEqual({});
    expect(c.skills).toEqual({});
  });

  it("rejects ability scores outside 1-30 or non-integers", () => {
    for (const bad of [0, 31, 10.5]) {
      const result = CharacterSchema.safeParse({
        ...emptyCharacter("id", "X"),
        abilityScores: { str: bad, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects unknown skill keys and proficiency levels", () => {
    const base = emptyCharacter("id", "X");
    expect(
      CharacterSchema.safeParse({ ...base, skills: { flying: "proficient" } })
        .success,
    ).toBe(false);
    expect(
      CharacterSchema.safeParse({ ...base, skills: { stealth: "master" } })
        .success,
    ).toBe(false);
  });

  it("rejects negative max/temp HP but allows negative current HP", () => {
    const base = emptyCharacter("id", "X");
    expect(CharacterSchema.safeParse({ ...base, maxHp: -1 }).success).toBe(false);
    expect(CharacterSchema.safeParse({ ...base, tempHp: -1 }).success).toBe(false);
    // Negative current HP is legal state (e.g. tracking massive damage).
    expect(CharacterSchema.safeParse({ ...base, currentHp: -5 }).success).toBe(true);
  });

  it("rejects spell levels outside 0-9", () => {
    const base = emptyCharacter("id", "X");
    const spell = { id: "s", name: "Fireball", level: 10 };
    expect(CharacterSchema.safeParse({ ...base, spells: [spell] }).success).toBe(
      false,
    );
  });
});

describe("ItemSchema", () => {
  it("defaults quantity to 1 and equipped to false", () => {
    const item = ItemSchema.parse({ id: "i", name: "Rope" });
    expect(item.quantity).toBe(1);
    expect(item.equipped).toBe(false);
  });
});

describe("NoteSchema", () => {
  it("defaults visibility to private", () => {
    expect(NoteSchema.parse({ id: "n", title: "T" }).visibility).toBe("private");
  });

  it("rejects unknown visibility values", () => {
    expect(
      NoteSchema.safeParse({ id: "n", title: "T", visibility: "public" }).success,
    ).toBe(false);
  });
});

describe("EnvelopeSchema", () => {
  it("accepts known kinds and rejects unknown ones", () => {
    for (const kind of ["character", "note", "scene", "session"]) {
      expect(
        EnvelopeSchema.safeParse({ schemaVersion: 1, kind, payload: {} }).success,
      ).toBe(true);
    }
    expect(
      EnvelopeSchema.safeParse({ schemaVersion: 1, kind: "map", payload: {} })
        .success,
    ).toBe(false);
  });
});

describe("skill table", () => {
  it("has exactly the 18 PHB skills, each tied to a valid ability", () => {
    expect(Object.keys(SKILLS)).toHaveLength(18);
    for (const ability of Object.values(SKILLS)) {
      expect(AbilitySchema.safeParse(ability).success).toBe(true);
    }
    expect(ABILITIES).toHaveLength(6);
  });
});
