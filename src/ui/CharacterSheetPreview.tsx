import {
  ABILITIES,
  SKILLS,
  type Ability,
  type Character,
  type Skill,
} from "../model/schema";
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

const ABILITY_LABELS: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** Skills grouped under their governing ability, in SKILLS declaration order. */
const SKILLS_BY_ABILITY: Record<Ability, Skill[]> = ABILITIES.reduce(
  (acc, ability) => {
    acc[ability] = (Object.keys(SKILLS) as Skill[]).filter(
      (skill) => SKILLS[skill] === ability,
    );
    return acc;
  },
  {} as Record<Ability, Skill[]>,
);

/**
 * A read-only, CSS-styled character sheet preview. This is a Phase 0 stand-in
 * that exercises the full rules pipeline; Phase 1 replaces it with the editable
 * sheet and wires it to a vault note.
 *
 * Layout follows the user's sheet design (dnd-character-sheet-v2.css): callout
 * tiles with uppercase headers, an HP tile with a big current(+temp)/max
 * display, combat mini-stats, and a per-ability column grid of stat + save +
 * skills with accent borders marking proficiency and expertise.
 */
export function CharacterSheetPreview({ character }: { character: Character }) {
  const level = totalLevel(character);
  const classLine = character.classes
    .map((c) => `${c.name} ${c.level}`)
    .join(" / ");
  const subtitle = [character.race, classLine, character.background]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="dvtt-sheet">
      <header className="dvtt-sheet__header">
        <h2>{character.name}</h2>
        <div className="dvtt-sheet__subtitle">
          {subtitle || `Level ${level}`}
        </div>
      </header>

      <div className="dvtt-sheet__row">
        <section className="dvtt-tile dvtt-tile--hp">
          <div className="dvtt-tile__title">Hit Points</div>
          <div className="dvtt-hp">
            <span className="dvtt-hp__current">{character.currentHp}</span>
            {character.tempHp > 0 && (
              <sup className="dvtt-hp__temp">+{character.tempHp}</sup>
            )}
            <span className="dvtt-hp__max"> / {character.maxHp}</span>
          </div>
        </section>

        <section className="dvtt-tile dvtt-tile--combat">
          <div className="dvtt-tile__title">Combat</div>
          <div className="dvtt-mini-grid">
            <Mini label="AC" value={character.armorClass} />
            <Mini
              label="Initiative"
              value={formatModifier(initiativeBonus(character.abilityScores))}
            />
            <Mini label="Speed" value={`${character.speed} ft`} />
            <Mini
              label="Prof."
              value={formatModifier(proficiencyBonus(level))}
            />
            <Mini label="Pass. Perc." value={passivePerception(character)} />
          </div>
        </section>
      </div>

      <section className="dvtt-tile dvtt-tile--abilities">
        <div className="dvtt-tile__title">Abilities &amp; Skills</div>
        <div className="dvtt-sheet-grid">
          {ABILITIES.map((ability) => (
            <AbilityColumn
              key={ability}
              ability={ability}
              character={character}
            />
          ))}
        </div>
      </section>

      {character.resources.length > 0 && (
        <section className="dvtt-tile dvtt-tile--resources">
          <div className="dvtt-tile__title">Resources</div>
          <div className="dvtt-chips">
            {character.resources.map((r) => (
              <span className="dvtt-chip" key={r.id}>
                {r.name}:{" "}
                {r.max === "unlimited"
                  ? "unlimited"
                  : `${r.max - r.used}/${r.max}`}{" "}
                per {r.per === "long-rest" ? "long rest" : "short rest"}
                {r.note ? ` · ${r.note}` : ""}
              </span>
            ))}
          </div>
        </section>
      )}

      <ProficienciesTile character={character} />
    </div>
  );
}

/** Armor/weapon/tool proficiencies, when the character carries any. */
function ProficienciesTile({ character }: { character: Character }) {
  const groups = (
    [
      ["Armor", character.proficiencies.armor],
      ["Weapons", character.proficiencies.weapons],
      ["Tools", character.proficiencies.tools],
    ] as const
  ).filter(([, list]) => list.length > 0);
  if (groups.length === 0) return null;

  return (
    <section className="dvtt-tile dvtt-tile--proficiencies">
      <div className="dvtt-tile__title">Proficiencies</div>
      {groups.map(([label, list]) => (
        <div className="dvtt-prof-group" key={label}>
          <span className="dvtt-prof-group__label">{label}</span>
          <span className="dvtt-prof-group__list">{list.join(", ")}</span>
        </div>
      ))}
    </section>
  );
}

function AbilityColumn({
  ability,
  character,
}: {
  ability: Ability;
  character: Character;
}) {
  const score = character.abilityScores[ability];
  const saveProficient = (character.savingThrows[ability] ?? "none") !== "none";
  return (
    <div className="dvtt-sheet-col">
      <div className="dvtt-sheet-stat" title={ABILITY_LABELS[ability]}>
        <div className="dvtt-sheet-stat__label">{ability.toUpperCase()}</div>
        <div className="dvtt-sheet-stat__mod">
          {formatModifier(abilityModifier(score))}
        </div>
        <div className="dvtt-sheet-stat__score">{score}</div>
      </div>

      <div className={`dvtt-save${saveProficient ? " is-proficient" : ""}`}>
        <span className="dvtt-save__name">Save</span>
        <span className="dvtt-save__bonus">
          {formatModifier(savingThrowBonus(character, ability))}
        </span>
      </div>

      <div className="dvtt-sheet-skills">
        {SKILLS_BY_ABILITY[ability].map((skill) => {
          const proficiency = character.skills[skill] ?? "none";
          const stateClass =
            proficiency === "expertise"
              ? " is-expert"
              : proficiency === "proficient"
                ? " is-proficient"
                : "";
          return (
            <div className={`dvtt-skill${stateClass}`} key={skill}>
              <span className="dvtt-skill__name">{humanize(skill)}</span>
              <span className="dvtt-skill__bonus">
                {formatModifier(skillBonus(character, skill))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="dvtt-mini">
      <div className="dvtt-mini__label">{label}</div>
      <div className="dvtt-mini__value">{value}</div>
    </div>
  );
}

function humanize(camel: string): string {
  const spaced = camel.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
