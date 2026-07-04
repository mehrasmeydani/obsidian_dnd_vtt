import {
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  requestUrl,
  Setting,
  TFolder,
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
  ensureFolder,
  loadCharacterNote,
  saveCharacterNote,
} from "./persistence/characterStore";
import { createSessionNote } from "./persistence/sessionStore";
import { newSessionNote } from "./persistence/sessionNote";
import {
  campaignRoot,
  detectCampaigns,
  resolveEntityFolder,
  scaffoldPaths,
  DEFAULT_CAMPAIGN_TEMPLATE,
  type Campaign,
  type CampaignEntityKind,
} from "./persistence/campaigns";
import { refreshOpen5eContent } from "./data/open5e";
import { importFiveEtools } from "./data/fiveEtoolsImport";
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
  /** Vault folder scanned for user-supplied 5etools JSON files. */
  fiveEtoolsFolder: string;
  /** File names of content bundles the user switched off. */
  disabledBundles: string[];
  /** Known campaigns (name + root folder), T-24. */
  campaigns: Campaign[];
  /** Name of the active campaign; "" = none (flat folders above apply). */
  activeCampaign: string;
  /** Subfolders "Create campaign" scaffolds, comma-separated in settings. */
  campaignTemplate: string[];
}

const DEFAULT_SETTINGS: DndVttSettings = {
  charactersFolder: "Characters",
  sessionsFolder: "Sessions",
  fiveEtoolsFolder: "5etools",
  disabledBundles: [],
  campaigns: [],
  activeCampaign: "",
  campaignTemplate: DEFAULT_CAMPAIGN_TEMPLATE,
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
    this.addCommand({
      id: "refresh-open5e-content",
      name: "Refresh 5e content from Open5e",
      callback: () => {
        void this.refreshOpen5eContent();
      },
    });
    this.addCommand({
      id: "import-5etools-data",
      name: "Import 5etools data",
      callback: () => {
        void this.importFiveEtoolsData();
      },
    });
    this.addCommand({
      id: "create-campaign",
      name: "Create campaign",
      callback: () => {
        new CampaignNameModal(this.app, (name) => {
          void this.createCampaign(name);
        }).open();
      },
    });
  }

  /** The active campaign, or null when none is configured. */
  activeCampaign(): Campaign | null {
    return (
      this.settings.campaigns.find(
        (campaign) => campaign.name === this.settings.activeCampaign,
      ) ?? null
    );
  }

  /** Target folder for a new entity: active campaign subfolder or fallback. */
  private entityFolder(kind: CampaignEntityKind): string {
    const fallback =
      kind === "character"
        ? this.settings.charactersFolder
        : this.settings.sessionsFolder;
    return resolveEntityFolder(this.activeCampaign(), kind, fallback);
  }

  /**
   * Scaffold a campaign's folder structure (T-24). Existing folders are
   * never touched; re-running is a no-op. The new campaign becomes active.
   */
  async createCampaign(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      new Notice("Campaign name cannot be empty.");
      return;
    }
    try {
      const existing = this.settings.campaigns.find((c) => c.name === trimmed);
      const root = existing?.root ?? campaignRoot(trimmed);
      for (const path of scaffoldPaths(root, this.settings.campaignTemplate)) {
        await ensureFolder(this.app, path);
      }
      if (!existing) {
        this.settings.campaigns.push({ name: trimmed, root });
      }
      this.settings.activeCampaign = trimmed;
      await this.saveSettings();
      new Notice(`Campaign "${trimmed}" ready at ${root}/ (now active).`);
    } catch (error) {
      console.error("D&D VTT: failed to create campaign", error);
      new Notice("Failed to create the campaign folders. See the developer console.");
    }
  }

  /** `<Name> dnd/` folders at the vault root not yet registered. */
  detectNewCampaigns(): Campaign[] {
    const rootFolders = this.app.vault
      .getRoot()
      .children.filter((child): child is TFolder => child instanceof TFolder)
      .map((folder) => folder.name);
    const known = new Set(this.settings.campaigns.map((c) => c.root));
    return detectCampaigns(rootFolders).filter((c) => !known.has(c.root));
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

  /**
   * The explicit, manual Open5e refresh (T-12): download SRD spells,
   * monsters, and magic items; cache each category as a content bundle
   * under `<plugin dir>/data/content/` (picked up offline on every future
   * startup); and merge them into the running content store. This command
   * is the only place the plugin ever touches the network.
   */
  private async refreshOpen5eContent(): Promise<void> {
    const progress = new Notice("Refreshing 5e content from Open5e…", 0);
    try {
      const { bundles, failures } = await refreshOpen5eContent(
        { getJson: async (url) => (await requestUrl({ url })).json },
        (message) => progress.setMessage(message),
      );

      const dir = `${this.manifest.dir}/data/content`;
      const adapter = this.app.vault.adapter;
      for (const segment of ["data", "data/content"]) {
        const path = `${this.manifest.dir}/${segment}`;
        if (!(await adapter.exists(path))) await adapter.mkdir(path);
      }

      const summary: string[] = [];
      for (const { fileName, bundle, skipped } of bundles) {
        await adapter.write(
          `${dir}/${fileName}`,
          JSON.stringify(bundle, null, 2),
        );
        this.content.addBundle(
          fileName,
          bundle,
          !this.settings.disabledBundles.includes(fileName),
        );
        const count =
          bundle.spells.length + bundle.monsters.length + bundle.items.length;
        summary.push(`${bundle.name}: ${count}`);
        if (skipped.length > 0) {
          console.warn(
            `D&D VTT: ${skipped.length} Open5e records skipped in ${fileName}`,
            skipped,
          );
          summary.push(`(${skipped.length} skipped — see console)`);
        }
      }
      for (const failure of failures) {
        console.error(`D&D VTT: Open5e refresh failed — ${failure}`);
        summary.push(`FAILED ${failure}`);
      }
      progress.setMessage(`Open5e refresh done. ${summary.join(" · ")}`);
      setTimeout(() => progress.hide(), 8000);
    } catch (error) {
      console.error("D&D VTT: Open5e refresh failed", error);
      progress.setMessage(
        "Open5e refresh failed. See the developer console for details.",
      );
      setTimeout(() => progress.hide(), 8000);
    }
  }

  /**
   * Convert user-supplied 5etools JSON files (from the configured vault
   * folder) into a content bundle (T-13). Re-running replaces the bundle.
   * The importer ships, the data does not: imported content stays in the
   * user's plugin folder and must never be redistributed — only SRD
   * content may ship with the plugin.
   */
  private async importFiveEtoolsData(): Promise<void> {
    const folder = this.settings.fiveEtoolsFolder;
    const adapter = this.app.vault.adapter;
    try {
      if (!(await adapter.exists(folder))) {
        new Notice(
          `5etools import folder "${folder}" not found. Create it, drop your 5etools JSON files in, and re-run (folder is configurable in settings).`,
        );
        return;
      }
      const listing = await adapter.list(folder);
      const jsonPaths = listing.files.filter((f) => f.endsWith(".json")).sort();
      if (jsonPaths.length === 0) {
        new Notice(`No .json files found in "${folder}".`);
        return;
      }

      const files: { name: string; json: unknown }[] = [];
      for (const path of jsonPaths) {
        const name = path.split("/").pop() ?? path;
        try {
          files.push({ name, json: JSON.parse(await adapter.read(path)) });
        } catch {
          new Notice(`Skipping "${name}" — not valid JSON.`);
        }
      }

      const { bundle, skipped } = importFiveEtools(files);
      // Round-trip through the bundle validator like any other source.
      const validated = parseContentBundle(JSON.parse(JSON.stringify(bundle)));

      const fileName = "5etools-import.json";
      const dir = `${this.manifest.dir}/data/content`;
      for (const segment of ["data", "data/content"]) {
        const path = `${this.manifest.dir}/${segment}`;
        if (!(await adapter.exists(path))) await adapter.mkdir(path);
      }
      await adapter.write(`${dir}/${fileName}`, JSON.stringify(validated, null, 2));
      this.content.addBundle(
        fileName,
        validated,
        !this.settings.disabledBundles.includes(fileName),
      );

      const counts = [
        [validated.races.length, "races"],
        [validated.classes.length, "classes"],
        [validated.backgrounds.length, "backgrounds"],
        [validated.feats.length, "feats"],
        [validated.spells.length, "spells"],
      ]
        .filter(([count]) => (count as number) > 0)
        .map(([count, label]) => `${count} ${label}`)
        .join(" · ");
      if (skipped.length > 0) {
        console.warn(
          `D&D VTT: ${skipped.length} 5etools records could not be mapped`,
          skipped,
        );
      }
      new Notice(
        `5etools import done: ${counts || "nothing recognized"}.` +
          (skipped.length > 0
            ? ` ${skipped.length} records skipped — see console.`
            : ""),
        8000,
      );
    } catch (error) {
      console.error("D&D VTT: 5etools import failed", error);
      new Notice(
        `5etools import failed — ${bundleProblem(error)}`,
      );
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
        this.entityFolder("character"),
        this.activeCampaign()?.name,
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
        this.entityFolder("session"),
        this.activeCampaign()?.name,
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

/** A one-field prompt for the new campaign's name. */
class CampaignNameModal extends Modal {
  private name = "";

  constructor(
    app: App,
    private onSubmit: (name: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Create campaign");
    const submit = () => {
      if (!this.name.trim()) return;
      this.close();
      this.onSubmit(this.name);
    };
    new Setting(this.contentEl)
      .setName("Campaign name")
      .setDesc('Scaffolds "<name> dnd/" with the configured subfolders.')
      .addText((text) => {
        text.setPlaceholder("Hell").onChange((value) => {
          this.name = value;
        });
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") submit();
        });
      });
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("Create").setCta().onClick(submit),
    );
  }

  onClose(): void {
    this.contentEl.empty();
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

    this.displayCampaigns();

    new Setting(this.containerEl)
      .setName("5etools import folder")
      .setDesc(
        'Vault folder scanned by the "Import 5etools data" command for your own 5etools JSON files. ' +
          "Imported content stays local and is never shared by the plugin. You are responsible " +
          "for only importing material you legally own — only SRD content may be redistributed.",
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.fiveEtoolsFolder)
          .setValue(this.plugin.settings.fiveEtoolsFolder)
          .onChange(async (value) => {
            this.plugin.settings.fiveEtoolsFolder =
              value.trim() || DEFAULT_SETTINGS.fiveEtoolsFolder;
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

    this.displayBundles();
  }

  /** Campaigns (T-24): active picker, per-campaign rows, detect + template. */
  private displayCampaigns(): void {
    new Setting(this.containerEl)
      .setName("Campaigns")
      .setDesc(
        "New characters land in the active campaign's Pc/ folder, session " +
          "notes in Sessions/. With no active campaign the flat folders " +
          "above apply. Use the \"Create campaign\" command to scaffold one.",
      )
      .setHeading();

    new Setting(this.containerEl)
      .setName("Active campaign")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "None (use the folders above)");
        for (const campaign of this.plugin.settings.campaigns) {
          dropdown.addOption(campaign.name, campaign.name);
        }
        dropdown
          .setValue(this.plugin.settings.activeCampaign)
          .onChange(async (value) => {
            this.plugin.settings.activeCampaign = value;
            await this.plugin.saveSettings();
          });
      });

    for (const campaign of this.plugin.settings.campaigns) {
      new Setting(this.containerEl)
        .setName(campaign.name)
        .setDesc("Root folder")
        .addText((text) =>
          text.setValue(campaign.root).onChange(async (value) => {
            campaign.root = value.trim() || campaignRoot(campaign.name);
            await this.plugin.saveSettings();
          }),
        )
        .addExtraButton((button) =>
          button
            .setIcon("trash")
            .setTooltip("Forget this campaign (folders are not deleted)")
            .onClick(async () => {
              this.plugin.settings.campaigns =
                this.plugin.settings.campaigns.filter((c) => c !== campaign);
              if (this.plugin.settings.activeCampaign === campaign.name) {
                this.plugin.settings.activeCampaign = "";
              }
              await this.plugin.saveSettings();
              this.display();
            }),
        );
    }

    const detected = this.plugin.detectNewCampaigns();
    if (detected.length > 0) {
      new Setting(this.containerEl)
        .setName("Detected campaign folders")
        .setDesc(
          `Found in your vault: ${detected.map((c) => c.root).join(", ")}`,
        )
        .addButton((button) =>
          button.setButtonText("Add all").onClick(async () => {
            this.plugin.settings.campaigns.push(...detected);
            await this.plugin.saveSettings();
            this.display();
          }),
        );
    }

    new Setting(this.containerEl)
      .setName("Campaign folder template")
      .setDesc(
        'Subfolders "Create campaign" scaffolds, comma-separated. Existing folders are never touched.',
      )
      .addText((text) =>
        text
          .setValue(this.plugin.settings.campaignTemplate.join(", "))
          .onChange(async (value) => {
            const parsed = value
              .split(",")
              .map((sub) => sub.trim())
              .filter(Boolean);
            this.plugin.settings.campaignTemplate =
              parsed.length > 0 ? parsed : DEFAULT_CAMPAIGN_TEMPLATE;
            await this.plugin.saveSettings();
          }),
      );
  }

  private displayBundles(): void {
    for (const entry of this.plugin.content.list()) {
      const counts = (
        [
          ["races", entry.bundle.races.length],
          ["classes", entry.bundle.classes.length],
          ["backgrounds", entry.bundle.backgrounds.length],
          ["spells", entry.bundle.spells.length],
          ["monsters", entry.bundle.monsters.length],
          ["items", entry.bundle.items.length],
        ] as const
      )
        .filter(([, count]) => count > 0)
        .map(([label, count]) => `${count} ${label}`)
        .join(" · ");
      const meta = [
        entry.bundle.source,
        entry.bundle.fetchedAt ? `fetched ${entry.bundle.fetchedAt}` : null,
        counts || "empty",
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
