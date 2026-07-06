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
    armorClassOverride: 14,
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

  it("short rest refills short-rest pools only; long rest refills everything (after confirming, T-34)", () => {
    const { last } = renderSheet();
    fireEvent.click(screen.getByLabelText("Rage pip 1"));
    fireEvent.click(screen.getByRole("button", { name: "Short rest" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(last().resources.find((r) => r.id === "ki")?.used).toBe(0);
    expect(last().resources.find((r) => r.id === "rage")?.used).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Long rest" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(last().resources.every((r) => r.used === 0)).toBe(true);
    expect(last().currentHp).toBe(24);
    expect(last().tempHp).toBe(0);
  });

  it("rests do nothing until confirmed; cancel backs out (T-34)", () => {
    const { last, changes } = renderSheet();
    fireEvent.click(screen.getByLabelText("Ki pip 1")); // ki 2 used → spend UI state
    const before = changes.length;

    fireEvent.click(screen.getByRole("button", { name: "Long rest" }));
    // Only the confirm prompt appeared; nothing changed yet.
    expect(screen.getByText("Take a long rest?")).toBeTruthy();
    expect(changes.length).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Take a long rest?")).toBeNull();
    expect(changes.length).toBe(before);
    expect(last().currentHp).toBe(17); // still hurt

    // The normal buttons are back.
    expect(screen.getByRole("button", { name: "Short rest" })).toBeTruthy();
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

describe("equip toggle (T-22, always live)", () => {
  /** DEX 16 (+3), no override: leather 11+3 = 14 AC as rendered. */
  function armoredCharacter(): Character {
    return CharacterSchema.parse({
      ...sampleCharacter(),
      armorClassOverride: undefined,
      inventory: [
        {
          id: "leather",
          name: "Leather armor",
          quantity: 1,
          equipped: true,
          armorId: "leather-armor",
        },
        {
          id: "scale",
          name: "Scale mail",
          quantity: 1,
          equipped: false,
          armorId: "scale-mail",
        },
        {
          id: "shield",
          name: "Shield",
          quantity: 1,
          equipped: false,
          armorId: "shield",
        },
        { id: "rope", name: "Rope", quantity: 1, equipped: false },
      ],
    });
  }

  const ac = () => screen.getByText("AC").nextElementSibling?.textContent;

  it("renders slotted items as toggles; unslotted gear is inert (T-38)", () => {
    renderSheet(armoredCharacter());
    const leather = screen.getByRole("button", { name: /Leather armor/ });
    expect(leather.getAttribute("aria-pressed")).toBe("true");
    expect(leather.classList.contains("is-equipped")).toBe(true);
    // Rope has no equip slot — it lists as a plain chip, not a button.
    expect(screen.queryByRole("button", { name: /^Rope/ })).toBeNull();
    expect(screen.getByText("Rope")).toBeTruthy();
  });

  it("splits read mode into Wearing and In bags (T-36)", () => {
    renderSheet(armoredCharacter());
    const group = (label: string) =>
      screen.getByText(label).parentElement as HTMLElement;
    expect(group("Wearing").textContent).toContain("Leather armor");
    expect(group("In bags").textContent).toContain("Scale mail");
    expect(group("In bags").textContent).toContain("Rope");

    // Equipping the shield moves it from bags to wearing.
    fireEvent.click(screen.getByRole("button", { name: "Shield" }));
    expect(group("Wearing").textContent).toContain("Shield");
  });

  it("equipping a shield in read mode updates derived AC live", () => {
    const { last } = renderSheet(armoredCharacter());
    expect(ac()).toBe("14"); // leather 11 + DEX 3
    fireEvent.click(screen.getByRole("button", { name: "Shield" }));
    expect(ac()).toBe("16"); // + shield 2
    expect(last().inventory.find((i) => i.id === "shield")?.equipped).toBe(true);
  });

  it("unequips in read mode and recomputes AC", () => {
    renderSheet(armoredCharacter());
    fireEvent.click(screen.getByRole("button", { name: /Leather armor/ }));
    expect(ac()).toBe("13"); // unarmored 10 + DEX 3
  });

  it("equipping a second body armor doffs the first (no stacking)", () => {
    const { last } = renderSheet(armoredCharacter());
    fireEvent.click(screen.getByRole("button", { name: "Scale mail" }));
    expect(ac()).toBe("16"); // scale 14 + DEX capped at 2
    expect(last().inventory.find((i) => i.id === "scale")?.equipped).toBe(true);
    expect(last().inventory.find((i) => i.id === "leather")?.equipped).toBe(false);
  });

  it("shield plus body armor stack fine", () => {
    const { last } = renderSheet(armoredCharacter());
    fireEvent.click(screen.getByRole("button", { name: "Shield" }));
    const inventory = last().inventory;
    expect(inventory.find((i) => i.id === "leather")?.equipped).toBe(true);
    expect(inventory.find((i) => i.id === "shield")?.equipped).toBe(true);
    expect(ac()).toBe("16");
  });

  it("applies the single-body-armor rule to the edit-mode checkbox too", () => {
    const { last } = renderSheet(armoredCharacter());
    enterEditMode();
    fireEvent.click(screen.getByLabelText("Item 2 equipped")); // scale mail
    expect(last().inventory.find((i) => i.id === "scale")?.equipped).toBe(true);
    expect(last().inventory.find((i) => i.id === "leather")?.equipped).toBe(false);
  });

  it("edit mode disables the Equipped checkbox on unslotted items (T-38)", () => {
    renderSheet(armoredCharacter());
    enterEditMode();
    expect((screen.getByLabelText("Item 1 equipped") as HTMLInputElement).disabled).toBe(false); // leather
    expect((screen.getByLabelText("Item 4 equipped") as HTMLInputElement).disabled).toBe(true); // rope
  });

  it("edit mode slot dropdown makes homebrew gear equippable (T-38)", () => {
    const { last } = renderSheet(armoredCharacter());
    enterEditMode();
    const slot = screen.getByLabelText("Item 4 slot") as HTMLSelectElement;
    expect(slot.value).toBe("none"); // rope: nothing inferred
    fireEvent.change(slot, { target: { value: "accessory" } });
    expect(last().inventory.find((i) => i.id === "rope")?.slot).toBe("accessory");
    fireEvent.click(screen.getByLabelText("Item 4 equipped"));
    expect(last().inventory.find((i) => i.id === "rope")?.equipped).toBe(true);
  });
});

describe("equip slots (T-38)", () => {
  function slottedCharacter(): Character {
    return CharacterSchema.parse({
      ...sampleCharacter(),
      armorClassOverride: undefined,
      inventory: [
        { id: "sword", name: "Longsword", quantity: 1, equipped: true },
        { id: "axe", name: "Handaxe", quantity: 1, equipped: true },
        { id: "dagger", name: "Dagger", quantity: 1, equipped: false },
        { id: "ring1", name: "Ring of warmth", quantity: 1, equipped: false },
        { id: "ring2", name: "Signet ring", quantity: 1, equipped: false },
        { id: "cloak", name: "Cloak of billowing", quantity: 1, equipped: false },
        { id: "gold", name: "Gold (gp)", quantity: 25, equipped: false },
      ],
    });
  }
  const item = (last: () => Character, id: string) =>
    last().inventory.find((i) => i.id === id);

  it("blocks a third held item until a hand frees up", () => {
    const { changes, last } = renderSheet(slottedCharacter());
    const dagger = screen.getByRole("button", { name: "Dagger" });
    expect(dagger.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(dagger);
    // Blocked: no change was emitted at all.
    expect(changes).toHaveLength(0);

    // Sheathe the longsword; now the dagger fits.
    fireEvent.click(screen.getByRole("button", { name: /Longsword/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dagger" }));
    expect(item(last, "dagger")?.equipped).toBe(true);
  });

  it("accessories are unlimited", () => {
    const { last } = renderSheet(slottedCharacter());
    for (const name of ["Ring of warmth", "Signet ring", "Cloak of billowing"]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    expect(item(last, "ring1")?.equipped).toBe(true);
    expect(item(last, "ring2")?.equipped).toBe(true);
    expect(item(last, "cloak")?.equipped).toBe(true);
  });

  it("gold is never toggleable", () => {
    renderSheet(slottedCharacter());
    expect(screen.queryByRole("button", { name: /Gold/ })).toBeNull();
    enterEditMode();
    expect((screen.getByLabelText("Item 7 equipped") as HTMLInputElement).disabled).toBe(true);
  });

  it("hand limit applies to edit-mode checkboxes too", () => {
    const { last } = renderSheet(slottedCharacter());
    enterEditMode();
    const dagger = screen.getByLabelText("Item 3 equipped") as HTMLInputElement;
    expect(dagger.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Item 1 equipped")); // sheathe longsword
    fireEvent.click(screen.getByLabelText("Item 3 equipped"));
    expect(item(last, "dagger")?.equipped).toBe(true);
  });
});

describe("collapsible sections (T-32)", () => {
  it("collapses and expands the inventory tile; controls keep working", () => {
    const { last } = renderSheet();
    // Equipped items render as toggle buttons with a trailing marker (T-52).
    expect(screen.getByRole("button", { name: /Dagger ×2/ })).toBeTruthy();

    const toggle = screen.getByRole("button", { name: /Inventory/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: /Dagger ×2/ })).toBeNull();

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /Dagger ×2/ })).toBeTruthy();
    // Play controls still live after a collapse/expand cycle.
    fireEvent.change(screen.getByLabelText("HP amount"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Damage" }));
    expect(last().tempHp).toBe(3); // 5 temp - 2
  });

  it("features, spells, proficiencies, and notes tiles are collapsible; HP/combat are not", () => {
    renderSheet({
      ...sampleCharacter(),
      features: [{ id: "f", name: "Trait", source: "Halfling" }],
    });
    for (const name of [/Spells/, /Features & Traits/, /Proficiencies & languages/, /Notes/]) {
      const toggle = screen.getByRole("button", { name });
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
    }
    // Always-visible tiles offer no toggle.
    expect(screen.queryByRole("button", { name: "Combat" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hit Points" })).toBeNull();
  });
});

describe("defenses & conditions (T-35)", () => {
  it("toggles conditions live in read mode", () => {
    const { last } = renderSheet();
    const poisoned = screen.getByRole("button", { name: "Poisoned" });
    expect(poisoned.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(poisoned);
    expect(last().conditions).toEqual(["Poisoned"]);
    fireEvent.click(screen.getByRole("button", { name: "Prone" }));
    expect(last().conditions).toEqual(["Poisoned", "Prone"]);
    fireEvent.click(screen.getByRole("button", { name: "Poisoned" }));
    expect(last().conditions).toEqual(["Prone"]);
  });

  it("edits resistances/immunities/vulnerabilities as comma lists", () => {
    const { last } = renderSheet();
    enterEditMode();
    fireEvent.blur(screen.getByLabelText("Resistances"), {
      target: { value: "Poison,  Fire " },
    });
    fireEvent.blur(screen.getByLabelText("Immunities"), {
      target: { value: "Disease" },
    });
    expect(last().resistances).toEqual(["Poison", "Fire"]);
    expect(last().immunities).toEqual(["Disease"]);
  });

  it("shows recorded defenses as read-mode groups and round-trips the note", () => {
    const character = CharacterSchema.parse({
      ...sampleCharacter(),
      resistances: ["Poison"],
      conditions: ["Prone"],
    });
    renderSheet(character);
    expect(screen.getByText("Resistances")).toBeTruthy();
    expect(screen.getByText("Poison")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Prone" }).getAttribute("aria-pressed"),
    ).toBe("true");

    const note = serializeCharacterNote(character);
    const parsed = parseCharacterNote(note);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.character.resistances).toEqual(["Poison"]);
      expect(parsed.character.conditions).toEqual(["Prone"]);
    }
  });

  it("parses pre-T-35 characters without the new fields (additive schema)", () => {
    const legacy = { ...sampleCharacter() } as Record<string, unknown>;
    delete legacy.resistances;
    delete legacy.immunities;
    delete legacy.vulnerabilities;
    delete legacy.conditions;
    delete legacy.languages;
    const parsed = CharacterSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.conditions).toEqual([]);
  });
});

describe("features grouped by origin (T-33)", () => {
  it("groups race/class/background/feats, class sorted by level with feats inline", () => {
    const character = CharacterSchema.parse({
      ...sampleCharacter(),
      race: "Hill Dwarf",
      background: "Acolyte",
      classes: [{ name: "Rogue", level: 4, subclass: "Thief" }],
      features: [
        { id: "r1", name: "Darkvision", source: "Hill Dwarf" },
        { id: "c2", name: "Cunning Action", source: "Rogue", level: 2 },
        { id: "c1", name: "Sneak Attack", source: "Rogue", level: 1 },
        { id: "s1", name: "Fast Hands", source: "Thief", level: 3 },
        { id: "b1", name: "Shelter of the Faithful", source: "Acolyte" },
        { id: "f1", name: "Grappler", source: "Feat", level: 4 },
      ],
    });
    const { container } = renderSheet(character);
    const groups = [...container.querySelectorAll(".dvtt-feature-group")];
    const labels = groups.map(
      (g) => g.querySelector(".dvtt-feature-group__label")?.textContent,
    );
    expect(labels).toEqual(["Hill Dwarf", "Rogue", "Acolyte", "Feats"]);

    const classGroup = groups[labels.indexOf("Rogue")];
    const classNames = [
      ...classGroup.querySelectorAll(".dvtt-granted-feature__name"),
    ].map((el) => el.textContent);
    // Level-sorted, subclass features inline, the level-4 feat included.
    expect(classNames).toEqual([
      "Sneak Attack",
      "Cunning Action",
      "Fast Hands",
      "Grappler",
    ]);

    // The feat also appears in its own group.
    const featGroup = groups[labels.indexOf("Feats")];
    expect(featGroup.textContent).toContain("Grappler");
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
    fireEvent.change(screen.getByLabelText("Armor class override"), {
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
    expect(last().armorClassOverride).toBe(17);
    expect(last().speed).toBe(35);
    expect(last().maxHp).toBe(30);
    expect(last().name).toBe("Merric the Bold");
  });

  it("derives AC from equipped armor and resets the override to auto", () => {
    const character = CharacterSchema.parse({
      ...sampleCharacter(),
      armorClassOverride: undefined,
      inventory: [
        {
          id: "leather",
          name: "Leather armor",
          quantity: 1,
          equipped: true,
          armorId: "leather-armor",
        },
      ],
    });
    const { last } = renderSheet(character);
    // Leather 11 + DEX 3.
    expect(screen.getByText("AC").nextElementSibling?.textContent).toBe("14");

    enterEditMode();
    fireEvent.change(screen.getByLabelText("Armor class override"), {
      target: { value: "20" },
    });
    expect(last().armorClassOverride).toBe(20);
    fireEvent.click(screen.getByLabelText("Reset AC to automatic"));
    expect(last().armorClassOverride).toBeUndefined();
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
    // A fresh item has no slot yet; its checkbox renders (disabled) and
    // it starts unequipped (T-38).
    expect(screen.getByLabelText("Item 3 equipped")).toBeTruthy();
    expect(last().inventory[2]).toMatchObject({
      name: "Grappling hook",
      quantity: 2,
      equipped: false,
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
    fireEvent.change(screen.getByLabelText("Armor class override"), {
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
    fireEvent.change(screen.getByLabelText("Armor class override"), {
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
