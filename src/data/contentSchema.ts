import { z } from "zod";
import { AbilitySchema, SkillSchema } from "../model/schema";

/**
 * Schema for game-content bundles (races, classes, backgrounds). Content is
 * data, not code: bundles live in JSON (see `content/srd-5.1.json`) and are
 * validated here at load time. Anything that can produce this shape — the
 * bundled SRD, a Phase 2 Open5e sync, or a 5etools import — plugs in without
 * touching the rules engine or the wizard.
 */

export const TraitSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
export type Trait = z.infer<typeof TraitSchema>;

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

export const ClassDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hitDie: z.number().int().positive(),
  savingThrows: z.tuple([AbilitySchema, AbilitySchema]),
  skillChoice: SkillChoiceSchema,
  spellcastingAbility: AbilitySchema.optional(),
  /** Level-1 class features. */
  traits: z.array(TraitSchema),
  /** Levels at which this class gains an Ability Score Improvement. */
  asiLevels: z.array(z.number().int().min(2).max(20)),
  equipment: StartingEquipmentSchema,
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
