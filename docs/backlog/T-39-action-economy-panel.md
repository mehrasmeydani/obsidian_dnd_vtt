# T-39 — Action economy panel (actions / bonus / reactions / free)

**Priority:** P2 · **Size:** L · **Phase:** 1–2 · **Depends on:** T-01, T-38 · **From:** user testing (todo round 2)

## User story
As a **player** in combat, I want a sheet section listing what I can do
with each action type — action, bonus action, reaction, free actions —
derived from my equipped items, features, and spells, with the per-turn
budget visible (1 action, 1 bonus action, 1 reaction), so my turn is a
menu instead of a memory test.

## Acceptance criteria
- [ ] Sheet gains an "Actions" section grouped by type: Action / Bonus
      action / Reaction / Free, each showing its per-turn budget.
- [ ] Baseline entries always present (Attack, Dash, Disengage, Dodge,
      Help, Hide, Ready, Search, Use an Object; Opportunity Attack under
      Reaction).
- [ ] Entries derived from the character:
      - equipped `hand` weapons appear under Attack (T-38 slots);
      - features tagged with an action type surface automatically
        (Rage and Second Wind → bonus action, Uncanny Dodge and
        Deflect Missiles → reaction, …);
      - prepared spells show their casting-time bucket (action/bonus/
        reaction) once spell data carries it (T-12 already stores
        castingTime).
- [ ] Content schema: features gain an optional `action` tag
      ("action" | "bonus" | "reaction" | "free"), SRD data backfilled for
      the obvious ones; untagged features simply don't appear.
- [ ] Extra budgets reflected where modeled (fighter Action Surge grants
      an extra action while its resource has uses left).
- [ ] jsdom tests: grouping, equipped-weapon entries, a tagged feature
      appearing in the right bucket.

## Technical notes
- Keep derivation pure in `rules/` (e.g. `actionEconomy(character)`)
  so the panel is testable without React.
- Tagging every SRD feature is a grind — start with the classes'
  signature actions and grow; the tag is optional by design.
- Pairs with T-29 hover cards for the entry detail text later.
