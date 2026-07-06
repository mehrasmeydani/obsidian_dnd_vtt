import { z } from "zod";

/**
 * The shared data model for the VTT. These Zod schemas are the single source of
 * truth: types are inferred from them, and the same schemas validate data read
 * from vault notes and received over the sync layer.
 *
 * Derived values (ability modifiers, proficiency bonus, save DCs, passive
 * scores) are NOT stored here — they are computed in `src/rules/abilityMath.ts`
 * so a sheet can never drift out of sync with its inputs.
 */

/** Bump when a breaking change to the model requires a migration. */
export const SCHEMA_VERSION = 1;

export const AbilitySchema = z.enum([
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
]);
export type Ability = z.infer<typeof AbilitySchema>;

export const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

/** The 18 skills, each tied to its governing ability. */
export const SKILLS = {
  acrobatics: "dex",
  animalHandling: "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  sleightOfHand: "dex",
  stealth: "dex",
  survival: "wis",
} as const satisfies Record<string, Ability>;

export const SkillSchema = z.enum(
  Object.keys(SKILLS) as [keyof typeof SKILLS, ...(keyof typeof SKILLS)[]],
);
export type Skill = z.infer<typeof SkillSchema>;

/** Proficiency level applied to a skill or saving throw. */
export const ProficiencyLevelSchema = z.enum(["none", "proficient", "expertise"]);
export type ProficiencyLevel = z.infer<typeof ProficiencyLevelSchema>;

export const AbilityScoresSchema = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
});
export type AbilityScores = z.infer<typeof AbilityScoresSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int().min(0).default(1),
  weight: z.number().min(0).optional(),
  equipped: z.boolean().default(false),
  /** Content-bundle armor id when this item is armor/a shield (drives AC). */
  armorId: z.string().optional(),
  /**
   * Equip slot (T-38): hand (weapons, shields, torches), body (armor,
   * clothes — one at a time), accessory (rings, cloaks — unlimited).
   * "none" marks an item explicitly unequippable; absent means "infer
   * from armor data / name" (rules/equipment.ts).
   */
  slot: z.enum(["hand", "body", "accessory", "none"]).optional(),
  notes: z.string().optional(),
});
export type Item = z.infer<typeof ItemSchema>;

export const SpellSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int().min(0).max(9),
  prepared: z.boolean().default(false),
  /** Reference to a cached Open5e slug, when sourced from the content browser. */
  sourceSlug: z.string().optional(),
});
export type Spell = z.infer<typeof SpellSchema>;

export const FeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string().optional(),
  description: z.string().optional(),
  /** Class level the feature was gained at (class/subclass features only). */
  level: z.number().int().min(1).max(20).optional(),
});
export type Feature = z.infer<typeof FeatureSchema>;

/**
 * A limited-use pool (Rage, Ki…) with its current spend. `max` is copied from
 * the class resource table at the character's level; "unlimited" pools render
 * without pips.
 */
export const ResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  max: z.union([z.number().int().min(0), z.literal("unlimited")]),
  used: z.number().int().min(0).default(0),
  per: z.enum(["short-rest", "long-rest"]),
  note: z.string().optional(),
});
export type Resource = z.infer<typeof ResourceSchema>;

/** Armor/weapon/tool proficiencies, as display strings from content data. */
export const CharacterProficienciesSchema = z.object({
  armor: z.array(z.string()).default([]),
  weapons: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
});
export type CharacterProficiencies = z.infer<
  typeof CharacterProficienciesSchema
>;

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string().optional(),
  race: z.string().default(""),
  background: z.string().default(""),
  /**
   * Rules edition the character was built with (T-17): "2014" (SRD 5.1) or
   * "2024" (SRD 5.2). Stamped from the class at assembly; additive, so
   * older notes default to "2014".
   */
  edition: z.enum(["2014", "2024"]).default("2014"),
  classes: z
    .array(
      z.object({
        name: z.string(),
        level: z.number().int().min(1),
        /** Subclass name, once chosen (additive — older notes lack it). */
        subclass: z.string().optional(),
      }),
    )
    .default([]),
  abilityScores: AbilityScoresSchema,
  savingThrows: z.record(AbilitySchema, ProficiencyLevelSchema).default({}),
  skills: z.record(SkillSchema, ProficiencyLevelSchema).default({}),
  maxHp: z.number().int().min(0).default(0),
  currentHp: z.number().int().default(0),
  tempHp: z.number().int().min(0).default(0),
  /**
   * AC is derived (armor/unarmored defense/10+DEX — see `rules/armorClass`);
   * this optional override wins outright when set (homebrew formulas).
   * Pre-T-06 notes stored a computed `armorClass`, which is now ignored.
   */
  armorClassOverride: z.number().int().optional(),
  /** Unarmored Defense formula the class grants, if any (10 + DEX + ability). */
  unarmoredDefense: z
    .object({ ability: AbilitySchema, shield: z.boolean() })
    .optional(),
  speed: z.number().int().default(30),
  inventory: z.array(ItemSchema).default([]),
  spells: z.array(SpellSchema).default([]),
  /** Ability used for spellcasting DC/attack, if any. */
  spellcastingAbility: AbilitySchema.optional(),
  features: z.array(FeatureSchema).default([]),
  /** Languages known, from race/background grants and picks (T-08). */
  languages: z.array(z.string()).default([]),
  /** Damage types this character resists, e.g. "Poison" (T-35). */
  resistances: z.array(z.string()).default([]),
  /** Damage types this character is immune to (T-35). */
  immunities: z.array(z.string()).default([]),
  /** Damage types this character is vulnerable to (T-35). */
  vulnerabilities: z.array(z.string()).default([]),
  /** Active conditions during play (Poisoned, Prone…), a live toggle (T-35). */
  conditions: z.array(z.string()).default([]),
  proficiencies: CharacterProficienciesSchema.default({}),
  resources: z.array(ResourceSchema).default([]),
  notes: z.string().default(""),
});
export type Character = z.infer<typeof CharacterSchema>;

export const NoteVisibilitySchema = z.enum(["private", "party", "dm"]);
export type NoteVisibility = z.infer<typeof NoteVisibilitySchema>;

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().default(""),
  ownerId: z.string().optional(),
  visibility: NoteVisibilitySchema.default("private"),
  updatedAt: z.number().int().optional(),
});
export type Note = z.infer<typeof NoteSchema>;

/** A versioned wrapper for any document persisted or synced. */
export const EnvelopeSchema = z.object({
  schemaVersion: z.number().int(),
  kind: z.enum(["character", "note", "scene", "session"]),
  payload: z.unknown(),
});
export type Envelope = z.infer<typeof EnvelopeSchema>;

/**
 * A blank, valid character used as the starting point for character creation.
 */
export function emptyCharacter(id: string, name = "New Character"): Character {
  return CharacterSchema.parse({
    id,
    name,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  });
}
