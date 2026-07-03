import { srdRaw } from "./content/srd/index";
import { parseContentBundle } from "./contentSchema";

/**
 * The bundled SRD content (5.1 for 2014 entries, 5.2 for 2024 entries),
 * assembled from per-entity JSON by `content/srd/index.ts` and validated at
 * startup. Game content is data, not code: to change or extend it, edit (or
 * add) a JSON file and list it in the manifest — see `contentSchema.ts` for
 * the format. Phase 2 layers Open5e / imported bundles on top through the
 * same `parseContentBundle` entry point.
 */
const SRD = parseContentBundle(srdRaw);

export const RACES = SRD.races;
export const CLASSES = SRD.classes;
export const BACKGROUNDS = SRD.backgrounds;
export const FEATS = SRD.feats;

export type {
  BackgroundData,
  ClassData,
  ClassFeature,
  ClassResource,
  ContentBundle,
  EquipmentChoice,
  EquipmentItem,
  FeatData,
  FeatureChoice,
  FeatureEffect,
  OptionChoice,
  Proficiencies,
  RaceData,
  SkillChoice,
  StartingEquipment,
  SubclassData,
  Trait,
} from "./contentSchema";
