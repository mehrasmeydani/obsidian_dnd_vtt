# T-19 — Leveled class feature progression (Barbarian first)

**Priority:** P1 · **Size:** L · **Phase:** 1 · **Depends on:** T-18

## User story
As a **player** creating a high-level character, I want every class and
subclass feature my starting level grants to appear on the character —
Reckless Attack at 2, Extra Attack at 5, Brutal Critical at 9/13/17,
Primal Champion at 20 — so the sheet reflects a real level-N character,
not a level-1 character with extra hit points.

Source of truth: the user's level-20 Berserker field guide (2026-07-03,
checked against D&D Beyond) — see the table in this ticket's history and
`docs/reference/5etools/class-barbarian.json`.

## Acceptance criteria
- [ ] Content schema: class and subclass features carry a `level`
      (today's `traits` are level-1-only and stay as such, or migrate to
      a `features: [{level, name, description}]` shape — pick one, don't
      keep both).
- [ ] Scaling features (Brutal Critical 1→2→3 dice, Rage uses/damage
      table) are modeled so the character shows the tier matching its
      level, not three copies. Rage's per-level uses/damage table becomes
      data the future sheet resources (T-01) can read.
- [ ] Assembly copies every class + subclass feature with
      `level <= starting level` onto `Character.features`.
- [ ] Mechanical effects that change derived numbers are applied at
      assembly: Fast Movement (+10 ft speed from level 5, Barbarian) and
      Primal Champion (+4 STR/+4 CON at 20, score cap 24 — needs a cap
      exception in `validateDraft`).
- [ ] The Class options step lists the granted (non-choice) features for
      the chosen class/subclass/level as read-only detail entries
      (name, level tag, description — collapsible like the class manager
      the guide came from), so the page shows the full progression next
      to the choices. Granted proficiencies (T-20) render there the same
      way.
- [ ] Data complete for **Barbarian 2014 + Path of the Berserker**:
      Reckless Attack (2), Danger Sense (2), Extra Attack (5), Fast
      Movement (5), Feral Instinct (7), Brutal Critical (9/13/17),
      Relentless Rage (11), Persistent Rage (15), Indomitable Might (18),
      Primal Champion (20); Berserker: Frenzy (3), Mindless Rage (6),
      Intimidating Presence (10), Retaliation (14). Feature text from the
      SRD, not D&D Beyond/PHB wording.
- [ ] Matrix/unit tests: level-20 barbarian carries the full feature set;
      speed 40 (race 30 + 10); STR/CON +4 over the draft's scores.

## Technical notes
- Per the user (2026-07-03): all class choices render in Class options —
  granted features belong there too as read-only entries.
- T-21 backfills the other 12 classes once the model is proven here.
- 2024 Barbarian gets the same treatment under T-17.
