import { Plugin, type WorkspaceLeaf } from "obsidian";
import {
  CharacterSheetView,
  VIEW_TYPE_CHARACTER_SHEET,
} from "./ui/CharacterSheetView";
import {
  CharacterCreationView,
  VIEW_TYPE_CHARACTER_CREATION,
} from "./ui/CharacterCreationView";
import type { Character } from "./model/schema";

/**
 * Plugin entry point. Registers the character-sheet view and the creation
 * wizard. A character finished in the wizard is held in memory and shown in
 * the sheet view; Phase 1's note serializer will persist it to the vault.
 * Later phases add the 5e content browser, sync, and map views.
 */
export default class DndVttPlugin extends Plugin {
  private activeCharacter: Character | null = null;

  async onload(): Promise<void> {
    this.registerView(
      VIEW_TYPE_CHARACTER_SHEET,
      (leaf) => new CharacterSheetView(leaf, () => this.activeCharacter),
    );
    this.registerView(
      VIEW_TYPE_CHARACTER_CREATION,
      (leaf) =>
        new CharacterCreationView(leaf, (character) => {
          void this.finishCharacterCreation(character);
        }),
    );

    this.addRibbonIcon("scroll-text", "Open D&D character sheet", () => {
      void this.activateCharacterSheet();
    });
    this.addRibbonIcon("user-plus", "Create D&D character", () => {
      void this.activateCharacterCreation();
    });

    this.addCommand({
      id: "open-character-sheet",
      name: "Open character sheet",
      callback: () => {
        void this.activateCharacterSheet();
      },
    });
    this.addCommand({
      id: "create-character",
      name: "Create character",
      callback: () => {
        void this.activateCharacterCreation();
      },
    });
  }

  async onunload(): Promise<void> {
    // Obsidian detaches leaves of unloaded plugins automatically; nothing extra
    // to clean up yet.
  }

  /** Reveal an existing sheet leaf or create one in the right sidebar. */
  private async activateCharacterSheet(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_CHARACTER_SHEET);

    let leaf: WorkspaceLeaf | null;
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({
        type: VIEW_TYPE_CHARACTER_SHEET,
        active: true,
      });
    }

    if (leaf) workspace.revealLeaf(leaf);
  }

  /** Open the creation wizard in the main workspace (one at a time). */
  private async activateCharacterCreation(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_CHARACTER_CREATION);

    let leaf: WorkspaceLeaf;
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({
        type: VIEW_TYPE_CHARACTER_CREATION,
        active: true,
      });
    }

    workspace.revealLeaf(leaf);
  }

  /** Wizard finished: keep the character, close the wizard, show the sheet. */
  private async finishCharacterCreation(character: Character): Promise<void> {
    this.activeCharacter = character;

    for (const leaf of this.app.workspace.getLeavesOfType(
      VIEW_TYPE_CHARACTER_CREATION,
    )) {
      leaf.detach();
    }

    await this.activateCharacterSheet();
    for (const leaf of this.app.workspace.getLeavesOfType(
      VIEW_TYPE_CHARACTER_SHEET,
    )) {
      if (leaf.view instanceof CharacterSheetView) {
        leaf.view.setCharacter(character);
      }
    }
  }
}
