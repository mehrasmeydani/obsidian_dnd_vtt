# T-34 — Rest buttons ask "are you sure"

**Priority:** P2 · **Size:** XS · **Phase:** 1 · **Depends on:** T-01 · **From:** user testing (todo #mid)

## User story
As a **player**, I don't want a stray click on Short/Long rest to wipe my
resource pips and heal me mid-fight — rests should confirm first.

## Acceptance criteria
- [x] Clicking Short/Long rest flips the button into an inline
      Confirm/Cancel pair; only Confirm applies the rest.
- [x] jsdom tests: cancel does nothing, confirm rests.
