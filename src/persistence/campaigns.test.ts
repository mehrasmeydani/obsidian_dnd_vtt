import { describe, expect, it } from "vitest";
import {
  campaignRoot,
  detectCampaigns,
  resolveEntityFolder,
  scaffoldPaths,
  DEFAULT_CAMPAIGN_TEMPLATE,
} from "./campaigns";
import { stampFrontmatterValue } from "./frontmatter";
import { serializeCharacterNote } from "./characterNote";
import { emptyCharacter } from "../model/schema";

/**
 * T-24 tests: campaign folder resolution and scaffolding are pure; the
 * `campaign` frontmatter key is stamped only when absent (the user's own
 * Templater template writes it too, and hand edits win).
 */

describe("detectCampaigns", () => {
  it("recognizes '<Name> dnd' folders and ignores the rest", () => {
    expect(
      detectCampaigns(["Hell dnd", "Notes", "Waterdeep dnd", "dnd", "Old dndx"]),
    ).toEqual([
      { name: "Hell", root: "Hell dnd" },
      { name: "Waterdeep", root: "Waterdeep dnd" },
    ]);
  });
});

describe("scaffoldPaths", () => {
  it("lists the root first, then each template subfolder", () => {
    expect(scaffoldPaths("Hell dnd")).toEqual([
      "Hell dnd",
      "Hell dnd/Pc",
      "Hell dnd/Sessions",
      "Hell dnd/Npc",
      "Hell dnd/Handouts",
    ]);
  });

  it("supports a custom template and drops blank entries", () => {
    expect(scaffoldPaths("X dnd", ["Maps", " ", "Loot"])).toEqual([
      "X dnd",
      "X dnd/Maps",
      "X dnd/Loot",
    ]);
    expect(DEFAULT_CAMPAIGN_TEMPLATE).toContain("Pc");
  });
});

describe("resolveEntityFolder", () => {
  const hell = { name: "Hell", root: "Hell dnd" };

  it("routes entities into the active campaign's subfolders", () => {
    expect(resolveEntityFolder(hell, "character", "Characters")).toBe(
      "Hell dnd/Pc",
    );
    expect(resolveEntityFolder(hell, "session", "Sessions")).toBe(
      "Hell dnd/Sessions",
    );
  });

  it("falls back to the flat folder when no campaign is active", () => {
    expect(resolveEntityFolder(null, "character", "Characters")).toBe(
      "Characters",
    );
    expect(resolveEntityFolder(null, "session", "Sessions")).toBe("Sessions");
  });
});

describe("campaignRoot", () => {
  it("follows the '<Name> dnd' convention", () => {
    expect(campaignRoot(" Hell ")).toBe("Hell dnd");
  });
});

describe("campaign frontmatter stamp", () => {
  it("adds the campaign key to a fresh character note", () => {
    const note = stampFrontmatterValue(
      serializeCharacterNote(emptyCharacter("id-1", "Borin")),
      "campaign",
      "Hell",
    );
    expect(note).toContain("campaign: Hell");
    expect(note.match(/^campaign:/gm)).toHaveLength(1);
  });

  it("never overwrites an existing campaign key (user-owned)", () => {
    const existing = [
      "---",
      "campaign: Waterdeep",
      "player: Mehras",
      "---",
      "",
      "# Borin",
    ].join("\n");
    const stamped = stampFrontmatterValue(existing, "campaign", "Hell");
    expect(stamped).toBe(existing);
  });

  it("adds frontmatter to a bare note when stamping", () => {
    const stamped = stampFrontmatterValue("Just prose.", "campaign", "Hell");
    expect(stamped.startsWith("---\ncampaign: Hell\n---\n")).toBe(true);
    expect(stamped).toContain("Just prose.");
  });
});
