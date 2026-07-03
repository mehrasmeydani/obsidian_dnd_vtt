import { useState } from "react";
import {
  ABILITIES,
  CharacterSchema,
  SKILLS,
  type Ability,
  type Character,
  type ProficiencyLevel,
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

const PROFICIENCY_CYCLE: Record<ProficiencyLevel, ProficiencyLevel> = {
  none: "proficient",
  proficient: "expertise",
  expertise: "none",
};

function newId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${suffix}`;
}

/**
 * The character sheet: play controls (HP, rests, resource pips, prepared
 * spells) are always live; everything else — scores, AC, speed, proficiency
 * toggles, inventory, spells, notes — unlocks in edit mode. Derived values
 * (modifiers, bonuses, passives, DCs) are always computed, never inputs.
 *
 * Layout and `dvtt-*` class names follow the user's sheet design
 * (docs/reference/dnd-character-sheet-v2.css, ported by T-02) — keep them
 * stable. Every change is validated by `CharacterSchema` before it reaches
 * `onChange`; the hosting view persists it to the bound note.
 */
export function CharacterSheet({
  character,
  onChange,
  bound = true,
}: {
  character: Character;
  onChange: (next: Character) => void;
  /** False when the sheet has no note to save to (demo/unsaved character). */
  bound?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  /** Apply a patch; only schema-valid results reach the caller. */
  const apply = (patch: Partial<Character>) => {
    const next = CharacterSchema.safeParse({ ...character, ...patch });
    if (next.success) onChange(next.data);
  };

  const level = totalLevel(character);
  const classLine = character.classes
    .map((c) =>
      c.subclass ? `${c.name} (${c.subclass}) ${c.level}` : `${c.name} ${c.level}`,
    )
    .join(" / ");
  const subtitle = [character.race, classLine, character.background]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="dvtt-sheet">
      <header className="dvtt-sheet__header">
        <div className="dvtt-sheet__headline">
          {editing ? (
            <input
              className="dvtt-sheet__name-input"
              aria-label="Character name"
              type="text"
              value={character.name}
              onChange={(e) => apply({ name: e.target.value })}
            />
          ) : (
            <h2>{character.name}</h2>
          )}
          <button
            className={`dvtt-sheet__edit-toggle${editing ? " mod-cta" : ""}`}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>
        <div className="dvtt-sheet__subtitle">
          {subtitle || `Level ${level}`}
        </div>
        {!bound && (
          <div className="dvtt-sheet__unbound">
            Not linked to a note — changes are not saved. Open a character
            note and run "Load character from active note".
          </div>
        )}
      </header>

      <div className="dvtt-sheet__row">
        <HpTile character={character} apply={apply} editing={editing} />
        <RestTile character={character} apply={apply} />
      </div>

      <section className="dvtt-tile dvtt-tile--combat">
        <div className="dvtt-tile__title">Combat</div>
        <div className="dvtt-mini-grid">
          <Mini label="AC">
            {editing ? (
              <NumberField
                ariaLabel="Armor class"
                value={character.armorClass}
                onCommit={(armorClass) => apply({ armorClass })}
              />
            ) : (
              character.armorClass
            )}
          </Mini>
          <Mini label="Initiative">
            {formatModifier(initiativeBonus(character.abilityScores))}
          </Mini>
          <Mini label="Speed">
            {editing ? (
              <NumberField
                ariaLabel="Speed"
                value={character.speed}
                onCommit={(speed) => apply({ speed })}
              />
            ) : (
              `${character.speed} ft`
            )}
          </Mini>
          <Mini label="Prof.">{formatModifier(proficiencyBonus(level))}</Mini>
          <Mini label="Pass. Perc.">{passivePerception(character)}</Mini>
          {character.spellcastingAbility && (
            <Mini label="Spell DC">
              {8 +
                proficiencyBonus(level) +
                abilityModifier(
                  character.abilityScores[character.spellcastingAbility],
                )}
            </Mini>
          )}
        </div>
      </section>

      <section className="dvtt-tile dvtt-tile--abilities">
        <div className="dvtt-tile__title">Abilities &amp; Skills</div>
        <div className="dvtt-sheet-grid">
          {ABILITIES.map((ability) => (
            <AbilityColumn
              key={ability}
              ability={ability}
              character={character}
              apply={apply}
              editing={editing}
            />
          ))}
        </div>
      </section>

      <InventoryTile character={character} apply={apply} editing={editing} />
      <SpellsTile character={character} apply={apply} editing={editing} />

      {character.features.length > 0 && (
        <section className="dvtt-tile dvtt-tile--features">
          <div className="dvtt-tile__title">Features &amp; Traits</div>
          <ul className="dvtt-granted-features">
            {character.features.map((f) => (
              <li key={f.id}>
                <details className="dvtt-granted-feature">
                  <summary>
                    {f.level !== undefined && (
                      <span className="dvtt-granted-feature__level">
                        Lv {f.level}
                      </span>
                    )}
                    <span className="dvtt-granted-feature__name">{f.name}</span>
                    {f.source && (
                      <span className="dvtt-granted-feature__source">
                        {f.source}
                      </span>
                    )}
                  </summary>
                  {f.description && (
                    <p className="dvtt-granted-feature__body">{f.description}</p>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ProficienciesTile character={character} />
      <NotesTile character={character} apply={apply} editing={editing} />
    </div>
  );
}

/**
 * A number input that commits every valid integer keystroke (derived values
 * recalculate live) but tolerates transient states like an empty field: the
 * draft text stays visible until blur, when it snaps back to the real value.
 */
function NumberField({
  value,
  onCommit,
  ariaLabel,
  min,
  max,
}: {
  value: number;
  onCommit: (next: number) => void;
  ariaLabel: string;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      className="dvtt-number-field"
      aria-label={ariaLabel}
      min={min}
      max={max}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const next = Number(e.target.value);
        if (e.target.value !== "" && Number.isInteger(next)) onCommit(next);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function HpTile({
  character,
  apply,
  editing,
}: {
  character: Character;
  apply: (patch: Partial<Character>) => void;
  editing: boolean;
}) {
  const [amountDraft, setAmountDraft] = useState("1");
  const amount = Math.max(0, Math.floor(Number(amountDraft)) || 0);

  // Damage eats temp HP first (5e), then current, floored at 0.
  const damage = () => {
    const fromTemp = Math.min(character.tempHp, amount);
    const rest = amount - fromTemp;
    apply({
      tempHp: character.tempHp - fromTemp,
      currentHp: Math.max(0, character.currentHp - rest),
    });
  };
  const heal = () =>
    apply({
      currentHp: Math.min(character.maxHp, character.currentHp + amount),
    });

  return (
    <section className="dvtt-tile dvtt-tile--hp">
      <div className="dvtt-tile__title">Hit Points</div>
      <div className="dvtt-hp">
        <span className="dvtt-hp__current">{character.currentHp}</span>
        {character.tempHp > 0 && (
          <sup className="dvtt-hp__temp">+{character.tempHp}</sup>
        )}
        <span className="dvtt-hp__max">
          {" / "}
          {editing ? (
            <NumberField
              ariaLabel="Max HP"
              min={0}
              value={character.maxHp}
              onCommit={(maxHp) => apply({ maxHp })}
            />
          ) : (
            character.maxHp
          )}
        </span>
      </div>
      <div className="dvtt-hp-controls">
        <button onClick={damage}>Damage</button>
        <input
          type="number"
          aria-label="HP amount"
          min={0}
          value={amountDraft}
          onChange={(e) => setAmountDraft(e.target.value)}
        />
        <button onClick={heal}>Heal</button>
        <label className="dvtt-hp-controls__temp">
          Temp
          <NumberField
            ariaLabel="Temp HP"
            min={0}
            value={character.tempHp}
            onCommit={(tempHp) => apply({ tempHp })}
          />
        </label>
      </div>
    </section>
  );
}

function RestTile({
  character,
  apply,
}: {
  character: Character;
  apply: (patch: Partial<Character>) => void;
}) {
  const shortRest = () =>
    apply({
      resources: character.resources.map((r) =>
        r.per === "short-rest" ? { ...r, used: 0 } : r,
      ),
    });
  const longRest = () =>
    apply({
      currentHp: character.maxHp,
      tempHp: 0,
      resources: character.resources.map((r) => ({ ...r, used: 0 })),
    });

  return (
    <section className="dvtt-tile dvtt-tile--rest">
      <div className="dvtt-tile__title">Rest &amp; Resources</div>
      {character.resources.length === 0 && (
        <p className="dvtt-note">No limited-use resources.</p>
      )}
      {character.resources.map((resource, index) => (
        <ResourceRow
          key={resource.id}
          resource={resource}
          onUsedChange={(used) =>
            apply({
              resources: character.resources.map((r, i) =>
                i === index ? { ...r, used } : r,
              ),
            })
          }
        />
      ))}
      <div className="dvtt-rest-buttons">
        <button onClick={shortRest}>Short rest</button>
        <button className="mod-cta" onClick={longRest}>
          Long rest
        </button>
      </div>
    </section>
  );
}

/**
 * One resource as a pip row. Pips show remaining uses; clicking pip k sets
 * the remainder to k (or k-1 when it is already k, so the last pip can be
 * spent). Unlimited pools render without pips.
 */
function ResourceRow({
  resource,
  onUsedChange,
}: {
  resource: Character["resources"][number];
  onUsedChange: (used: number) => void;
}) {
  const label = `${resource.name}${resource.note ? ` (${resource.note})` : ""}`;
  if (resource.max === "unlimited") {
    return (
      <div className="dvtt-resource">
        <span className="dvtt-resource__name">{label}</span>
        <span className="dvtt-resource__unlimited">∞</span>
      </div>
    );
  }

  const remaining = resource.max - resource.used;
  return (
    <div className="dvtt-resource">
      <span className="dvtt-resource__name">{label}</span>
      <span className="dvtt-pips">
        {Array.from({ length: resource.max }, (_, i) => {
          const pip = i + 1;
          const filled = pip <= remaining;
          return (
            <button
              key={pip}
              className={`dvtt-pip${filled ? " is-filled" : ""}`}
              aria-label={`${resource.name} pip ${pip}`}
              aria-pressed={filled}
              onClick={() =>
                onUsedChange(
                  (resource.max as number) -
                    (remaining === pip ? pip - 1 : pip),
                )
              }
            />
          );
        })}
      </span>
    </div>
  );
}

function AbilityColumn({
  ability,
  character,
  apply,
  editing,
}: {
  ability: Ability;
  character: Character;
  apply: (patch: Partial<Character>) => void;
  editing: boolean;
}) {
  const score = character.abilityScores[ability];
  const saveLevel = character.savingThrows[ability] ?? "none";
  const saveProficient = saveLevel !== "none";

  const setSkill = (skill: Skill, next: ProficiencyLevel) => {
    const skills = { ...character.skills };
    if (next === "none") delete skills[skill];
    else skills[skill] = next;
    apply({ skills });
  };

  return (
    <div className="dvtt-sheet-col">
      <div className="dvtt-sheet-stat" title={ABILITY_LABELS[ability]}>
        <div className="dvtt-sheet-stat__label">{ability.toUpperCase()}</div>
        <div className="dvtt-sheet-stat__mod">
          {formatModifier(abilityModifier(score))}
        </div>
        <div className="dvtt-sheet-stat__score">
          {editing ? (
            <NumberField
              ariaLabel={`${ABILITY_LABELS[ability]} score`}
              min={1}
              max={30}
              value={score}
              onCommit={(next) =>
                apply({
                  abilityScores: { ...character.abilityScores, [ability]: next },
                })
              }
            />
          ) : (
            score
          )}
        </div>
      </div>

      <div className={`dvtt-save${saveProficient ? " is-proficient" : ""}`}>
        {editing ? (
          <label className="dvtt-save__toggle">
            <input
              type="checkbox"
              aria-label={`${ABILITY_LABELS[ability]} save proficiency`}
              checked={saveProficient}
              onChange={() =>
                apply({
                  savingThrows: {
                    ...character.savingThrows,
                    [ability]: saveProficient ? "none" : "proficient",
                  },
                })
              }
            />
            <span className="dvtt-save__name">Save</span>
          </label>
        ) : (
          <span className="dvtt-save__name">Save</span>
        )}
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
          const bonus = (
            <span className="dvtt-skill__bonus">
              {formatModifier(skillBonus(character, skill))}
            </span>
          );
          if (editing) {
            return (
              <button
                className={`dvtt-skill dvtt-skill--toggle${stateClass}`}
                key={skill}
                title={`Proficiency: ${proficiency} — click to change`}
                onClick={() => setSkill(skill, PROFICIENCY_CYCLE[proficiency])}
              >
                <span className="dvtt-skill__name">{humanize(skill)}</span>
                {bonus}
              </button>
            );
          }
          return (
            <div className={`dvtt-skill${stateClass}`} key={skill}>
              <span className="dvtt-skill__name">{humanize(skill)}</span>
              {bonus}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InventoryTile({
  character,
  apply,
  editing,
}: {
  character: Character;
  apply: (patch: Partial<Character>) => void;
  editing: boolean;
}) {
  const update = (index: number, patch: Partial<Character["inventory"][number]>) =>
    apply({
      inventory: character.inventory.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    });
  const remove = (index: number) =>
    apply({
      inventory: character.inventory.filter((_, i) => i !== index),
    });
  const add = () =>
    apply({
      inventory: [
        ...character.inventory,
        { id: newId("item"), name: "New item", quantity: 1, equipped: false },
      ],
    });

  return (
    <section className="dvtt-tile dvtt-tile--inventory">
      <div className="dvtt-tile__title">Inventory</div>
      {character.inventory.length === 0 && (
        <p className="dvtt-note">Empty.</p>
      )}
      {editing ? (
        <div className="dvtt-inv">
          {character.inventory.map((item, index) => (
            <div className="dvtt-inv__row" key={item.id}>
              <input
                type="text"
                aria-label={`Item ${index + 1} name`}
                value={item.name}
                onChange={(e) => update(index, { name: e.target.value })}
              />
              <NumberField
                ariaLabel={`Item ${index + 1} quantity`}
                min={0}
                value={item.quantity}
                onCommit={(quantity) => update(index, { quantity })}
              />
              <label className="dvtt-inv__equipped">
                <input
                  type="checkbox"
                  aria-label={`Item ${index + 1} equipped`}
                  checked={item.equipped}
                  onChange={() => update(index, { equipped: !item.equipped })}
                />
                Equipped
              </label>
              <button
                aria-label={`Remove item ${index + 1}`}
                onClick={() => remove(index)}
              >
                ✕
              </button>
            </div>
          ))}
          <button className="dvtt-inv__add" onClick={add}>
            Add item
          </button>
        </div>
      ) : (
        <div className="dvtt-chips">
          {character.inventory.map((item) => (
            <span
              className={`dvtt-chip${item.equipped ? " is-equipped" : ""}`}
              key={item.id}
            >
              {item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name}
              {item.equipped ? " ●" : ""}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function SpellsTile({
  character,
  apply,
  editing,
}: {
  character: Character;
  apply: (patch: Partial<Character>) => void;
  editing: boolean;
}) {
  if (character.spells.length === 0 && !editing && !character.spellcastingAbility) {
    return null;
  }

  const update = (index: number, patch: Partial<Character["spells"][number]>) =>
    apply({
      spells: character.spells.map((spell, i) =>
        i === index ? { ...spell, ...patch } : spell,
      ),
    });

  return (
    <section className="dvtt-tile dvtt-tile--spells">
      <div className="dvtt-tile__title">Spells</div>
      {character.spells.length === 0 && (
        <p className="dvtt-note">No spells recorded.</p>
      )}
      <div className="dvtt-spell-list">
        {character.spells.map((spell, index) => (
          <div className="dvtt-spell" key={spell.id}>
            <label className="dvtt-spell__prepared">
              <input
                type="checkbox"
                aria-label={`${spell.name} prepared`}
                checked={spell.prepared}
                onChange={() => update(index, { prepared: !spell.prepared })}
              />
            </label>
            {editing ? (
              <>
                <input
                  type="text"
                  aria-label={`Spell ${index + 1} name`}
                  value={spell.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
                <NumberField
                  ariaLabel={`Spell ${index + 1} level`}
                  min={0}
                  max={9}
                  value={spell.level}
                  onCommit={(level) => update(index, { level })}
                />
                <button
                  aria-label={`Remove spell ${index + 1}`}
                  onClick={() =>
                    apply({
                      spells: character.spells.filter((_, i) => i !== index),
                    })
                  }
                >
                  ✕
                </button>
              </>
            ) : (
              <span className="dvtt-spell__name">
                {spell.name}
                <span className="dvtt-spell__level">
                  {spell.level === 0 ? " (cantrip)" : ` (level ${spell.level})`}
                </span>
              </span>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <button
          className="dvtt-spell-list__add"
          onClick={() =>
            apply({
              spells: [
                ...character.spells,
                { id: newId("spell"), name: "New spell", level: 0, prepared: false },
              ],
            })
          }
        >
          Add spell
        </button>
      )}
    </section>
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

function NotesTile({
  character,
  apply,
  editing,
}: {
  character: Character;
  apply: (patch: Partial<Character>) => void;
  editing: boolean;
}) {
  if (!editing && !character.notes) return null;
  return (
    <section className="dvtt-tile dvtt-tile--notes">
      <div className="dvtt-tile__title">Notes</div>
      {editing ? (
        <textarea
          aria-label="Character notes"
          rows={6}
          value={character.notes}
          onChange={(e) => apply({ notes: e.target.value })}
        />
      ) : (
        <p className="dvtt-sheet__notes">{character.notes}</p>
      )}
    </section>
  );
}

function Mini({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dvtt-mini">
      <div className="dvtt-mini__label">{label}</div>
      <div className="dvtt-mini__value">{children}</div>
    </div>
  );
}

function humanize(camel: string): string {
  const spaced = camel.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
