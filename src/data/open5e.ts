import { z } from "zod";
import {
  ItemDataSchema,
  MonsterDataSchema,
  SpellDataSchema,
  type ContentBundle,
  type ItemData,
  type MonsterData,
  type SpellData,
} from "./contentSchema";

/**
 * Open5e client + transforms (T-12). The network side is injected
 * (`Open5eHttp`) so the plugin can pass Obsidian's `requestUrl` (no CORS)
 * while tests pass recorded fixtures — nothing here ever fetches on its own,
 * and the plugin only calls it from the explicit refresh command.
 *
 * Each category (spells, monsters, magic items) becomes its own content
 * bundle so it carries its own `fetchedAt` and its own on/off toggle in
 * settings. Records the API serves that don't fit our schema are reported
 * by name, never silently dropped.
 */

export interface Open5eHttp {
  /** GET `url` and return the parsed JSON body. */
  getJson(url: string): Promise<unknown>;
}

export const OPEN5E_BASE_URL = "https://api.open5e.com";

/** Only SRD-document content is fetched — same licensing line as bundling. */
const DOCUMENT_FILTER = "document__slug=wotc-srd";

const PageSchema = z.object({
  next: z.string().nullable(),
  results: z.array(z.unknown()),
});

/** Guard against a server bug producing a `next` cycle. */
const MAX_PAGES = 500;

/** Follow `next` links until the last page, collecting every result. */
export async function fetchAllPages(
  http: Open5eHttp,
  firstUrl: string,
  onPage?: (fetched: number) => void,
): Promise<unknown[]> {
  const results: unknown[] = [];
  let url: string | null = firstUrl;
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const body: unknown = await http.getJson(url);
    const parsed = PageSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error(`Unexpected Open5e response shape from ${url}`);
    }
    results.push(...parsed.data.results);
    onPage?.(results.length);
    url = parsed.data.next;
  }
  return results;
}

/** What a category transform produced: entities plus rejected record names. */
export interface TransformResult<T> {
  entities: T[];
  /** Names (or slugs) of records that could not be mapped, with the reason. */
  skipped: string[];
}

// ---------------------------------------------------------------------------
// Raw Open5e record shapes — only the fields we consume, everything optional
// enough to let safeParse identify the record in error messages.
// ---------------------------------------------------------------------------

const RawSpellSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  level_int: z.number().int().min(0).max(9),
  school: z.string().min(1),
  casting_time: z.string().default(""),
  range: z.string().default(""),
  components: z.string().default(""),
  material: z.string().optional().default(""),
  duration: z.string().default(""),
  concentration: z.string().default("no"),
  ritual: z.string().default("no"),
  dnd_class: z.string().default(""),
  desc: z.string().default(""),
  higher_level: z.string().optional().default(""),
});

const RawNamedBlockSchema = z.object({
  name: z.string().min(1),
  desc: z.string().optional(),
});

const RawMonsterSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  size: z.string().min(1),
  type: z.string().min(1),
  alignment: z.string().optional().default(""),
  armor_class: z.number().int().positive(),
  armor_desc: z.string().nullable().optional(),
  hit_points: z.number().int().positive(),
  hit_dice: z.string().nullable().optional(),
  speed: z.record(z.string(), z.unknown()).default({}),
  strength: z.number().int(),
  dexterity: z.number().int(),
  constitution: z.number().int(),
  intelligence: z.number().int(),
  wisdom: z.number().int(),
  charisma: z.number().int(),
  challenge_rating: z.string().min(1),
  senses: z.string().optional().default(""),
  languages: z.string().optional().default(""),
  special_abilities: z.array(RawNamedBlockSchema).nullable().default([]),
  actions: z.array(RawNamedBlockSchema).nullable().default([]),
  reactions: z.array(RawNamedBlockSchema).nullable().default([]),
  legendary_actions: z.array(RawNamedBlockSchema).nullable().default([]),
});

const RawMagicItemSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional().default(""),
  rarity: z.string().optional().default(""),
  requires_attunement: z.string().optional().default(""),
  desc: z.string().default(""),
});

// ---------------------------------------------------------------------------
// Pure transforms, raw record → bundle entity.
// ---------------------------------------------------------------------------

/** A short "who is this record" label for skip reports. */
function recordLabel(raw: unknown): string {
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const name = record.name ?? record.slug;
    if (typeof name === "string" && name) return name;
  }
  return "(unnamed record)";
}

function transformAll<T>(
  rawRecords: unknown[],
  transform: (raw: unknown) => T,
): TransformResult<T> {
  const entities: T[] = [];
  const skipped: string[] = [];
  for (const raw of rawRecords) {
    try {
      entities.push(transform(raw));
    } catch (error) {
      const reason =
        error instanceof z.ZodError
          ? `${error.issues[0].path.join(".")}: ${error.issues[0].message}`
          : error instanceof Error
            ? error.message
            : String(error);
      skipped.push(`${recordLabel(raw)} (${reason})`);
    }
  }
  return { entities, skipped };
}

export function spellFromOpen5e(raw: unknown): SpellData {
  const spell = RawSpellSchema.parse(raw);
  return SpellDataSchema.parse({
    id: `open5e-spell-${spell.slug}`,
    name: spell.name,
    level: spell.level_int,
    school: spell.school,
    castingTime: spell.casting_time,
    range: spell.range,
    components: spell.material
      ? `${spell.components} (${spell.material})`
      : spell.components,
    duration: spell.duration,
    concentration: spell.concentration.toLowerCase() === "yes",
    ritual: spell.ritual.toLowerCase() === "yes",
    classes: spell.dnd_class
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
    description: spell.desc,
    higherLevels: spell.higher_level || undefined,
  });
}

export function monsterFromOpen5e(raw: unknown): MonsterData {
  const monster = RawMonsterSchema.parse(raw);
  const namedBlocks = (
    blocks: z.infer<typeof RawNamedBlockSchema>[] | null,
  ): { name: string; description?: string }[] =>
    (blocks ?? []).map((block) => ({
      name: block.name,
      description: block.desc,
    }));
  // Speed values can carry flags like `hover: true`; keep the numbers only.
  const speed: Record<string, number> = {};
  for (const [mode, value] of Object.entries(monster.speed)) {
    if (typeof value === "number") speed[mode] = value;
  }
  return MonsterDataSchema.parse({
    id: `open5e-monster-${monster.slug}`,
    name: monster.name,
    size: monster.size,
    type: monster.type,
    alignment: monster.alignment || undefined,
    armorClass: monster.armor_class,
    armorDescription: monster.armor_desc || undefined,
    hitPoints: monster.hit_points,
    hitDice: monster.hit_dice || undefined,
    speed,
    abilityScores: {
      str: monster.strength,
      dex: monster.dexterity,
      con: monster.constitution,
      int: monster.intelligence,
      wis: monster.wisdom,
      cha: monster.charisma,
    },
    challengeRating: monster.challenge_rating,
    senses: monster.senses || undefined,
    languages: monster.languages || undefined,
    traits: namedBlocks(monster.special_abilities),
    actions: namedBlocks(monster.actions),
    reactions: namedBlocks(monster.reactions),
    legendaryActions: namedBlocks(monster.legendary_actions),
  });
}

export function itemFromOpen5e(raw: unknown): ItemData {
  const item = RawMagicItemSchema.parse(raw);
  return ItemDataSchema.parse({
    id: `open5e-item-${item.slug}`,
    name: item.name,
    type: item.type || undefined,
    rarity: item.rarity || undefined,
    requiresAttunement: /requires attunement/i.test(item.requires_attunement),
    description: item.desc,
  });
}

// ---------------------------------------------------------------------------
// Category refresh: one bundle per category, own fetchedAt.
// ---------------------------------------------------------------------------

export interface Open5eCategory {
  /** Content-store bundle file name, e.g. "open5e-spells.json". */
  fileName: string;
  bundleName: string;
  endpoint: string;
  build: (rawRecords: unknown[]) => {
    bundle: ContentBundle;
    skipped: string[];
  };
}

/** An empty bundle skeleton every category starts from. */
function emptyBundle(name: string, endpoint: string): ContentBundle {
  return {
    name,
    source: `${OPEN5E_BASE_URL}${endpoint}`,
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
}

export const OPEN5E_CATEGORIES: Open5eCategory[] = [
  {
    fileName: "open5e-spells.json",
    bundleName: "Open5e spells (SRD)",
    endpoint: `/v1/spells/?${DOCUMENT_FILTER}&limit=200`,
    build: (rawRecords) => {
      const { entities, skipped } = transformAll(rawRecords, spellFromOpen5e);
      const bundle = emptyBundle("Open5e spells (SRD)", "/v1/spells/");
      bundle.spells = entities;
      return { bundle, skipped };
    },
  },
  {
    fileName: "open5e-monsters.json",
    bundleName: "Open5e monsters (SRD)",
    endpoint: `/v1/monsters/?${DOCUMENT_FILTER}&limit=200`,
    build: (rawRecords) => {
      const { entities, skipped } = transformAll(rawRecords, monsterFromOpen5e);
      const bundle = emptyBundle("Open5e monsters (SRD)", "/v1/monsters/");
      bundle.monsters = entities;
      return { bundle, skipped };
    },
  },
  {
    fileName: "open5e-magicitems.json",
    bundleName: "Open5e magic items (SRD)",
    endpoint: `/v1/magicitems/?${DOCUMENT_FILTER}&limit=200`,
    build: (rawRecords) => {
      const { entities, skipped } = transformAll(rawRecords, itemFromOpen5e);
      const bundle = emptyBundle("Open5e magic items (SRD)", "/v1/magicitems/");
      bundle.items = entities;
      return { bundle, skipped };
    },
  },
];

export interface Open5eRefreshResult {
  fileName: string;
  bundle: ContentBundle;
  skipped: string[];
}

/**
 * Fetch and transform every category. `onProgress` receives human-readable
 * status lines for the progress notice. A category that fails outright is
 * reported and skipped; the others still refresh.
 */
export async function refreshOpen5eContent(
  http: Open5eHttp,
  onProgress?: (message: string) => void,
  baseUrl = OPEN5E_BASE_URL,
): Promise<{ bundles: Open5eRefreshResult[]; failures: string[] }> {
  const bundles: Open5eRefreshResult[] = [];
  const failures: string[] = [];
  for (const category of OPEN5E_CATEGORIES) {
    try {
      onProgress?.(`Fetching ${category.bundleName}…`);
      const rawRecords = await fetchAllPages(
        http,
        `${baseUrl}${category.endpoint}`,
        (fetched) =>
          onProgress?.(`Fetching ${category.bundleName}… ${fetched} records`),
      );
      const { bundle, skipped } = category.build(rawRecords);
      bundles.push({ fileName: category.fileName, bundle, skipped });
    } catch (error) {
      failures.push(
        `${category.bundleName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return { bundles, failures };
}
