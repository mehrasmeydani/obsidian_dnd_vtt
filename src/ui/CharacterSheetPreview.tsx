import { ABILITIES, SKILLS, type Character } from "../model/schema";
import {
  abilityModifier,
  formatModifier,
  initiativeBonus,
  passivePerception,
  proficiencyBonus,
  savingThrowBonus,
  skillBonus,
  totalLevel,
} from "../rules/abilityMath";

const ABILITY_LABELS: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/**
 * A read-only, CSS-styled character sheet preview. This is a Phase 0 stand-in
 * that exercises the full rules pipeline; Phase 1 replaces it with the editable
 * sheet and wires it to a vault note.
 */
export function CharacterSheetPreview({ character }: { character: Character }) {
  const level = totalLevel(character);
  return (
    <div className="dvtt-sheet">
      <header className="dvtt-sheet__header">
        <h2>{character.name}</h2>
        <div className="dvtt-sheet__subtitle">
          Level {level} · Proficiency {formatModifier(proficiencyBonus(level))}
        </div>
      </header>

      <div className="dvtt-topline">
        <Stat label="AC" value={character.armorClass} />
        <Stat label="HP" value={`${character.currentHp}/${character.maxHp}`} />
        <Stat label="Speed" value={`${character.speed} ft`} />
        <Stat
          label="Initiative"
          value={formatModifier(initiativeBonus(character.abilityScores))}
        />
        <Stat label="Passive Perception" value={passivePerception(character)} />
      </div>

      <section className="dvtt-abilities">
        {ABILITIES.map((ab) => (
          <div className="dvtt-ability" key={ab}>
            <div className="dvtt-ability__name">{ABILITY_LABELS[ab]}</div>
            <div className="dvtt-ability__score">
              {character.abilityScores[ab]}
            </div>
            <div className="dvtt-ability__mod">
              {formatModifier(abilityModifier(character.abilityScores[ab]))}
            </div>
            <div className="dvtt-ability__save">
              Save {formatModifier(savingThrowBonus(character, ab))}
            </div>
          </div>
        ))}
      </section>

      <section className="dvtt-skills">
        <h3>Skills</h3>
        <ul>
          {(Object.keys(SKILLS) as (keyof typeof SKILLS)[]).map((skill) => (
            <li key={skill}>
              <span className="dvtt-skill__name">{humanize(skill)}</span>
              <span className="dvtt-skill__bonus">
                {formatModifier(skillBonus(character, skill))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="dvtt-stat">
      <div className="dvtt-stat__value">{value}</div>
      <div className="dvtt-stat__label">{label}</div>
    </div>
  );
}

function humanize(camel: string): string {
  const spaced = camel.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
