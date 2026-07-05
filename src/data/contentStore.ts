import { ARMOR, RACES, CLASSES, BACKGROUNDS, FEATS } from "./srd";
import type {
  BackgroundData,
  ClassData,
  ClassFeature,
  ContentBundle,
  FeatData,
  ItemData,
  MonsterData,
  RaceData,
  SpellData,
  SubclassData,
} from "./contentSchema";

/**
 * The plugin's game-content service: the bundled SRD plus any number of
 * user-supplied bundles (dropped-in JSON today; Open5e / 5etools imports in
 * T-12/T-13), merged by entity id. Later bundles override earlier ones, so a
 * homebrew bundle can replace an SRD entry outright; the SRD itself is always
 * the base layer. Pure and Obsidian-free — the plugin owns loading files and
 * feeding them in.
 */

/** How deep a feature progression goes (0 for none) — the fold's tiebreaker. */
function maxFeatureLevel(features: readonly ClassFeature[]): number {
  return features.reduce((max, f) => Math.max(max, f.level), 0);
}

/**
 * Re-attach the donor's mechanical feature effects onto same-named adopted
 * features that carry none. Imported features are text-only; the SRD's
 * effects (Unarmored Defense, Fast Movement…) must survive the swap or
 * derived sheet numbers break.
 */
function withDonorEffects(
  adopted: readonly ClassFeature[],
  donor: readonly ClassFeature[],
): ClassFeature[] {
  const effectsByName = new Map(
    donor
      .filter((f) => f.effects.length > 0)
      .map((f) => [f.name.toLowerCase(), f.effects]),
  );
  return adopted.map((f) => {
    const effects = effectsByName.get(f.name.toLowerCase());
    return effects && f.effects.length === 0 ? { ...f, effects } : f;
  });
}

/** The deeper subclass wins a name tie, keeping the shallower one's effects
 * and (when the winner has none) its feature choices. */
function deeperSubclass(
  winner: SubclassData,
  loser: SubclassData,
): SubclassData {
  return {
    ...winner,
    features: withDonorEffects(winner.features, loser.features),
    featureChoices:
      winner.featureChoices.length > 0
        ? winner.featureChoices
        : loser.featureChoices,
  };
}

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
    // Classes get one extra merge rule beyond override-by-id: a later class
    // with a *new* id but the same name and edition as an existing card
    // folds in — its unseen subclasses join the existing class instead of
    // spawning a duplicate card. This is the 5etools-import case: the SRD
    // ships one subclass per class (all CC-BY allows), and an imported PHB
    // class carries the full list under a different entity id. Within the
    // fold, deeper data wins (T-44): the staged 2024 SRD cards are
    // level-1-only, so a full import supplies the missing progressions
    // until the T-17 backfill lands.
    const byId = new Map<string, ClassData>();
    const cardIdByNameEdition = new Map<string, string>();
    for (const entry of this.entries) {
      if (!entry.enabled) continue;
      for (const cls of entry.bundle.classes) {
        if (byId.has(cls.id)) {
          byId.set(cls.id, cls); // same id: later bundle replaces outright
          continue;
        }
        const key = `${cls.name.toLowerCase()}::${cls.edition}`;
        const cardId = cardIdByNameEdition.get(key);
        if (cardId === undefined) {
          cardIdByNameEdition.set(key, cls.id);
          byId.set(cls.id, cls);
          continue;
        }
        const base = byId.get(cardId) as ClassData;
        let merged = base;

        // Class features: a staged SRD 5.2 card stops at level 1 (T-17
        // deferred the 2..20 backfill), so a same-name import with a real
        // progression is strictly more useful — adopt its feature list, but
        // re-attach the base's feature effects by name (Unarmored Defense
        // drives derived AC; imports carry text only). Choices, equipment,
        // proficiencies and resources always stay the base's: imports don't
        // model them, and the wizard's pickers must survive.
        if (
          maxFeatureLevel(base.features) <= 1 &&
          maxFeatureLevel(cls.features) > maxFeatureLevel(base.features)
        ) {
          merged = {
            ...merged,
            features: withDonorEffects(cls.features, base.features),
          };
        }

        // Subclasses: fold unseen ones in; on a name tie the *deeper*
        // record wins (the existing card keeps true ties, preserving SRD
        // curation where SRD data is complete). Dedup applies against the
        // card and within the incoming batch alike.
        const byName = new Map(
          merged.subclasses.map((s) => [s.name.toLowerCase(), s]),
        );
        const haveIds = new Set(merged.subclasses.map((s) => s.id));
        let changed = merged !== base;
        for (const sub of cls.subclasses) {
          const nameKey = sub.name.toLowerCase();
          const existing = byName.get(nameKey);
          if (existing) {
            if (maxFeatureLevel(sub.features) > maxFeatureLevel(existing.features)) {
              byName.set(nameKey, deeperSubclass(sub, existing));
              haveIds.add(sub.id);
              changed = true;
            }
            continue;
          }
          if (haveIds.has(sub.id)) continue;
          byName.set(nameKey, sub);
          haveIds.add(sub.id);
          changed = true;
        }
        if (changed) {
          byId.set(cardId, {
            ...merged,
            subclasses: [...byName.values()],
            // A base class without subclasses has no subclass level of its
            // own; adopt the incoming one so the picks unlock.
            subclassLevel: merged.subclassLevel ?? cls.subclassLevel,
          });
        }
      }
    }
    return [...byId.values()];
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
