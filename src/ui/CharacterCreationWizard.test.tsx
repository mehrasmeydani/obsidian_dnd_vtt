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

/** T-30: Next never blocks; incompleteness shows as the footer hint. */
function stepIncomplete(): boolean {
  return document.querySelector(".dvtt-wizard__hint") !== null;
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
    expect(stepIncomplete()).toBe(true);
    expect(screen.getByText("Enter a character name.")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Borin" },
    });
    expect(stepIncomplete()).toBe(true);
    expect(screen.getByText("Select a race.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Hill Dwarf/ }));
    expect(screen.queryByText("Select a race.")).toBeNull();
    // The dwarf's artisan-tool pick (T-08) still gates the step.
    expect(stepIncomplete()).toBe(true);
    fireEvent.change(screen.getByLabelText("Tool proficiency"), {
      target: { value: "smiths-tools" },
    });
    expect(stepIncomplete()).toBe(false);
    fireEvent.click(nextButton());

    // Step 2: class.
    fireEvent.click(screen.getByRole("button", { name: /Fighter.*2014/ }));
    fireEvent.click(nextButton());

    // Step 3: class options — subclass is still locked at level 1, but the
    // fighter owes a Fighting Style.
    expect(screen.getByText(/Unlocks at level 3/)).toBeTruthy();
    expect(stepIncomplete()).toBe(true);
    expect(screen.getByText(/Choose 1 option for Fighting Style/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Defense"));
    expect(stepIncomplete()).toBe(false);
    fireEvent.click(nextButton());

    // Step 4: background.
    fireEvent.click(screen.getByRole("button", { name: /Acolyte.*2014/ }));
    fireEvent.change(screen.getByLabelText("Extra language (1)"), {
      target: { value: "abyssal" },
    });
    fireEvent.change(screen.getByLabelText("Extra language (2)"), {
      target: { value: "celestial" },
    });
    fireEvent.click(nextButton());

    // Step 5: abilities — assign the standard array (rows are STR..CHA).
    expect(stepIncomplete()).toBe(true);
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(6);
    const assignment = [15, 13, 14, 8, 12, 10]; // str dex con int wis cha
    assignment.forEach((value, i) => {
      fireEvent.change(selects[i], { target: { value: String(value) } });
    });
    expect(stepIncomplete()).toBe(false);
    fireEvent.click(nextButton());

    // Step 6: skills — acolyte's granted skills show as chips, not choices.
    expect(choiceGroup(/Granted by race/).getByText("Insight")).toBeTruthy();
    expect(stepIncomplete()).toBe(true);
    const classGroup = choiceGroup(/Fighter skills/);
    fireEvent.click(classGroup.getByLabelText("Athletics"));
    fireEvent.click(classGroup.getByLabelText("Perception"));
    expect(stepIncomplete()).toBe(false);
    fireEvent.click(nextButton());

    // Step 7: equipment — defaults are pre-selected; swap one choice.
    expect(screen.getByText("Vestments")).toBeTruthy(); // acolyte gear
    expect(
      (screen.getByLabelText("Chain mail") as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(screen.getByLabelText("Greatsword"));
    expect(stepIncomplete()).toBe(false);
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

  it("shows edition badges and gates a 2024 background on its origin feat (T-17)", () => {
    render(
      <CharacterCreationWizard onComplete={vi.fn()} onCancel={() => {}} />,
    );

    // Step 1: same-named species across editions are told apart by a badge.
    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Korra" },
    });
    expect(
      screen.getAllByRole("button", { name: /^Human/ }).length,
    ).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: /Human.*2024/ }));
    fireEvent.click(nextButton());

    // Step 2: a 2024 class.
    fireEvent.click(screen.getByRole("button", { name: /Barbarian.*2024/ }));
    fireEvent.click(nextButton());

    // Step 3: class options — Next never blocks (T-30), so skip past.
    fireEvent.click(nextButton());

    // Step 4: a 2024 background owes an origin feat, which gates the step.
    fireEvent.click(screen.getByRole("button", { name: /Acolyte.*2024/ }));
    expect(
      screen.getByText("Choose an origin feat for your background."),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Origin feat"), {
      target: { value: "alert" },
    });
    expect(
      screen.queryByText("Choose an origin feat for your background."),
    ).toBeNull();
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
    fireEvent.click(screen.getByRole("button", { name: /Fighter.*2014/ }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "4" } });
    fireEvent.click(nextButton());

    // Class options: the level-3 subclass is now owed alongside the style.
    expect(stepIncomplete()).toBe(true);
    expect(screen.getByText(/Choose a Fighter subclass/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Champion/ }));
    fireEvent.click(screen.getByLabelText("Archery"));
    expect(stepIncomplete()).toBe(false);
    fireEvent.click(nextButton());

    fireEvent.click(screen.getByRole("button", { name: /Acolyte.*2014/ }));
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
    expect(stepIncomplete()).toBe(true);
    expect(screen.getByText(/Assign 2 more improvement points/)).toBeTruthy();

    const asiGroup = choiceGroup(/Ability score improvements/);
    const plusButtons = asiGroup.getAllByRole("button", { name: "+" });
    fireEvent.click(plusButtons[0]); // STR +1
    fireEvent.click(plusButtons[2]); // CON +1
    expect(stepIncomplete()).toBe(false);

    // Flip the level-4 improvement to a feat (T-04): the assigned points no
    // longer fit the shrunken pool and are dropped; a pick is now owed.
    const levelRow = asiGroup.getByText("Level 4").parentElement!;
    fireEvent.click(within(levelRow).getByLabelText("Feat"));
    expect(stepIncomplete()).toBe(true);
    expect(
      screen.getByText("Choose a feat for the level-4 improvement."),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Feat for level 4"), {
      target: { value: "grappler" },
    });
    expect(stepIncomplete()).toBe(false);

    // Flipping back to points re-opens the 2-point pool.
    fireEvent.click(within(levelRow).getByLabelText("+2 points"));
    expect(stepIncomplete()).toBe(true);
    expect(screen.getByText(/Assign 2 more improvement points/)).toBeTruthy();
  });

  it("empties the level field when erased instead of showing 0 (T-25)", () => {
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

    const level = () => screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(level(), { target: { value: "4" } });
    expect(level().value).toBe("4");

    // Erasing shows an empty field, not 0; the draft keeps the last level.
    fireEvent.change(level(), { target: { value: "" } });
    expect(level().value).toBe("");
    fireEvent.change(level(), { target: { value: "12" } });
    expect(level().value).toBe("12");

    // Leaving the field empty restores the draft's level.
    fireEvent.change(level(), { target: { value: "" } });
    fireEvent.blur(level());
    expect(level().value).toBe("12");
  });

  it("labels racial and ASI increases separately (T-26)", () => {
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

    // Level 4 fighter earns one ASI (2 points).
    fireEvent.click(screen.getByRole("button", { name: /Fighter.*2014/ }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "4" } });
    fireEvent.click(nextButton());
    fireEvent.click(screen.getByRole("button", { name: /^Champion/ }));
    fireEvent.click(screen.getByLabelText("Archery"));
    fireEvent.click(nextButton());
    fireEvent.click(screen.getByRole("button", { name: /Acolyte.*2014/ }));
    fireEvent.change(screen.getByLabelText("Extra language (1)"), {
      target: { value: "abyssal" },
    });
    fireEvent.change(screen.getByLabelText("Extra language (2)"), {
      target: { value: "celestial" },
    });
    fireEvent.click(nextButton());

    // Put both ASI points into STR: hill dwarf has no STR racial bonus, so
    // the row must say ASI, not racial.
    const asiGroup = choiceGroup(/Ability score improvements/);
    const plusButtons = asiGroup.getAllByRole("button", { name: "+" });
    fireEvent.click(plusButtons[0]);
    fireEvent.click(plusButtons[0]);

    const row = (name: string) =>
      screen
        .getAllByText(name)
        .map((el) => el.closest(".dvtt-ability-row"))
        .find((el): el is HTMLElement => el !== null)!;
    expect(row("Strength").textContent).toContain("+2 ASI");
    expect(row("Strength").textContent).not.toContain("racial");
    // CON keeps its racial +2 label (hill dwarf), with no ASI part.
    expect(row("Constitution").textContent).toContain("+2 racial");
    expect(row("Constitution").textContent).not.toContain("ASI");
  });

  it("removes a skill picked in one list from the other lists, both ways (T-28)", () => {
    render(
      <CharacterCreationWizard onComplete={vi.fn()} onCancel={() => {}} />,
    );
    // Half-elf (choose any 2) bard (choose any 3): two grids sharing skills.
    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Lyra" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Half-Elf/ }));
    fireEvent.change(screen.getByLabelText("Extra language"), {
      target: { value: "giant" },
    });
    fireEvent.click(nextButton());
    fireEvent.click(screen.getByRole("button", { name: /Bard.*2014/ }));
    fireEvent.click(nextButton());
    fireEvent.click(nextButton());
    fireEvent.click(screen.getByRole("button", { name: /Acolyte.*2014/ }));
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
    const racialGroup = choiceGroup(/Half-Elf: \+1 to 2 abilities/);
    fireEvent.click(racialGroup.getByLabelText("Dexterity"));
    fireEvent.click(racialGroup.getByLabelText("Constitution"));
    fireEvent.click(nextButton());

    const classGroup = () => choiceGroup(/Bard skills/);
    const bonusGroup = () => choiceGroup(/Additional skills/);

    // Forward: pick in the class list → gone from the additional list.
    fireEvent.click(classGroup().getByLabelText("Animal Handling"));
    expect(bonusGroup().queryByLabelText("Animal Handling")).toBeNull();
    // Unchecking brings it back.
    fireEvent.click(classGroup().getByLabelText("Animal Handling"));
    expect(bonusGroup().getByLabelText("Animal Handling")).toBeTruthy();

    // Reverse: pick in the additional list → gone from the class list.
    fireEvent.click(bonusGroup().getByLabelText("Animal Handling"));
    expect(classGroup().queryByLabelText("Animal Handling")).toBeNull();

    // Granted skills (acolyte insight/religion) never appear in either.
    expect(classGroup().queryByLabelText("Insight")).toBeNull();
    expect(bonusGroup().queryByLabelText("Religion")).toBeNull();
  });

  it("releases an expertise pick when its proficiency is unchecked (T-37)", () => {
    render(
      <CharacterCreationWizard onComplete={vi.fn()} onCancel={() => {}} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Merric" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Hill Dwarf/ }));
    fireEvent.change(screen.getByLabelText("Tool proficiency"), {
      target: { value: "smiths-tools" },
    });
    fireEvent.click(nextButton());
    fireEvent.click(screen.getByRole("button", { name: /Rogue.*2014/ }));
    fireEvent.click(nextButton());
    fireEvent.click(nextButton());
    fireEvent.click(screen.getByRole("button", { name: /Acolyte.*2014/ }));
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

    // Choose skills, give Stealth expertise…
    const classGroup = () => choiceGroup(/Rogue skills/);
    for (const skill of ["Stealth", "Acrobatics", "Deception", "Perception"]) {
      fireEvent.click(classGroup().getByLabelText(skill));
    }
    const expertiseGroup = () => choiceGroup(/Expertise — level 1/);
    fireEvent.click(expertiseGroup().getByLabelText("Stealth"));
    fireEvent.click(expertiseGroup().getByLabelText("Insight"));
    expect(stepIncomplete()).toBe(false);

    // …then remove the Stealth proficiency: the expertise pick must be
    // released — the step blocks with honest hints instead of jamming.
    fireEvent.click(classGroup().getByLabelText("Stealth"));
    expect(expertiseGroup().queryByLabelText("Stealth")).toBeNull();
    expect(stepIncomplete()).toBe(true);
    expect(screen.getByText(/Choose 1 more class skill/)).toBeTruthy();
    // The stale pick was released: the counter dropped from 2/2 to 1/2.
    expect(screen.getByText(/Expertise — level 1 \(1\/2\)/)).toBeTruthy();

    // Recovering: re-check Stealth and expertise is choosable again.
    fireEvent.click(classGroup().getByLabelText("Stealth"));
    fireEvent.click(expertiseGroup().getByLabelText("Stealth"));
    expect(stepIncomplete()).toBe(false);
  });

  it("moves freely between all steps; incomplete ones carry a warning marker (T-30)", () => {
    render(
      <CharacterCreationWizard onComplete={vi.fn()} onCancel={() => {}} />,
    );
    const stepButton = (name: RegExp) =>
      screen.getByRole("button", { name }) as HTMLButtonElement;

    // Nothing filled in: every step is still clickable, but marked.
    expect(stepButton(/Class options/).disabled).toBe(false);
    expect(stepButton(/^Name & Race/).querySelector(".dvtt-wizard__step-warning")).toBeTruthy();
    fireEvent.click(stepButton(/Background/));
    expect(screen.getByText("Background", { selector: "h3" })).toBeTruthy();

    // Complete the first step: its marker clears, others stay.
    fireEvent.click(stepButton(/^Name & Race/));
    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Borin" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Hill Dwarf/ }));
    fireEvent.change(screen.getByLabelText("Tool proficiency"), {
      target: { value: "smiths-tools" },
    });
    expect(stepButton(/^Name & Race/).querySelector(".dvtt-wizard__step-warning")).toBeNull();
    expect(stepButton(/^Abilities/).querySelector(".dvtt-wizard__step-warning")).toBeTruthy();

    // Jump straight back — state is preserved.
    fireEvent.click(stepButton(/^Abilities/));
    fireEvent.click(stepButton(/^Name & Race/));
    expect(
      (screen.getByPlaceholderText(/Borin/) as HTMLInputElement).value,
    ).toBe("Borin");
  });

  it("previews an incomplete draft on the review step; Create stays gated (T-31)", () => {
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
    fireEvent.click(screen.getByRole("button", { name: /Fighter.*2014/ }));

    // Jump straight to Review with plenty missing.
    fireEvent.click(screen.getByRole("button", { name: /Review/ }));
    expect(screen.getByText(/Borin — preview/)).toBeTruthy();
    expect(screen.getByText(/Hill Dwarf · Fighter 1/)).toBeTruthy();
    expect(screen.getByText("Still missing")).toBeTruthy();
    expect(screen.getByText("Choose a background.")).toBeTruthy();
    // Constitution shows the racial +2 already: 10 + 2.
    expect(screen.getByText(/HP so far/)).toBeTruthy();
    const create = screen.getByRole("button", {
      name: "Create character",
    }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
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
    fireEvent.click(screen.getByRole("button", { name: /Rogue.*2014/ }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3" } });
    fireEvent.click(nextButton());
    expect(stepIncomplete()).toBe(true);
    expect(screen.getByText(/Choose a Rogue subclass/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Thief/ }));
    expect(stepIncomplete()).toBe(false);
    fireEvent.click(nextButton());

    fireEvent.click(screen.getByRole("button", { name: /Acolyte.*2014/ }));
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
    expect(stepIncomplete()).toBe(true);
    expect(screen.getByText(/Choose 2 skills for Expertise/)).toBeTruthy();
    const expertiseGroup = choiceGroup(/Expertise — level 1/);
    fireEvent.click(expertiseGroup.getByLabelText("Stealth"));
    fireEvent.click(expertiseGroup.getByLabelText("Insight"));
    expect(stepIncomplete()).toBe(false);
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
    fireEvent.click(screen.getByRole("button", { name: /Human.*2014/ }));
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
    expect(stepIncomplete()).toBe(true);
    expect(screen.getByText("Choose a Draconic Ancestry.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Draconic Ancestry"), {
      target: { value: "red" },
    });
    expect(stepIncomplete()).toBe(false);

    // Switching race clears the pick; the hill dwarf owes its own tool pick.
    fireEvent.click(screen.getByRole("button", { name: /Hill Dwarf/ }));
    expect(screen.queryByLabelText("Draconic Ancestry")).toBeNull();
    expect(stepIncomplete()).toBe(true);
    fireEvent.change(screen.getByLabelText("Tool proficiency"), {
      target: { value: "smiths-tools" },
    });
    expect(stepIncomplete()).toBe(false);
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

    fireEvent.click(screen.getByRole("button", { name: /Bard.*2014/ }));
    fireEvent.click(nextButton());

    // Class options: nothing is owed at level 1 (bard expertise comes at 3,
    // the college at 3 too).
    expect(screen.getByText(/Unlocks at level 3/)).toBeTruthy();
    expect(screen.getByText(/Nothing else to choose/)).toBeTruthy();
    expect(stepIncomplete()).toBe(false);
    fireEvent.click(nextButton());

    fireEvent.click(screen.getByRole("button", { name: /Acolyte.*2014/ }));
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
    expect(stepIncomplete()).toBe(true);
    const racialGroup = choiceGroup(/Half-Elf: \+1 to 2 abilities/);
    fireEvent.click(racialGroup.getByLabelText("Dexterity"));
    fireEvent.click(racialGroup.getByLabelText("Constitution"));
    expect(stepIncomplete()).toBe(false);
    fireEvent.click(nextButton());

    // Bard: 3 class skills from any list; half-elf: 2 more from any. The same
    // skill appears in both groups, so scope the queries.
    const classGroup = choiceGroup(/Bard skills/);
    fireEvent.click(classGroup.getByLabelText("Athletics"));
    fireEvent.click(classGroup.getByLabelText("Performance"));
    fireEvent.click(classGroup.getByLabelText("Persuasion"));
    expect(stepIncomplete()).toBe(true);
    const bonusGroup = choiceGroup(/Additional skills/);
    fireEvent.click(bonusGroup.getByLabelText("Stealth"));
    fireEvent.click(bonusGroup.getByLabelText("Deception"));
    expect(stepIncomplete()).toBe(false);
    fireEvent.click(nextButton());

    // Equipment: bard defaults are valid as-is.
    expect(stepIncomplete()).toBe(false);
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
