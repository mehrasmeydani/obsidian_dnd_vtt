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
import bard2024 from "./classes/bard-2024.json";
import cleric from "./classes/cleric.json";
import cleric2024 from "./classes/cleric-2024.json";
import druid from "./classes/druid.json";
import druid2024 from "./classes/druid-2024.json";
import fighter from "./classes/fighter.json";
import fighter2024 from "./classes/fighter-2024.json";
import monk from "./classes/monk.json";
import monk2024 from "./classes/monk-2024.json";
import paladin from "./classes/paladin.json";
import paladin2024 from "./classes/paladin-2024.json";
import ranger from "./classes/ranger.json";
import ranger2024 from "./classes/ranger-2024.json";
import rogue from "./classes/rogue.json";
import rogue2024 from "./classes/rogue-2024.json";
import sorcerer from "./classes/sorcerer.json";
import sorcerer2024 from "./classes/sorcerer-2024.json";
import warlock from "./classes/warlock.json";
import warlock2024 from "./classes/warlock-2024.json";
import wizard from "./classes/wizard.json";
import wizard2024 from "./classes/wizard-2024.json";

import dragonborn from "./races/dragonborn.json";
import halfElf from "./races/half-elf.json";
import halfOrc from "./races/half-orc.json";
import highElf from "./races/high-elf.json";
import hillDwarf from "./races/hill-dwarf.json";
import human from "./races/human.json";
import lightfootHalfling from "./races/lightfoot-halfling.json";
import rockGnome from "./races/rock-gnome.json";
import tiefling from "./races/tiefling.json";
import human2024 from "./races/human-2024.json";
import elf2024 from "./races/elf-2024.json";
import dwarf2024 from "./races/dwarf-2024.json";
import halfling2024 from "./races/halfling-2024.json";
import orc2024 from "./races/orc-2024.json";

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
    human2024,
    elf2024,
    dwarf2024,
    halfling2024,
    orc2024,
  ],
  classes: [
    barbarian,
    barbarian2024,
    bard,
    bard2024,
    cleric,
    cleric2024,
    druid,
    druid2024,
    fighter,
    fighter2024,
    monk,
    monk2024,
    paladin,
    paladin2024,
    ranger,
    ranger2024,
    rogue,
    rogue2024,
    sorcerer,
    sorcerer2024,
    warlock,
    warlock2024,
    wizard,
    wizard2024,
  ],
  backgrounds,
  feats,
  armor,
};
