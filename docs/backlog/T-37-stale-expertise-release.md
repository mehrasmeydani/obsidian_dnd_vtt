# T-37 — Expertise pick survives losing its proficiency

**Priority:** P1 · **Size:** S · **Phase:** 1 · **Depends on:** — · **From:** user testing (live report)

## User story
As a **player** on the Skills step, when I give a skill expertise and then
uncheck its proficiency, the wizard must release the expertise pick — not
keep a stale, invisible pick that fails validation with no way to clear it.

## Acceptance criteria
- [x] Removing a proficiency (class skill, bonus skill, or feature skill
      pick) drops any expertise pick that depended on it, everywhere the
      draft changes (`pruneStaleExpertise` runs on every wizard update).
- [x] The expertise counter and Next hints reflect the released pick;
      re-adding the proficiency lets expertise be chosen again.
- [x] Rules tests (prune/keep/no-op) + jsdom choose-then-uncheck cycle.
