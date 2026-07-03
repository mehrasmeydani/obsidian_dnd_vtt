import { z } from "zod";
import { AbilitySchema, SkillSchema } from "../model/schema";

/**
 * Schema for game-content bundles (races, classes, backgrounds). Content is
 * data, not code: bundles live in JSON — one file per class/race under
 * `content/srd/`, assembled by its manifest (`content/srd/index.ts`) — and
 * are validated here at load time. Anything that can produce this shape — the
 * bundled SRD, a Phase 2 Open5e sync, or a 5etools import — plugs in without
 * touching the rules engine or the wizard.
 */

export const TraitSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
export type Trait = z.infer<typeof TraitSchema>;

/**
 * A mechanical effect a class feature applies to the character at assembly.
 * Only effects that change derived sheet numbers are modeled; purely textual
 * features carry none.
 */
export const FeatureEffectSchema = z.discriminatedUnion("kind", [
  /** Fast Movement: flat bonus to walking speed. */
  z.object({
    kind: z.literal("speed-bonus"),
    amount: z.number().int().positive(),
  }),
  /** Primal Champion: raise scores, with a new cap above the usual 20. */
  z.object({
    kind: z.literal("ability-increase"),
    abilities: z.array(AbilitySchema).min(1),
    amount: z.number().int().positive(),
    /** New maximum for the raised scores (increase never exceeds it). */
    max: z.number().int().positive(),
  }),
]);
export type FeatureEffect = z.infer<typeof FeatureEffectSchema>;

/**
 * A class or subclass feature granted at `level`. Entries that share a name
 * are tiers of one scaling feature (Brutal Critical at 9/13/17): a character
 * gets only the highest tier with `level <= character level`.
 */
export const ClassFeatureSchema = z.object({
  name: z.string().min(1),
  level: z.number().int().min(1).max(20),
  description: z.string().optional(),
  effects: z.array(FeatureEffectSchema).default([]),
});
export type ClassFeature = z.infer<typeof ClassFeatureSchema>;

/**
 * A limited-use class resource (Rage, Ki, Channel Divinity…) whose pool
 * scales with class level. The highest entry with `level <= class level`
 * applies; the sheet renders the pool as pips.
 */
export const ClassResourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  per: z.enum(["short-rest", "long-rest"]),
  levels: z
    .array(
      z.object({
        level: z.number().int().min(1).max(20),
        uses: z.union([z.number().int().positive(), z.literal("unlimited")]),
        /** A rider that scales alongside the pool, e.g. "+2 rage damage". */
        note: z.string().optional(),
      }),
    )
    .min(1),
});
export type ClassResource = z.infer<typeof ClassResourceSchema>;

/** Armor/weapon/tool proficiencies granted outright (they are not a pick). */
export const ProficienciesSchema = z.object({
  armor: z.array(z.string().min(1)).default([]),
  weapons: z.array(z.string().min(1)).default([]),
  tools: z.array(z.string().min(1)).default([]),
});
export type Proficiencies = z.infer<typeof ProficienciesSchema>;

/** "Choose `count` skills from `from`" — `"any"` means all 18 skills. */
export const SkillChoiceSchema = z.object({
  count: z.number().int().positive(),
  from: z.union([z.array(SkillSchema), z.literal("any")]),
});
export type SkillChoice = z.infer<typeof SkillChoiceSchema>;

/** A concrete piece of starting gear. */
export const EquipmentItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive().optional(),
});
export type EquipmentItem = z.infer<typeof EquipmentItemSchema>;

/** "Pick one": each option is a bundle of items granted together. */
export const EquipmentChoiceSchema = z.object({
  options: z.array(z.array(EquipmentItemSchema).min(1)).min(2),
});
export type EquipmentChoice = z.infer<typeof EquipmentChoiceSchema>;

export const StartingEquipmentSchema = z.object({
  fixed: z.array(EquipmentItemSchema),
  choices: z.array(EquipmentChoiceSchema),
});
export type StartingEquipment = z.infer<typeof StartingEquipmentSchema>;

export const RaceDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  speed: z.number().int().positive(),
  /** Fixed ability score increases, e.g. { con: 2, wis: 1 }. */
  fixedBonuses: z.record(AbilitySchema, z.number().int().positive()),
  /** Extra "+`amount` to `count` different abilities of your choice". */
  bonusChoice: z
    .object({
      count: z.number().int().positive(),
      amount: z.number().int().positive(),
    })
    .optional(),
  /** Skill proficiencies granted outright (e.g. elf Keen Senses). */
  grantedSkills: z.array(SkillSchema).optional(),
  /** Skill proficiencies chosen freely (e.g. half-elf Skill Versatility). */
  skillChoice: SkillChoiceSchema.optional(),
  traits: z.array(TraitSchema),
});
export type RaceData = z.infer<typeof RaceDataSchema>;

/**
 * Rules edition a piece of content belongs to: "2014" is the original 5e
 * (SRD 5.1), "2024" the revised 5.5e rules (SRD 5.2). Entries may share a
 * name across editions (e.g. two Barbarians); ids stay unique.
 */
export const EditionSchema = z.enum(["2014", "2024"]);
export type Edition = z.infer<typeof EditionSchema>;

/**
 * A player decision attached to a class or subclass feature (Fighting Style,
 * Expertise, Pact Boon, Weapon Mastery…). `level` says when the choice is
 * owed; the wizard only surfaces choices with `level <= starting level`.
 */
const FeatureChoiceBaseSchema = z.object({
  /** Unique within the class, including its subclasses' choices. */
  id: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().min(1).max(20),
  count: z.number().int().positive(),
  description: z.string().optional(),
});

export const FeatureChoiceSchema = z.discriminatedUnion("kind", [
  /** Pick `count` named options; each pick becomes a feature. */
  FeatureChoiceBaseSchema.extend({
    kind: z.literal("options"),
    options: z.array(TraitSchema).min(2),
  }),
  /** Pick `count` new skill proficiencies (e.g. Lore bard, Primal Knowledge). */
  FeatureChoiceBaseSchema.extend({
    kind: z.literal("skills"),
    from: z.union([z.array(SkillSchema), z.literal("any")]),
  }),
  /** Pick `count` already-proficient skills to upgrade to expertise. */
  FeatureChoiceBaseSchema.extend({
    kind: z.literal("expertise"),
  }),
]);
export type FeatureChoice = z.infer<typeof FeatureChoiceSchema>;

export const SubclassDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Granted subclass features by level (see `ClassFeatureSchema`). */
  features: z.array(ClassFeatureSchema),
  featureChoices: z.array(FeatureChoiceSchema).default([]),
});
export type SubclassData = z.infer<typeof SubclassDataSchema>;

export const ClassDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  edition: EditionSchema.default("2014"),
  hitDie: z.number().int().positive(),
  savingThrows: z.tuple([AbilitySchema, AbilitySchema]),
  skillChoice: SkillChoiceSchema,
  spellcastingAbility: AbilitySchema.optional(),
  /** Granted class features by level (see `ClassFeatureSchema`). */
  features: z.array(ClassFeatureSchema),
  /** Armor/weapon/tool proficiencies the class grants at level 1. */
  proficiencies: ProficienciesSchema.default({}),
  /** Scaling limited-use pools (Rage…), read by the sheet's resource pips. */
  resources: z.array(ClassResourceSchema).default([]),
  /** Levels at which this class gains an Ability Score Improvement. */
  asiLevels: z.array(z.number().int().min(2).max(20)),
  equipment: StartingEquipmentSchema,
  /** Level the subclass is chosen at; required when `subclasses` is set. */
  subclassLevel: z.number().int().min(1).max(20).optional(),
  subclasses: z.array(SubclassDataSchema).default([]),
  /** Class-level feature choices (subclasses carry their own). */
  featureChoices: z.array(FeatureChoiceSchema).default([]),
});
export type ClassData = z.infer<typeof ClassDataSchema>;

export const BackgroundDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  grantedSkills: z.array(SkillSchema),
  skillChoice: SkillChoiceSchema.optional(),
  /** Free-text name allowed (the "custom" background). */
  customName: z.boolean().optional(),
  description: z.string(),
  traits: z.array(TraitSchema),
  equipment: z.array(EquipmentItemSchema),
});
export type BackgroundData = z.infer<typeof BackgroundDataSchema>;

export const ContentBundleSchema = z.object({
  /** Human-readable source name, e.g. "SRD 5.1". */
  name: z.string().min(1),
  races: z.array(RaceDataSchema),
  classes: z.array(ClassDataSchema),
  backgrounds: z.array(BackgroundDataSchema),
});
export type ContentBundle = z.infer<typeof ContentBundleSchema>;

/**
 * Validate raw JSON (bundled, user-supplied, or imported) into a typed
 * content bundle. Throws a ZodError describing every problem when invalid.
 */
export function parseContentBundle(raw: unknown): ContentBundle {
  return ContentBundleSchema.parse(raw);
}
