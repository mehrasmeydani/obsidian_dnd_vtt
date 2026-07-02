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

    // Step 1: name & race. Next stays disabled until both are set.
    expect(nextButton().disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/Borin/), {
      target: { value: "Borin" },
    });
    expect(nextButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Hill Dwarf/ }));
    expect(nextButton().disabled).toBe(false);
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

    // Step 6: review shows derived stats, then create.
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
