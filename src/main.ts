import {
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  type App,
  type WorkspaceLeaf,
} from "obsidian";
import {
  CharacterSheetView,
  VIEW_TYPE_CHARACTER_SHEET,
  type BoundCharacter,
} from "./ui/CharacterSheetView";
import {
  CharacterCreationView,
  VIEW_TYPE_CHARACTER_CREATION,
} from "./ui/CharacterCreationView";
import {
  loadCharacterNote,
  saveCharacterNote,
} from "./persistence/characterStore";
import type { TFile } from "obsidian";
import type { Character } from "./model/schema";

interface DndVttSettings {
  /** Vault folder where new character notes are created. */
  charactersFolder: string;
}

const DEFAULT_SETTINGS: DndVttSettings = {
  charactersFolder: "Characters",
};

/**
 * Plugin entry point. Registers the character-sheet view and the creation
 * wizard. Finished characters are saved as vault notes (frontmatter + JSON
 * block, see `persistence/characterNote.ts`) and can be loaded back from any
 * such note. Later phases add the 5e content browser, sync, and map views.
 */
export default class DndVttPlugin extends Plugin {
  settings: DndVttSettings = { ...DEFAULT_SETTINGS };
  private activeCharacter: BoundCharacter | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new DndVttSettingTab(this.app, this));

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
    this.addCommand({
      id: "load-character-from-note",
      name: "Load character from active note",
      callback: () => {
        void this.loadCharacterFromActiveNote();
      },
    });
  }

  async onunload(): Promise<void> {
    // Obsidian detaches leaves of unloaded plugins automatically; nothing extra
    // to clean up yet.
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
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

  /** Show `character` (bound to `file`) in every open sheet view. */
  private showCharacter(character: Character, file: TFile | null): void {
    this.activeCharacter = { character, file };
    for (const leaf of this.app.workspace.getLeavesOfType(
      VIEW_TYPE_CHARACTER_SHEET,
    )) {
      if (leaf.view instanceof CharacterSheetView) {
        leaf.view.setCharacter(character, file);
      }
    }
  }

  /** Wizard finished: persist the character, close the wizard, show the sheet. */
  private async finishCharacterCreation(character: Character): Promise<void> {
    let file: TFile | null = null;
    try {
      file = await saveCharacterNote(
        this.app,
        character,
        this.settings.charactersFolder,
      );
      new Notice(`Character saved to ${file.path}`);
    } catch (error) {
      console.error("D&D VTT: failed to save character note", error);
      new Notice(
        "Failed to save the character note — the character is still open in the sheet. See the developer console for details.",
      );
    }

    for (const leaf of this.app.workspace.getLeavesOfType(
      VIEW_TYPE_CHARACTER_CREATION,
    )) {
      leaf.detach();
    }

    await this.activateCharacterSheet();
    this.showCharacter(character, file);
  }

  /** Parse the active note as a character and show it in the sheet. */
  private async loadCharacterFromActiveNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("Open a character note first.");
      return;
    }
    const result = await loadCharacterNote(this.app, file);
    if (!result.ok) {
      new Notice(result.error);
      return;
    }
    await this.activateCharacterSheet();
    this.showCharacter(result.character, file);
  }
}

class DndVttSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: DndVttPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName("Characters folder")
      .setDesc(
        'Vault folder where new character notes are created, e.g. "Hell dnd/Pc". Created if missing.',
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.charactersFolder)
          .setValue(this.plugin.settings.charactersFolder)
          .onChange(async (value) => {
            this.plugin.settings.charactersFolder =
              value.trim() || DEFAULT_SETTINGS.charactersFolder;
            await this.plugin.saveSettings();
          }),
      );
  }
}
