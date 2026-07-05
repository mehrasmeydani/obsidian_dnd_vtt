# Needs your check

Everything here shipped and is green in CI, but **you haven't verified it
in Obsidian yet**. Test each item, then either flip its board status to
`done` (and delete its line here) or drop a note in `todo` with what's
wrong.

*(Big sweep 2026-07-05: your todo verdicts flipped T-07/08/12/13/17/21/
25/26/27/28/30–35/37/43/44 to done; the reported problems became
T-46…T-56 on the board.)*

- **T-49 Edition sections** — the Race/Class/Background card grids now
  split into a "5.5e (2024)" section on top and "5e (2014)" below
  instead of mixing editions. Verify all three steps.

- **Items & spells import** — the importer now ingests 5etools
  `item`/`baseitem`; `items.json`, `items-base.json`, `spells-phb.json`
  and `spells-xphb.json` were copied into your vault's `5etools`
  folder. **Re-run "Import 5etools data"**, then check settings show the
  bundle grew (~2,658 items, ~752 spells). Nothing browses them yet —
  that's T-48 (loot picker) and T-15 (spell selection).

- **T-10 Player notes** — "Create session note" command; visibility via
  frontmatter (`private`/`party`/`dm`); sessions folder setting.
  **How to check:** run the command from the palette (with a campaign
  active it lands in `<Campaign> dnd/Sessions/`, else the sessions
  folder from settings); open the note and set `visibility: dm` (or
  `party`/`private`) in frontmatter — the value is what a future sync
  layer will filter on, so today the check is just: note created in the
  right folder, frontmatter keys present, your prose preserved on edit.

- **T-22 / T-36 / T-52 Equipping** — fixed per your rule: **every**
  item can equip now (greataxe, backpack — on your person vs in
  bags/cart/horse), not just armor. Verify: read-mode inventory chips
  are all clickable toggles; "Wearing" vs "In bags" follows them;
  equipping armor still moves AC (and a second body armor doffs the
  first) while non-armor gear never changes AC; an *old* character
  note's armor also moves AC again (links heal on load). Slot limits
  (one body armor, two hands…) remain future work under T-38.

- **T-23 Frontmatter projection** — kept in progress at your request
  (`hp`/`hp_max`/`race` two-way; `ac`/`level`/`class` write-only).

- **T-24 Campaigns** — kept in progress at your request ("Create
  campaign" scaffolding, active-campaign routing, `campaign` stamping).

<!-- appended as each fix lands -->
