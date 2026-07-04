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

<!-- appended as each fix lands -->
