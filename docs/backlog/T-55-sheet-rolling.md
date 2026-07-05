# T-55 — Sheet dice rolling: checks/saves with advantage & party hooks

**Priority:** P2 · **Size:** L · **Phase:** 2 · **Depends on:** T-01, T-27

## User story
As a **player**, I want to roll checks, saves and attacks from the
character sheet with advantage/disadvantage applied, and — future —
party-aware modifiers (a Bardic Inspiration die I can mark off when a
bard is in the party).

## Plan (own session — L)
1. Clickable modifiers: ability scores, saves, skills, attacks roll
   d20 + modifier; reuse the T-27 roll animation; result strip with
   the breakdown (die, modifier, adv/dis picks).
2. Advantage/disadvantage: per-roll toggle (normal/adv/dis) rolling
   2d20 keep high/low; conditions could pre-suggest (e.g. prone) later.
3. **Party compatibility (future, separate ticket when near):** party
   roster awareness — if a bard is in the party, offer a Bardic
   Inspiration add-die button that a player can mark down; needs the
   campaign/party model (T-24) to know members.

## Acceptance criteria
- [ ] d20 rolls from abilities/saves/skills with adv/dis toggle and
      visible breakdown.
- [ ] Tests; user verifies in Obsidian. Party hooks explicitly out of
      scope for v1.

## Status: todo
