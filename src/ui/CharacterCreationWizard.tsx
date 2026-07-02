import { useMemo, useState } from "react";
import {
  ABILITIES,
  SKILLS,
  type Ability,
  type AbilityScores,
  type Character,
  type Skill,
} from "../model/schema";
import {
  BACKGROUNDS,
  CLASSES,
  RACES,
  type BackgroundData,
  type ClassData,
  type RaceData,
} from "../data/srd";
import {
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  STANDARD_ARRAY,
  assembleCharacter,
  bonusSkillCount,
  emptyDraft,
  finalAbilityScores,
  grantedSkills,
  pointBuyTotal,
  validateDraft,
  type CharacterDraft,
} from "../rules/characterCreation";
import {
  abilityModifier,
  formatModifier,
  passivePerception,
  proficiencyBonus,
} from "../rules/abilityMath";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const STEPS = [
  "Name & Race",
  "Class",
  "Background",
  "Abilities",
  "Skills",
  "Review",
] as const;

type AbilityMethod = "standard" | "pointBuy" | "manual";

/**
 * Guided character creation: race → class → background → abilities → skills →
 * review. All rules logic lives in `rules/characterCreation`; this component
 * only collects the draft and renders validation state.
 */
export function CharacterCreationWizard({
  onComplete,
  onCancel,
}: {
  onComplete: (character: Character) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CharacterDraft>(emptyDraft);
  const [method, setMethod] = useState<AbilityMethod>("standard");
  // Standard-array assignment lives here (null = unassigned) and is folded
  // into draft.baseScores once every slot is filled.
  const [assignments, setAssignments] = useState<
    Record<Ability, number | null>
  >({ str: null, dex: null, con: null, int: null, wis: null, cha: null });

  const update = (patch: Partial<CharacterDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const blockers = useMemo(
    () => stepBlockers(step, draft, method, assignments),
    [step, draft, method, assignments],
  );
  const stepValid = blockers.length === 0;

  const switchMethod = (next: AbilityMethod) => {
    setMethod(next);
    setAssignments({ str: null, dex: null, con: null, int: null, wis: null, cha: null });
    const base = next === "pointBuy" ? 8 : 10;
    update({
      baseScores: { str: base, dex: base, con: base, int: base, wis: base, cha: base },
    });
  };

  const assignStandard = (ability: Ability, value: number | null) => {
    const next = { ...assignments, [ability]: value };
    setAssignments(next);
    if (ABILITIES.every((a) => next[a] !== null)) {
      update({
        baseScores: Object.fromEntries(
          ABILITIES.map((a) => [a, next[a]]),
        ) as unknown as AbilityScores,
      });
    }
  };

  return (
    <div className="dvtt-wizard">
      <header className="dvtt-wizard__header">
        <h2>Create a character</h2>
        <ol className="dvtt-wizard__steps">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={
                i === step
                  ? "is-active"
                  : i < step
                    ? "is-done"
                    : undefined
              }
            >
              {label}
            </li>
          ))}
        </ol>
      </header>

      <div className="dvtt-wizard__body">
        {step === 0 && (
          <NameRaceStep draft={draft} update={update} />
        )}
        {step === 1 && <ClassStep draft={draft} update={update} />}
        {step === 2 && <BackgroundStep draft={draft} update={update} />}
        {step === 3 && (
          <AbilitiesStep
            draft={draft}
            update={update}
            method={method}
            switchMethod={switchMethod}
            assignments={assignments}
            assignStandard={assignStandard}
          />
        )}
        {step === 4 && <SkillsStep draft={draft} update={update} />}
        {step === 5 && <ReviewStep draft={draft} />}
      </div>

      <footer className="dvtt-wizard__footer">
        <button onClick={onCancel}>Cancel</button>
        {!stepValid && (
          <span className="dvtt-wizard__hint">{blockers[0]}</span>
        )}
        <div className="dvtt-wizard__nav">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}>Back</button>
          )}
          {step < STEPS.length - 1 && (
            <button
              className="mod-cta"
              disabled={!stepValid}
              onClick={() => setStep(step + 1)}
            >
              Next
            </button>
          )}
          {step === STEPS.length - 1 && (
            <button
              className="mod-cta"
              disabled={validateDraft(draft).length > 0}
              onClick={() =>
                onComplete(assembleCharacter(draft, crypto.randomUUID()))
              }
            >
              Create character
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

/**
 * What still blocks the current step, as user-facing messages. Empty means
 * Next is allowed; the first message is shown beside the disabled button so
 * the user always knows what the wizard is waiting for.
 */
function stepBlockers(
  step: number,
  draft: CharacterDraft,
  method: AbilityMethod,
  assignments: Record<Ability, number | null>,
): string[] {
  const blockers: string[] = [];
  switch (step) {
    case 0:
      if (!draft.name.trim()) blockers.push("Enter a character name.");
      if (!draft.race) blockers.push("Select a race.");
      break;
    case 1:
      if (!draft.charClass) blockers.push("Select a class.");
      break;
    case 2:
      if (!draft.background) blockers.push("Select a background.");
      break;
    case 3: {
      // The racial bonus picker lives on this step, so it gates here.
      if (draft.race?.bonusChoice) {
        const { count, amount } = draft.race.bonusChoice;
        const left = count - draft.racialBonusAbilities.length;
        if (left > 0) {
          blockers.push(`Pick ${left} more abilit${left === 1 ? "y" : "ies"} for the racial +${amount}.`);
        }
      }
      if (method === "standard") {
        const left = ABILITIES.filter((a) => assignments[a] === null).length;
        if (left > 0) {
          blockers.push(`Assign all six standard-array values (${left} left).`);
        }
      } else if (method === "pointBuy") {
        const total = pointBuyTotal(draft.baseScores);
        if (total === null || total > POINT_BUY_BUDGET) {
          blockers.push(`Stay within the ${POINT_BUY_BUDGET}-point budget.`);
        }
      } else {
        const allValid = ABILITIES.every((a) => {
          const s = draft.baseScores[a];
          return Number.isInteger(s) && s >= 1 && s <= 30;
        });
        if (!allValid) {
          blockers.push("Scores must be whole numbers from 1 to 30.");
        }
      }
      break;
    }
    case 4: {
      const classLeft =
        (draft.charClass?.skillChoice.count ?? 0) - draft.classSkills.length;
      if (classLeft > 0) {
        blockers.push(`Choose ${classLeft} more class skill${classLeft === 1 ? "" : "s"}.`);
      }
      const bonusLeft = bonusSkillCount(draft) - draft.bonusSkills.length;
      if (bonusLeft > 0) {
        blockers.push(`Choose ${bonusLeft} more additional skill${bonusLeft === 1 ? "" : "s"}.`);
      }
      break;
    }
  }
  return blockers;
}

function NameRaceStep({
  draft,
  update,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
}) {
  const selectRace = (race: RaceData) =>
    // Reset picks that depend on the race.
    update({ race, racialBonusAbilities: [], bonusSkills: [] });

  return (
    <div>
      <label className="dvtt-field">
        <span>Character name</span>
        <input
          type="text"
          value={draft.name}
          placeholder="e.g. Borin Ironfist"
          onChange={(e) => update({ name: e.target.value })}
        />
      </label>

      <h3>Race</h3>
      <div className="dvtt-cards">
        {RACES.map((race) => (
          <button
            key={race.id}
            className={`dvtt-card${draft.race?.id === race.id ? " is-selected" : ""}`}
            onClick={() => selectRace(race)}
          >
            <div className="dvtt-card__title">{race.name}</div>
            <div className="dvtt-card__meta">
              {describeBonuses(race)} · Speed {race.speed} ft
            </div>
            <div className="dvtt-card__detail">
              {race.traits.map((t) => t.name).join(", ")}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function describeBonuses(race: RaceData): string {
  const parts = ABILITIES.filter((a) => race.fixedBonuses[a]).map(
    (a) => `${ABILITY_LABELS[a].slice(0, 3).toUpperCase()} +${race.fixedBonuses[a]}`,
  );
  if (race.bonusChoice) {
    parts.push(
      `+${race.bonusChoice.amount} to ${race.bonusChoice.count} others`,
    );
  }
  return parts.join(", ");
}

function ClassStep({
  draft,
  update,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
}) {
  const selectClass = (charClass: ClassData) =>
    // Reset skill picks; the allowed list changed.
    update({ charClass, classSkills: [] });

  return (
    <div>
      <h3>Class</h3>
      <div className="dvtt-cards">
        {CLASSES.map((c) => (
          <button
            key={c.id}
            className={`dvtt-card${draft.charClass?.id === c.id ? " is-selected" : ""}`}
            onClick={() => selectClass(c)}
          >
            <div className="dvtt-card__title">{c.name}</div>
            <div className="dvtt-card__meta">
              d{c.hitDie} hit die ·{" "}
              {c.savingThrows
                .map((a) => ABILITY_LABELS[a].slice(0, 3).toUpperCase())
                .join("/")}{" "}
              saves
              {c.spellcastingAbility
                ? ` · ${ABILITY_LABELS[c.spellcastingAbility]} caster`
                : ""}
            </div>
            <div className="dvtt-card__detail">
              {c.traits.map((t) => t.name).join(", ")}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BackgroundStep({
  draft,
  update,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
}) {
  const selectBackground = (background: BackgroundData) =>
    update({ background, bonusSkills: [], backgroundName: "" });

  return (
    <div>
      <h3>Background</h3>
      <div className="dvtt-cards">
        {BACKGROUNDS.map((bg) => (
          <button
            key={bg.id}
            className={`dvtt-card${draft.background?.id === bg.id ? " is-selected" : ""}`}
            onClick={() => selectBackground(bg)}
          >
            <div className="dvtt-card__title">{bg.name}</div>
            <div className="dvtt-card__meta">
              {bg.grantedSkills.length > 0
                ? `Skills: ${bg.grantedSkills.map(humanizeSkill).join(", ")}`
                : `Choose ${bg.skillChoice?.count ?? 0} skills`}
            </div>
            <div className="dvtt-card__detail">{bg.description}</div>
          </button>
        ))}
      </div>

      {draft.background?.customName && (
        <label className="dvtt-field">
          <span>Background name</span>
          <input
            type="text"
            value={draft.backgroundName}
            placeholder="e.g. Caravan Guard"
            onChange={(e) => update({ backgroundName: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}

function AbilitiesStep({
  draft,
  update,
  method,
  switchMethod,
  assignments,
  assignStandard,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
  method: AbilityMethod;
  switchMethod: (m: AbilityMethod) => void;
  assignments: Record<Ability, number | null>;
  assignStandard: (ability: Ability, value: number | null) => void;
}) {
  const final = finalAbilityScores(draft);
  const spent = pointBuyTotal(draft.baseScores);

  const setScore = (ability: Ability, value: number) =>
    update({ baseScores: { ...draft.baseScores, [ability]: value } });

  return (
    <div>
      <h3>Ability scores</h3>
      <div className="dvtt-method-picker">
        {(
          [
            ["standard", "Standard array"],
            ["pointBuy", "Point buy"],
            ["manual", "Manual"],
          ] as const
        ).map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="dvtt-ability-method"
              checked={method === value}
              onChange={() => switchMethod(value)}
            />
            {label}
          </label>
        ))}
      </div>

      {method === "pointBuy" && (
        <div className="dvtt-pointbuy-budget">
          Points spent: <strong>{spent ?? "—"}</strong> / {POINT_BUY_BUDGET}
        </div>
      )}

      <div className="dvtt-ability-rows">
        {ABILITIES.map((ability) => {
          const racialDelta = final[ability] - draft.baseScores[ability];
          return (
            <div className="dvtt-ability-row" key={ability}>
              <span className="dvtt-ability-row__name">
                {ABILITY_LABELS[ability]}
              </span>

              {method === "standard" && (
                <select
                  value={assignments[ability] ?? ""}
                  onChange={(e) =>
                    assignStandard(
                      ability,
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                >
                  <option value="">—</option>
                  {STANDARD_ARRAY.filter(
                    (v) =>
                      assignments[ability] === v ||
                      !ABILITIES.some((a) => assignments[a] === v),
                  ).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              )}

              {method === "pointBuy" && (
                <span className="dvtt-pointbuy-controls">
                  <button
                    disabled={draft.baseScores[ability] <= POINT_BUY_MIN}
                    onClick={() => setScore(ability, draft.baseScores[ability] - 1)}
                  >
                    −
                  </button>
                  <span className="dvtt-pointbuy-score">
                    {draft.baseScores[ability]}
                  </span>
                  <button
                    disabled={draft.baseScores[ability] >= POINT_BUY_MAX}
                    onClick={() => setScore(ability, draft.baseScores[ability] + 1)}
                  >
                    +
                  </button>
                </span>
              )}

              {method === "manual" && (
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={draft.baseScores[ability]}
                  onChange={(e) => setScore(ability, Number(e.target.value))}
                />
              )}

              <span className="dvtt-ability-row__final">
                {racialDelta > 0 && (
                  <span className="dvtt-ability-row__racial">
                    +{racialDelta} racial →
                  </span>
                )}{" "}
                <strong>{final[ability]}</strong> (
                {formatModifier(abilityModifier(final[ability]))})
              </span>
            </div>
          );
        })}
      </div>

      {draft.race?.bonusChoice && (
        <RacialBonusPicker draft={draft} update={update} />
      )}
    </div>
  );
}

function RacialBonusPicker({
  draft,
  update,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
}) {
  const race = draft.race;
  if (!race?.bonusChoice) return null;
  const { count, amount } = race.bonusChoice;
  const picks = draft.racialBonusAbilities;

  const toggle = (ability: Ability) => {
    const next = picks.includes(ability)
      ? picks.filter((a) => a !== ability)
      : [...picks, ability];
    update({ racialBonusAbilities: next });
  };

  return (
    <div className="dvtt-choice-group">
      <h4>
        {race.name}: +{amount} to {count} abilities ({picks.length}/{count})
      </h4>
      <div className="dvtt-checkboxes">
        {ABILITIES.filter((a) => !(race.fixedBonuses[a] ?? 0)).map((ability) => (
          <label key={ability}>
            <input
              type="checkbox"
              checked={picks.includes(ability)}
              disabled={!picks.includes(ability) && picks.length >= count}
              onChange={() => toggle(ability)}
            />
            {ABILITY_LABELS[ability]}
          </label>
        ))}
      </div>
    </div>
  );
}

function SkillsStep({
  draft,
  update,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
}) {
  const granted = grantedSkills(draft);
  const classChoice = draft.charClass?.skillChoice;
  const classOptions: Skill[] =
    classChoice?.from === "any" || !classChoice
      ? (Object.keys(SKILLS) as Skill[])
      : classChoice.from;
  const bonusNeeded = bonusSkillCount(draft);
  const taken = new Set<Skill>([
    ...granted,
    ...draft.classSkills,
    ...draft.bonusSkills,
  ]);

  const toggleIn = (list: "classSkills" | "bonusSkills", skill: Skill) => {
    const current = draft[list];
    const next = current.includes(skill)
      ? current.filter((s) => s !== skill)
      : [...current, skill];
    update({ [list]: next });
  };

  return (
    <div>
      <h3>Skills</h3>

      {granted.length > 0 && (
        <div className="dvtt-choice-group">
          <h4>Granted by race & background</h4>
          <div className="dvtt-chips">
            {granted.map((s) => (
              <span className="dvtt-chip" key={s}>
                {humanizeSkill(s)}
              </span>
            ))}
          </div>
        </div>
      )}

      {classChoice && (
        <div className="dvtt-choice-group">
          <h4>
            {draft.charClass?.name} skills ({draft.classSkills.length}/
            {classChoice.count})
          </h4>
          <div className="dvtt-checkboxes">
            {classOptions.map((skill) => {
              const checked = draft.classSkills.includes(skill);
              return (
                <label key={skill}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={
                      !checked &&
                      (taken.has(skill) ||
                        draft.classSkills.length >= classChoice.count)
                    }
                    onChange={() => toggleIn("classSkills", skill)}
                  />
                  {humanizeSkill(skill)}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {bonusNeeded > 0 && (
        <div className="dvtt-choice-group">
          <h4>
            Additional skills — any ({draft.bonusSkills.length}/{bonusNeeded})
          </h4>
          <div className="dvtt-checkboxes">
            {(Object.keys(SKILLS) as Skill[]).map((skill) => {
              const checked = draft.bonusSkills.includes(skill);
              return (
                <label key={skill}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={
                      !checked &&
                      (taken.has(skill) ||
                        draft.bonusSkills.length >= bonusNeeded)
                    }
                    onChange={() => toggleIn("bonusSkills", skill)}
                  />
                  {humanizeSkill(skill)}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewStep({ draft }: { draft: CharacterDraft }) {
  const errors = validateDraft(draft);
  if (errors.length > 0) {
    return (
      <div>
        <h3>Almost there</h3>
        <ul className="dvtt-errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    );
  }

  // Safe: the draft validated.
  const character = assembleCharacter(draft, "preview");
  return (
    <div>
      <h3>
        {character.name} — Level 1 {character.race} {character.classes[0]?.name}
      </h3>
      <p className="dvtt-review__subtitle">{character.background}</p>
      <div className="dvtt-topline">
        <ReviewStat label="HP" value={character.maxHp} />
        <ReviewStat label="AC" value={character.armorClass} />
        <ReviewStat label="Speed" value={`${character.speed} ft`} />
        <ReviewStat
          label="Prof. bonus"
          value={formatModifier(proficiencyBonus(1))}
        />
        <ReviewStat label="Passive Perc." value={passivePerception(character)} />
      </div>
      <div className="dvtt-review__grid">
        {ABILITIES.map((a) => (
          <div key={a} className="dvtt-ability">
            <div className="dvtt-ability__name">{ABILITY_LABELS[a]}</div>
            <div className="dvtt-ability__score">
              {character.abilityScores[a]}
            </div>
            <div className="dvtt-ability__mod">
              {formatModifier(abilityModifier(character.abilityScores[a]))}
            </div>
          </div>
        ))}
      </div>
      <p>
        <strong>Proficient skills:</strong>{" "}
        {Object.keys(character.skills).map(humanizeSkill).join(", ") || "none"}
      </p>
      <p>
        <strong>Saving throws:</strong>{" "}
        {Object.keys(character.savingThrows)
          .map((a) => ABILITY_LABELS[a as Ability])
          .join(", ")}
      </p>
      {character.features.length > 0 && (
        <div className="dvtt-choice-group">
          <h4>Features & traits</h4>
          <ul className="dvtt-features">
            {character.features.map((f) => (
              <li key={f.id}>
                <strong>{f.name}</strong>
                <span className="dvtt-feature__source"> ({f.source})</span>
                {f.description ? ` — ${f.description}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReviewStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="dvtt-stat">
      <div className="dvtt-stat__value">{value}</div>
      <div className="dvtt-stat__label">{label}</div>
    </div>
  );
}

function humanizeSkill(camel: string): string {
  const spaced = camel.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
