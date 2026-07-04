# T-28 — Skill picks filter across lists

**Priority:** P2 · **Size:** S · **Phase:** 1 · **Depends on:** — · **From:** user testing (todo #mid)

## User story
As a **player** picking skills, I want a skill chosen in one list (class,
additional, feature choice) to be disabled in the other lists — in both
directions — so I can't build an invalid selection the validator then
scolds me about.

## Acceptance criteria
- [ ] Choosing a skill anywhere disables (with a hint) that skill in every
      other pick list on the Skills step; unchecking re-enables it.
- [ ] Works in reverse (later list first, then earlier list).
- [ ] jsdom tests for cross-list disabling both ways.
