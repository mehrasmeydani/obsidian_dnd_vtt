/**
 * Manifest for the bundled SRD content. Game data lives in one JSON file per
 * class (subclasses ride along inside their class) and per race; the small
 * background and feat lists stay whole. Adding content = add the JSON file
 * and one import line here — nothing else in the plugin changes, and
 * `parseContentBundle` in `srd.ts` still validates the assembled whole.
 *
 * Editions: 2014 entries come from SRD 5.1 (CC-BY-4.0), 2024 entries from
 * SRD 5.2 (CC-BY-4.0). Only SRD content may ship with the plugin.
 */

import barbarian from "./classes/barbarian.json";
import barbarian2024 from "./classes/barbarian-2024.json";
import bard from "./classes/bard.json";
import cleric from "./classes/cleric.json";
import druid from "./classes/druid.json";
import fighter from "./classes/fighter.json";
import monk from "./classes/monk.json";
import paladin from "./classes/paladin.json";
import ranger from "./classes/ranger.json";
import rogue from "./classes/rogue.json";
import sorcerer from "./classes/sorcerer.json";
import warlock from "./classes/warlock.json";
import wizard from "./classes/wizard.json";

import dragonborn from "./races/dragonborn.json";
import halfElf from "./races/half-elf.json";
import halfOrc from "./races/half-orc.json";
import highElf from "./races/high-elf.json";
import hillDwarf from "./races/hill-dwarf.json";
import human from "./races/human.json";
import lightfootHalfling from "./races/lightfoot-halfling.json";
import rockGnome from "./races/rock-gnome.json";
import tiefling from "./races/tiefling.json";

import backgrounds from "./backgrounds.json";
import feats from "./feats.json";
import armor from "./armor.json";

/** The raw, unvalidated SRD bundle — `srd.ts` parses it at startup. */
export const srdRaw = {
  name: "SRD",
  races: [
    hillDwarf,
    highElf,
    lightfootHalfling,
    human,
    dragonborn,
    rockGnome,
    halfElf,
    halfOrc,
    tiefling,
  ],
  classes: [
    barbarian,
    barbarian2024,
    bard,
    cleric,
    druid,
    fighter,
    monk,
    paladin,
    ranger,
    rogue,
    sorcerer,
    warlock,
    wizard,
  ],
  backgrounds,
  feats,
  armor,
};
