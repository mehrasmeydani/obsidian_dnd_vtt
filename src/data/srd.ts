import type { Ability, Skill } from "../model/schema";

/**
 * Static SRD 5.1 content used by the character creation flow. Phase 2 replaces
 * this with the Open5e client + local cache; keeping the shape close to what
 * that API provides makes the swap mechanical. Only SRD-licensed content lives
 * here (hence a single official background plus a free-form custom option).
 */

/**
 * A racial trait or class feature. Structured (not just a display string) so
 * `assembleCharacter` can copy them onto `Character.features` and Phase 2 can
 * swap in Open5e's richer descriptions without changing consumers.
 */
export interface Trait {
  name: string;
  description?: string;
}

/** "Choose `count` skills from `from`" — `"any"` means all 18 skills. */
export interface SkillChoice {
  count: number;
  from: Skill[] | "any";
}

export interface RaceData {
  id: string;
  name: string;
  speed: number;
  /** Fixed ability score increases, e.g. { con: 2, wis: 1 }. */
  fixedBonuses: Partial<Record<Ability, number>>;
  /** Extra "+`amount` to `count` different abilities of your choice". */
  bonusChoice?: { count: number; amount: number };
  /** Skill proficiencies granted outright (e.g. elf Keen Senses). */
  grantedSkills?: Skill[];
  /** Skill proficiencies chosen freely (e.g. half-elf Skill Versatility). */
  skillChoice?: SkillChoice;
  traits: Trait[];
}

export interface ClassData {
  id: string;
  name: string;
  hitDie: number;
  savingThrows: [Ability, Ability];
  skillChoice: SkillChoice;
  spellcastingAbility?: Ability;
  /** Level-1 class features. */
  traits: Trait[];
}

export interface BackgroundData {
  id: string;
  name: string;
  grantedSkills: Skill[];
  skillChoice?: SkillChoice;
  /** Free-text name allowed (the "custom" background). */
  customName?: boolean;
  description: string;
  traits: Trait[];
}

export const RACES: RaceData[] = [
  {
    id: "hill-dwarf",
    name: "Hill Dwarf",
    speed: 25,
    fixedBonuses: { con: 2, wis: 1 },
    traits: [
      { name: "Darkvision", description: "See in dim light within 60 feet as if it were bright light." },
      { name: "Dwarven Resilience", description: "Advantage on saves against poison; resistance to poison damage." },
      { name: "Dwarven Toughness", description: "Hit point maximum increases by 1 per level." },
    ],
  },
  {
    id: "high-elf",
    name: "High Elf",
    speed: 30,
    fixedBonuses: { dex: 2, int: 1 },
    grantedSkills: ["perception"],
    traits: [
      { name: "Darkvision", description: "See in dim light within 60 feet as if it were bright light." },
      { name: "Keen Senses", description: "Proficiency in the Perception skill." },
      { name: "Fey Ancestry", description: "Advantage on saves against being charmed; magic can't put you to sleep." },
      { name: "Trance", description: "Meditate 4 hours a day instead of sleeping." },
    ],
  },
  {
    id: "lightfoot-halfling",
    name: "Lightfoot Halfling",
    speed: 25,
    fixedBonuses: { dex: 2, cha: 1 },
    traits: [
      { name: "Lucky", description: "Reroll 1s on attack rolls, ability checks, and saving throws." },
      { name: "Brave", description: "Advantage on saves against being frightened." },
      { name: "Halfling Nimbleness", description: "Move through the space of any creature larger than you." },
      { name: "Naturally Stealthy", description: "Hide even when obscured only by a larger creature." },
    ],
  },
  {
    id: "human",
    name: "Human",
    speed: 30,
    fixedBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    traits: [
      { name: "Versatile", description: "+1 to every ability score." },
    ],
  },
  {
    id: "dragonborn",
    name: "Dragonborn",
    speed: 30,
    fixedBonuses: { str: 2, cha: 1 },
    traits: [
      { name: "Draconic Ancestry", description: "Choose a dragon type; it sets your breath weapon and resistance." },
      { name: "Breath Weapon", description: "Exhale destructive energy as an action (2d6, DC 8 + CON mod + prof)." },
      { name: "Damage Resistance", description: "Resistance to the damage type of your draconic ancestry." },
    ],
  },
  {
    id: "rock-gnome",
    name: "Rock Gnome",
    speed: 25,
    fixedBonuses: { int: 2, con: 1 },
    traits: [
      { name: "Darkvision", description: "See in dim light within 60 feet as if it were bright light." },
      { name: "Gnome Cunning", description: "Advantage on INT, WIS, and CHA saves against magic." },
      { name: "Artificer's Lore", description: "Double proficiency on History checks about magic items and devices." },
      { name: "Tinker", description: "Construct tiny clockwork devices with tinker's tools." },
    ],
  },
  {
    id: "half-elf",
    name: "Half-Elf",
    speed: 30,
    fixedBonuses: { cha: 2 },
    bonusChoice: { count: 2, amount: 1 },
    skillChoice: { count: 2, from: "any" },
    traits: [
      { name: "Darkvision", description: "See in dim light within 60 feet as if it were bright light." },
      { name: "Fey Ancestry", description: "Advantage on saves against being charmed; magic can't put you to sleep." },
      { name: "Skill Versatility", description: "Proficiency in two skills of your choice." },
    ],
  },
  {
    id: "half-orc",
    name: "Half-Orc",
    speed: 30,
    fixedBonuses: { str: 2, con: 1 },
    grantedSkills: ["intimidation"],
    traits: [
      { name: "Darkvision", description: "See in dim light within 60 feet as if it were bright light." },
      { name: "Relentless Endurance", description: "Drop to 1 HP instead of 0 once per long rest." },
      { name: "Savage Attacks", description: "Roll one extra weapon damage die on a melee critical hit." },
    ],
  },
  {
    id: "tiefling",
    name: "Tiefling",
    speed: 30,
    fixedBonuses: { cha: 2, int: 1 },
    traits: [
      { name: "Darkvision", description: "See in dim light within 60 feet as if it were bright light." },
      { name: "Hellish Resistance", description: "Resistance to fire damage." },
      { name: "Infernal Legacy", description: "Know the thaumaturgy cantrip; gain infernal spells at higher levels." },
    ],
  },
];

export const CLASSES: ClassData[] = [
  {
    id: "barbarian",
    name: "Barbarian",
    hitDie: 12,
    savingThrows: ["str", "con"],
    skillChoice: {
      count: 2,
      from: [
        "animalHandling",
        "athletics",
        "intimidation",
        "nature",
        "perception",
        "survival",
      ],
    },
    traits: [
      { name: "Rage", description: "Bonus-action rage: advantage on STR checks/saves, bonus melee damage, resistance to bludgeoning, piercing, and slashing." },
      { name: "Unarmored Defense", description: "Without armor, AC = 10 + DEX mod + CON mod." },
    ],
  },
  {
    id: "bard",
    name: "Bard",
    hitDie: 8,
    savingThrows: ["dex", "cha"],
    skillChoice: { count: 3, from: "any" },
    spellcastingAbility: "cha",
    traits: [
      { name: "Spellcasting", description: "Cast bard spells using Charisma." },
      { name: "Bardic Inspiration", description: "Bonus action: give a creature a d6 to add to one roll (CHA mod uses per long rest)." },
    ],
  },
  {
    id: "cleric",
    name: "Cleric",
    hitDie: 8,
    savingThrows: ["wis", "cha"],
    skillChoice: {
      count: 2,
      from: ["history", "insight", "medicine", "persuasion", "religion"],
    },
    spellcastingAbility: "wis",
    traits: [
      { name: "Spellcasting", description: "Cast cleric spells using Wisdom; prepare from the full cleric list." },
      { name: "Divine Domain", description: "Choose a domain that grants bonus spells and features." },
    ],
  },
  {
    id: "druid",
    name: "Druid",
    hitDie: 8,
    savingThrows: ["int", "wis"],
    skillChoice: {
      count: 2,
      from: [
        "arcana",
        "animalHandling",
        "insight",
        "medicine",
        "nature",
        "perception",
        "religion",
        "survival",
      ],
    },
    spellcastingAbility: "wis",
    traits: [
      { name: "Druidic", description: "Know the secret language of druids." },
      { name: "Spellcasting", description: "Cast druid spells using Wisdom; prepare from the full druid list." },
    ],
  },
  {
    id: "fighter",
    name: "Fighter",
    hitDie: 10,
    savingThrows: ["str", "con"],
    skillChoice: {
      count: 2,
      from: [
        "acrobatics",
        "animalHandling",
        "athletics",
        "history",
        "insight",
        "intimidation",
        "perception",
        "survival",
      ],
    },
    traits: [
      { name: "Fighting Style", description: "Choose a combat style (archery, defense, dueling, ...)." },
      { name: "Second Wind", description: "Bonus action: regain 1d10 + fighter level HP once per rest." },
    ],
  },
  {
    id: "monk",
    name: "Monk",
    hitDie: 8,
    savingThrows: ["str", "dex"],
    skillChoice: {
      count: 2,
      from: [
        "acrobatics",
        "athletics",
        "history",
        "insight",
        "religion",
        "stealth",
      ],
    },
    traits: [
      { name: "Unarmored Defense", description: "Without armor, AC = 10 + DEX mod + WIS mod." },
      { name: "Martial Arts", description: "Use DEX for unarmed strikes/monk weapons; bonus-action unarmed strike." },
    ],
  },
  {
    id: "paladin",
    name: "Paladin",
    hitDie: 10,
    savingThrows: ["wis", "cha"],
    skillChoice: {
      count: 2,
      from: [
        "athletics",
        "insight",
        "intimidation",
        "medicine",
        "persuasion",
        "religion",
      ],
    },
    spellcastingAbility: "cha",
    traits: [
      { name: "Divine Sense", description: "Detect celestials, fiends, and undead within 60 feet." },
      { name: "Lay on Hands", description: "Heal a pool of 5 × paladin level HP per long rest." },
    ],
  },
  {
    id: "ranger",
    name: "Ranger",
    hitDie: 10,
    savingThrows: ["str", "dex"],
    skillChoice: {
      count: 3,
      from: [
        "animalHandling",
        "athletics",
        "insight",
        "investigation",
        "nature",
        "perception",
        "stealth",
        "survival",
      ],
    },
    spellcastingAbility: "wis",
    traits: [
      { name: "Favored Enemy", description: "Advantage on tracking and recalling lore about a chosen enemy type." },
      { name: "Natural Explorer", description: "Expert navigator and tracker in a chosen terrain." },
    ],
  },
  {
    id: "rogue",
    name: "Rogue",
    hitDie: 8,
    savingThrows: ["dex", "int"],
    skillChoice: {
      count: 4,
      from: [
        "acrobatics",
        "athletics",
        "deception",
        "insight",
        "intimidation",
        "investigation",
        "perception",
        "performance",
        "persuasion",
        "sleightOfHand",
        "stealth",
      ],
    },
    traits: [
      { name: "Expertise", description: "Double proficiency bonus for two chosen proficiencies." },
      { name: "Sneak Attack", description: "Once per turn, +1d6 damage when you have advantage (or an ally is adjacent)." },
      { name: "Thieves' Cant", description: "Secret rogue dialect of jargon and code." },
    ],
  },
  {
    id: "sorcerer",
    name: "Sorcerer",
    hitDie: 6,
    savingThrows: ["con", "cha"],
    skillChoice: {
      count: 2,
      from: [
        "arcana",
        "deception",
        "insight",
        "intimidation",
        "persuasion",
        "religion",
      ],
    },
    spellcastingAbility: "cha",
    traits: [
      { name: "Spellcasting", description: "Cast sorcerer spells using Charisma." },
      { name: "Sorcerous Origin", description: "Choose the source of your innate magic (draconic bloodline, wild magic, ...)." },
    ],
  },
  {
    id: "warlock",
    name: "Warlock",
    hitDie: 8,
    savingThrows: ["wis", "cha"],
    skillChoice: {
      count: 2,
      from: [
        "arcana",
        "deception",
        "history",
        "intimidation",
        "investigation",
        "nature",
        "religion",
      ],
    },
    spellcastingAbility: "cha",
    traits: [
      { name: "Otherworldly Patron", description: "Pact with a powerful entity that grants features." },
      { name: "Pact Magic", description: "Cast warlock spells using Charisma; slots recharge on a short rest." },
    ],
  },
  {
    id: "wizard",
    name: "Wizard",
    hitDie: 6,
    savingThrows: ["int", "wis"],
    skillChoice: {
      count: 2,
      from: [
        "arcana",
        "history",
        "insight",
        "investigation",
        "medicine",
        "religion",
      ],
    },
    spellcastingAbility: "int",
    traits: [
      { name: "Spellcasting", description: "Cast wizard spells using Intelligence; learn spells in a spellbook." },
      { name: "Arcane Recovery", description: "Recover spell slots (half wizard level) on a short rest, once per day." },
    ],
  },
];

export const BACKGROUNDS: BackgroundData[] = [
  {
    id: "acolyte",
    name: "Acolyte",
    grantedSkills: ["insight", "religion"],
    description:
      "You have spent your life in service to a temple. Shelter of the Faithful.",
    traits: [
      { name: "Shelter of the Faithful", description: "Free healing and care at temples of your faith; support from fellow worshipers." },
    ],
  },
  {
    id: "custom",
    name: "Custom",
    grantedSkills: [],
    skillChoice: { count: 2, from: "any" },
    customName: true,
    description:
      "Name your own background and choose any two skill proficiencies.",
    traits: [],
  },
];
