import { ItemView, type WorkspaceLeaf } from "obsidian";
import { type Root } from "react-dom/client";
import { mountReact, renderReact } from "./mount";
import { emptyCharacter, type Character } from "../model/schema";
import { CharacterSheetPreview } from "./CharacterSheetPreview";

export const VIEW_TYPE_CHARACTER_SHEET = "dnd-vtt-character-sheet";

/**
 * Obsidian view that hosts the React character sheet. Renders the character
 * provided by the plugin (e.g. fresh from the creation wizard) or a seeded
 * demo when none exists yet; Phase 1's serializer will load characters from
 * vault notes instead.
 */
export class CharacterSheetView extends ItemView {
  private root: Root | null = null;
  private character: Character;

  constructor(
    leaf: WorkspaceLeaf,
    private getCharacter: () => Character | null,
  ) {
    super(leaf);
    this.character = getCharacter() ?? demoCharacter();
  }

  getViewType(): string {
    return VIEW_TYPE_CHARACTER_SHEET;
  }

  getDisplayText(): string {
    return "D&D character sheet";
  }

  getIcon(): string {
    return "scroll-text";
  }

  /** Swap the displayed character (called when the wizard finishes). */
  setCharacter(character: Character): void {
    this.character = character;
    if (this.root) {
      renderReact(
        this.root,
        <CharacterSheetPreview character={this.character} />,
      );
    }
  }

  async onOpen(): Promise<void> {
    this.character = this.getCharacter() ?? demoCharacter();
    this.root = mountReact(
      this.contentEl,
      <CharacterSheetPreview character={this.character} />,
    );
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}

/** Seeded demo with a few proficiencies so the math is visible. */
function demoCharacter(): Character {
  return {
    ...emptyCharacter("demo", "Demo Hero"),
    classes: [{ name: "Fighter", level: 5 }],
    abilityScores: { str: 16, dex: 14, con: 15, int: 10, wis: 12, cha: 8 },
    savingThrows: { str: "proficient", con: "proficient" },
    skills: { athletics: "proficient", perception: "proficient" },
    maxHp: 44,
    currentHp: 44,
    armorClass: 18,
  };
}
