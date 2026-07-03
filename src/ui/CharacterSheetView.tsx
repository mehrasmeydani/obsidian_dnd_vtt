import { Notice, TFile, ItemView, type WorkspaceLeaf } from "obsidian";
import { type Root } from "react-dom/client";
import { mountReact, renderReact } from "./mount";
import { emptyCharacter, type Character } from "../model/schema";
import { serializeCharacterNote } from "../persistence/characterNote";
import { loadCharacterNote } from "../persistence/characterStore";
import { CharacterSheet } from "./CharacterSheet";

export const VIEW_TYPE_CHARACTER_SHEET = "dnd-vtt-character-sheet";

/** How long the sheet waits after the last edit before writing the note. */
const SAVE_DEBOUNCE_MS = 800;

/** A character plus the vault note it lives in (null = unsaved/demo). */
export interface BoundCharacter {
  character: Character;
  file: TFile | null;
}

/**
 * Obsidian view hosting the editable React character sheet. The sheet binds
 * to a vault note: edits are validated in the React layer, then debounced
 * into the note through the shared serializer (user prose is preserved);
 * hand-edits to the note refresh the sheet, while our own writes are
 * ignored via a self-save counter.
 */
export class CharacterSheetView extends ItemView {
  private root: Root | null = null;
  private character: Character;
  private file: TFile | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: Character | null = null;
  /** Writes we made ourselves; the modify handler skips these. */
  private selfSaves = 0;

  constructor(
    leaf: WorkspaceLeaf,
    private getInitial: () => BoundCharacter | null,
  ) {
    super(leaf);
    this.character = demoCharacter();
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

  /** Swap the displayed character and its note (wizard finish / load command). */
  setCharacter(character: Character, file: TFile | null): void {
    // A pending save belongs to the previous binding; flush it first.
    void this.flushSave();
    this.character = character;
    this.file = file;
    this.render();
  }

  async onOpen(): Promise<void> {
    const initial = this.getInitial();
    if (initial) {
      this.character = initial.character;
      this.file = initial.file;
    } else {
      // No character handed over: bind the active note when it is one.
      const active = this.app.workspace.getActiveFile();
      if (active) {
        const parsed = await loadCharacterNote(this.app, active);
        if (parsed.ok) {
          this.character = parsed.character;
          this.file = active;
        }
      }
    }

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file === this.file) {
          void this.onBoundNoteModified(file);
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file === this.file) {
          this.file = null;
          this.pendingSave = null;
          this.render();
        }
      }),
    );

    this.root = mountReact(this.contentEl, this.sheet());
  }

  async onClose(): Promise<void> {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    await this.flushSave();
    this.root?.unmount();
    this.root = null;
  }

  /** The bound note changed on disk. Skip our own writes; reload the rest. */
  private async onBoundNoteModified(file: TFile): Promise<void> {
    if (this.selfSaves > 0) {
      this.selfSaves--;
      return;
    }
    const parsed = await loadCharacterNote(this.app, file);
    if (parsed.ok) {
      // A hand-edit wins over an unsaved sheet edit from before it.
      this.pendingSave = null;
      this.character = parsed.character;
      this.render();
    }
    // Invalid content: keep showing the last good state; the user is likely
    // mid-edit in the note. The next valid save round-trips normally.
  }

  private handleChange = (next: Character): void => {
    this.character = next;
    this.render();
    if (!this.file) return; // demo/unsaved characters live in memory only
    this.pendingSave = next;
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flushSave();
    }, SAVE_DEBOUNCE_MS);
  };

  private async flushSave(): Promise<void> {
    if (!this.file || !this.pendingSave) return;
    const character = this.pendingSave;
    this.pendingSave = null;
    this.selfSaves++;
    try {
      await this.app.vault.process(this.file, (content) =>
        serializeCharacterNote(character, content),
      );
    } catch (error) {
      this.selfSaves--;
      console.error("D&D VTT: failed to save character note", error);
      new Notice("Failed to save the character note. See the developer console.");
    }
  }

  private sheet(): React.ReactNode {
    return (
      <CharacterSheet
        character={this.character}
        onChange={this.handleChange}
        bound={this.file !== null}
      />
    );
  }

  private render(): void {
    if (this.root) renderReact(this.root, this.sheet());
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
