# Needs your check

Everything here shipped and is green in CI, but **you haven't verified it
in Obsidian yet**. Test each item, then either flip its board status to
`done` (and delete its line here) or drop a note in `todo` with what's
wrong.

*(Big sweep 2026-07-05: your todo verdicts flipped T-07/08/12/13/17/21/
25/26/27/28/30–35/37/43/44 to done; the reported problems became
T-46…T-56 on the board.)*

- **T-45 Collapsible creator sections** — every section on the Class
  options step (subclass, each choice block, granted proficiencies and
  features) now folds behind its heading with a chevron. Choice blocks
  start open; the read-only grant lists start collapsed above level 3.
  A collapsed section with an unresolved choice keeps the red "!"
  marker and the footer hint. Expertise groups on the Skills step fold
  the same way. **How to check:** make a level-5 warlock — grants
  arrive folded, choices open; fold an unfinished invocations group and
  confirm the "!" stays.

- **T-46 ASI spacing** — the ability +/- steppers no longer reuse the
  checkbox grid: wider columns with a real gap, uniform square buttons,
  and the per-level feat dropdown shrinks instead of overflowing.
  **How to check:** Abilities step with a level-8+ character at normal
  and narrow pane widths.

- **T-51 Class choices: Metamagic, invocations & co.** — all SRD
  choose-N-options grants above level 1 are now real pickers on the
  Class options step. **How to check:** create a 2014 sorcerer at
  starting level 3 (or 10/17) — Metamagic groups appear with 8 options
  and an option picked at 3 disappears from the level-10 group; a 2024
  sorcerer gets them at level 2; a 2014 warlock at level 5 owes
  invocations at levels 2 and 5 with grey italic prerequisite text on
  cards like Ascendant Step (advisory only — you enforce prereqs
  yourself for now); a level-10 Champion fighter owes a second Fighting
  Style that can't repeat the first; a level-6 ranger owes extra
  Favored Enemy / Natural Explorer picks. The full audit table is in
  the ticket.

- **T-49 Edition sections** — the Race/Class/Background card grids now
  split into a "5.5e (2024)" section on top and "5e (2014)" below
  instead of mixing editions. Verify all three steps.

- **Items, spells & monsters import** — the importer now ingests
  5etools `item`/`baseitem` and `monster`; `items.json`,
  `items-base.json`, `spells-phb.json`, `spells-xphb.json`,
  `bestiary-mm.json` and `bestiary-xmm.json` were copied into your
  vault's `5etools` folder. **Re-run "Import 5etools data"**, then
  check the import notice / console: ~2,658 items, ~752 spells,
  ~953 monsters, no skipped records from these files. Nothing browses
  them yet — that's T-48 (loot picker), T-15 (spells) and T-57
  (encounter planner).

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
