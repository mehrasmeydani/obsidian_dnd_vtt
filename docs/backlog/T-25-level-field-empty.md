# T-25 — Level field shows 0 when erased

**Priority:** P2 · **Size:** XS · **Phase:** 1 · **Depends on:** — · **From:** user testing (todo #minor)

## User story
As a **player** typing a starting level, I want the field to go empty when
I erase it — not snap to `0` — so that entering a two-digit level doesn't
fight me.

## Acceptance criteria
- [x] Erasing the level input shows an empty field, not `0`.
- [x] The draft keeps its last valid level while the field is empty (Next
      hint explains if left empty); leaving the field restores the value.
- [x] jsdom test for erase → empty → retype.
