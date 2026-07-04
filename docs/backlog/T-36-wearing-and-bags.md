# T-36 — Equip only wearables; Wearing vs Bags

**Priority:** P2 · **Size:** S · **Phase:** 1 · **Depends on:** T-22 · **From:** user testing (todo #mid)

## User story
As a **player**, gold shouldn't have an "equipped" state — only wearable
items should — and the inventory should read as "Wearing" and "In bags".

## Acceptance criteria
- [x] Only armor-linked (wearable) items show the equip toggle (read mode)
      and the Equipped checkbox (edit mode).
- [x] Read mode splits inventory into "Wearing" (equipped) and "In bags";
      wearables move between them when toggled.
- [x] jsdom tests updated.
