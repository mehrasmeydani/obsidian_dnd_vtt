# T-04 — Feats as an ASI alternative

**Priority:** P2 · **Size:** M · **Phase:** 1 · **Depends on:** —

## User story
As a **player** starting above level 3, I want to spend an Ability Score
Improvement on a feat instead of +2 ability points, so that my build matches
the 5e rules rather than being forced into raw stats.

## Acceptance criteria
- [ ] Content schema validates top-level `feats[]` (Grappler already in the
      bundle; imported bundles can add more).
- [ ] Abilities step: each earned ASI can be spent as +2 points (current
      behavior) or one feat; picking a feat reduces the point pool by 2.
- [ ] A feat cannot be taken twice; blockers/hints reflect remaining
      improvements; changing class/level resets picks.
- [ ] Chosen feats become `Character.features` with source "Feat".
- [ ] Rules tests for point-pool math with feats; wizard test for the flow.

## Technical notes
- `characterCreation.ts`: draft gains `feats: FeatData[]`;
  `asiPointsTotal = 2 * (asiCount - feats.length)`.
- Wizard: feat checkbox list beside the ASI stepper (AbilitiesStep).
- Sets up **variant human** later (race granting a feat at level 1).
