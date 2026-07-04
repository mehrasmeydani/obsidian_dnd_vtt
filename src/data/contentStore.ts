import { ARMOR, RACES, CLASSES, BACKGROUNDS, FEATS } from "./srd";
import type {
  BackgroundData,
  ClassData,
  ContentBundle,
  FeatData,
  ItemData,
  MonsterData,
  RaceData,
  SpellData,
} from "./contentSchema";

/**
 * The plugin's game-content service: the bundled SRD plus any number of
 * user-supplied bundles (dropped-in JSON today; Open5e / 5etools imports in
 * T-12/T-13), merged by entity id. Later bundles override earlier ones, so a
 * homebrew bundle can replace an SRD entry outright; the SRD itself is always
 * the base layer. Pure and Obsidian-free — the plugin owns loading files and
 * feeding them in.
 */

/** A loaded bundle plus the bookkeeping the settings UI shows. */
export interface BundleEntry {
  /** Stable identity: the file name for loaded bundles, "srd" for the base. */
  id: string;
  bundle: ContentBundle;
  enabled: boolean;
  builtin: boolean;
}

export class ContentStore {
  private entries: BundleEntry[] = [];

  constructor() {
    this.entries.push({
      id: "srd",
      bundle: {
        name: "SRD (bundled)",
        races: RACES,
        classes: CLASSES,
        backgrounds: BACKGROUNDS,
        feats: FEATS,
        armor: ARMOR,
        spells: [],
        monsters: [],
        items: [],
      },
      enabled: true,
      builtin: true,
    });
  }

  /**
   * Add a validated bundle under `id` (the file name). Re-adding an id
   * replaces it in place, keeping its position in the override order.
   */
  addBundle(id: string, bundle: ContentBundle, enabled = true): void {
    const existing = this.entries.findIndex((e) => e.id === id);
    const entry: BundleEntry = { id, bundle, enabled, builtin: false };
    if (existing >= 0) this.entries[existing] = entry;
    else this.entries.push(entry);
  }

  /** Loaded bundles in override order (the built-in SRD first). */
  list(): readonly BundleEntry[] {
    return this.entries;
  }

  /** Enable/disable a bundle. The built-in SRD cannot be disabled. */
  setEnabled(id: string, enabled: boolean): void {
    const entry = this.entries.find((e) => e.id === id);
    if (entry && !entry.builtin) entry.enabled = enabled;
  }

  get races(): RaceData[] {
    return this.merged((b) => b.races);
  }

  get classes(): ClassData[] {
    return this.merged((b) => b.classes);
  }

  get backgrounds(): BackgroundData[] {
    return this.merged((b) => b.backgrounds);
  }

  get feats(): FeatData[] {
    return this.merged((b) => b.feats);
  }

  get spells(): SpellData[] {
    return this.merged((b) => b.spells);
  }

  get monsters(): MonsterData[] {
    return this.merged((b) => b.monsters);
  }

  get items(): ItemData[] {
    return this.merged((b) => b.items);
  }

  /** Merge one entity list across enabled bundles: later bundles win by id. */
  private merged<T extends { id: string }>(
    pick: (bundle: ContentBundle) => T[],
  ): T[] {
    const byId = new Map<string, T>();
    for (const entry of this.entries) {
      if (!entry.enabled) continue;
      for (const item of pick(entry.bundle)) {
        byId.set(item.id, item);
      }
    }
    return [...byId.values()];
  }
}
