import { describe, expect, it } from "vitest";
import type { Note } from "../model/schema";
import {
  newSessionNote,
  parseSessionNote,
  serializeSessionNote,
} from "./sessionNote";

/**
 * Regression tests for the session-note format (T-10): machine data lives
 * only in frontmatter (marker, id, visibility), the prose body is
 * user-owned, and malformed frontmatter degrades into readable errors.
 */

function sampleNote(): Note {
  return {
    id: "note-123",
    title: "Session 2026-07-04",
    body: "",
    visibility: "party",
  };
}

describe("round trip", () => {
  it("serializes a fresh note and parses the same data back", () => {
    const note = sampleNote();
    const content = serializeSessionNote(note);

    expect(content).toContain("dnd-vtt: note");
    expect(content).toContain("note-id: note-123");
    expect(content).toContain("visibility: party");
    expect(content).toContain("# Session 2026-07-04");

    const result = parseSessionNote(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.note.id).toBe("note-123");
      expect(result.note.title).toBe("Session 2026-07-04");
      expect(result.note.visibility).toBe("party");
    }
  });

  it("survives repeated save cycles without duplicating frontmatter", () => {
    const note = sampleNote();
    let content = serializeSessionNote(note);
    content = serializeSessionNote(note, content);
    content = serializeSessionNote(note, content);

    expect(content.match(/^dnd-vtt: note$/gm)).toHaveLength(1);
    expect(content.match(/^visibility: party$/gm)).toHaveLength(1);
    expect(parseSessionNote(content).ok).toBe(true);
  });

  it("preserves user prose and foreign frontmatter on update", () => {
    const existing = [
      "---",
      "dnd-vtt: note",
      "note-id: note-123",
      "visibility: private",
      "campaign: Hell",
      "tags:",
      "  - session",
      "---",
      "",
      "# Session 2026-07-04",
      "",
      "The party met the Black Raven. See [[Borin Ironfist]].",
    ].join("\n");

    const updated = { ...sampleNote(), visibility: "dm" as const };
    const content = serializeSessionNote(updated, existing);

    expect(content).toContain("visibility: dm");
    expect(content).toContain("campaign: Hell");
    expect(content).toContain("  - session");
    expect(content).toContain("The party met the Black Raven. See [[Borin Ironfist]].");

    const result = parseSessionNote(content);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.note.visibility).toBe("dm");
  });

  it("adds frontmatter to a bare prose note", () => {
    const content = serializeSessionNote(sampleNote(), "Just prose so far.");
    expect(content.startsWith("---\ndnd-vtt: note\n")).toBe(true);
    expect(content).toContain("Just prose so far.");
    expect(parseSessionNote(content).ok).toBe(true);
  });
});

describe("hand-edited visibility", () => {
  const base = serializeSessionNote(sampleNote());

  it("accepts every valid visibility value", () => {
    for (const visibility of ["private", "party", "dm"]) {
      const content = base.replace(/^visibility: .*$/m, `visibility: ${visibility}`);
      const result = parseSessionNote(content);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.note.visibility).toBe(visibility);
    }
  });

  it("defaults to private when the visibility line is removed", () => {
    const content = base.replace(/^visibility: .*$\n/m, "");
    const result = parseSessionNote(content);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.note.visibility).toBe("private");
  });

  it("reports an invalid visibility with the valid options", () => {
    const content = base.replace(/^visibility: .*$/m, "visibility: everyone");
    const result = parseSessionNote(content);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('"everyone"');
      expect(result.error).toContain("private, party, dm");
    }
  });
});

describe("graceful failure", () => {
  it("reports a missing marker", () => {
    const result = parseSessionNote("# Just a note\n\nNo frontmatter.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("dnd-vtt: note");
  });

  it("reports a character note as not a session note", () => {
    const result = parseSessionNote("---\ndnd-vtt: character\n---\n\n# Borin");
    expect(result.ok).toBe(false);
  });

  it("reports a missing note id", () => {
    const result = parseSessionNote("---\ndnd-vtt: note\n---\n\n# Untagged");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("note-id");
  });

  it("falls back to the given title when the body has no heading", () => {
    const content = "---\ndnd-vtt: note\nnote-id: n1\n---\n\nProse only.";
    const result = parseSessionNote(content, "Session 12");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.note.title).toBe("Session 12");
  });
});

describe("newSessionNote", () => {
  it("titles the note with the ISO date and starts private", () => {
    const note = newSessionNote("n1", new Date("2026-07-04T12:00:00Z"));
    expect(note.title).toBe("Session 2026-07-04");
    expect(note.visibility).toBe("private");
  });
});
