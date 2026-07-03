// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { emptyCharacter, type Character } from "../model/schema";
import { CharacterSheetPreview } from "./CharacterSheetPreview";

/**
 * Regression for the sheet preview markup that the CSS skin depends on:
 * the HP display (current + optional temp + max), the per-ability columns,
 * and the is-proficient / is-expert state classes.
 */

afterEach(cleanup);

function sampleCharacter(): Character {
  return {
    ...emptyCharacter("test", "Merric"),
    race: "Halfling",
    background: "Criminal",
    classes: [{ name: "Rogue", level: 3 }],
    abilityScores: { str: 8, dex: 16, con: 14, int: 12, wis: 10, cha: 13 },
    savingThrows: { dex: "proficient", int: "proficient" },
    skills: { stealth: "expertise", perception: "proficient" },
    maxHp: 24,
    currentHp: 17,
    tempHp: 5,
    armorClass: 14,
  };
}

describe("CharacterSheetPreview", () => {
  it("renders the HP display with current, temp, and max", () => {
    const { container } = render(
      <CharacterSheetPreview character={sampleCharacter()} />,
    );
    const hp = container.querySelector(".dvtt-hp");
    expect(hp?.querySelector(".dvtt-hp__current")?.textContent).toBe("17");
    expect(hp?.querySelector(".dvtt-hp__temp")?.textContent).toBe("+5");
    expect(hp?.querySelector(".dvtt-hp__max")?.textContent).toBe(" / 24");
  });

  it("omits the temp HP element when tempHp is 0", () => {
    const { container } = render(
      <CharacterSheetPreview
        character={{ ...sampleCharacter(), tempHp: 0 }}
      />,
    );
    expect(container.querySelector(".dvtt-hp__temp")).toBeNull();
  });

  it("renders one column per ability with its skills grouped under it", () => {
    const { container } = render(
      <CharacterSheetPreview character={sampleCharacter()} />,
    );
    const columns = container.querySelectorAll(".dvtt-sheet-col");
    expect(columns).toHaveLength(6);
    // DEX column (2nd) holds the three dex skills.
    const dexSkills = [...columns[1].querySelectorAll(".dvtt-skill__name")].map(
      (el) => el.textContent,
    );
    expect(dexSkills).toEqual(["Acrobatics", "Sleight Of Hand", "Stealth"]);
  });

  it("marks proficient saves and proficient/expert skills with state classes", () => {
    const { container } = render(
      <CharacterSheetPreview character={sampleCharacter()} />,
    );
    const columns = [...container.querySelectorAll(".dvtt-sheet-col")];
    const [str, dex, , , wis] = columns;

    expect(dex.querySelector(".dvtt-save")?.classList.contains("is-proficient")).toBe(true);
    expect(str.querySelector(".dvtt-save")?.classList.contains("is-proficient")).toBe(false);

    const stealth = [...dex.querySelectorAll(".dvtt-skill")].find((el) =>
      el.textContent?.includes("Stealth"),
    );
    expect(stealth?.classList.contains("is-expert")).toBe(true);
    // Expertise on a rogue 3 (prof +2): +3 dex, +4 with prof, +7 expert.
    expect(stealth?.querySelector(".dvtt-skill__bonus")?.textContent).toBe("+7");

    const perception = [...wis.querySelectorAll(".dvtt-skill")].find((el) =>
      el.textContent?.includes("Perception"),
    );
    expect(perception?.classList.contains("is-proficient")).toBe(true);
  });

  it("shows combat mini-stats derived from the character", () => {
    render(<CharacterSheetPreview character={sampleCharacter()} />);
    expect(screen.getByText("AC").nextElementSibling?.textContent).toBe("14");
    expect(screen.getByText("Initiative").nextElementSibling?.textContent).toBe("+3");
    // Passive perception: 10 + wis 0 + prof 2 = 12.
    expect(screen.getByText("Pass. Perc.").nextElementSibling?.textContent).toBe("12");
  });
});
