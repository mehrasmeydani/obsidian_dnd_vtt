# T-41 — Rules glossary: mechanics as content (advantage, conditions, tables…)

**Priority:** P2 · **Size:** M · **Phase:** 2 · **Depends on:** T-11 · **From:** user request · **Feeds:** T-29 hover cards

## User story
As a **player**, I want the game's mechanics themselves — advantage/
disadvantage, the conditions, saving throws, spellcasting rules, spell
slot tables, resting, cover… — available in the plugin as readable
entries, so hovering (or clicking) anything on the sheet can explain the
rule and show its data instead of sending me to the books.

## Acceptance criteria
- [ ] Content schema gains a `rules[]` category: id, name, kind
      ("rule" | "condition" | "action" | "sense" | "table"), rendered
      description, optional structured table data (rows/columns, e.g.
      spell slots per level, exhaustion levels), and edition.
- [ ] **A baseline glossary ships**: the SRD (5.1/5.2, CC-BY) contains
      the core mechanics text — conditions, advantage, saving throws,
      spellcasting, resting — so unlike subclasses this one is
      redistributable. Authored under `src/data/content/srd/rules*.json`.
- [ ] The 5etools importer maps the mechanics files users supply
      (`variantrules.json`, `conditionsdiseases.json`, `actions.json`,
      `skills.json`, `senses.json`, `tables.json`) into the same
      category — user-owned, local-only, same policy as all imports.
- [ ] Content store serves the merged glossary; settings bundle rows
      count it.
- [ ] First consumers wired up where cheap: the Defenses tile's
      condition chips (T-35) and the sheet's skill/save labels get a
      hover/click description sourced from the glossary. The full hover
      component is T-29's job — this ticket only proves the pipeline
      with a minimal tooltip.
- [ ] Tests: schema validation, SRD glossary integrity, importer mapping
      fixtures, and one jsdom hover/click smoke test.

## Technical notes
- Structured tables matter as data, not just prose: T-15 (spell
  selection) wants the spell-slot table, T-39 (action economy) wants the
  actions list — shape `table` entries so those tickets can consume them
  rather than re-hardcoding.
- 5etools `entries` rendering is already solved (`renderEntries`).
- Keep glossary ids stable (`condition-poisoned`, `rule-advantage`…) so
  UI references don't break across bundles/editions.
