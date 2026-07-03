import { ItemView, type WorkspaceLeaf } from "obsidian";
import { type Root } from "react-dom/client";
import { mountReact } from "./mount";
import { type Character } from "../model/schema";
import {
  CharacterCreationWizard,
  type WizardContent,
} from "./CharacterCreationWizard";

export const VIEW_TYPE_CHARACTER_CREATION = "dnd-vtt-character-creation";

/**
 * Workspace view hosting the character creation wizard. The plugin supplies
 * `onComplete` and the merged game content (SRD + user bundles); cancelling
 * just closes the view.
 */
export class CharacterCreationView extends ItemView {
  private root: Root | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private onComplete: (character: Character) => void,
    private getContent: () => WizardContent,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CHARACTER_CREATION;
  }

  getDisplayText(): string {
    return "Create D&D character";
  }

  getIcon(): string {
    return "user-plus";
  }

  async onOpen(): Promise<void> {
    this.root = mountReact(
      this.contentEl,
      <CharacterCreationWizard
        onComplete={this.onComplete}
        onCancel={() => this.leaf.detach()}
        content={this.getContent()}
      />,
    );
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}
