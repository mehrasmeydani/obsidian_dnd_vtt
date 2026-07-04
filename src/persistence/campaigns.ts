/**
 * Campaign folder logic (T-24), pure and vault-free: the plugin owns a
 * list of campaigns (name + root folder) with one active; entity types
 * declare which subfolder they live in, and creation commands resolve
 * their target folder through here. The user's live convention is the
 * default: campaigns are `<Name> dnd/` folders with PCs in `Pc/`.
 *
 * With no active campaign everything falls back to the flat folder
 * settings (pre-T-24 behavior, no breaking change).
 */

export interface Campaign {
  name: string;
  /** Vault-relative root folder, e.g. "Hell dnd". */
  root: string;
}

/** Entity types that know where they live inside a campaign. */
export type CampaignEntityKind = "character" | "session";

export const ENTITY_SUBFOLDER: Record<CampaignEntityKind, string> = {
  character: "Pc",
  session: "Sessions",
};

/** Default scaffold, matching the user's vault convention. */
export const DEFAULT_CAMPAIGN_TEMPLATE = ["Pc", "Sessions", "Npc", "Handouts"];

/** The conventional root folder for a campaign name. */
export function campaignRoot(name: string): string {
  return `${name.trim()} dnd`;
}

/** Recognize existing `<Name> dnd` folders among the vault's root folders. */
export function detectCampaigns(rootFolderNames: string[]): Campaign[] {
  return rootFolderNames
    .map((folder) => {
      const match = folder.match(/^(.+) dnd$/);
      return match ? { name: match[1], root: folder } : null;
    })
    .filter((campaign): campaign is Campaign => campaign !== null);
}

/**
 * Every folder the scaffold must ensure, root first. Creation is
 * idempotent by construction: callers ensure each path, and ensureFolder
 * never touches folders that already exist.
 */
export function scaffoldPaths(
  root: string,
  template: string[] = DEFAULT_CAMPAIGN_TEMPLATE,
): string[] {
  const cleaned = template.map((sub) => sub.trim()).filter(Boolean);
  return [root, ...cleaned.map((sub) => `${root}/${sub}`)];
}

/**
 * Where a new entity of `kind` should be created: the active campaign's
 * subfolder, or the flat fallback folder when no campaign is active.
 */
export function resolveEntityFolder(
  campaign: Campaign | null,
  kind: CampaignEntityKind,
  fallback: string,
): string {
  if (!campaign) return fallback;
  return `${campaign.root}/${ENTITY_SUBFOLDER[kind]}`;
}
