# Needs your check

Everything here shipped and is green in CI, but **you haven't verified it
in Obsidian yet**. Test each item, then either flip its board status to
`done` (and delete its line here) or drop a note in `todo` with what's
wrong.

## From the big backlog round (2026-07-04)

- **T-10 Player notes** — "Create session note" command; visibility via
  frontmatter (`private`/`party`/`dm`); sessions folder setting.
- **T-12 Open5e client** — "Refresh 5e content from Open5e" command;
  caches spells/monsters/magic items as bundles; offline afterwards;
  per-bundle toggles in settings.
- **T-13 5etools importer** — "Import 5etools data" command; scans the
  `5etools` vault folder (setting) for your JSON files; skipped records
  land in the console.
- **T-22 Equip toggle** — read-mode inventory chips are clickable
  equip/unequip; AC follows; second body armor doffs the first.
  *(Superseded in part by T-36: only wearables keep the toggle.)*
- **T-23 Frontmatter projection** — `hp`/`hp_max`/`race` sync both ways
  with the note frontmatter; `ac`/`level`/`class` are written read-only;
  your `campaign`/`player`/`type` keys untouched.
- **T-24 Campaigns** — "Create campaign" command scaffolds `<Name> dnd/`
  (Pc/Sessions/Npc/Handouts); active campaign in settings routes new
  characters to `Pc/`, session notes to `Sessions/`; `campaign`
  frontmatter stamped only when absent.
- **T-21 Leveled features, all classes** — every 2014 class + SRD
  subclass has its full 1–20 progression; monk speed tiers; new resource
  pips (Ki, Sorcery Points, Channel Divinity, Lay on Hands…).
- **T-07 Rolled HP & starting gold** — HP mode on the Abilities step;
  "take starting gold instead" on the Equipment step.
- **T-08 Languages & tools** — races/backgrounds grant and offer
  languages/tools; shown on the sheet under Proficiencies & languages.

## From your todo file (fixed this round)

- **T-25 Level field** — erasing the starting level shows an empty field
  (draft keeps the last valid level; leaving the field restores it).
- **T-26 ASI labels** — ability rows now say "+2 racial" and "+1 ASI"
  separately instead of calling everything racial.

- **T-28 Skill cross-filtering** — a skill chosen in any pick list (class,
  additional, feature choice) disappears from all the others, both
  directions; unchecking brings it back; granted skills never listed.

- **T-34 Rest confirmation** — Short/Long rest flips into an inline
  "Take a short/long rest? Confirm / Cancel" pair; nothing happens until
  Confirm.

- **T-36 Wearing vs bags** — read-mode inventory splits into "Wearing"
  and "In bags"; only armor-linked items get the equip toggle (read
  mode) and the Equipped checkbox (edit mode) — gold and gear are plain
  chips.

- **T-33 Feature grouping** — Features & Traits now renders per origin:
  race, class (level-sorted, subclass + leveled feats inline),
  background, feats (leveled feats appear in both class and feats).

- **T-32 Collapsible sections** — Inventory, Spells, Features & Traits,
  Proficiencies & languages, and Notes fold behind their titles
  (chevron); HP/Combat/Abilities stay always visible.

- **T-27 Dice animation** — HP roll chips tumble in one after another
  and the gold total pops on every (re)roll; disabled under
  prefers-reduced-motion.

- **T-37 Stale expertise (your live report)** — unchecking a proficient
  skill now releases its expertise pick; the counter drops and the step
  explains what's owed instead of jamming. (The end-to-end repro also
  confirmed feats/feature groups render on the sheet for valid
  characters — if a specific note still shows no Feats section, send it
  my way via the todo file.)

- **T-35 Defenses & conditions** — new sheet tile: always-live condition
  toggle chips (14 standard + Exhaustion, red when active) plus
  resistances/immunities/vulnerabilities lists editable in edit mode
  (comma-separated). Stored on the character, round-trips the note.

- **T-30 Free navigation** — every step header is always clickable and
  Next never blocks; incomplete steps carry a red "!" marker and the
  footer hint still says what's missing. Only "Create character"
  requires a complete draft.
- **T-31 Live preview** — the Review step now previews an incomplete
  draft (name/race/class line, ability scores with modifiers, HP so
  far, picked skills) under a "Still missing" list instead of refusing.

<!-- appended as each fix lands -->
