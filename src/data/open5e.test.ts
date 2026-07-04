import { describe, expect, it } from "vitest";
import {
  fetchAllPages,
  itemFromOpen5e,
  monsterFromOpen5e,
  refreshOpen5eContent,
  spellFromOpen5e,
  type Open5eHttp,
} from "./open5e";
import { parseContentBundle } from "./contentSchema";

/**
 * T-12 tests: transforms are pure and run against recorded fixture records
 * (trimmed real Open5e v1 responses) — no live API. Pagination follows
 * `next` links; unmappable records are reported by name, never dropped
 * silently.
 */

// --- Recorded fixture records (abridged from api.open5e.com/v1) -----------

const FIREBALL = {
  slug: "fireball",
  name: "Fireball",
  desc: "A bright streak flashes from your pointing finger to a point you choose.",
  higher_level:
    "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6.",
  range: "150 feet",
  components: "V, S, M",
  material: "A tiny ball of bat guano and sulfur.",
  ritual: "no",
  duration: "Instantaneous",
  concentration: "no",
  casting_time: "1 action",
  level: "3rd-level",
  level_int: 3,
  school: "Evocation",
  dnd_class: "Sorcerer, Wizard",
  document__slug: "wotc-srd",
};

const GUIDANCE = {
  slug: "guidance",
  name: "Guidance",
  desc: "You touch one willing creature.",
  higher_level: "",
  range: "Touch",
  components: "V, S",
  material: "",
  ritual: "no",
  duration: "Up to 1 minute",
  concentration: "yes",
  casting_time: "1 action",
  level: "Cantrip",
  level_int: 0,
  school: "Divination",
  dnd_class: "Cleric, Druid",
  document__slug: "wotc-srd",
};

const GOBLIN = {
  slug: "goblin",
  name: "Goblin",
  size: "Small",
  type: "humanoid",
  subtype: "goblinoid",
  alignment: "neutral evil",
  armor_class: 15,
  armor_desc: "leather armor, shield",
  hit_points: 7,
  hit_dice: "2d6",
  speed: { walk: 30 },
  strength: 8,
  dexterity: 14,
  constitution: 10,
  intelligence: 10,
  wisdom: 8,
  charisma: 8,
  senses: "darkvision 60 ft., passive Perception 9",
  languages: "Common, Goblin",
  challenge_rating: "1/4",
  special_abilities: [
    {
      name: "Nimble Escape",
      desc: "The goblin can take the Disengage or Hide action as a bonus action.",
    },
  ],
  actions: [
    {
      name: "Scimitar",
      desc: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target.",
    },
  ],
  reactions: null,
  legendary_actions: null,
  document__slug: "wotc-srd",
};

const BAG_OF_HOLDING = {
  slug: "bag-of-holding",
  name: "Bag of Holding",
  type: "Wondrous item",
  desc: "This bag has an interior space considerably larger than its outside dimensions.",
  rarity: "uncommon",
  requires_attunement: "",
  document__slug: "wotc-srd",
};

const RING_OF_PROTECTION = {
  slug: "ring-of-protection",
  name: "Ring of Protection",
  type: "Ring",
  desc: "You gain a +1 bonus to AC and saving throws while wearing this ring.",
  rarity: "rare",
  requires_attunement: "requires attunement",
  document__slug: "wotc-srd",
};

// --- Transforms ------------------------------------------------------------

describe("spellFromOpen5e", () => {
  it("maps a leveled spell with material components", () => {
    const spell = spellFromOpen5e(FIREBALL);
    expect(spell).toMatchObject({
      id: "open5e-spell-fireball",
      name: "Fireball",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M (A tiny ball of bat guano and sulfur.)",
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      classes: ["sorcerer", "wizard"],
    });
    expect(spell.higherLevels).toContain("4th level");
  });

  it("maps a concentration cantrip without materials", () => {
    const spell = spellFromOpen5e(GUIDANCE);
    expect(spell.level).toBe(0);
    expect(spell.concentration).toBe(true);
    expect(spell.components).toBe("V, S");
    expect(spell.higherLevels).toBeUndefined();
    expect(spell.classes).toEqual(["cleric", "druid"]);
  });

  it("rejects a record missing required fields", () => {
    expect(() => spellFromOpen5e({ slug: "broken" })).toThrow();
  });
});

describe("monsterFromOpen5e", () => {
  it("maps a full stat block", () => {
    const monster = monsterFromOpen5e(GOBLIN);
    expect(monster).toMatchObject({
      id: "open5e-monster-goblin",
      name: "Goblin",
      size: "Small",
      type: "humanoid",
      armorClass: 15,
      armorDescription: "leather armor, shield",
      hitPoints: 7,
      hitDice: "2d6",
      speed: { walk: 30 },
      challengeRating: "1/4",
      abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    });
    expect(monster.traits).toEqual([
      { name: "Nimble Escape", description: expect.stringContaining("Disengage") },
    ]);
    expect(monster.actions[0].name).toBe("Scimitar");
    expect(monster.reactions).toEqual([]);
    expect(monster.legendaryActions).toEqual([]);
  });

  it("keeps only numeric speed modes (drops hover flags)", () => {
    const monster = monsterFromOpen5e({
      ...GOBLIN,
      speed: { walk: 30, fly: 60, hover: true },
    });
    expect(monster.speed).toEqual({ walk: 30, fly: 60 });
  });
});

describe("itemFromOpen5e", () => {
  it("maps a magic item without attunement", () => {
    const item = itemFromOpen5e(BAG_OF_HOLDING);
    expect(item).toMatchObject({
      id: "open5e-item-bag-of-holding",
      name: "Bag of Holding",
      type: "Wondrous item",
      rarity: "uncommon",
      requiresAttunement: false,
    });
  });

  it("detects attunement", () => {
    expect(itemFromOpen5e(RING_OF_PROTECTION).requiresAttunement).toBe(true);
  });
});

// --- Pagination + full refresh ---------------------------------------------

/** A fake Open5e serving canned pages per endpoint prefix. */
function fakeHttp(pagesByPath: Record<string, unknown[][]>): Open5eHttp & {
  requested: string[];
} {
  const requested: string[] = [];
  return {
    requested,
    async getJson(url: string) {
      requested.push(url);
      const path = Object.keys(pagesByPath).find((p) => url.includes(p));
      if (!path) throw new Error(`404 ${url}`);
      const pages = pagesByPath[path];
      const pageMatch = url.match(/[&?]page=(\d+)/);
      const page = pageMatch ? Number(pageMatch[1]) - 1 : 0;
      const next =
        page + 1 < pages.length
          ? `https://api.open5e.com${path}?page=${page + 2}`
          : null;
      return { count: pages.flat().length, next, results: pages[page] };
    },
  };
}

describe("fetchAllPages", () => {
  it("follows next links and concatenates results", async () => {
    const http = fakeHttp({ "/v1/spells/": [[FIREBALL], [GUIDANCE]] });
    const results = await fetchAllPages(http, "https://api.open5e.com/v1/spells/");
    expect(results).toHaveLength(2);
    expect(http.requested).toHaveLength(2);
  });

  it("throws on an unexpected response shape", async () => {
    const http: Open5eHttp = { getJson: async () => ({ nope: true }) };
    await expect(fetchAllPages(http, "https://x/y")).rejects.toThrow(
      /response shape/,
    );
  });
});

describe("refreshOpen5eContent", () => {
  it("produces one valid bundle per category and reports skipped records", async () => {
    const http = fakeHttp({
      "/v1/spells/": [[FIREBALL, { slug: "broken-spell", name: "Broken" }]],
      "/v1/monsters/": [[GOBLIN]],
      "/v1/magicitems/": [[BAG_OF_HOLDING, RING_OF_PROTECTION]],
    });
    const { bundles, failures } = await refreshOpen5eContent(http);

    expect(failures).toEqual([]);
    expect(bundles.map((b) => b.fileName)).toEqual([
      "open5e-spells.json",
      "open5e-monsters.json",
      "open5e-magicitems.json",
    ]);

    const spells = bundles[0];
    expect(spells.bundle.spells.map((s) => s.name)).toEqual(["Fireball"]);
    expect(spells.skipped).toHaveLength(1);
    expect(spells.skipped[0]).toContain("Broken");

    expect(bundles[1].bundle.monsters).toHaveLength(1);
    expect(bundles[2].bundle.items).toHaveLength(2);

    // Every produced bundle round-trips through the store's validator.
    for (const { bundle } of bundles) {
      expect(() =>
        parseContentBundle(JSON.parse(JSON.stringify(bundle))),
      ).not.toThrow();
      expect(bundle.fetchedAt).toBeTruthy();
    }
  });

  it("keeps refreshing other categories when one endpoint fails", async () => {
    const http = fakeHttp({
      "/v1/monsters/": [[GOBLIN]],
      "/v1/magicitems/": [[BAG_OF_HOLDING]],
    });
    const { bundles, failures } = await refreshOpen5eContent(http);
    expect(bundles).toHaveLength(2);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("spells");
  });

  it("only requests SRD-document content", async () => {
    const http = fakeHttp({
      "/v1/spells/": [[]],
      "/v1/monsters/": [[]],
      "/v1/magicitems/": [[]],
    });
    await refreshOpen5eContent(http);
    for (const url of http.requested) {
      expect(url).toContain("document__slug=wotc-srd");
    }
  });
});
