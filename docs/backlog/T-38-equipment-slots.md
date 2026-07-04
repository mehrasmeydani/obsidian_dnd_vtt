# T-38 — Equipment slots: hands, body, accessories

**Priority:** P1 · **Size:** M · **Phase:** 1 · **Depends on:** T-36 · **From:** user testing (todo round 2) — supersedes T-36's wearable-only rule

## User story
As a **player**, I want to equip anything that is genuinely wearable or
holdable — weapons, shields, clothes, rings, pendants — with realistic
limits: two hands' worth of held items, one body armor, unlimited
accessories. Gold coins and candles are not equippable at all.

## Problem today
T-36 keyed "wearable" off `armorId`, so only SRD armor/shields toggle —
in practice "nothing is toggleable" (weapons and clothes from starting
equipment have no armorId). Gold correctly has no toggle.

## Acceptance criteria
- [ ] Item model gains an equip slot (additive): `hand` (weapons,
      shields, torches…), `body` (armor, clothes), `accessory` (rings,
      pendants, cloaks…), or none (gold, candles, consumables — never
      equippable).
- [ ] Slot limits enforced in the sheet UI (both read-mode toggles and
      edit-mode checkboxes):
      - hands: at most 2 equipped `hand` items (a future two-handed flag
        may cost both; out of scope here);
      - body: at most 1 (equipping another doffs the current, as today);
      - accessories: unlimited.
- [ ] Content/assembly tags slots automatically where known: armor →
      body, shields/weapons from class equipment → hand; SRD weapon list
      (or name heuristics) may be needed — unknown items default to no
      slot but are editable.
- [ ] Edit mode lets the user set/override an item's slot (dropdown), so
      homebrew items work.
- [ ] AC math unchanged: still body armor + shield only (T-06).
- [ ] Read mode keeps Wearing / In bags groups; "Wearing" includes held
      items.
- [ ] jsdom tests: hand limit (third weapon blocked or forces a swap),
      single body armor, unlimited rings, gold never toggleable.

## Technical notes
- `ItemSchema` gains `slot?: "hand" | "body" | "accessory"` (additive);
  keep `armorId` as-is for AC.
- Assembly: link class equipment picks to slots when recognizable
  (armor list → body/hand for shields; a small weapon-name list in the
  content bundle, e.g. `weapons[]`, may be worth adding here).
- The equip rules live in one helper so read-mode chips and edit-mode
  checkboxes can't drift apart (lesson from T-22/T-36).
