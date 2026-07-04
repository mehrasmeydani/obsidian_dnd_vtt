# Backlog

One file per ticket: user story, acceptance criteria, technical notes.
Statuses: **todo · in-progress · blocked · needs-check · done**.
`needs-check` = implemented and green in CI, awaiting the user's manual
verification — the list to work through is [NEEDS-CHECK.md](NEEDS-CHECK.md). Work top-to-bottom within
a priority band unless a dependency says otherwise. When a ticket is done,
flip its status here and tick the roadmap item it maps to.

(These can be mirrored to GitHub Issues once `gh auth login` is set up.)

## Board

| # | Ticket | Priority | Size | Phase | Depends on | Status |
|---|--------|----------|------|-------|------------|--------|
| [T-01](T-01-editable-character-sheet.md) | Editable character sheet view | P1 | L | 1 | — | done |
| [T-02](T-02-sheet-css-skin.md) | Character sheet CSS skin | P1 | S | 1 | user CSS file | done |
| [T-03](T-03-subclasses.md) | Subclass selection in wizard | P1 | M | 1 | — | done |
| [T-18](T-18-class-feature-options.md) | Class feature options in wizard | P1 | M | 1 | T-03 | done |
| [T-11](T-11-content-store.md) | Local content store | P1 | M | 2 | — | done |
| [T-04](T-04-feats.md) | Feats as ASI alternative | P2 | M | 1 | — | done |
| [T-05](T-05-race-background-options.md) | Race & background option choices | P2 | M | 1 | — | done |
| [T-06](T-06-armor-aware-ac.md) | Armor-aware AC | P2 | M | 1 | T-01 | done |
| [T-10](T-10-player-notes.md) | Player notes with visibility | P2 | M | 1 | — | needs-check |
| [T-12](T-12-open5e-client.md) | Open5e client + refresh command | P2 | M | 2 | T-11 | needs-check |
| [T-13](T-13-5etools-importer.md) | 5etools importer | P2 | M | 2 | T-11 | needs-check |
| [T-07](T-07-rolled-hp-starting-gold.md) | Rolled HP & starting gold | P3 | S | 1 | — | needs-check |
| [T-08](T-08-languages-tools.md) | Languages & tool proficiencies | P3 | S | 1 | T-05 | needs-check |
| [T-09](T-09-flavor-fields.md) | Flavor fields | P3 | S | 1 | — | todo |
| [T-14](T-14-content-browser.md) | Content browser view | P3 | L | 2 | T-11, T-12 | todo |
| [T-15](T-15-spell-selection.md) | Spell selection in wizard | P3 | L | 2 | T-12, T-03 | todo |
| [T-16](T-16-level-up-editor.md) | Level-up editor & multiclassing | P4 | XL | post-MVP | T-01, T-03, T-04, T-15 | todo |
| [T-17](T-17-2024-edition-content.md) | 2024 (5.5e) edition content | P2 | M | 1–2 | — | in-progress |
| [T-19](T-19-leveled-class-features.md) | Leveled class features (Barbarian first) | P1 | L | 1 | T-18 | done |
| [T-20](T-20-armor-weapon-proficiencies.md) | Armor & weapon proficiencies as data | P2 | S | 1 | — | done |
| [T-21](T-21-leveled-features-remaining-classes.md) | Leveled features: remaining classes | P2 | L | 1 | T-19 | needs-check |
| [T-22](T-22-equip-toggle-play-control.md) | Equip toggle as a play control | P2 | S | 1 | T-01, T-06 | needs-check |
| [T-23](T-23-two-way-markdown-data.md) | Two-way Markdown data (frontmatter projection) | P2 | M | 1–2 | T-01 | needs-check |
| [T-24](T-24-campaign-folder-structure.md) | Campaign folder structure managed by the plugin | P2 | M | 1–2 | — | needs-check |
| [T-25](T-25-level-field-empty.md) | Level field shows 0 when erased | P2 | XS | 1 | — | needs-check |
| [T-26](T-26-asi-racial-label.md) | ASI points mislabeled as racial | P2 | XS | 1 | — | needs-check |
| [T-27](T-27-dice-roll-animation.md) | Dice roll animation | P2 | S | 1 | T-07 | needs-check |
| [T-28](T-28-skill-pick-cross-filtering.md) | Skill picks filter across lists | P2 | S | 1 | — | needs-check |
| [T-29](T-29-hover-info-cards.md) | Hover info cards (future) | P3 | L | 2+ | T-14 | todo |
| [T-30](T-30-free-wizard-navigation.md) | Free wizard navigation + warnings | P1 | M | 1 | — | needs-check |
| [T-31](T-31-creator-preview.md) | Live preview in the creator | P2 | S | 1 | T-30 | needs-check |
| [T-32](T-32-sheet-sections-togglable.md) | Togglable sheet sections | P1 | M | 1 | T-01 | needs-check |
| [T-33](T-33-features-grouped-by-source.md) | Features grouped by origin | P2 | S | 1 | T-01 | needs-check |
| [T-34](T-34-rest-confirmation.md) | Rest buttons confirm | P2 | XS | 1 | T-01 | needs-check |
| [T-35](T-35-defenses-conditions.md) | Resistances, immunities, conditions | P2 | M | 1 | T-01 | needs-check |
| [T-36](T-36-wearing-and-bags.md) | Equip only wearables; Wearing vs Bags | P2 | S | 1 | T-22 | needs-check |
| [T-37](T-37-stale-expertise-release.md) | Expertise pick survives losing its proficiency | P1 | S | 1 | — | needs-check |
| [T-38](T-38-equipment-slots.md) | Equipment slots: hands, body, accessories | P1 | M | 1 | T-36 | todo |
| [T-39](T-39-action-economy-panel.md) | Action economy panel | P2 | L | 1–2 | T-01, T-38 | todo |
| [T-40](T-40-draggable-sheet-layout.md) | Dynamic sheet layout (drag & drop, show/hide) | P3 | L | 2+ | T-01, T-32 | todo |
| [T-41](T-41-rules-glossary.md) | Rules glossary: mechanics as content | P2 | M | 2 | T-11 | todo |
| [T-42](T-42-import-fluff-lore.md) | Import 5etools fluff as lore text | P3 | S | 2 | T-13 | todo |

## Suggested order

1. **T-03 subclasses** (data is staged, self-contained) → **T-02 skin** the
   moment the CSS arrives → **T-01 editable sheet** (the big Phase 1 payoff).
2. Then the creator completeness pass: T-05 → T-04 → T-06 → T-07/T-08/T-09.
3. Phase 2 track (parallelizable with 2): T-11 → T-12/T-13 → T-14 → T-15.
4. T-10 notes anytime; T-16 last.

Beyond this backlog, Phases 3–5 (sync server, battle map, dice/polish) stay
at the milestone level in `docs/ROADMAP.md` until they get near.
