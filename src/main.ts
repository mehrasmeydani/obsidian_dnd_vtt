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
import { createSessionNote } from "./persistence/sessionStore";
import { newSessionNote } from "./persistence/sessionNote";
import { ContentStore } from "./data/contentStore";
import { parseContentBundle } from "./data/contentSchema";
import type { TFile } from "obsidian";
import type { Character } from "./model/schema";
import { ZodError } from "zod";

interface DndVttSettings {
  /** Vault folder where new character notes are created. */
  charactersFolder: string;
  /** Vault folder where new session notes are created. */
  sessionsFolder: string;
  /** File names of content bundles the user switched off. */
  disabledBundles: string[];
}

const DEFAULT_SETTINGS: DndVttSettings = {
  charactersFolder: "Characters",
  sessionsFolder: "Sessions",
  disabledBundles: [],
};

/**
 * Plugin entry point. Registers the character-sheet view and the creation
 * wizard. Finished characters are saved as vault notes (frontmatter + JSON
 * block, see `persistence/characterNote.ts`) and can be loaded back from any
 * such note. Later phases add the 5e content browser, sync, and map views.
 */
export default class DndVttPlugin extends Plugin {
  settings: DndVttSettings = { ...DEFAULT_SETTINGS };
  content = new ContentStore();
  private activeCharacter: BoundCharacter | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.loadContentBundles();
    this.addSettingTab(new DndVttSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_CHARACTER_SHEET,
      (leaf) => new CharacterSheetView(leaf, () => this.activeCharacter),
    );
    this.registerView(
      VIEW_TYPE_CHARACTER_CREATION,
      (leaf) =>
        new CharacterCreationView(
          leaf,
          (character) => {
            void this.finishCharacterCreation(character);
          },
          () => ({
            races: this.content.races,
            classes: this.content.classes,
            backgrounds: this.content.backgrounds,
            feats: this.content.feats,
          }),
        ),
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
    this.addCommand({
      id: "create-session-note",
      name: "Create session note",
      callback: () => {
        void this.createSessionNote();
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

  /**
   * Load every `*.json` bundle from `<plugin dir>/data/content/` into the
   * content store (T-11). Invalid bundles are skipped with a notice naming
   * the file and the first problem; nothing here touches the network.
   */
  private async loadContentBundles(): Promise<void> {
    const adapter = this.app.vault.adapter;
    const dir = `${this.manifest.dir}/data/content`;
    if (!(await adapter.exists(dir))) return;

    const listing = await adapter.list(dir);
    for (const path of listing.files.filter((f) => f.endsWith(".json")).sort()) {
      const fileName = path.split("/").pop() ?? path;
      try {
        const bundle = parseContentBundle(JSON.parse(await adapter.read(path)));
        this.content.addBundle(
          fileName,
          bundle,
          !this.settings.disabledBundles.includes(fileName),
        );
      } catch (error) {
        console.error(`D&D VTT: invalid content bundle ${path}`, error);
        new Notice(
          `D&D VTT: skipping content bundle "${fileName}" — ${bundleProblem(error)}`,
        );
      }
    }
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

  /**
   * Create today's session note in the sessions folder and open it for
   * editing (T-10). Visibility starts private; the note explains how to
   * change it via frontmatter.
   */
  private async createSessionNote(): Promise<void> {
    try {
      const note = newSessionNote(crypto.randomUUID(), new Date());
      const file = await createSessionNote(
        this.app,
        note,
        this.settings.sessionsFolder,
      );
      await this.app.workspace.getLeaf(true).openFile(file);
      new Notice(`Session note created at ${file.path}`);
    } catch (error) {
      console.error("D&D VTT: failed to create session note", error);
      new Notice(
        "Failed to create the session note. See the developer console for details.",
      );
    }
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

/** A short, user-facing description of why a bundle failed to load. */
function bundleProblem(error: unknown): string {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const where = issue.path.join(".") || "bundle";
    return `invalid content at "${where}": ${issue.message}`;
  }
  if (error instanceof SyntaxError) return "not valid JSON.";
  return error instanceof Error ? error.message : String(error);
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

    new Setting(this.containerEl)
      .setName("Sessions folder")
      .setDesc(
        'Vault folder where new session notes are created, e.g. "Hell dnd/Sessions". Created if missing.',
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.sessionsFolder)
          .setValue(this.plugin.settings.sessionsFolder)
          .onChange(async (value) => {
            this.plugin.settings.sessionsFolder =
              value.trim() || DEFAULT_SETTINGS.sessionsFolder;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(this.containerEl)
      .setName("Content bundles")
      .setDesc(
        "Game content sources, merged in order (later bundles override by id). " +
          "Drop *.json bundle files into the plugin's data/content/ folder and " +
          "reload the plugin to add more.",
      )
      .setHeading();

    for (const entry of this.plugin.content.list()) {
      const meta = [
        entry.bundle.source,
        entry.bundle.fetchedAt ? `fetched ${entry.bundle.fetchedAt}` : null,
        `${entry.bundle.races.length} races · ${entry.bundle.classes.length} classes · ${entry.bundle.backgrounds.length} backgrounds`,
      ]
        .filter(Boolean)
        .join(" — ");

      const setting = new Setting(this.containerEl)
        .setName(
          entry.builtin ? entry.bundle.name : `${entry.bundle.name} (${entry.id})`,
        )
        .setDesc(meta);
      if (entry.builtin) {
        setting.setDesc(`${meta} — always on.`);
      } else {
        setting.addToggle((toggle) =>
          toggle.setValue(entry.enabled).onChange(async (enabled) => {
            this.plugin.content.setEnabled(entry.id, enabled);
            this.plugin.settings.disabledBundles = enabled
              ? this.plugin.settings.disabledBundles.filter(
                  (id) => id !== entry.id,
                )
              : [...new Set([...this.plugin.settings.disabledBundles, entry.id])];
            await this.plugin.saveSettings();
          }),
        );
      }
    }
  }
}
