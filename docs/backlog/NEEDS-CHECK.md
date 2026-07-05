# Needs your check

Everything here shipped and is green in CI, but **you haven't verified it
in Obsidian yet**. Test each item, then either flip its board status to
`done` (and delete its line here) or drop a note in `todo` with what's
wrong.

*(Big sweep 2026-07-05: your todo verdicts flipped T-07/08/12/13/17/21/
25/26/27/28/30–35/37/43/44 to done; the reported problems became
T-46…T-56 on the board.)*

- **T-10 Player notes** — "Create session note" command; visibility via
  frontmatter (`private`/`party`/`dm`); sessions folder setting.
  **How to check:** run the command from the palette (with a campaign
  active it lands in `<Campaign> dnd/Sessions/`, else the sessions
  folder from settings); open the note and set `visibility: dm` (or
  `party`/`private`) in frontmatter — the value is what a future sync
  layer will filter on, so today the check is just: note created in the
  right folder, frontmatter keys present, your prose preserved on edit.

- **T-22 / T-36 Equip & Wearing/Bags** — kept open: your report
  "equipping items is gone again" is being fixed under **T-52**;
  re-verify both once it ships.

- **T-23 Frontmatter projection** — kept in progress at your request
  (`hp`/`hp_max`/`race` two-way; `ac`/`level`/`class` write-only).

- **T-24 Campaigns** — kept in progress at your request ("Create
  campaign" scaffolding, active-campaign routing, `campaign` stamping).

<!-- appended as each fix lands -->
