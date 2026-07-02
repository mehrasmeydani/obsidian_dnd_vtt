import { Plugin, type WorkspaceLeaf } from "obsidian";
import {
  CharacterSheetView,
  VIEW_TYPE_CHARACTER_SHEET,
} from "./ui/CharacterSheetView";

/**
 * Plugin entry point. Phase 0 registers the character-sheet view and a way to
 * open it, proving the scaffold (React mount + rules math + data model) works
 * inside Obsidian. Later phases add the 5e content browser, sync, and map views.
 */
export default class DndVttPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(
      VIEW_TYPE_CHARACTER_SHEET,
      (leaf) => new CharacterSheetView(leaf),
    );

    this.addRibbonIcon("scroll-text", "Open D&D character sheet", () => {
      void this.activateCharacterSheet();
    });

    this.addCommand({
      id: "open-character-sheet",
      name: "Open character sheet",
      callback: () => {
        void this.activateCharacterSheet();
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
}
