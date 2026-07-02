import srdJson from "./content/srd-5.1.json";
import { parseContentBundle } from "./contentSchema";

/**
 * The bundled SRD 5.1 content, loaded from JSON and validated at startup.
 * Game content is data, not code: to change or extend it, edit (or add)
 * a JSON bundle — see `contentSchema.ts` for the format. Phase 2 layers
 * Open5e / imported bundles on top through the same `parseContentBundle`
 * entry point.
 */
const SRD = parseContentBundle(srdJson);

export const RACES = SRD.races;
export const CLASSES = SRD.classes;
export const BACKGROUNDS = SRD.backgrounds;

export type {
  BackgroundData,
  ClassData,
  ContentBundle,
  EquipmentChoice,
  EquipmentItem,
  RaceData,
  SkillChoice,
  StartingEquipment,
  Trait,
} from "./contentSchema";
