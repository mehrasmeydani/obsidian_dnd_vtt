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
  FEATS,
  RACES,
  type BackgroundData,
  type ClassData,
  type FeatData,
  type FeatureChoice,
  type OptionChoice,
  type RaceData,
  type SubclassData,
} from "../data/srd";
import {
  ABILITY_SCORE_CAP,
  MAX_LEVEL,
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  STANDARD_ARRAY,
  activeFeatureChoices,
  asiPointsSpent,
  asiPointsTotal,
  assembleCharacter,
  bonusSkillCount,
  draftProficientSkills,
  earnedAsiLevels,
  emptyDraft,
  featProblems,
  featureChoiceProblems,
  featureSkillPicks,
  finalAbilityScores,
  grantedClassFeatures,
  goldProblems,
  grantedSkills,
  hpProblems,
  languageToolProblems,
  hpRollsNeeded,
  optionChoiceProblems,
  pointBuyTotal,
  pruneStaleExpertise,
  startingHp,
  subclassRequired,
  validateDraft,
  type CharacterDraft,
} from "../rules/characterCreation";
import { goldRollLabel, rollDice, rollGold } from "../rules/dice";
import {
  abilityModifier,
  formatModifier,
  passivePerception,
  proficiencyBonus,
  totalLevel,
} from "../rules/abilityMath";
import { armorClass } from "../rules/armorClass";
import type { EquipmentItem } from "../data/srd";

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
  "Class options",
  "Background",
  "Abilities",
  "Skills",
  "Equipment",
  "Review",
] as const;

type AbilityMethod = "standard" | "pointBuy" | "manual";

/** The entity lists the wizard offers; defaults to the bundled SRD. */
export interface WizardContent {
  races: RaceData[];
  classes: ClassData[];
  backgrounds: BackgroundData[];
  feats: FeatData[];
}

const SRD_CONTENT: WizardContent = {
  races: RACES,
  classes: CLASSES,
  backgrounds: BACKGROUNDS,
  feats: FEATS,
};

/**
 * Guided character creation: race → class → background → abilities → skills →
 * review. All rules logic lives in `rules/characterCreation`; this component
 * only collects the draft and renders validation state. `content` comes from
 * the plugin's ContentStore (SRD + user bundles); it defaults to the SRD.
 */
export function CharacterCreationWizard({
  onComplete,
  onCancel,
  content = SRD_CONTENT,
}: {
  onComplete: (character: Character) => void;
  onCancel: () => void;
  content?: WizardContent;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CharacterDraft>(emptyDraft);
  const [method, setMethod] = useState<AbilityMethod>("standard");
  // Standard-array assignment lives here (null = unassigned) and is folded
  // into draft.baseScores once every slot is filled.
  const [assignments, setAssignments] = useState<
    Record<Ability, number | null>
  >({ str: null, dex: null, con: null, int: null, wis: null, cha: null });

  // Every draft change prunes expertise picks whose underlying proficiency
  // was removed (T-37): unchecking a skill must release its expertise slot
  // instead of leaving a stale, invisible pick that blocks validation.
  const update = (patch: Partial<CharacterDraft>) =>
    setDraft((d) => pruneStaleExpertise({ ...d, ...patch }));

  const blockers = useMemo(
    () => stepBlockers(step, draft, method, assignments),
    [step, draft, method, assignments],
  );
  const stepValid = blockers.length === 0;

  // Farthest step reachable via the header: the first incomplete step blocks
  // everything after it (same gating as the Next button).
  const maxStep = useMemo(() => {
    for (let i = 0; i < STEPS.length - 1; i++) {
      if (stepBlockers(i, draft, method, assignments).length > 0) return i;
    }
    return STEPS.length - 1;
  }, [draft, method, assignments]);

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
              <button
                className="dvtt-wizard__step"
                disabled={i > maxStep}
                onClick={() => setStep(i)}
              >
                {label}
              </button>
            </li>
          ))}
        </ol>
      </header>

      <div className="dvtt-wizard__body">
        {step === 0 && (
          <NameRaceStep draft={draft} update={update} races={content.races} />
        )}
        {step === 1 && (
          <ClassStep draft={draft} update={update} classes={content.classes} />
        )}
        {step === 2 && <ClassOptionsStep draft={draft} update={update} />}
        {step === 3 && (
          <BackgroundStep
            draft={draft}
            update={update}
            backgrounds={content.backgrounds}
          />
        )}
        {step === 4 && (
          <AbilitiesStep
            draft={draft}
            update={update}
            method={method}
            switchMethod={switchMethod}
            assignments={assignments}
            assignStandard={assignStandard}
            feats={content.feats}
          />
        )}
        {step === 5 && <SkillsStep draft={draft} update={update} />}
        {step === 6 && <EquipmentStep draft={draft} update={update} />}
        {step === 7 && <ReviewStep draft={draft} />}
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
      blockers.push(...optionChoiceProblems(draft, "race"));
      blockers.push(...languageToolProblems(draft));
      break;
    case 1:
      if (!draft.charClass) blockers.push("Select a class.");
      if (
        !Number.isInteger(draft.level) ||
        draft.level < 1 ||
        draft.level > MAX_LEVEL
      ) {
        blockers.push(`Level must be between 1 and ${MAX_LEVEL}.`);
      }
      break;
    case 2:
      // Subclass and the non-skill feature choices live on this step;
      // expertise gates the Skills step, where its pool is known.
      if (subclassRequired(draft) && !draft.subclass) {
        blockers.push(`Choose a ${draft.charClass?.name} subclass.`);
      }
      blockers.push(...featureChoiceProblems(draft, ["options", "skills"]));
      break;
    case 3:
      if (!draft.background) blockers.push("Select a background.");
      blockers.push(...optionChoiceProblems(draft, "background"));
      blockers.push(...languageToolProblems(draft));
      break;
    case 4: {
      // The racial bonus and ASI pickers live on this step, so they gate here.
      if (draft.race?.bonusChoice) {
        const { count, amount } = draft.race.bonusChoice;
        const left = count - draft.racialBonusAbilities.length;
        if (left > 0) {
          blockers.push(`Pick ${left} more abilit${left === 1 ? "y" : "ies"} for the racial +${amount}.`);
        }
      }
      const asiLeft = asiPointsTotal(draft) - asiPointsSpent(draft);
      if (asiLeft > 0) {
        blockers.push(
          `Assign ${asiLeft} more improvement point${asiLeft === 1 ? "" : "s"}.`,
        );
      } else if (asiLeft < 0) {
        blockers.push(
          `Remove ${-asiLeft} improvement point${asiLeft === -1 ? "" : "s"}.`,
        );
      }
      blockers.push(...featProblems(draft));
      blockers.push(...hpProblems(draft));
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
    case 5: {
      const classLeft =
        (draft.charClass?.skillChoice.count ?? 0) - draft.classSkills.length;
      if (classLeft > 0) {
        blockers.push(`Choose ${classLeft} more class skill${classLeft === 1 ? "" : "s"}.`);
      }
      const bonusLeft = bonusSkillCount(draft) - draft.bonusSkills.length;
      if (bonusLeft > 0) {
        blockers.push(`Choose ${bonusLeft} more additional skill${bonusLeft === 1 ? "" : "s"}.`);
      }
      blockers.push(...featureChoiceProblems(draft, ["expertise"]));
      break;
    }
    case 6: {
      if (draft.equipmentMode === "gold") {
        blockers.push(...goldProblems(draft));
        break;
      }
      const choices = draft.charClass?.equipment.choices ?? [];
      const valid =
        draft.equipmentChoices.length === choices.length &&
        draft.equipmentChoices.every(
          (pick, i) => pick >= 0 && pick < choices[i].options.length,
        );
      if (!valid) blockers.push("Choose your starting equipment.");
      break;
    }
  }
  return blockers;
}

/** "Handaxe ×2, Spear" — display label for an equipment bundle. */
function bundleLabel(items: EquipmentItem[]): string {
  return items
    .map((i) => ((i.quantity ?? 1) > 1 ? `${i.name} ×${i.quantity}` : i.name))
    .join(", ");
}

function NameRaceStep({
  draft,
  update,
  races,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
  races: RaceData[];
}) {
  const selectRace = (race: RaceData) =>
    // Reset picks that depend on the race.
    update({
      race,
      racialBonusAbilities: [],
      bonusSkills: [],
      raceOptions: {},
    });

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
        {races.map((race) => (
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

      {draft.race && <GrantedLanguagesTools entity={draft.race} />}

      {draft.race && (
        <OptionChoicePickers
          title={draft.race.name}
          choices={draft.race.optionChoices}
          picks={draft.raceOptions}
          setPicks={(raceOptions) => update({ raceOptions })}
        />
      )}
    </div>
  );
}

/** Languages/tools a race or background grants outright (T-08), as chips. */
function GrantedLanguagesTools({
  entity,
}: {
  entity: { languages: string[]; tools: string[] };
}) {
  if (entity.languages.length === 0 && entity.tools.length === 0) return null;
  return (
    <div className="dvtt-choice-group">
      <h4>Languages &amp; tools</h4>
      <div className="dvtt-chips">
        {entity.languages.map((language) => (
          <span className="dvtt-chip" key={`lang-${language}`}>
            {language}
          </span>
        ))}
        {entity.tools.map((tool) => (
          <span className="dvtt-chip" key={`tool-${tool}`}>
            {tool} (tool)
          </span>
        ))}
      </div>
    </div>
  );
}

/** One dropdown per race/background "pick one" choice (T-05). */
function OptionChoicePickers({
  title,
  choices,
  picks,
  setPicks,
}: {
  title: string;
  choices: OptionChoice[];
  picks: Record<string, string>;
  setPicks: (next: Record<string, string>) => void;
}) {
  if (choices.length === 0) return null;
  return (
    <>
      {choices.map((choice) => (
        <div className="dvtt-choice-group" key={choice.id}>
          <h4>
            {title}: {choice.name}
          </h4>
          {choice.description && (
            <p className="dvtt-note">{choice.description}</p>
          )}
          <select
            aria-label={choice.name}
            value={picks[choice.id] ?? ""}
            onChange={(e) => {
              const next = { ...picks };
              if (e.target.value) next[choice.id] = e.target.value;
              else delete next[choice.id];
              setPicks(next);
            }}
          >
            <option value="">Choose…</option>
            {choice.options.map((option) => (
              <option
                key={option.id}
                value={option.id}
                title={option.description}
              >
                {option.name}
              </option>
            ))}
          </select>
        </div>
      ))}
    </>
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

/** Ids of the feature choices active for a class/subclass pair at a level. */
function activeChoiceIds(
  charClass: ClassData | null,
  subclass: SubclassData | null,
  level: number,
): Set<string> {
  return new Set(
    [
      ...(charClass?.featureChoices ?? []),
      ...(subclass?.featureChoices ?? []),
    ]
      .filter((c) => c.level <= level)
      .map((c) => c.id),
  );
}

/** Drop feature picks whose choice no longer applies. */
function prunePicks(
  picks: Record<string, string[]>,
  keep: Set<string>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(picks).filter(([id]) => keep.has(id)),
  );
}

function ClassStep({
  draft,
  update,
  classes,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
  classes: ClassData[];
}) {
  const selectClass = (charClass: ClassData) =>
    // Reset picks that depend on the class: skills, ASI points, subclass,
    // feature picks, and equipment (defaulting each to its first option).
    update({
      charClass,
      classSkills: [],
      asiBonuses: {},
      asiFeats: {},
      subclass: null,
      featurePicks: {},
      equipmentChoices: charClass.equipment.choices.map(() => 0),
    });

  // The input keeps its own text so erasing shows an empty field instead of
  // snapping to 0 (T-25); the draft holds the last valid level meanwhile,
  // and leaving the field restores it.
  const [levelText, setLevelText] = useState(String(draft.level));

  const setLevel = (level: number) => {
    // Dropping below the subclass level clears the subclass; feature picks
    // are pruned to the choices still active at the new level.
    const stillUnlocked =
      !!draft.charClass &&
      draft.charClass.subclassLevel !== undefined &&
      level >= draft.charClass.subclassLevel;
    const subclass = stillUnlocked ? draft.subclass : null;
    update({
      level,
      asiBonuses: {},
      asiFeats: {},
      subclass,
      featurePicks: prunePicks(
        draft.featurePicks,
        activeChoiceIds(draft.charClass, subclass, level),
      ),
    });
  };

  return (
    <div>
      <h3>Class</h3>
      <label className="dvtt-field dvtt-field--narrow">
        <span>Starting level (1–{MAX_LEVEL})</span>
        <input
          type="number"
          min={1}
          max={MAX_LEVEL}
          value={levelText}
          onChange={(e) => {
            const text = e.target.value;
            setLevelText(text);
            const value = Number(text);
            if (
              text !== "" &&
              Number.isInteger(value) &&
              value >= 1 &&
              value <= MAX_LEVEL
            ) {
              setLevel(value);
            }
          }}
          onBlur={() => setLevelText(String(draft.level))}
        />
      </label>
      <div className="dvtt-cards">
        {classes.map((c) => (
          <button
            key={c.id}
            className={`dvtt-card${draft.charClass?.id === c.id ? " is-selected" : ""}`}
            onClick={() => selectClass(c)}
          >
            <div className="dvtt-card__title">
              {c.name}
              <span className="dvtt-card__edition">
                {c.edition === "2024" ? "5.5e (2024)" : "5e (2014)"}
              </span>
            </div>
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
              {c.features
                .filter((f) => f.level === 1)
                .map((f) => f.name)
                .join(", ")}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Subclass plus the feature choices owed at the starting level: fighting
 * styles, pact boons, weapon mastery… Expertise choices are the exception —
 * they render on the Skills step, since they pick from the skills chosen
 * there.
 */
function ClassOptionsStep({
  draft,
  update,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
}) {
  const charClass = draft.charClass;
  const choices = activeFeatureChoices(draft).filter(
    (c) => c.kind !== "expertise",
  );

  if (!charClass) {
    return (
      <div>
        <h3>Class options</h3>
        <p className="dvtt-note">Choose a class first.</p>
      </div>
    );
  }

  const selectSubclass = (subclass: SubclassData) =>
    update({
      subclass,
      featurePicks: prunePicks(
        draft.featurePicks,
        activeChoiceIds(charClass, subclass, draft.level),
      ),
    });

  const hasSubclassSection = charClass.subclasses.length > 0;

  return (
    <div>
      <h3>Class options</h3>

      {hasSubclassSection && (
        <div className="dvtt-choice-group">
          <h4>{charClass.name} subclass</h4>
          {subclassRequired(draft) ? (
            <div className="dvtt-cards">
              {charClass.subclasses.map((s) => (
                <button
                  key={s.id}
                  className={`dvtt-card${draft.subclass?.id === s.id ? " is-selected" : ""}`}
                  onClick={() => selectSubclass(s)}
                >
                  <div className="dvtt-card__title">{s.name}</div>
                  <div className="dvtt-card__detail">
                    {s.features.map((f) => `${f.name} (${f.level})`).join(", ")}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="dvtt-note">
              Unlocks at level {charClass.subclassLevel} — start at that level
              or pick it up when levelling.
            </p>
          )}
        </div>
      )}

      {choices.length === 0 && !subclassRequired(draft) && (
        <p className="dvtt-note">
          Nothing else to choose for a level {draft.level} {charClass.name}.
        </p>
      )}

      {choices.map((choice) => (
        <FeatureChoiceGroup
          key={choice.id}
          draft={draft}
          update={update}
          choice={choice}
        />
      ))}

      <GrantedProficiencies charClass={charClass} />
      <GrantedFeatureList
        charClass={charClass}
        subclass={subclassRequired(draft) ? draft.subclass : null}
        level={draft.level}
      />
    </div>
  );
}

/** Armor/weapon/tool proficiencies the class grants — display only, not a pick. */
function GrantedProficiencies({ charClass }: { charClass: ClassData }) {
  const groups = (
    [
      ["Armor", charClass.proficiencies.armor],
      ["Weapons", charClass.proficiencies.weapons],
      ["Tools", charClass.proficiencies.tools],
    ] as const
  ).filter(([, list]) => list.length > 0);
  if (groups.length === 0) return null;

  return (
    <div className="dvtt-choice-group">
      <h4>Proficiencies — granted</h4>
      {groups.map(([label, list]) => (
        <div className="dvtt-prof-group" key={label}>
          <span className="dvtt-prof-group__label">{label}</span>
          <span className="dvtt-chips">
            {list.map((entry) => (
              <span className="dvtt-chip" key={entry}>
                {entry}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Read-only progression detail: every class/subclass feature the starting
 * level grants (scaling tiers collapsed to the level's tier), plus scaling
 * resource pools at their current row. Choices are made above; grants are
 * shown, never picked.
 */
function GrantedFeatureList({
  charClass,
  subclass,
  level,
}: {
  charClass: ClassData;
  subclass: SubclassData | null;
  level: number;
}) {
  const granted = grantedClassFeatures(charClass, subclass, level);
  if (granted.length === 0 && charClass.resources.length === 0) return null;

  const resources = charClass.resources.flatMap((resource) => {
    const row = [...resource.levels]
      .filter((r) => r.level <= level)
      .sort((a, b) => a.level - b.level)
      .pop();
    return row ? [{ resource, row }] : [];
  });

  return (
    <div className="dvtt-choice-group">
      <h4>
        Features — granted at level {level}
        {subclass ? ` (${charClass.name} · ${subclass.name})` : ""}
      </h4>
      {resources.length > 0 && (
        <div className="dvtt-chips">
          {resources.map(({ resource, row }) => (
            <span className="dvtt-chip" key={resource.id}>
              {resource.name}:{" "}
              {row.uses === "unlimited" ? "unlimited" : `${row.uses}`} per{" "}
              {resource.per === "long-rest" ? "long rest" : "short rest"}
              {row.note ? ` · ${row.note}` : ""}
            </span>
          ))}
        </div>
      )}
      <ul className="dvtt-granted-features">
        {granted.map(({ source, feature }) => (
          <li key={`${source}-${feature.name}`}>
            <details className="dvtt-granted-feature">
              <summary>
                <span className="dvtt-granted-feature__level">
                  Lv {feature.level}
                </span>
                <span className="dvtt-granted-feature__name">
                  {feature.name}
                </span>
                {source !== charClass.name && (
                  <span className="dvtt-granted-feature__source">{source}</span>
                )}
              </summary>
              {feature.description && (
                <p className="dvtt-granted-feature__body">
                  {feature.description}
                </p>
              )}
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One feature choice as a picker group (radio for count 1, else checkboxes). */
function FeatureChoiceGroup({
  draft,
  update,
  choice,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
  choice: FeatureChoice;
}) {
  const picks = draft.featurePicks[choice.id] ?? [];

  const setPicks = (next: string[]) =>
    update({
      featurePicks: { ...draft.featurePicks, [choice.id]: next },
    });

  const toggle = (value: string) =>
    setPicks(
      picks.includes(value)
        ? picks.filter((v) => v !== value)
        : [...picks, value],
    );

  return (
    <div className="dvtt-choice-group">
      <h4>
        {choice.name} — level {choice.level} ({picks.length}/{choice.count})
      </h4>
      {choice.description && <p className="dvtt-note">{choice.description}</p>}

      {choice.kind === "options" && (
        <div className="dvtt-checkboxes">
          {choice.options.map((option) => {
            const checked = picks.includes(option.name);
            return (
              <label key={option.name} title={option.description}>
                <input
                  type={choice.count === 1 ? "radio" : "checkbox"}
                  name={`dvtt-choice-${choice.id}`}
                  checked={checked}
                  disabled={
                    !checked &&
                    choice.count > 1 &&
                    picks.length >= choice.count
                  }
                  onChange={() =>
                    choice.count === 1 ? setPicks([option.name]) : toggle(option.name)
                  }
                />
                {option.name}
              </label>
            );
          })}
        </div>
      )}

      {choice.kind === "skills" && (
        <SkillPickGrid
          draft={draft}
          choice={choice}
          picks={picks as Skill[]}
          pool={
            choice.from === "any" ? (Object.keys(SKILLS) as Skill[]) : choice.from
          }
          toggle={toggle}
        />
      )}

      {choice.kind === "expertise" && (
        <ExpertisePickGrid
          draft={draft}
          choice={choice}
          picks={picks as Skill[]}
          toggle={toggle}
        />
      )}
    </div>
  );
}

/** New skill proficiencies from a feature choice: dedupe against every other source. */
function SkillPickGrid({
  draft,
  choice,
  picks,
  pool,
  toggle,
}: {
  draft: CharacterDraft;
  choice: FeatureChoice;
  picks: Skill[];
  pool: Skill[];
  toggle: (skill: Skill) => void;
}) {
  const takenElsewhere = new Set<Skill>(
    draftProficientSkills(draft).filter((s) => !picks.includes(s)),
  );
  return (
    <div className="dvtt-checkboxes">
      {pool
        // Taken in another list → removed here (T-28), symmetric across grids.
        .filter((skill) => !takenElsewhere.has(skill))
        .map((skill) => {
          const checked = picks.includes(skill);
          return (
            <label key={skill}>
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && picks.length >= choice.count}
                onChange={() => toggle(skill)}
              />
              {humanizeSkill(skill)}
            </label>
          );
        })}
    </div>
  );
}

/** Expertise picks: only skills the draft is already proficient in qualify. */
function ExpertisePickGrid({
  draft,
  choice,
  picks,
  toggle,
}: {
  draft: CharacterDraft;
  choice: FeatureChoice;
  picks: Skill[];
  toggle: (skill: Skill) => void;
}) {
  const pool = [...new Set(draftProficientSkills(draft))];
  // Skills claimed by the *other* expertise choice (e.g. rogue level 6).
  const claimedElsewhere = new Set(
    activeFeatureChoices(draft)
      .filter((c) => c.kind === "expertise" && c.id !== choice.id)
      .flatMap((c) => draft.featurePicks[c.id] ?? []),
  );
  if (pool.length === 0) {
    return (
      <p className="dvtt-note">
        Pick your skills first — expertise upgrades skills you are proficient
        in.
      </p>
    );
  }
  return (
    <div className="dvtt-checkboxes">
      {pool.map((skill) => {
        const checked = picks.includes(skill);
        return (
          <label key={skill}>
            <input
              type="checkbox"
              checked={checked}
              disabled={
                !checked &&
                (claimedElsewhere.has(skill) || picks.length >= choice.count)
              }
              onChange={() => toggle(skill)}
            />
            {humanizeSkill(skill)}
          </label>
        );
      })}
    </div>
  );
}

function BackgroundStep({
  draft,
  update,
  backgrounds,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
  backgrounds: BackgroundData[];
}) {
  const selectBackground = (background: BackgroundData) =>
    update({
      background,
      bonusSkills: [],
      backgroundName: "",
      backgroundOptions: {},
    });

  return (
    <div>
      <h3>Background</h3>
      <div className="dvtt-cards">
        {backgrounds.map((bg) => (
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

      {draft.background && (
        <GrantedLanguagesTools entity={draft.background} />
      )}

      {draft.background && (
        <OptionChoicePickers
          title={draft.background.name}
          choices={draft.background.optionChoices}
          picks={draft.backgroundOptions}
          setPicks={(backgroundOptions) => update({ backgroundOptions })}
        />
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
  feats,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
  method: AbilityMethod;
  switchMethod: (m: AbilityMethod) => void;
  assignments: Record<Ability, number | null>;
  assignStandard: (ability: Ability, value: number | null) => void;
  feats: FeatData[];
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
          // Label increases by where they actually came from (T-26): racial
          // bonuses (fixed + chosen) and ASI points are separate things.
          const racialDelta =
            (draft.race?.fixedBonuses[ability] ?? 0) +
            (draft.race?.bonusChoice &&
            draft.racialBonusAbilities.includes(ability)
              ? draft.race.bonusChoice.amount
              : 0);
          const asiDelta = draft.asiBonuses[ability] ?? 0;
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
                {(racialDelta > 0 || asiDelta > 0) && (
                  <span className="dvtt-ability-row__racial">
                    {[
                      racialDelta > 0 ? `+${racialDelta} racial` : null,
                      asiDelta > 0 ? `+${asiDelta} ASI` : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}{" "}
                    →
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

      {draft.charClass &&
        earnedAsiLevels(draft.charClass, draft.level).length > 0 && (
          <AsiPicker draft={draft} update={update} feats={feats} />
        )}

      {draft.charClass && <HpModePicker draft={draft} update={update} />}
    </div>
  );
}

/**
 * Hit-point mode (T-07): the fixed average (default) or dice rolled per
 * level above 1st, with visible results and a reroll button. Level 1 is
 * always the full hit die; CON applies each level (minimum 1 per level).
 */
function HpModePicker({
  draft,
  update,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
}) {
  const charClass = draft.charClass;
  if (!charClass) return null;
  const conMod = abilityModifier(finalAbilityScores(draft).con);
  const needed = hpRollsNeeded(draft.level);
  const rollsValid =
    draft.hpRolls.length === needed &&
    draft.hpRolls.every((r) => r >= 1 && r <= charClass.hitDie);
  const total =
    draft.hpMode === "rolled"
      ? rollsValid
        ? startingHp(charClass.hitDie, conMod, draft.level, draft.hpRolls)
        : null
      : startingHp(charClass.hitDie, conMod, draft.level);

  // Bumped on every roll so the chips remount and their tumble animation
  // replays even when a die lands on the same number (T-27).
  const [rollSeq, setRollSeq] = useState(0);

  const reroll = () => {
    setRollSeq((seq) => seq + 1);
    update({ hpRolls: rollDice(needed, charClass.hitDie) });
  };

  return (
    <div className="dvtt-choice-group">
      <h4>Hit points</h4>
      <div className="dvtt-method-picker">
        <label>
          <input
            type="radio"
            name="dvtt-hp-mode"
            checked={draft.hpMode === "average"}
            onChange={() => update({ hpMode: "average", hpRolls: [] })}
          />
          Average ({Math.floor(charClass.hitDie / 2) + 1} per level after 1st)
        </label>
        <label>
          <input
            type="radio"
            name="dvtt-hp-mode"
            checked={draft.hpMode === "rolled"}
            onChange={() => {
              setRollSeq((seq) => seq + 1);
              update({
                hpMode: "rolled",
                hpRolls: rollDice(needed, charClass.hitDie),
              });
            }}
          />
          Rolled (d{charClass.hitDie} per level after 1st)
        </label>
      </div>
      {draft.hpMode === "rolled" && (
        <div className="dvtt-hp-rolls">
          <span className="dvtt-chips">
            <span className="dvtt-chip">
              Level 1: {charClass.hitDie} (max)
            </span>
            {draft.hpRolls.map((roll, i) => (
              <span
                className="dvtt-chip dvtt-roll-pop"
                key={`${rollSeq}-${i}`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                Level {i + 2}: {roll}
              </span>
            ))}
          </span>
          {needed > 0 && (
            <button type="button" onClick={reroll}>
              Reroll
            </button>
          )}
        </div>
      )}
      <p className="dvtt-note">
        {total !== null
          ? `Max HP at level ${draft.level}: ${total} (CON ${formatModifier(conMod)} per level, minimum 1).`
          : "Roll your hit points."}
      </p>
    </div>
  );
}

/**
 * Ability Score Improvements for characters starting above the class's first
 * ASI level. Each earned improvement is its own "+2 points or a feat" choice
 * (T-04); the point pool below covers the improvements left on points, with
 * no score above 20.
 */
function AsiPicker({
  draft,
  update,
  feats,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
  feats: FeatData[];
}) {
  const total = asiPointsTotal(draft);
  const spent = asiPointsSpent(draft);
  const finals = finalAbilityScores(draft);
  const levels = draft.charClass
    ? earnedAsiLevels(draft.charClass, draft.level)
    : [];

  const adjust = (ability: Ability, delta: number) => {
    const current = draft.asiBonuses[ability] ?? 0;
    update({
      asiBonuses: { ...draft.asiBonuses, [ability]: current + delta },
    });
  };

  const setMode = (level: number, useFeat: boolean) => {
    const asiFeats = { ...draft.asiFeats };
    if (useFeat) asiFeats[level] = asiFeats[level] ?? null;
    else delete asiFeats[level];
    // The pool shrinks when a level flips to a feat; drop assigned points
    // that no longer fit rather than leaving an over-spent pool.
    const newTotal = 2 * Math.max(0, levels.length - Object.keys(asiFeats).length);
    update({
      asiFeats,
      ...(asiPointsSpent(draft) > newTotal ? { asiBonuses: {} } : {}),
    });
  };

  const pickFeat = (level: number, featId: string) => {
    const feat = feats.find((f) => f.id === featId) ?? null;
    update({ asiFeats: { ...draft.asiFeats, [level]: feat } });
  };

  const takenFeatIds = new Set(
    Object.values(draft.asiFeats)
      .filter((f): f is FeatData => f !== null)
      .map((f) => f.id),
  );

  return (
    <div className="dvtt-choice-group">
      <h4>
        Ability score improvements — level {draft.level}{" "}
        {draft.charClass?.name} ({spent}/{total} points)
      </h4>

      {feats.length > 0 && (
        <div className="dvtt-asi-levels">
          {levels.map((level) => {
            const isFeat = level in draft.asiFeats;
            const picked = draft.asiFeats[level];
            return (
              <div className="dvtt-asi-level" key={level}>
                <span className="dvtt-asi-level__name">Level {level}</span>
                <label>
                  <input
                    type="radio"
                    name={`dvtt-asi-mode-${level}`}
                    checked={!isFeat}
                    onChange={() => setMode(level, false)}
                  />
                  +2 points
                </label>
                <label>
                  <input
                    type="radio"
                    name={`dvtt-asi-mode-${level}`}
                    checked={isFeat}
                    onChange={() => setMode(level, true)}
                  />
                  Feat
                </label>
                {isFeat && (
                  <select
                    aria-label={`Feat for level ${level}`}
                    value={picked?.id ?? ""}
                    onChange={(e) => pickFeat(level, e.target.value)}
                  >
                    <option value="">Choose a feat…</option>
                    {feats.map((feat) => (
                      <option
                        key={feat.id}
                        value={feat.id}
                        title={feat.description}
                        disabled={
                          feat.id !== picked?.id && takenFeatIds.has(feat.id)
                        }
                      >
                        {feat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <div className="dvtt-checkboxes">
          {ABILITIES.map((ability) => {
            const points = draft.asiBonuses[ability] ?? 0;
            return (
              <span className="dvtt-asi-row" key={ability}>
                <span className="dvtt-asi-row__name">
                  {ABILITY_LABELS[ability]}
                </span>
                <button disabled={points <= 0} onClick={() => adjust(ability, -1)}>
                  −
                </button>
                <span className="dvtt-asi-row__points">+{points}</span>
                <button
                  disabled={spent >= total || finals[ability] >= ABILITY_SCORE_CAP}
                  onClick={() => adjust(ability, 1)}
                >
                  +
                </button>
              </span>
            );
          })}
        </div>
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
    ...featureSkillPicks(draft),
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
            {classOptions
              // A skill taken in any other list is removed here (T-28) —
              // and vice versa, since every grid filters on the same set.
              .filter(
                (skill) =>
                  draft.classSkills.includes(skill) || !taken.has(skill),
              )
              .map((skill) => {
                const checked = draft.classSkills.includes(skill);
                return (
                  <label key={skill}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={
                        !checked &&
                        draft.classSkills.length >= classChoice.count
                      }
                      onChange={() => toggleIn("classSkills", skill)}
                    />
                    {humanizeSkill(skill)}
                  </label>
                );
              })}
          </div>
          <p className="dvtt-note">
            Skills granted or chosen elsewhere are not listed.
          </p>
        </div>
      )}

      {bonusNeeded > 0 && (
        <div className="dvtt-choice-group">
          <h4>
            Additional skills — any ({draft.bonusSkills.length}/{bonusNeeded})
          </h4>
          <div className="dvtt-checkboxes">
            {(Object.keys(SKILLS) as Skill[])
              .filter(
                (skill) =>
                  draft.bonusSkills.includes(skill) || !taken.has(skill),
              )
              .map((skill) => {
                const checked = draft.bonusSkills.includes(skill);
                return (
                  <label key={skill}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={
                        !checked && draft.bonusSkills.length >= bonusNeeded
                      }
                      onChange={() => toggleIn("bonusSkills", skill)}
                    />
                    {humanizeSkill(skill)}
                  </label>
                );
              })}
          </div>
          <p className="dvtt-note">
            Skills granted or chosen elsewhere are not listed.
          </p>
        </div>
      )}

      {/* Expertise picks live here — their pool is the skills chosen above. */}
      {activeFeatureChoices(draft)
        .filter((c) => c.kind === "expertise")
        .map((choice) => (
          <FeatureChoiceGroup
            key={choice.id}
            draft={draft}
            update={update}
            choice={choice}
          />
        ))}
    </div>
  );
}

function EquipmentStep({
  draft,
  update,
}: {
  draft: CharacterDraft;
  update: (p: Partial<CharacterDraft>) => void;
}) {
  const charClass = draft.charClass;
  const granted = [
    ...(charClass?.equipment.fixed ?? []),
    ...(draft.background?.equipment ?? []),
  ];

  const pick = (choiceIndex: number, optionIndex: number) => {
    const next = [...draft.equipmentChoices];
    next[choiceIndex] = optionIndex;
    update({ equipmentChoices: next });
  };

  const goldFormula = charClass?.startingGold;
  // Remount the gold figure per roll so the tumble replays (T-27).
  const [rollSeq, setRollSeq] = useState(0);
  const rollGoldNow = () => {
    if (!goldFormula) return;
    setRollSeq((seq) => seq + 1);
    update({ equipmentMode: "gold", goldRoll: rollGold(goldFormula) });
  };

  return (
    <div>
      <h3>Starting equipment</h3>

      {goldFormula && (
        <div className="dvtt-method-picker">
          <label>
            <input
              type="radio"
              name="dvtt-equipment-mode"
              checked={draft.equipmentMode === "package"}
              onChange={() =>
                update({ equipmentMode: "package", goldRoll: null })
              }
            />
            Equipment package
          </label>
          <label>
            <input
              type="radio"
              name="dvtt-equipment-mode"
              checked={draft.equipmentMode === "gold"}
              onChange={rollGoldNow}
            />
            Take starting gold instead ({goldRollLabel(goldFormula)})
          </label>
        </div>
      )}

      {draft.equipmentMode === "gold" && goldFormula && (
        <div className="dvtt-choice-group">
          <h4>Starting gold</h4>
          <p>
            You rolled{" "}
            <strong className="dvtt-roll-pop" key={rollSeq}>
              {draft.goldRoll ?? "—"} gp
            </strong>{" "}
            — it lands in your inventory as "Gold (gp)"; buy gear during
            play. This replaces the class package, its choices, and the
            background gear.
          </p>
          <button type="button" onClick={rollGoldNow}>
            Reroll
          </button>
        </div>
      )}

      {draft.equipmentMode === "package" && granted.length > 0 && (
        <div className="dvtt-choice-group">
          <h4>Granted by class & background</h4>
          <div className="dvtt-chips">
            {granted.map((item, i) => (
              <span className="dvtt-chip" key={`${item.name}-${i}`}>
                {bundleLabel([item])}
              </span>
            ))}
          </div>
        </div>
      )}

      {draft.equipmentMode === "package" &&
        charClass?.equipment.choices.map((choice, choiceIndex) => (
        <div className="dvtt-choice-group" key={choiceIndex}>
          <h4>Choice {choiceIndex + 1}</h4>
          <div className="dvtt-checkboxes">
            {choice.options.map((bundle, optionIndex) => (
              <label key={optionIndex}>
                <input
                  type="radio"
                  name={`dvtt-equipment-${choiceIndex}`}
                  checked={draft.equipmentChoices[choiceIndex] === optionIndex}
                  onChange={() => pick(choiceIndex, optionIndex)}
                />
                {bundleLabel(bundle)}
              </label>
            ))}
          </div>
        </div>
      ))}
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
        {character.name} — Level {totalLevel(character)} {character.race}{" "}
        {character.classes[0]?.name}
        {character.classes[0]?.subclass
          ? ` (${character.classes[0].subclass})`
          : ""}
      </h3>
      <p className="dvtt-review__subtitle">{character.background}</p>
      <div className="dvtt-topline">
        <ReviewStat label="HP" value={character.maxHp} />
        <ReviewStat label="AC" value={armorClass(character)} />
        <ReviewStat label="Speed" value={`${character.speed} ft`} />
        <ReviewStat
          label="Prof. bonus"
          value={formatModifier(proficiencyBonus(totalLevel(character)))}
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
        {Object.entries(character.skills)
          .map(
            ([skill, level]) =>
              humanizeSkill(skill) +
              (level === "expertise" ? " (expertise)" : ""),
          )
          .join(", ") || "none"}
      </p>
      <p>
        <strong>Saving throws:</strong>{" "}
        {Object.keys(character.savingThrows)
          .map((a) => ABILITY_LABELS[a as Ability])
          .join(", ")}
      </p>
      <p>
        <strong>Equipment:</strong>{" "}
        {character.inventory
          .map((item) =>
            item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name,
          )
          .join(", ") || "none"}
      </p>
      {character.features.length > 0 && (
        <div className="dvtt-choice-group">
          <h4>Features & traits</h4>
          <ul className="dvtt-features">
            {character.features.map((f) => (
              <li key={f.id}>
                <strong>{f.name}</strong>
                <span className="dvtt-feature__source">
                  {" "}
                  ({f.source}
                  {f.level !== undefined ? `, level ${f.level}` : ""})
                </span>
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
