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
});
export type Feature = z.infer<typeof FeatureSchema>;

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string().optional(),
  race: z.string().default(""),
  background: z.string().default(""),
  classes: z
    .array(z.object({ name: z.string(), level: z.number().int().min(1) }))
    .default([]),
  abilityScores: AbilityScoresSchema,
  savingThrows: z.record(AbilitySchema, ProficiencyLevelSchema).default({}),
  skills: z.record(SkillSchema, ProficiencyLevelSchema).default({}),
  maxHp: z.number().int().min(0).default(0),
  currentHp: z.number().int().default(0),
  tempHp: z.number().int().min(0).default(0),
  armorClass: z.number().int().default(10),
  speed: z.number().int().default(30),
  inventory: z.array(ItemSchema).default([]),
  spells: z.array(SpellSchema).default([]),
  /** Ability used for spellcasting DC/attack, if any. */
  spellcastingAbility: AbilitySchema.optional(),
  features: z.array(FeatureSchema).default([]),
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
