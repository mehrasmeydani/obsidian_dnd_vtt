# T-29 — Hover info for skills, abilities, inventory…

**Priority:** P3 · **Size:** L · **Phase:** 2+ · **Depends on:** T-14 · **From:** user testing (todo #major, future feature)

## User story
As a **player**, I want hover tooltips with formatted details (what a
skill covers, what an item does) across the sheet and creator, backed by
a formatted Markdown blob per entity in the content bundle.

## Acceptance criteria
- [ ] Content schema carries optional formatted descriptions per entity.
- [ ] Shared hover-card component; used for skills, abilities, inventory,
      features, spells.
- [ ] Future feature — design pass first; not scheduled yet.

## Addendum (user request, 2026-07-05)
Hovering a *derived value* (AC, save, skill bonus, HP max…) should also
explain **how it was calculated and where each part comes from** — e.g.
"AC 16 = 14 (scale mail, DEX capped +2) + 2 (shield)". The provenance
data mostly exists in the rules layer (armorClass.ts already picks a
source); surface it as the hover card body for computed stats.
