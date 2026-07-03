// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CharacterSchema, emptyCharacter, type Character } from "../model/schema";
import {
  parseCharacterNote,
  serializeCharacterNote,
} from "../persistence/characterNote";
import { CharacterSheet } from "./CharacterSheet";

/**
 * Regression for the editable character sheet: the markup the CSS skin
 * depends on (HP display, ability columns, proficiency state classes), the
 * always-on play controls (damage/heal, pips, rests), and edit mode. Every
 * emitted change must be CharacterSchema-valid — the view trusts that when
 * writing the note.
 */

afterEach(cleanup);

function sampleCharacter(): Character {
  return CharacterSchema.parse({
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
    inventory: [
      { id: "dagger", name: "Dagger", quantity: 2, equipped: true },
      { id: "rope", name: "Rope", quantity: 1, equipped: false },
    ],
    spells: [{ id: "ml", name: "Minor Illusion", level: 0, prepared: true }],
    resources: [
      { id: "rage", name: "Rage", max: 3, used: 0, per: "long-rest" },
      { id: "ki", name: "Ki", max: 2, used: 2, per: "short-rest" },
    ],
    proficiencies: {
      armor: ["Light armor"],
      weapons: ["Simple weapons"],
      tools: ["Thieves' tools"],
    },
    notes: "Owes Vex 20gp.",
  });
}

/** Stateful wrapper so edits round-trip like they do under the real view. */
function Harness({
  initial,
  bound = true,
  onChange,
}: {
  initial: Character;
  bound?: boolean;
  onChange?: (next: Character) => void;
}) {
  const [character, setCharacter] = useState(initial);
  return (
    <CharacterSheet
      character={character}
      bound={bound}
      onChange={(next) => {
        setCharacter(next);
        onChange?.(next);
      }}
    />
  );
}

function renderSheet(character = sampleCharacter(), bound = true) {
  const changes: Character[] = [];
  const utils = render(
    <Harness
      initial={character}
      bound={bound}
      onChange={(next) => changes.push(next)}
    />,
  );
  return { ...utils, changes, last: () => changes[changes.length - 1] };
}

function enterEditMode() {
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
}

describe("CharacterSheet markup (CSS skin contract)", () => {
  it("renders the HP display with current, temp, and max", () => {
    const { container } = renderSheet();
    const hp = container.querySelector(".dvtt-hp");
    expect(hp?.querySelector(".dvtt-hp__current")?.textContent).toBe("17");
    expect(hp?.querySelector(".dvtt-hp__temp")?.textContent).toBe("+5");
    expect(hp?.querySelector(".dvtt-hp__max")?.textContent).toBe(" / 24");
  });

  it("omits the temp HP element when tempHp is 0", () => {
    const { container } = renderSheet({ ...sampleCharacter(), tempHp: 0 });
    expect(container.querySelector(".dvtt-hp__temp")).toBeNull();
  });

  it("renders one column per ability with its skills grouped under it", () => {
    const { container } = renderSheet();
    const columns = container.querySelectorAll(".dvtt-sheet-col");
    expect(columns).toHaveLength(6);
    const dexSkills = [...columns[1].querySelectorAll(".dvtt-skill__name")].map(
      (el) => el.textContent,
    );
    expect(dexSkills).toEqual(["Acrobatics", "Sleight Of Hand", "Stealth"]);
  });

  it("marks proficient saves and proficient/expert skills with state classes", () => {
    const { container } = renderSheet();
    const columns = [...container.querySelectorAll(".dvtt-sheet-col")];
    const [str, dex, , , wis] = columns;

    expect(
      dex.querySelector(".dvtt-save")?.classList.contains("is-proficient"),
    ).toBe(true);
    expect(
      str.querySelector(".dvtt-save")?.classList.contains("is-proficient"),
    ).toBe(false);

    const stealth = [...dex.querySelectorAll(".dvtt-skill")].find((el) =>
      el.textContent?.includes("Stealth"),
    );
    expect(stealth?.classList.contains("is-expert")).toBe(true);
    expect(stealth?.querySelector(".dvtt-skill__bonus")?.textContent).toBe("+7");

    const perception = [...wis.querySelectorAll(".dvtt-skill")].find((el) =>
      el.textContent?.includes("Perception"),
    );
    expect(perception?.classList.contains("is-proficient")).toBe(true);
  });

  it("shows combat mini-stats derived from the character", () => {
    renderSheet();
    expect(screen.getByText("AC").nextElementSibling?.textContent).toBe("14");
    expect(screen.getByText("Initiative").nextElementSibling?.textContent).toBe(
      "+3",
    );
    expect(screen.getByText("Pass. Perc.").nextElementSibling?.textContent).toBe(
      "12",
    );
  });

  it("lists proficiencies and the unbound hint when not linked to a note", () => {
    renderSheet(sampleCharacter(), false);
    expect(screen.getByText(/Not linked to a note/)).toBeTruthy();
    expect(screen.getByText(/Thieves' tools/)).toBeTruthy();
  });
});

describe("play controls (always live)", () => {
  it("damage consumes temp HP before current, floored at 0", () => {
    const { container, last } = renderSheet();
    fireEvent.change(screen.getByLabelText("HP amount"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Damage" }));
    // 7 damage: 5 from temp, 2 from current (17 -> 15).
    expect(last().tempHp).toBe(0);
    expect(last().currentHp).toBe(15);
    expect(container.querySelector(".dvtt-hp__current")?.textContent).toBe(
      "15",
    );

    fireEvent.change(screen.getByLabelText("HP amount"), {
      target: { value: "99" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Damage" }));
    expect(last().currentHp).toBe(0);
  });

  it("heal caps at max HP", () => {
    const { last } = renderSheet();
    fireEvent.change(screen.getByLabelText("HP amount"), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Heal" }));
    expect(last().currentHp).toBe(24);
    expect(last().tempHp).toBe(5); // healing never touches temp HP
  });

  it("spends and restores resource pips", () => {
    const { last } = renderSheet();
    // Rage 3/3: clicking the outermost filled pip spends one.
    fireEvent.click(screen.getByLabelText("Rage pip 3"));
    expect(last().resources.find((r) => r.id === "rage")?.used).toBe(1);
    // Clicking pip 3 again restores back to 3 remaining.
    fireEvent.click(screen.getByLabelText("Rage pip 3"));
    expect(last().resources.find((r) => r.id === "rage")?.used).toBe(0);
    // Clicking pip 1 leaves only one remaining.
    fireEvent.click(screen.getByLabelText("Rage pip 1"));
    expect(last().resources.find((r) => r.id === "rage")?.used).toBe(2);
  });

  it("short rest refills short-rest pools only; long rest refills everything", () => {
    const { last } = renderSheet();
    fireEvent.click(screen.getByLabelText("Rage pip 1"));
    fireEvent.click(screen.getByRole("button", { name: "Short rest" }));
    expect(last().resources.find((r) => r.id === "ki")?.used).toBe(0);
    expect(last().resources.find((r) => r.id === "rage")?.used).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Long rest" }));
    expect(last().resources.every((r) => r.used === 0)).toBe(true);
    expect(last().currentHp).toBe(24);
    expect(last().tempHp).toBe(0);
  });

  it("renders unlimited resources without pips", () => {
    const character = CharacterSchema.parse({
      ...sampleCharacter(),
      resources: [
        { id: "rage", name: "Rage", max: "unlimited", used: 0, per: "long-rest" },
      ],
    });
    renderSheet(character);
    expect(screen.getByText("∞")).toBeTruthy();
    expect(screen.queryByLabelText(/Rage pip/)).toBeNull();
  });

  it("toggles a spell's prepared state outside edit mode", () => {
    const { last } = renderSheet();
    fireEvent.click(screen.getByLabelText("Minor Illusion prepared"));
    expect(last().spells[0].prepared).toBe(false);
  });
});

describe("edit mode", () => {
  it("recalculates derived values live when a score changes, and never offers them as inputs", () => {
    const { container } = renderSheet();
    enterEditMode();
    fireEvent.change(screen.getByLabelText("Dexterity score"), {
      target: { value: "20" },
    });
    const dex = container.querySelectorAll(".dvtt-sheet-col")[1];
    expect(dex.querySelector(".dvtt-sheet-stat__mod")?.textContent).toBe("+5");
    // Stealth: dex +5, prof +2, expertise => +9.
    const stealth = [...dex.querySelectorAll(".dvtt-skill")].find((el) =>
      el.textContent?.includes("Stealth"),
    );
    expect(stealth?.querySelector(".dvtt-skill__bonus")?.textContent).toBe("+9");
    // Modifiers and bonuses are text, not inputs.
    expect(container.querySelector(".dvtt-sheet-stat__mod input")).toBeNull();
    expect(container.querySelector(".dvtt-skill__bonus input")).toBeNull();
  });

  it("rejects out-of-range scores (schema-invalid changes never emit)", () => {
    const { changes } = renderSheet();
    enterEditMode();
    const before = changes.length;
    fireEvent.change(screen.getByLabelText("Strength score"), {
      target: { value: "0" },
    });
    expect(changes.length).toBe(before);
  });

  it("cycles skill proficiency none → proficient → expertise → none", () => {
    const { container, last } = renderSheet();
    enterEditMode();
    const str = container.querySelectorAll(".dvtt-sheet-col")[0];
    const athletics = [...str.querySelectorAll("button.dvtt-skill")].find(
      (el) => el.textContent?.includes("Athletics"),
    ) as HTMLElement;
    fireEvent.click(athletics);
    expect(last().skills.athletics).toBe("proficient");
    fireEvent.click(athletics);
    expect(last().skills.athletics).toBe("expertise");
    fireEvent.click(athletics);
    expect(last().skills.athletics).toBeUndefined();
  });

  it("toggles save proficiency", () => {
    const { last } = renderSheet();
    enterEditMode();
    fireEvent.click(screen.getByLabelText("Strength save proficiency"));
    expect(last().savingThrows.str).toBe("proficient");
    fireEvent.click(screen.getByLabelText("Strength save proficiency"));
    expect(last().savingThrows.str).toBe("none");
  });

  it("edits AC, speed, max HP, and the character name", () => {
    const { last } = renderSheet();
    enterEditMode();
    fireEvent.change(screen.getByLabelText("Armor class"), {
      target: { value: "17" },
    });
    fireEvent.change(screen.getByLabelText("Speed"), {
      target: { value: "35" },
    });
    fireEvent.change(screen.getByLabelText("Max HP"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Character name"), {
      target: { value: "Merric the Bold" },
    });
    expect(last().armorClass).toBe(17);
    expect(last().speed).toBe(35);
    expect(last().maxHp).toBe(30);
    expect(last().name).toBe("Merric the Bold");
  });

  it("adds, edits, and removes inventory rows", () => {
    const { last } = renderSheet();
    enterEditMode();
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(last().inventory).toHaveLength(3);

    fireEvent.change(screen.getByLabelText("Item 3 name"), {
      target: { value: "Grappling hook" },
    });
    fireEvent.change(screen.getByLabelText("Item 3 quantity"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByLabelText("Item 3 equipped"));
    expect(last().inventory[2]).toMatchObject({
      name: "Grappling hook",
      quantity: 2,
      equipped: true,
    });

    fireEvent.click(screen.getByLabelText("Remove item 1"));
    expect(last().inventory.map((i) => i.name)).toEqual([
      "Rope",
      "Grappling hook",
    ]);
  });

  it("adds and removes spells", () => {
    const { last } = renderSheet();
    enterEditMode();
    fireEvent.click(screen.getByRole("button", { name: "Add spell" }));
    fireEvent.change(screen.getByLabelText("Spell 2 name"), {
      target: { value: "Disguise Self" },
    });
    fireEvent.change(screen.getByLabelText("Spell 2 level"), {
      target: { value: "1" },
    });
    expect(last().spells[1]).toMatchObject({ name: "Disguise Self", level: 1 });

    fireEvent.click(screen.getByLabelText("Remove spell 1"));
    expect(last().spells.map((s) => s.name)).toEqual(["Disguise Self"]);
  });

  it("edits the notes text", () => {
    const { last } = renderSheet();
    enterEditMode();
    fireEvent.change(screen.getByLabelText("Character notes"), {
      target: { value: "Paid Vex back." },
    });
    expect(last().notes).toBe("Paid Vex back.");
  });

  it("emits only schema-valid characters", () => {
    const { changes } = renderSheet();
    enterEditMode();
    fireEvent.change(screen.getByLabelText("Armor class"), {
      target: { value: "17" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    fireEvent.click(screen.getByLabelText("Rage pip 1"));
    for (const change of changes) {
      expect(CharacterSchema.safeParse(change).success).toBe(true);
    }
  });
});

describe("note round-trip", () => {
  it("survives serialize/parse after sheet edits without losing user prose", () => {
    const { last } = renderSheet();
    enterEditMode();
    fireEvent.change(screen.getByLabelText("Armor class"), {
      target: { value: "17" },
    });

    const existing = [
      "---",
      "dnd-vtt: character",
      "campaign: Hell",
      "---",
      "",
      "# Merric",
      "",
      "My backstory paragraph.",
      "",
      "```dnd-vtt-character",
      '{"schemaVersion":1,"kind":"character","payload":{}}',
      "```",
      "",
    ].join("\n");

    const serialized = serializeCharacterNote(last(), existing);
    expect(serialized).toContain("My backstory paragraph.");
    expect(serialized).toContain("campaign: Hell");

    const parsed = parseCharacterNote(serialized);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.character).toEqual(last());
  });
});

describe("onChange wiring", () => {
  it("does not call onChange when nothing is interacted with", () => {
    const onChange = vi.fn();
    render(<Harness initial={sampleCharacter()} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});
