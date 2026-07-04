# T-30 — Free movement between wizard steps

**Priority:** P1 · **Size:** M · **Phase:** 1 · **Depends on:** — · **From:** user testing (todo #major)

## User story
As a **player**, I want to move through all creator steps without filling
everything in order — incomplete fields should warn, not block — and only
the final "Create character" should require a complete draft.

## Acceptance criteria
- [x] All step headers are always clickable; Next never blocks.
- [x] Incomplete steps show a warning marker in the header and a hint list
      on the step; the messages match validateDraft.
- [x] "Create character" stays disabled until the draft validates, listing
      what's missing.
- [x] jsdom tests updated: jump ahead freely, create gated.
