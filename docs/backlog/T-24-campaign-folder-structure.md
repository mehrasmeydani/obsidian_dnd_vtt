# T-24 — Campaign folder structure managed by the plugin

**Priority:** P2 · **Size:** M · **Phase:** 1–2 · **Depends on:** —

## User story
As a **user running campaigns**, I want the plugin to understand and
manage my campaign folder layout — `<Name> dnd/` with `Pc/`, `Sessions/`,
etc. — so that characters, session notes, and future content land in the
right campaign automatically instead of one flat "Characters" folder.

## Acceptance criteria
- [x] A campaign concept in settings: list of campaigns, each mapping to
      a root folder (auto-detected from existing `<Name> dnd/` folders,
      editable), with one active campaign.
- [x] "Create campaign" command scaffolds the folder structure
      (configurable template: `Pc/`, `Sessions/`, `Npc/`, `Handouts/`…)
      without touching folders that already exist.
- [x] New characters save into the active campaign's `Pc/` folder; the
      wizard/save path falls back to the current single-folder setting
      when no campaign is configured (no breaking change).
- [x] Session notes (T-10) and future entity types declare which
      subfolder they belong to; creation commands honor it.
- [x] Character notes get a `campaign` frontmatter key matching the
      campaign (consistent with the user's Templater template); loading
      can filter by campaign.
- [x] Tests: folder resolution, scaffold idempotency, fallback behavior.

## Technical notes
- Extend `persistence/characterStore.ts`'s `ensureFolder` into a small
  campaign/folder service the plugin owns; settings UI lists campaigns
  like content bundles (T-11).
- Respect the user's live vault convention (campaigns are `<Name> dnd/`,
  PCs in `Hell dnd/Pc`) as the default template.
- Pairs with T-23: the `campaign` key is part of the frontmatter
  projection.
