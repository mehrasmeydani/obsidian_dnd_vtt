import { useState, type ReactNode } from "react";
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
import { armorClass } from "../rules/armorClass";
import { ARMOR } from "../data/srd";

/** Armor lookup for the equip toggle (same source `armorClass` defaults to). */
const ARMOR_BY_ID = new Map(ARMOR.map((armor) => [armor.id, armor]));

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
              <span className="dvtt-ac-override">
                <NumberField
                  ariaLabel="Armor class override"
                  value={armorClass(character)}
                  onCommit={(armorClassOverride) =>
                    apply({ armorClassOverride })
                  }
                />
                {character.armorClassOverride !== undefined && (
                  <button
                    aria-label="Reset AC to automatic"
                    title="Back to armor-derived AC"
                    onClick={() => apply({ armorClassOverride: undefined })}
                  >
                    auto
                  </button>
                )}
              </span>
            ) : (
              armorClass(character)
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

      <DefensesTile character={character} apply={apply} editing={editing} />

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

      <FeaturesTile character={character} />

      <ProficienciesTile character={character} />
      <NotesTile character={character} apply={apply} editing={editing} />
    </div>
  );
}

/** The 14 standard 5e conditions plus Exhaustion (T-35). */
const CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
] as const;

/**
 * Defenses & conditions (T-35). Conditions are a play control — always
 * live toggle chips over the standard list. The damage-type lists
 * (resistances/immunities/vulnerabilities) are data: comma-separated
 * inputs in edit mode, chips in read mode.
 */
function DefensesTile({
  character,
  apply,
  editing,
}: {
  character: Character;
  apply: (patch: Partial<Character>) => void;
  editing: boolean;
}) {
  const lists = [
    ["Resistances", "resistances", character.resistances],
    ["Immunities", "immunities", character.immunities],
    ["Vulnerabilities", "vulnerabilities", character.vulnerabilities],
  ] as const;
  const hasDefenses = lists.some(([, , list]) => list.length > 0);
  if (!editing && !hasDefenses && character.conditions.length === 0) {
    // Nothing recorded: keep the sheet tight, but stay reachable — the
    // conditions row still renders so play toggles are one click away.
  }

  const toggleCondition = (condition: string) =>
    apply({
      conditions: character.conditions.includes(condition)
        ? character.conditions.filter((c) => c !== condition)
        : [...character.conditions, condition],
    });

  const commitList = (
    key: "resistances" | "immunities" | "vulnerabilities",
    raw: string,
  ) =>
    apply({
      [key]: raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    });

  return (
    <section className="dvtt-tile dvtt-tile--defenses">
      <div className="dvtt-tile__title">Defenses &amp; Conditions</div>

      {editing ? (
        <div className="dvtt-defense-edit">
          {lists.map(([label, key, list]) => (
            <label className="dvtt-field" key={key}>
              <span>{label} (comma-separated)</span>
              <input
                type="text"
                aria-label={label}
                defaultValue={list.join(", ")}
                onBlur={(e) => commitList(key, e.target.value)}
              />
            </label>
          ))}
        </div>
      ) : (
        lists
          .filter(([, , list]) => list.length > 0)
          .map(([label, key, list]) => (
            <div className="dvtt-prof-group" key={key}>
              <span className="dvtt-prof-group__label">{label}</span>
              <span className="dvtt-prof-group__list">{list.join(", ")}</span>
            </div>
          ))
      )}

      <div className="dvtt-conditions">
        <span className="dvtt-prof-group__label">Conditions</span>
        <div className="dvtt-chips">
          {CONDITIONS.map((condition) => {
            const active = character.conditions.includes(condition);
            return (
              <button
                type="button"
                key={condition}
                className={`dvtt-chip dvtt-chip--toggle${active ? " is-active" : ""}`}
                aria-pressed={active}
                onClick={() => toggleCondition(condition)}
              >
                {condition}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * A sheet tile whose body collapses behind its title (T-32): features,
 * spells, inventory, proficiencies, and notes fold away for easier
 * reading. Play-critical tiles (HP, combat, abilities, rests) don't use
 * this — they stay always visible.
 */
function CollapsibleTile({
  title,
  className,
  children,
}: {
  title: ReactNode;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section
      className={`dvtt-tile ${className}${open ? "" : " is-collapsed"}`}
    >
      <button
        type="button"
        className="dvtt-tile__title dvtt-tile__title--toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="dvtt-tile__chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        {title}
      </button>
      {open && children}
    </section>
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
  // Rests confirm before applying (T-34): a stray click must not wipe pips
  // or heal mid-fight. The clicked button flips into Confirm/Cancel.
  const [confirming, setConfirming] = useState<"short" | "long" | null>(null);

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
  const confirmRest = () => {
    if (confirming === "short") shortRest();
    if (confirming === "long") longRest();
    setConfirming(null);
  };

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
        {confirming === null ? (
          <>
            <button onClick={() => setConfirming("short")}>Short rest</button>
            <button className="mod-cta" onClick={() => setConfirming("long")}>
              Long rest
            </button>
          </>
        ) : (
          <>
            <span className="dvtt-rest-confirm__label">
              {confirming === "short" ? "Take a short rest?" : "Take a long rest?"}
            </span>
            <button className="mod-cta" onClick={confirmRest}>
              Confirm
            </button>
            <button onClick={() => setConfirming(null)}>Cancel</button>
          </>
        )}
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
  /** Wearables are armor-linked items — the only things that equip (T-36). */
  const isWearable = (item: Character["inventory"][number]) =>
    item.armorId !== undefined && ARMOR_BY_ID.has(item.armorId);
  /** Body armor (not shields) can only be worn one at a time. */
  const isBodyArmor = (item: Character["inventory"][number]) =>
    item.armorId !== undefined &&
    ARMOR_BY_ID.get(item.armorId) !== undefined &&
    ARMOR_BY_ID.get(item.armorId)?.type !== "shield";
  /**
   * The equip play control (T-22): always live, like HP and rests. AC is
   * derived from equipped gear, so equipping new body armor doffs the old
   * one — stacked body armor can never happen from the UI.
   */
  const toggleEquipped = (index: number) => {
    const target = character.inventory[index];
    const equipping = !target.equipped;
    apply({
      inventory: character.inventory.map((item, i) => {
        if (i === index) return { ...item, equipped: equipping };
        if (equipping && item.equipped && isBodyArmor(target) && isBodyArmor(item)) {
          return { ...item, equipped: false };
        }
        return item;
      }),
    });
  };
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
    <CollapsibleTile title="Inventory" className="dvtt-tile--inventory">
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
              {isWearable(item) && (
                <label className="dvtt-inv__equipped">
                  <input
                    type="checkbox"
                    aria-label={`Item ${index + 1} equipped`}
                    checked={item.equipped}
                    onChange={() => toggleEquipped(index)}
                  />
                  Equipped
                </label>
              )}
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
        <InventoryChips
          inventory={character.inventory}
          isWearable={isWearable}
          toggleEquipped={toggleEquipped}
        />
      )}
    </CollapsibleTile>
  );
}

/**
 * Read-mode inventory (T-36): split into "Wearing" (equipped) and "In
 * bags". Only wearables (armor-linked items) get the equip toggle; gold
 * and gear render as plain chips.
 */
function InventoryChips({
  inventory,
  isWearable,
  toggleEquipped,
}: {
  inventory: Character["inventory"];
  isWearable: (item: Character["inventory"][number]) => boolean;
  toggleEquipped: (index: number) => void;
}) {
  const groups = [
    { label: "Wearing", items: inventory.filter((i) => i.equipped) },
    { label: "In bags", items: inventory.filter((i) => !i.equipped) },
  ].filter((group) => group.items.length > 0);

  return (
    <>
      {groups.map((group) => (
        <div className="dvtt-inv-group" key={group.label}>
          <div className="dvtt-inv-group__label">{group.label}</div>
          <div className="dvtt-chips">
            {group.items.map((item) => {
              const index = inventory.indexOf(item);
              const label =
                item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name;
              if (!isWearable(item)) {
                return (
                  <span className="dvtt-chip" key={item.id}>
                    {label}
                  </span>
                );
              }
              return (
                <button
                  type="button"
                  className={`dvtt-chip dvtt-chip--toggle${item.equipped ? " is-equipped" : ""}`}
                  key={item.id}
                  aria-pressed={item.equipped}
                  title={
                    item.equipped
                      ? "Equipped — click to take off"
                      : "Click to equip"
                  }
                  onClick={() => toggleEquipped(index)}
                >
                  {label}
                  {item.equipped ? " ●" : ""}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
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
    <CollapsibleTile title="Spells" className="dvtt-tile--spells">
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
    </CollapsibleTile>
  );
}

/**
 * Features & Traits grouped by origin (T-33): race, class (sorted by the
 * level gained, subclass features and leveled feats inline), background,
 * and feats. Feats taken at an ASI level appear both in the class
 * progression and in the Feats group.
 */
function FeaturesTile({ character }: { character: Character }) {
  if (character.features.length === 0) return null;

  const classSources = new Set(
    character.classes.flatMap((c) =>
      c.subclass ? [c.name, c.subclass] : [c.name],
    ),
  );
  const features = character.features;
  const raceItems = features.filter((f) => f.source === character.race);
  const backgroundItems = features.filter(
    (f) => f.source === character.background && f.source !== character.race,
  );
  const featItems = features.filter((f) => f.source === "Feat");
  const classItems = [
    ...features.filter((f) => f.source !== undefined && classSources.has(f.source)),
    // Leveled feats slot into the class progression too.
    ...featItems.filter((f) => f.level !== undefined),
  ].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const grouped = new Set([...raceItems, ...backgroundItems, ...featItems, ...classItems]);
  const otherItems = features.filter((f) => !grouped.has(f));

  const groups = [
    { label: character.race || "Race", items: raceItems },
    {
      label: character.classes.map((c) => c.name).join(" / ") || "Class",
      items: classItems,
    },
    { label: character.background || "Background", items: backgroundItems },
    { label: "Feats", items: featItems },
    { label: "Other", items: otherItems },
  ].filter((group) => group.items.length > 0);

  return (
    <CollapsibleTile
      title={<>Features &amp; Traits</>}
      className="dvtt-tile--features"
    >
      {groups.map((group) => (
        <div className="dvtt-feature-group" key={group.label}>
          <div className="dvtt-feature-group__label">{group.label}</div>
          <ul className="dvtt-granted-features">
            {group.items.map((f) => (
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
        </div>
      ))}
    </CollapsibleTile>
  );
}

/** Armor/weapon/tool proficiencies and languages (T-08), when any exist. */
function ProficienciesTile({ character }: { character: Character }) {
  const groups = (
    [
      ["Armor", character.proficiencies.armor],
      ["Weapons", character.proficiencies.weapons],
      ["Tools", character.proficiencies.tools],
      ["Languages", character.languages],
    ] as const
  ).filter(([, list]) => list.length > 0);
  if (groups.length === 0) return null;

  return (
    <CollapsibleTile
      title={<>Proficiencies &amp; languages</>}
      className="dvtt-tile--proficiencies"
    >
      {groups.map(([label, list]) => (
        <div className="dvtt-prof-group" key={label}>
          <span className="dvtt-prof-group__label">{label}</span>
          <span className="dvtt-prof-group__list">{list.join(", ")}</span>
        </div>
      ))}
    </CollapsibleTile>
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
    <CollapsibleTile title="Notes" className="dvtt-tile--notes">
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
    </CollapsibleTile>
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
