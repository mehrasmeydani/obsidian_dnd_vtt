// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { CharacterSchema, type Character } from "../model/schema";
import { CharacterCreationWizard } from "./CharacterCreationWizard";

/**
 * End-to-end regression for the creation wizard: walk every step as a user
 * would and assert the completed character. Guards the step gating, the
 * choice widgets, and the wiring between the UI and the rules layer.
 */

beforeAll(() => {
  // jsdom lacks crypto.randomUUID; the wizard uses it for the character id.
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: () => "test-uuid" },
      configurable: true,
    });
  }
});

afterEach(cleanup);

function nextButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;
}

/** The .dvtt-choice-group whose heading matches, for scoped queries. */
function choiceGroup(heading: RegExp) {
  const group = screen.getByText(heading).parentElement;
  if (!group) throw new Error(`No choice group for ${heading}`);
  return within(group);
}

describe("CharacterCreationWizard", () => {
  it("creates a hill dwarf fighter acolyte via the standard array", () => {
    const onComplete = vi.fn<(c: Character) => void>();
    render(
      <CharacterCreationWizard onComplete={onComplete} onCancel={() => {}} />,
    );

    // Step 1: name & race. Next stays disabled — with an explanation — until
    // both are set.
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByText("Enter a character name.")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Borin" },
    });
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByText("Select a race.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Hill Dwarf/ }));
    expect(screen.queryByText("Select a race.")).toBeNull();
    // The dwarf's artisan-tool pick (T-08) still gates the step.
    expect(nextButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Tool proficiency"), {
      target: { value: "smiths-tools" },
    });
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    // Step 2: class.
    fireEvent.click(screen.getByRole("button", { name: /^Fighter/ }));
    fireEvent.click(nextButton());

    // Step 3: class options — subclass is still locked at level 1, but the
    // fighter owes a Fighting Style.
    expect(screen.getByText(/Unlocks at level 3/)).toBeTruthy();
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByText(/Choose 1 option for Fighting Style/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Defense"));
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    // Step 4: background.
    fireEvent.click(screen.getByRole("button", { name: /^Acolyte/ }));
    fireEvent.change(screen.getByLabelText("Extra language (1)"), {
      target: { value: "abyssal" },
    });
    fireEvent.change(screen.getByLabelText("Extra language (2)"), {
      target: { value: "celestial" },
    });
    fireEvent.click(nextButton());

    // Step 5: abilities — assign the standard array (rows are STR..CHA).
    expect(nextButton().disabled).toBe(true);
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(6);
    const assignment = [15, 13, 14, 8, 12, 10]; // str dex con int wis cha
    assignment.forEach((value, i) => {
      fireEvent.change(selects[i], { target: { value: String(value) } });
    });
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    // Step 6: skills — acolyte's granted skills show as chips, not choices.
    expect(choiceGroup(/Granted by race/).getByText("Insight")).toBeTruthy();
    expect(nextButton().disabled).toBe(true);
    const classGroup = choiceGroup(/Fighter skills/);
    fireEvent.click(classGroup.getByLabelText("Athletics"));
    fireEvent.click(classGroup.getByLabelText("Perception"));
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    // Step 7: equipment — defaults are pre-selected; swap one choice.
    expect(screen.getByText("Vestments")).toBeTruthy(); // acolyte gear
    expect(
      (screen.getByLabelText("Chain mail") as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(screen.getByLabelText("Greatsword"));
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    // Step 8: review shows derived stats, then create.
    expect(screen.getByText(/Level 1 Hill Dwarf Fighter/)).toBeTruthy();
    expect(screen.getByText(/Fighting Style: Defense/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create character" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const character = onComplete.mock.calls[0][0];
    expect(CharacterSchema.safeParse(character).success).toBe(true);
    expect(character.name).toBe("Borin");
    expect(character.race).toBe("Hill Dwarf");
    expect(character.background).toBe("Acolyte");
    // con 14 + racial 2 = 16 (mod +3), fighter d10 => 13 HP
    expect(character.maxHp).toBe(13);
    expect(character.skills).toEqual({
      insight: "proficient",
      religion: "proficient",
      athletics: "proficient",
      perception: "proficient",
    });
    const gear = character.inventory.map((i) => i.name);
    expect(gear).toContain("Chain mail"); // default kept
    expect(gear).toContain("Greatsword"); // swapped pick
    expect(gear).not.toContain("Longsword");
    expect(gear).toContain("Vestments");
  });

  it("gates ability score improvements for higher starting levels", () => {
    render(
      <CharacterCreationWizard onComplete={vi.fn()} onCancel={() => {}} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Borin" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Hill Dwarf/ }));
    fireEvent.change(screen.getByLabelText("Tool proficiency"), {
      target: { value: "smiths-tools" },
    });
    fireEvent.click(nextButton());

    // Level 4 fighter: one ASI = two +1 points to assign.
    fireEvent.click(screen.getByRole("button", { name: /^Fighter/ }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "4" } });
    fireEvent.click(nextButton());

    // Class options: the level-3 subclass is now owed alongside the style.
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByText(/Choose a Fighter subclass/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Champion/ }));
    fireEvent.click(screen.getByLabelText("Archery"));
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    fireEvent.click(screen.getByRole("button", { name: /^Acolyte/ }));
    fireEvent.change(screen.getByLabelText("Extra language (1)"), {
      target: { value: "abyssal" },
    });
    fireEvent.change(screen.getByLabelText("Extra language (2)"), {
      target: { value: "celestial" },
    });
    fireEvent.click(nextButton());

    const selects = screen.getAllByRole("combobox");
    [15, 13, 14, 8, 12, 10].forEach((value, i) => {
      fireEvent.change(selects[i], { target: { value: String(value) } });
    });

    // Scores assigned but ASI points not: still blocked, with a hint.
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByText(/Assign 2 more improvement points/)).toBeTruthy();

    const asiGroup = choiceGroup(/Ability score improvements/);
    const plusButtons = asiGroup.getAllByRole("button", { name: "+" });
    fireEvent.click(plusButtons[0]); // STR +1
    fireEvent.click(plusButtons[2]); // CON +1
    expect(nextButton().disabled).toBe(false);

    // Flip the level-4 improvement to a feat (T-04): the assigned points no
    // longer fit the shrunken pool and are dropped; a pick is now owed.
    const levelRow = asiGroup.getByText("Level 4").parentElement!;
    fireEvent.click(within(levelRow).getByLabelText("Feat"));
    expect(nextButton().disabled).toBe(true);
    expect(
      screen.getByText("Choose a feat for the level-4 improvement."),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Feat for level 4"), {
      target: { value: "grappler" },
    });
    expect(nextButton().disabled).toBe(false);

    // Flipping back to points re-opens the 2-point pool.
    fireEvent.click(within(levelRow).getByLabelText("+2 points"));
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByText(/Assign 2 more improvement points/)).toBeTruthy();
  });

  it("allows jumping between steps via the header once they are reachable", () => {
    render(
      <CharacterCreationWizard onComplete={vi.fn()} onCancel={() => {}} />,
    );
    const stepButton = (name: string) =>
      screen.getByRole("button", { name }) as HTMLButtonElement;

    // Nothing filled in: later steps are locked.
    expect(stepButton("Class").disabled).toBe(true);
    expect(stepButton("Review").disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Borin" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Hill Dwarf/ }));
    fireEvent.change(screen.getByLabelText("Tool proficiency"), {
      target: { value: "smiths-tools" },
    });

    // Step 1 is complete: Class unlocks, but steps beyond it stay locked.
    expect(stepButton("Class").disabled).toBe(false);
    expect(stepButton("Background").disabled).toBe(true);

    fireEvent.click(stepButton("Class"));
    fireEvent.click(screen.getByRole("button", { name: /^Fighter/ }));
    // Class options unlocks, but Background waits on the fighting style.
    expect(stepButton("Class options").disabled).toBe(false);
    expect(stepButton("Background").disabled).toBe(true);
    fireEvent.click(stepButton("Class options"));
    fireEvent.click(screen.getByLabelText("Defense"));
    expect(stepButton("Background").disabled).toBe(false);

    // Jump straight back to the first step — state is preserved.
    fireEvent.click(stepButton("Name & Race"));
    expect(
      (screen.getByPlaceholderText(/Borin/) as HTMLInputElement).value,
    ).toBe("Borin");
  });

  it("walks a level-3 rogue through subclass and expertise picks", () => {
    const onComplete = vi.fn<(c: Character) => void>();
    render(
      <CharacterCreationWizard onComplete={onComplete} onCancel={() => {}} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Merric" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Hill Dwarf/ }));
    fireEvent.change(screen.getByLabelText("Tool proficiency"), {
      target: { value: "smiths-tools" },
    });
    fireEvent.click(nextButton());

    // Level 3 rogue, then the class-options step owes the Thief archetype.
    fireEvent.click(screen.getByRole("button", { name: /^Rogue/ }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3" } });
    fireEvent.click(nextButton());
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByText(/Choose a Rogue subclass/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Thief/ }));
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    fireEvent.click(screen.getByRole("button", { name: /^Acolyte/ }));
    fireEvent.change(screen.getByLabelText("Extra language (1)"), {
      target: { value: "abyssal" },
    });
    fireEvent.change(screen.getByLabelText("Extra language (2)"), {
      target: { value: "celestial" },
    });
    fireEvent.click(nextButton());

    const selects = screen.getAllByRole("combobox");
    [10, 15, 14, 8, 12, 13].forEach((value, i) => {
      fireEvent.change(selects[i], { target: { value: String(value) } });
    });
    fireEvent.click(nextButton());

    // Skills: four rogue picks, then expertise from proficient skills only —
    // including the background-granted Insight.
    const classGroup = choiceGroup(/Rogue skills/);
    for (const skill of ["Stealth", "Acrobatics", "Deception", "Perception"]) {
      fireEvent.click(classGroup.getByLabelText(skill));
    }
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByText(/Choose 2 skills for Expertise/)).toBeTruthy();
    const expertiseGroup = choiceGroup(/Expertise — level 1/);
    fireEvent.click(expertiseGroup.getByLabelText("Stealth"));
    fireEvent.click(expertiseGroup.getByLabelText("Insight"));
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    // Equipment defaults, review, create.
    fireEvent.click(nextButton());
    expect(screen.getByText(/Level 3 Hill Dwarf Rogue \(Thief\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create character" }));

    const character = onComplete.mock.calls[0][0];
    expect(character.classes).toEqual([
      { name: "Rogue", level: 3, subclass: "Thief" },
    ]);
    expect(character.skills.stealth).toBe("expertise");
    expect(character.skills.insight).toBe("expertise");
    expect(character.skills.acrobatics).toBe("proficient");
    expect(character.features.map((f) => f.name)).toContain("Second-Story Work");
  });

  it("shows the granted progression and proficiencies on the Class options step", () => {
    render(
      <CharacterCreationWizard onComplete={vi.fn()} onCancel={() => {}} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Grok" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Human/ }));
    fireEvent.change(screen.getByLabelText("Extra language"), {
      target: { value: "elvish" },
    });
    fireEvent.click(nextButton());

    // Level 20 Barbarian (2014 — the 2024 variant is a separate card).
    fireEvent.click(screen.getByRole("button", { name: /Barbarian.*2014/ }));
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "20" },
    });
    fireEvent.click(nextButton());
    fireEvent.click(
      screen.getByRole("button", { name: /Path of the Berserker/ }),
    );

    // Granted proficiencies render as chips, not picks.
    const profGroup = choiceGroup(/Proficiencies — granted/);
    expect(profGroup.getByText("Martial weapons")).toBeTruthy();
    expect(profGroup.getByText("Medium armor")).toBeTruthy();

    // Full progression, read-only, with subclass features and level tags.
    const featureGroup = choiceGroup(/Features — granted at level 20/);
    expect(featureGroup.getByText("Primal Champion")).toBeTruthy();
    expect(featureGroup.getByText("Retaliation")).toBeTruthy();
    // Scaling features collapse to the level's tier: one Brutal Critical.
    expect(featureGroup.getAllByText("Brutal Critical")).toHaveLength(1);
    expect(
      featureGroup.getByText(/three additional weapon damage dice/),
    ).toBeTruthy();
    // The Rage pool shows the level-20 row.
    expect(
      featureGroup.getByText(/Rage: unlimited per long rest · \+4 rage damage/),
    ).toBeTruthy();

    // Dropping to level 4 trims the list to what is actually granted.
    fireEvent.click(screen.getByRole("button", { name: "Class" }));
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Class options" }));
    const trimmed = choiceGroup(/Features — granted at level 4/);
    expect(trimmed.getByText("Reckless Attack")).toBeTruthy();
    expect(trimmed.queryByText("Extra Attack")).toBeNull();
    expect(trimmed.getByText(/Rage: 3 per long rest/)).toBeTruthy();
  });

  it("gates the race step on option choices (dragonborn ancestry, T-05)", () => {
    render(
      <CharacterCreationWizard onComplete={vi.fn()} onCancel={() => {}} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Sora" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Dragonborn/ }));

    // Name and race set, but the ancestry pick still blocks the step.
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByText("Choose a Draconic Ancestry.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Draconic Ancestry"), {
      target: { value: "red" },
    });
    expect(nextButton().disabled).toBe(false);

    // Switching race clears the pick; the hill dwarf owes its own tool pick.
    fireEvent.click(screen.getByRole("button", { name: /Hill Dwarf/ }));
    expect(screen.queryByLabelText("Draconic Ancestry")).toBeNull();
    expect(nextButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Tool proficiency"), {
      target: { value: "smiths-tools" },
    });
    expect(nextButton().disabled).toBe(false);
  });

  it("supports races with bonus ability and skill choices (half-elf bard)", () => {
    const onComplete = vi.fn<(c: Character) => void>();
    render(
      <CharacterCreationWizard onComplete={onComplete} onCancel={() => {}} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Lyra" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Half-Elf/ }));
    fireEvent.change(screen.getByLabelText("Extra language"), {
      target: { value: "giant" },
    });
    fireEvent.click(nextButton());

    fireEvent.click(screen.getByRole("button", { name: /^Bard/ }));
    fireEvent.click(nextButton());

    // Class options: nothing is owed at level 1 (bard expertise comes at 3,
    // the college at 3 too).
    expect(screen.getByText(/Unlocks at level 3/)).toBeTruthy();
    expect(screen.getByText(/Nothing else to choose/)).toBeTruthy();
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    fireEvent.click(screen.getByRole("button", { name: /^Acolyte/ }));
    fireEvent.change(screen.getByLabelText("Extra language (1)"), {
      target: { value: "abyssal" },
    });
    fireEvent.change(screen.getByLabelText("Extra language (2)"), {
      target: { value: "celestial" },
    });
    fireEvent.click(nextButton());

    // Point buy: default all-8s is affordable, but the racial +1 picks still
    // gate the step.
    fireEvent.click(screen.getByLabelText("Point buy"));
    expect(nextButton().disabled).toBe(true);
    const racialGroup = choiceGroup(/Half-Elf: \+1 to 2 abilities/);
    fireEvent.click(racialGroup.getByLabelText("Dexterity"));
    fireEvent.click(racialGroup.getByLabelText("Constitution"));
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    // Bard: 3 class skills from any list; half-elf: 2 more from any. The same
    // skill appears in both groups, so scope the queries.
    const classGroup = choiceGroup(/Bard skills/);
    fireEvent.click(classGroup.getByLabelText("Athletics"));
    fireEvent.click(classGroup.getByLabelText("Performance"));
    fireEvent.click(classGroup.getByLabelText("Persuasion"));
    expect(nextButton().disabled).toBe(true);
    const bonusGroup = choiceGroup(/Additional skills/);
    fireEvent.click(bonusGroup.getByLabelText("Stealth"));
    fireEvent.click(bonusGroup.getByLabelText("Deception"));
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    // Equipment: bard defaults are valid as-is.
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    fireEvent.click(screen.getByRole("button", { name: "Create character" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    const character = onComplete.mock.calls[0][0];
    // cha 8 + racial 2 = 10; dex/con 8 + chosen 1 = 9
    expect(character.abilityScores.cha).toBe(10);
    expect(character.abilityScores.dex).toBe(9);
    expect(character.abilityScores.con).toBe(9);
    expect(character.spellcastingAbility).toBe("cha");
    expect(Object.keys(character.skills).sort()).toEqual(
      [
        "athletics",
        "deception",
        "insight",
        "performance",
        "persuasion",
        "religion",
        "stealth",
      ].sort(),
    );
  });
});
