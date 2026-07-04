# Backlog

One file per ticket: user story, acceptance criteria, technical notes.
Statuses: **todo · in-progress · blocked · done**. Work top-to-bottom within
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
| [T-10](T-10-player-notes.md) | Player notes with visibility | P2 | M | 1 | — | done |
| [T-12](T-12-open5e-client.md) | Open5e client + refresh command | P2 | M | 2 | T-11 | todo |
| [T-13](T-13-5etools-importer.md) | 5etools importer | P2 | M | 2 | T-11 | todo |
| [T-07](T-07-rolled-hp-starting-gold.md) | Rolled HP & starting gold | P3 | S | 1 | — | todo |
| [T-08](T-08-languages-tools.md) | Languages & tool proficiencies | P3 | S | 1 | T-05 | todo |
| [T-09](T-09-flavor-fields.md) | Flavor fields | P3 | S | 1 | — | todo |
| [T-14](T-14-content-browser.md) | Content browser view | P3 | L | 2 | T-11, T-12 | todo |
| [T-15](T-15-spell-selection.md) | Spell selection in wizard | P3 | L | 2 | T-12, T-03 | todo |
| [T-16](T-16-level-up-editor.md) | Level-up editor & multiclassing | P4 | XL | post-MVP | T-01, T-03, T-04, T-15 | todo |
| [T-17](T-17-2024-edition-content.md) | 2024 (5.5e) edition content | P2 | M | 1–2 | — | in-progress |
| [T-19](T-19-leveled-class-features.md) | Leveled class features (Barbarian first) | P1 | L | 1 | T-18 | done |
| [T-20](T-20-armor-weapon-proficiencies.md) | Armor & weapon proficiencies as data | P2 | S | 1 | — | done |
| [T-21](T-21-leveled-features-remaining-classes.md) | Leveled features: remaining classes | P2 | L | 1 | T-19 | todo |
| [T-22](T-22-equip-toggle-play-control.md) | Equip toggle as a play control | P2 | S | 1 | T-01, T-06 | todo |
| [T-23](T-23-two-way-markdown-data.md) | Two-way Markdown data (frontmatter projection) | P2 | M | 1–2 | T-01 | todo |
| [T-24](T-24-campaign-folder-structure.md) | Campaign folder structure managed by the plugin | P2 | M | 1–2 | — | todo |

## Suggested order

1. **T-03 subclasses** (data is staged, self-contained) → **T-02 skin** the
   moment the CSS arrives → **T-01 editable sheet** (the big Phase 1 payoff).
2. Then the creator completeness pass: T-05 → T-04 → T-06 → T-07/T-08/T-09.
3. Phase 2 track (parallelizable with 2): T-11 → T-12/T-13 → T-14 → T-15.
4. T-10 notes anytime; T-16 last.

Beyond this backlog, Phases 3–5 (sync server, battle map, dice/polish) stay
at the milestone level in `docs/ROADMAP.md` until they get near.
