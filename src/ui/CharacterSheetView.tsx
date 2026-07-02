import { ItemView, type WorkspaceLeaf } from "obsidian";
import { type Root } from "react-dom/client";
import { mountReact } from "./mount";
import { emptyCharacter, type Character } from "../model/schema";
import { CharacterSheetPreview } from "./CharacterSheetPreview";

export const VIEW_TYPE_CHARACTER_SHEET = "dnd-vtt-character-sheet";

/**
 * Obsidian view that hosts the React character sheet. In Phase 0 it renders a
 * demo character to prove the React mount + rules math work end to end; Phase 1
 * will load the character from the active vault note.
 */
export class CharacterSheetView extends ItemView {
  private root: Root | null = null;
  private character: Character = emptyCharacter("demo", "Demo Hero");

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
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

  async onOpen(): Promise<void> {
    // Seed the demo character with a few proficiencies so the math is visible.
    this.character = {
      ...this.character,
      classes: [{ name: "Fighter", level: 5 }],
      abilityScores: { str: 16, dex: 14, con: 15, int: 10, wis: 12, cha: 8 },
      savingThrows: { str: "proficient", con: "proficient" },
      skills: { athletics: "proficient", perception: "proficient" },
      maxHp: 44,
      currentHp: 44,
      armorClass: 18,
    };
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
