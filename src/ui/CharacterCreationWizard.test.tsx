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
    expect(nextButton().disabled).toBe(false);
    expect(screen.queryByText("Select a race.")).toBeNull();
    fireEvent.click(nextButton());

    // Step 2: class.
    fireEvent.click(screen.getByRole("button", { name: /^Fighter/ }));
    fireEvent.click(nextButton());

    // Step 3: background.
    fireEvent.click(screen.getByRole("button", { name: /^Acolyte/ }));
    fireEvent.click(nextButton());

    // Step 4: abilities — assign the standard array (rows are STR..CHA).
    expect(nextButton().disabled).toBe(true);
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(6);
    const assignment = [15, 13, 14, 8, 12, 10]; // str dex con int wis cha
    assignment.forEach((value, i) => {
      fireEvent.change(selects[i], { target: { value: String(value) } });
    });
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    // Step 5: skills — acolyte's granted skills show as chips, not choices.
    expect(choiceGroup(/Granted by race/).getByText("Insight")).toBeTruthy();
    expect(nextButton().disabled).toBe(true);
    const classGroup = choiceGroup(/Fighter skills/);
    fireEvent.click(classGroup.getByLabelText("Athletics"));
    fireEvent.click(classGroup.getByLabelText("Perception"));
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    // Step 6: equipment — defaults are pre-selected; swap one choice.
    expect(screen.getByText("Vestments")).toBeTruthy(); // acolyte gear
    expect(
      (screen.getByLabelText("Chain mail") as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(screen.getByLabelText("Greatsword"));
    expect(nextButton().disabled).toBe(false);
    fireEvent.click(nextButton());

    // Step 7: review shows derived stats, then create.
    expect(screen.getByText(/Level 1 Hill Dwarf Fighter/)).toBeTruthy();
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
    fireEvent.click(nextButton());

    // Level 4 fighter: one ASI = two +1 points to assign.
    fireEvent.click(screen.getByRole("button", { name: /^Fighter/ }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "4" } });
    fireEvent.click(nextButton());
    fireEvent.click(screen.getByRole("button", { name: /^Acolyte/ }));
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

    // Step 1 is complete: Class unlocks, but steps beyond it stay locked.
    expect(stepButton("Class").disabled).toBe(false);
    expect(stepButton("Background").disabled).toBe(true);

    fireEvent.click(stepButton("Class"));
    fireEvent.click(screen.getByRole("button", { name: /^Fighter/ }));
    expect(stepButton("Background").disabled).toBe(false);

    // Jump straight back to the first step — state is preserved.
    fireEvent.click(stepButton("Name & Race"));
    expect(
      (screen.getByPlaceholderText(/Borin/) as HTMLInputElement).value,
    ).toBe("Borin");
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
    fireEvent.click(nextButton());

    fireEvent.click(screen.getByRole("button", { name: /^Bard/ }));
    fireEvent.click(nextButton());

    fireEvent.click(screen.getByRole("button", { name: /^Acolyte/ }));
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
