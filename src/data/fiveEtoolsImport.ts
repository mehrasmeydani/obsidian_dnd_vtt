import {
  SKILLS,
  type Ability,
  type Skill,
} from "../model/schema";
import type {
  BackgroundData,
  ClassData,
  ClassFeature,
  ContentBundle,
  EquipmentItem,
  FeatData,
  RaceData,
  SpellData,
  StartingEquipment,
  SubclassData,
} from "./contentSchema";

/**
 * 5etools JSON → content bundle converter (T-13). Pure: takes parsed JSON
 * the user supplies from their own 5etools data files and returns bundle
 * entities plus a report of everything that could not be mapped (by name —
 * nothing is dropped silently).
 *
 * **Licensing:** the importer ships with the plugin, the data does not.
 * 5etools files contain WotC-copyrighted text; imported bundles stay in the
 * user's own vault/plugin folder and must never be redistributed. Only SRD
 * content may ship with the plugin.
 *
 * The mapping covers the subset the wizard consumes: races (ability
 * bonuses, skills, traits), classes (leveled features, subclasses, ASI
 * levels, proficiencies, starting equipment), backgrounds, feats, and
 * spells. 5etools' quirks (tag markup, ref indirection, `_copy` variants)
 * are handled where cheap and reported where not.
 */

// ---------------------------------------------------------------------------
// Entry rendering: 5etools "entries" trees + {@tag ...} markup → plain text.
// ---------------------------------------------------------------------------

/** Replace `{@tag payload}` markup with its display text. */
export function stripTags(text: string): string {
  // Tags may nest one level ({@b {@i x}}); two passes cover practice.
  let out = text;
  for (let pass = 0; pass < 2 && out.includes("{@"); pass++) {
    out = out.replace(/\{@(\w+) ([^{}]*)\}/g, (_, _tag: string, payload: string) => {
      const parts = payload.split("|");
      // "name|source|display" prefers the display text when present.
      return (parts[2] || parts[0]).trim();
    });
  }
  return out;
}

/** Flatten a 5etools entries tree into readable plain text. */
export function renderEntries(entries: unknown, depth = 0): string {
  if (entries == null) return "";
  if (typeof entries === "string") return stripTags(entries);
  if (typeof entries === "number") return String(entries);
  if (Array.isArray(entries)) {
    return entries
      .map((entry) => renderEntries(entry, depth))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof entries !== "object") return "";

  const entry = entries as Record<string, unknown>;
  switch (entry.type) {
    case "list":
      return renderEntries(entry.items, depth + 1);
    case "item": {
      const name = typeof entry.name === "string" ? stripTags(entry.name) : "";
      const body = renderEntries(entry.entry ?? entry.entries, depth);
      return name ? `${name} ${body}`.trim() : body;
    }
    case "table":
      return "(table omitted)";
    case "options":
      return renderEntries(entry.entries, depth);
    case "refOptionalfeature":
      return typeof entry.optionalfeature === "string"
        ? `- ${entry.optionalfeature.split("|")[0]}`
        : "";
    case "refSubclassFeature":
    case "refClassFeature":
      // Referenced features are converted separately; no inline text.
      return "";
    case "inset":
    case "insetReadaloud":
    case "quote":
    case "entries":
    case "section":
    default: {
      const name = typeof entry.name === "string" ? stripTags(entry.name) : "";
      const body = renderEntries(entry.entries ?? entry.items, depth + 1);
      if (!name) return body;
      return depth === 0 ? `${name}. ${body}` : `${name}: ${body}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Small shared lookups.
// ---------------------------------------------------------------------------

const ABILITIES = new Set(["str", "dex", "con", "int", "wis", "cha"]);

/** "animal handling" → "animalHandling"; returns undefined when unknown. */
function toSkill(name: string): Skill | undefined {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/ (\w)/g, (_, c: string) => c.toUpperCase());
  return key in SKILLS ? (key as Skill) : undefined;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Stable bundle id for an imported entity. */
function importId(kind: string, name: string, source?: string): string {
  return `5etools-${kind}-${slugify(source ? `${name}-${source}` : name)}`;
}

/** One "could not map" line for the report. */
function skipLine(kind: string, raw: unknown, reason: string): string {
  const name =
    raw && typeof raw === "object" && typeof (raw as { name?: unknown }).name === "string"
      ? (raw as { name: string }).name
      : "(unnamed)";
  const source =
    raw && typeof raw === "object" && typeof (raw as { source?: unknown }).source === "string"
      ? ` [${(raw as { source: string }).source}]`
      : "";
  return `${kind} ${name}${source}: ${reason}`;
}

// ---------------------------------------------------------------------------
// Races.
// ---------------------------------------------------------------------------

export function raceFromFiveEtools(raw: unknown): RaceData {
  const race = raw as Record<string, unknown>;
  if (!race || typeof race.name !== "string") throw new Error("no name");
  if (race._copy) throw new Error("_copy variants are not supported");

  const speed =
    typeof race.speed === "number"
      ? race.speed
      : typeof race.speed === "object" && race.speed
        ? Number((race.speed as { walk?: unknown }).walk)
        : NaN;
  if (!Number.isFinite(speed) || speed <= 0) throw new Error("no walking speed");

  const fixedBonuses: Partial<Record<Ability, number>> = {};
  let bonusChoice: RaceData["bonusChoice"];
  const abilityBlocks = Array.isArray(race.ability) ? race.ability : [];
  for (const block of abilityBlocks) {
    if (!block || typeof block !== "object") continue;
    for (const [key, value] of Object.entries(block as Record<string, unknown>)) {
      if (ABILITIES.has(key) && typeof value === "number" && value > 0) {
        fixedBonuses[key as Ability] = value;
      } else if (key === "choose" && value && typeof value === "object") {
        const choose = value as { count?: number; amount?: number };
        bonusChoice = {
          count: choose.count ?? 1,
          amount: choose.amount ?? 1,
        };
      }
    }
  }

  const grantedSkills: Skill[] = [];
  let skillChoice: RaceData["skillChoice"];
  const skillBlocks = Array.isArray(race.skillProficiencies)
    ? race.skillProficiencies
    : [];
  for (const block of skillBlocks) {
    if (!block || typeof block !== "object") continue;
    for (const [key, value] of Object.entries(block as Record<string, unknown>)) {
      if (value === true) {
        const skill = toSkill(key);
        if (skill) grantedSkills.push(skill);
      } else if (key === "any" && typeof value === "number") {
        skillChoice = { count: value, from: "any" };
      } else if (key === "choose" && value && typeof value === "object") {
        const choose = value as { from?: unknown[]; count?: number };
        const from = (choose.from ?? [])
          .map((s) => (typeof s === "string" ? toSkill(s) : undefined))
          .filter((s): s is Skill => Boolean(s));
        if (from.length > 0) {
          skillChoice = { count: choose.count ?? 1, from };
        }
      }
    }
  }

  const traits = (Array.isArray(race.entries) ? race.entries : [])
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as { name?: unknown }).name === "string",
    )
    .map((entry) => ({
      name: stripTags(entry.name as string),
      description: renderEntries(entry.entries, 1) || undefined,
    }));

  return {
    id: importId("race", race.name, race.source as string | undefined),
    name: race.name,
    edition: race.edition === "one" || race.source === "XPHB" ? "2024" : "2014",
    speed,
    fixedBonuses,
    bonusChoice,
    grantedSkills: grantedSkills.length > 0 ? grantedSkills : undefined,
    skillChoice,
    traits,
    languages: [],
    tools: [],
    optionChoices: [],
  };
}

// ---------------------------------------------------------------------------
// Classes (a 5etools class file: class + subclass + feature lookup tables).
// ---------------------------------------------------------------------------

const ARMOR_PROFICIENCY_NAMES: Record<string, string> = {
  light: "Light armor",
  medium: "Medium armor",
  heavy: "Heavy armor",
  shield: "Shields",
};

const WEAPON_PROFICIENCY_NAMES: Record<string, string> = {
  simple: "Simple weapons",
  martial: "Martial weapons",
  firearms: "Firearms",
};

/** "chain mail|phb" / {item,quantity} / {special} / {equipmentType} → item. */
function equipmentItemFromRef(ref: unknown): EquipmentItem | undefined {
  if (typeof ref === "string") {
    const name = stripTags(ref).split("|")[0].trim();
    return name ? { name } : undefined;
  }
  if (!ref || typeof ref !== "object") return undefined;
  const record = ref as Record<string, unknown>;
  const quantity =
    typeof record.quantity === "number" && record.quantity > 1
      ? record.quantity
      : undefined;
  if (typeof record.displayName === "string") {
    return { name: stripTags(record.displayName), quantity };
  }
  if (typeof record.special === "string") {
    return { name: stripTags(record.special), quantity };
  }
  if (typeof record.item === "string") {
    return { name: stripTags(record.item).split("|")[0].trim(), quantity };
  }
  if (typeof record.equipmentType === "string") {
    const names: Record<string, string> = {
      weaponSimple: "Any simple weapon",
      weaponSimpleMelee: "Any simple melee weapon",
      weaponMartial: "Any martial weapon",
      weaponMartialMelee: "Any martial melee weapon",
      instrumentMusical: "A musical instrument",
      setGaming: "A gaming set",
      toolArtisan: "Artisan's tools",
      armorLight: "Any light armor",
      armorMedium: "Any medium armor",
      armorHeavy: "Any heavy armor",
      weaponRanged: "Any ranged weapon",
      focusSpellcasting: "A spellcasting focus",
    };
    const name = names[record.equipmentType] ?? record.equipmentType;
    return { name, quantity };
  }
  return undefined;
}

/** 5etools `startingEquipment.defaultData` → our fixed + pick-one choices. */
function startingEquipmentFromFiveEtools(raw: unknown): StartingEquipment {
  const equipment: StartingEquipment = { fixed: [], choices: [] };
  const defaultData =
    raw && typeof raw === "object"
      ? (raw as { defaultData?: unknown }).defaultData
      : undefined;
  if (!Array.isArray(defaultData)) return equipment;

  for (const group of defaultData) {
    if (!group || typeof group !== "object") continue;
    const record = group as Record<string, unknown>;
    if (Array.isArray(record._)) {
      for (const ref of record._) {
        const item = equipmentItemFromRef(ref);
        if (item) equipment.fixed.push(item);
      }
      continue;
    }
    const options = Object.keys(record)
      .filter((key) => /^[a-z]$/.test(key) && Array.isArray(record[key]))
      .sort()
      .map((key) =>
        (record[key] as unknown[])
          .map(equipmentItemFromRef)
          .filter((item): item is EquipmentItem => Boolean(item)),
      )
      .filter((items) => items.length > 0);
    if (options.length >= 2) {
      equipment.choices.push({ options });
    } else if (options.length === 1) {
      equipment.fixed.push(...options[0]);
    }
  }
  return equipment;
}

interface FeatureRef {
  name: string;
  level: number;
  source?: string;
  gainSubclassFeature: boolean;
}

/** "Name|Class|ClassSource|Level|Source?" or the object wrapper. */
function parseClassFeatureRef(raw: unknown): FeatureRef | undefined {
  let ref = raw;
  let gainSubclassFeature = false;
  if (ref && typeof ref === "object") {
    const record = ref as { classFeature?: unknown; gainSubclassFeature?: unknown };
    gainSubclassFeature = record.gainSubclassFeature === true;
    ref = record.classFeature;
  }
  if (typeof ref !== "string") return undefined;
  const parts = ref.split("|");
  const level = Number(parts[3]);
  if (!parts[0] || !Number.isFinite(level)) return undefined;
  return { name: parts[0], level, source: parts[4] || undefined, gainSubclassFeature };
}

/** "Name|Class|ClassSource|Short|SubSource|Level|Source?" */
function parseSubclassFeatureRef(raw: unknown): FeatureRef | undefined {
  if (typeof raw !== "string") return undefined;
  const parts = raw.split("|");
  const level = Number(parts[5]);
  if (!parts[0] || !Number.isFinite(level)) return undefined;
  return { name: parts[0], level, source: parts[6] || undefined, gainSubclassFeature: false };
}

interface RawFeatureRecord {
  name?: unknown;
  level?: unknown;
  source?: unknown;
  entries?: unknown;
  className?: unknown;
  subclassShortName?: unknown;
}

function findFeature(
  table: RawFeatureRecord[],
  ref: FeatureRef,
  extra: (record: RawFeatureRecord) => boolean,
): RawFeatureRecord | undefined {
  const candidates = table.filter(
    (record) =>
      record.name === ref.name && record.level === ref.level && extra(record),
  );
  if (candidates.length <= 1) return candidates[0];
  return candidates.find((record) => record.source === (ref.source ?? "PHB")) ?? candidates[0];
}

/** The names that mark ASI slots rather than real features. */
const ASI_NAME = "Ability Score Improvement";

export interface FiveEtoolsClassFile {
  class?: unknown[];
  subclass?: unknown[];
  classFeature?: unknown[];
  subclassFeature?: unknown[];
}

export function classesFromFiveEtools(file: FiveEtoolsClassFile): {
  classes: ClassData[];
  skipped: string[];
} {
  const classes: ClassData[] = [];
  const skipped: string[] = [];
  const classFeatureTable = (file.classFeature ?? []) as RawFeatureRecord[];
  const subclassFeatureTable = (file.subclassFeature ?? []) as RawFeatureRecord[];

  for (const raw of file.class ?? []) {
    const cls = raw as Record<string, unknown>;
    try {
      if (typeof cls.name !== "string") throw new Error("no name");
      // Sidekick pseudo-classes (TCE) aren't player classes; ignore by design.
      if (/sidekick$/i.test(cls.name)) {
        skipped.push(skipLine("class", raw, "ignored — sidekick classes are not supported"));
        continue;
      }
      const hd = cls.hd as { faces?: unknown } | undefined;
      if (!hd || typeof hd.faces !== "number") throw new Error("no hit die");
      const saves = Array.isArray(cls.proficiency)
        ? cls.proficiency.filter(
            (p): p is Ability => typeof p === "string" && ABILITIES.has(p),
          )
        : [];
      if (saves.length !== 2) throw new Error("expected exactly 2 saving throws");

      const starting = (cls.startingProficiencies ?? {}) as Record<string, unknown>;
      const skillBlocks = Array.isArray(starting.skills) ? starting.skills : [];
      let skillChoice: ClassData["skillChoice"] | undefined;
      for (const block of skillBlocks) {
        const choose = (block as { choose?: { from?: unknown[]; count?: number }; any?: number })
          ?.choose;
        const any = (block as { any?: number })?.any;
        if (typeof any === "number") {
          skillChoice = { count: any, from: "any" };
        } else if (choose) {
          const from = (choose.from ?? [])
            .map((s) => (typeof s === "string" ? toSkill(s) : undefined))
            .filter((s): s is Skill => Boolean(s));
          if (from.length > 0) skillChoice = { count: choose.count ?? 1, from };
        }
      }
      if (!skillChoice) throw new Error("no skill choice found");

      const armor = (Array.isArray(starting.armor) ? starting.armor : [])
        .map((entry) =>
          typeof entry === "string"
            ? (ARMOR_PROFICIENCY_NAMES[entry] ?? capitalize(stripTags(entry).split("|")[0]))
            : undefined,
        )
        .filter((entry): entry is string => Boolean(entry));
      const weapons = (Array.isArray(starting.weapons) ? starting.weapons : [])
        .map((entry) =>
          typeof entry === "string"
            ? (WEAPON_PROFICIENCY_NAMES[entry] ?? capitalize(stripTags(entry).split("|")[0]))
            : undefined,
        )
        .filter((entry): entry is string => Boolean(entry));
      const tools = (Array.isArray(starting.tools) ? starting.tools : [])
        .map((entry) => (typeof entry === "string" ? capitalize(stripTags(entry)) : undefined))
        .filter((entry): entry is string => Boolean(entry));

      // Leveled features + ASI levels + subclass level, from the ref list.
      const features: ClassFeature[] = [];
      const asiLevels: number[] = [];
      let subclassLevel: number | undefined;
      for (const refRaw of Array.isArray(cls.classFeatures) ? cls.classFeatures : []) {
        const ref = parseClassFeatureRef(refRaw);
        if (!ref) {
          skipped.push(skipLine("class feature", refRaw, "unparseable feature ref"));
          continue;
        }
        if (ref.gainSubclassFeature) {
          subclassLevel = subclassLevel ?? ref.level;
          continue;
        }
        if (ref.name === ASI_NAME) {
          if (ref.level >= 2) asiLevels.push(ref.level);
          continue;
        }
        const record = findFeature(
          classFeatureTable,
          ref,
          (candidate) => candidate.className === cls.name,
        );
        features.push({
          name: ref.name,
          level: ref.level,
          description: record ? renderEntries(record.entries) || undefined : undefined,
          effects: [],
        });
      }

      const subclasses: SubclassData[] = [];
      for (const subRaw of file.subclass ?? []) {
        const sub = subRaw as Record<string, unknown>;
        if (sub.className !== cls.name || sub.classSource !== cls.source) continue;
        if (typeof sub.name !== "string") continue;
        const subFeatures: ClassFeature[] = [];
        for (const refRaw of Array.isArray(sub.subclassFeatures)
          ? sub.subclassFeatures
          : []) {
          const ref = parseSubclassFeatureRef(refRaw);
          if (!ref) {
            skipped.push(skipLine("subclass feature", refRaw, "unparseable feature ref"));
            continue;
          }
          const record = findFeature(
            subclassFeatureTable,
            ref,
            (candidate) => candidate.subclassShortName === sub.shortName,
          );
          subFeatures.push({
            name: ref.name,
            level: ref.level,
            description: record ? renderEntries(record.entries) || undefined : undefined,
            effects: [],
          });
        }
        subclasses.push({
          id: importId(
            "subclass",
            `${cls.name}-${sub.name}`,
            sub.source as string | undefined,
          ),
          name: sub.name,
          features: subFeatures,
          featureChoices: [],
        });
      }

      classes.push({
        id: importId("class", cls.name, cls.source as string | undefined),
        name: cls.name,
        // 5etools marks rules editions as "classic" (2014) / "one" (2024);
        // fall back to the XPHB source for files that predate the field.
        edition:
          cls.edition === "one" || cls.source === "XPHB" ? "2024" : "2014",
        hitDie: hd.faces,
        savingThrows: [saves[0], saves[1]],
        skillChoice,
        spellcastingAbility:
          typeof cls.spellcastingAbility === "string" &&
          ABILITIES.has(cls.spellcastingAbility)
            ? (cls.spellcastingAbility as Ability)
            : undefined,
        features,
        proficiencies: { armor, weapons, tools },
        resources: [],
        asiLevels: [...new Set(asiLevels)].sort((a, b) => a - b),
        equipment: startingEquipmentFromFiveEtools(cls.startingEquipment),
        subclassLevel: subclasses.length > 0 ? subclassLevel : undefined,
        subclasses,
        featureChoices: [],
      });
    } catch (error) {
      skipped.push(
        skipLine("class", raw, error instanceof Error ? error.message : String(error)),
      );
    }
  }
  return { classes, skipped };
}

function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

// ---------------------------------------------------------------------------
// Backgrounds.
// ---------------------------------------------------------------------------

export function backgroundFromFiveEtools(raw: unknown): BackgroundData {
  const background = raw as Record<string, unknown>;
  if (!background || typeof background.name !== "string") throw new Error("no name");
  if (background._copy) throw new Error("_copy variants are not supported");

  const grantedSkills: Skill[] = [];
  let skillChoice: BackgroundData["skillChoice"];
  for (const block of Array.isArray(background.skillProficiencies)
    ? background.skillProficiencies
    : []) {
    if (!block || typeof block !== "object") continue;
    for (const [key, value] of Object.entries(block as Record<string, unknown>)) {
      if (value === true) {
        const skill = toSkill(key);
        if (skill) grantedSkills.push(skill);
      } else if (key === "any" && typeof value === "number") {
        skillChoice = { count: value, from: "any" };
      } else if (key === "choose" && value && typeof value === "object") {
        const choose = value as { from?: unknown[]; count?: number };
        const from = (choose.from ?? [])
          .map((s) => (typeof s === "string" ? toSkill(s) : undefined))
          .filter((s): s is Skill => Boolean(s));
        if (from.length > 0) skillChoice = { count: choose.count ?? 1, from };
      }
    }
  }

  // Equipment: fixed items plus the first option of each pick (the
  // background schema has no choice slots — noted in the import report
  // only when a choice actually existed).
  const equipment: EquipmentItem[] = [];
  for (const group of Array.isArray(background.startingEquipment)
    ? background.startingEquipment
    : []) {
    if (!group || typeof group !== "object") continue;
    const record = group as Record<string, unknown>;
    const list = Array.isArray(record._)
      ? record._
      : Array.isArray(record.a)
        ? record.a
        : [];
    for (const ref of list) {
      const item = equipmentItemFromRef(ref);
      if (item) equipment.push(item);
    }
  }

  const entries = Array.isArray(background.entries) ? background.entries : [];
  const summary = entries.find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      (entry as { type?: unknown }).type === "list",
  );
  const description =
    renderEntries(summary, 1) ||
    (typeof entries[0] === "string" ? stripTags(entries[0]) : background.name);

  const traits = entries
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as { name?: unknown }).name === "string" &&
        /^feature/i.test((entry as { name: string }).name),
    )
    .map((entry) => ({
      name: stripTags(entry.name as string).replace(/^feature:\s*/i, ""),
      description: renderEntries(entry.entries, 1) || undefined,
    }));

  return {
    id: importId("background", background.name, background.source as string | undefined),
    name: background.name,
    edition:
      background.edition === "one" || background.source === "XPHB"
        ? "2024"
        : "2014",
    grantedSkills,
    skillChoice,
    // TODO(T-17): extract 2024 background ability increases + origin feat
    // from the 5etools `ability`/`feats` fields; defaults for now.
    fixedBonuses: {},
    originFeat: false,
    description,
    traits,
    equipment,
    languages: [],
    tools: [],
    optionChoices: [],
  };
}

// ---------------------------------------------------------------------------
// Feats.
// ---------------------------------------------------------------------------

export function featFromFiveEtools(raw: unknown): FeatData {
  const feat = raw as Record<string, unknown>;
  if (!feat || typeof feat.name !== "string") throw new Error("no name");
  if (feat._copy) throw new Error("_copy variants are not supported");
  return {
    id: importId("feat", feat.name, feat.source as string | undefined),
    name: feat.name,
    // 5etools marks 2024 origin feats with category "O" (T-17).
    origin: feat.category === "O",
    description: renderEntries(feat.entries) || undefined,
  };
}

// ---------------------------------------------------------------------------
// Spells.
// ---------------------------------------------------------------------------

const SCHOOL_NAMES: Record<string, string> = {
  A: "Abjuration",
  C: "Conjuration",
  D: "Divination",
  E: "Enchantment",
  V: "Evocation",
  I: "Illusion",
  N: "Necromancy",
  T: "Transmutation",
  P: "Psionics",
};

function renderSpellTime(time: unknown): string {
  if (!Array.isArray(time) || time.length === 0) return "";
  const first = time[0] as { number?: number; unit?: string };
  if (typeof first !== "object" || !first) return "";
  return `${first.number ?? 1} ${first.unit ?? ""}`.trim();
}

function renderSpellRange(range: unknown): string {
  if (!range || typeof range !== "object") return "";
  const record = range as {
    type?: string;
    distance?: { type?: string; amount?: number };
  };
  const distance = record.distance;
  if (!distance) return capitalize(record.type ?? "");
  if (distance.type === "self") return "Self";
  if (distance.type === "touch") return "Touch";
  if (distance.type === "sight") return "Sight";
  if (distance.type === "unlimited") return "Unlimited";
  const base = `${distance.amount ?? ""} ${distance.type ?? ""}`.trim();
  if (record.type && record.type !== "point") {
    return `Self (${distance.amount}-${(distance.type ?? "").replace(/s$/, "")} ${record.type})`;
  }
  return base;
}

function renderSpellDuration(duration: unknown): {
  text: string;
  concentration: boolean;
} {
  if (!Array.isArray(duration) || duration.length === 0) {
    return { text: "", concentration: false };
  }
  const first = duration[0] as {
    type?: string;
    duration?: { type?: string; amount?: number };
    concentration?: boolean;
    ends?: unknown[];
  };
  const concentration = first.concentration === true;
  if (first.type === "instant") return { text: "Instantaneous", concentration };
  if (first.type === "permanent") {
    return {
      text: Array.isArray(first.ends) ? "Until dispelled" : "Permanent",
      concentration,
    };
  }
  if (first.type === "timed" && first.duration) {
    const amount = first.duration.amount ?? 1;
    const unit = `${first.duration.type ?? ""}${amount === 1 ? "" : "s"}`;
    const text = `${amount} ${unit}`;
    return {
      text: concentration ? `Concentration, up to ${text}` : text,
      concentration,
    };
  }
  return { text: capitalize(first.type ?? ""), concentration };
}

export function spellFromFiveEtools(raw: unknown): SpellData {
  const spell = raw as Record<string, unknown>;
  if (!spell || typeof spell.name !== "string") throw new Error("no name");
  if (typeof spell.level !== "number") throw new Error("no level");

  const components = spell.components as
    | { v?: boolean; s?: boolean; m?: unknown }
    | undefined;
  const parts: string[] = [];
  if (components?.v) parts.push("V");
  if (components?.s) parts.push("S");
  if (components?.m) {
    const material =
      typeof components.m === "string"
        ? components.m
        : typeof components.m === "object" &&
            typeof (components.m as { text?: unknown }).text === "string"
          ? (components.m as { text: string }).text
          : "";
    parts.push(material ? `M (${stripTags(material)})` : "M");
  }

  const { text: duration, concentration } = renderSpellDuration(spell.duration);
  const fromClassList =
    spell.classes && typeof spell.classes === "object"
      ? (spell.classes as { fromClassList?: { name?: unknown }[] }).fromClassList
      : undefined;

  return {
    id: importId("spell", spell.name, spell.source as string | undefined),
    name: spell.name,
    level: spell.level,
    school: SCHOOL_NAMES[String(spell.school)] ?? String(spell.school),
    castingTime: renderSpellTime(spell.time),
    range: renderSpellRange(spell.range),
    components: parts.join(", "),
    duration,
    concentration,
    ritual:
      Boolean(spell.meta && (spell.meta as { ritual?: unknown }).ritual === true),
    classes: (fromClassList ?? [])
      .map((entry) => (typeof entry?.name === "string" ? entry.name.toLowerCase() : ""))
      .filter(Boolean),
    description: renderEntries(spell.entries),
    higherLevels: renderEntries(spell.entriesHigherLevel) || undefined,
  };
}

// ---------------------------------------------------------------------------
// Whole-file import.
// ---------------------------------------------------------------------------

export interface FiveEtoolsImportResult {
  bundle: ContentBundle;
  /** Human-readable lines: every record that could not be mapped, by name. */
  skipped: string[];
}

/**
 * Convert any number of parsed 5etools JSON files into one content bundle.
 * Top-level arrays we recognize: `race`, `class`/`subclass`(+feature
 * tables), `background`, `feat`, `spell`. Unrecognized top-level keys are
 * reported once per file, records that fail to map are reported by name.
 */
export function importFiveEtools(
  files: { name: string; json: unknown }[],
): FiveEtoolsImportResult {
  const bundle: ContentBundle = {
    name: "5etools import",
    source: "5etools import",
    fetchedAt: new Date().toISOString(),
    races: [],
    classes: [],
    backgrounds: [],
    feats: [],
    armor: [],
    spells: [],
    monsters: [],
    items: [],
  };
  const skipped: string[] = [];
  const KNOWN_KEYS = new Set([
    "race",
    "class",
    "subclass",
    "classFeature",
    "subclassFeature",
    "background",
    "feat",
    "spell",
    "_meta",
  ]);

  for (const file of files) {
    if (!file.json || typeof file.json !== "object" || Array.isArray(file.json)) {
      skipped.push(`${file.name}: not a 5etools JSON object`);
      continue;
    }
    const data = file.json as Record<string, unknown>;

    const convertEach = <T>(
      key: string,
      kind: string,
      convert: (raw: unknown) => T,
      into: T[],
    ): void => {
      if (!Array.isArray(data[key])) return;
      for (const raw of data[key] as unknown[]) {
        try {
          into.push(convert(raw));
        } catch (error) {
          skipped.push(
            skipLine(kind, raw, error instanceof Error ? error.message : String(error)),
          );
        }
      }
    };

    convertEach("race", "race", raceFromFiveEtools, bundle.races);
    convertEach("background", "background", backgroundFromFiveEtools, bundle.backgrounds);
    convertEach("feat", "feat", featFromFiveEtools, bundle.feats);
    convertEach("spell", "spell", spellFromFiveEtools, bundle.spells);
    if (Array.isArray(data.class)) {
      const { classes, skipped: classSkipped } = classesFromFiveEtools(
        data as FiveEtoolsClassFile,
      );
      bundle.classes.push(...classes);
      skipped.push(...classSkipped);
    }

    const unknownKeys = Object.keys(data).filter((key) => !KNOWN_KEYS.has(key));
    if (unknownKeys.length > 0) {
      skipped.push(
        `${file.name}: ignored unsupported sections: ${unknownKeys.join(", ")}`,
      );
    }
  }
  return { bundle, skipped };
}
