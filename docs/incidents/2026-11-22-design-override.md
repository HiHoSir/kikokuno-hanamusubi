# Incident: recorded design ignored and map-progression rationale partially lost (2026-11-22)

**Scope:** only `HiHoSir/kikokuno-hanamusubi`, first game 『鬼哭の花結び』.
**Classification:** two independent but reinforcing failures: (A) existing recorded decisions disregarded, **confirmed and primary**; (B) parts of the November 15 map-based reasoning were not fully migrated into the then-current repository, **confirmed documentation gap**.
**Responsibility:** assistant's design review and implementation process. Not an authorized change in user direction.

## 1. Evidence at the actual time of the mistakes

| Evidence | What was already recorded | What went wrong |
| --- | --- | --- |
| [BATTLE_BALANCE.md **before PR #64**](https://github.com/HiHoSir/kikokuno-hanamusubi/blob/906f14c03bbe0216e4b407ea887dfff65cbdf0ec/docs/BATTLE_BALANCE.md) | The **confirmed** B-style v2 level formula and T0–T6 aggregate bonuses; `T1 = attack+20 / defense+14`, `T2 = attack+42 / defense+30`. Regional enemies/tier vendors and prices were **proposals**, not confirmed. | Assistant designed new village equipment without tracing to the confirmed curve and its distinct, later-approved four-slot items. |
| [PR #64](https://github.com/HiHoSir/kikokuno-hanamusubi/pull/64) (merged before the Shiomachi preview) | Exactly **four villages** including Hozuki. Additional village names/locations, **specific equipment tiers, prices, merchant and dungeon availability were undecided**. Absent in-game rest-stop vendors and dungeon loot were marked as unimplemented. | Assistant later asserted tier/merchant placement and proposed specific item levels/prices as though these were already decided. |
| [PR #69](https://github.com/HiHoSir/kikokuno-hanamusubi/pull/69) | Generated new Shiomachi four-slot products and numbers, explicitly called unapproved preview data. | The prices and bonuses were *still invented* while the requested task concerned distinct stock and connections; no comparison to approved progression or original map path was completed. |
| [PR #70](https://github.com/HiHoSir/kikokuno-hanamusubi/pull/70) | Correctly recognized **no visitable rest-stop shop or dungeon between the villages**. | Assistant then asserted a new **Shiomachi=T2** stage assignment even though the documented tier distribution was still undetermined. A documentation-only PR can contradict canon too. |
| [PR #71](https://github.com/HiHoSir/kikokuno-hanamusubi/pull/71) | The same docs and `data/characters/hizuki-status.json` still retained approved tier bonuses. Current encounter payout is 8 ryo, but the new village is **not even connected to the live field**. | Assistant changed prototype price/bonuses to 128 ryo and attack+8/defense+12 based on short distance and 8-ryo reward; updated tests to match, and merged. Passing tests did **not** validate design authorization. |
| [PR #72](https://github.com/HiHoSir/kikokuno-hanamusubi/pull/72) | Added `docs/BALANCE_PROGRESSION_CONTRACT.md` and tests protecting approved tier values; reversed the 128-ryo change. | This fixed the most recent unsupported numbers but still did not enforce provenance for future *preview* catalog edits. |
| [PR #73](https://github.com/HiHoSir/kikokuno-hanamusubi/pull/73) | Recovered route-length and map-progression notes into `docs/MAP_ENEMY_EQUIPMENT_RECONCILIATION.md`, plus a read-only audit. | Clarified historical design but did not yet make design-record review a mandatory PR gate. |

## 2. The documentation gap must not be used as an excuse

The T0–T6 numbers, original regional enemy *candidates*, and "pricing and locations undecided" were **already in the repository**. The detailed **2026-11-15** sequence of steps, 43/68/33/31-step estimates, concern that reaching level 5 at the shrine was too early, and required mountain-pass cave were **not preserved together as a reproducible map-first decision report** in the then-current repository. The old `docs/BATTLE_BALANCE.md` contained some **proposed** region/enemy/level associations, but was not a complete route-distance/encounter/equipment acceptance specification.

The missing detail was later reconstructed in PR #73, carefully labeled as **historical proposal, user-approved direction, confirmed stat value, or current implementation**. It is **not proof that every original tier vendor or exact map length was finalized**.

The correct response to gaps would have been to read the available primary sources, identify the missing acceptance decision, **keep gameplay values unchanged**, and record the gap. It was **not** to choose one interpretation and then rewrite the provisional equipment values.

## 3. Root causes

1. **Pre-change audit skipped.** The assistant did not read or apply `docs/BATTLE_BALANCE.md` and the four-village plan before proposing values, violating the existing `AGENTS.md` principle of checking rules and current implementation.
2. **Scope creep in follow-up requests.** A request to connect the armory and give the village its own stock was treated as permission to invent gear progression/economics.
3. **Lost approval boundaries.** "Confirmed aggregate tier", "approved separate shop item", "historical proposal", and "preview-only placeholder" were conflated. A request for a village did not approve a tier stage, and an unbuilt rest stop was taken as a functioning vendor.
4. **False confidence from tests.** Tests were authored to assert the new arbitrary prices; green CI meant the code matched those new expectations, **not** that user-approved design was respected.
5. **No change provenance gate.** Repository guard primarily checked assets, file hygiene and mechanical functionality. No policy required an explicit source for changes to battle/route/equipment design.

## 4. What has been corrected, and what remains open

- **Already recovered:** PR #72 pinned the *original tier bonuses* and the later-approved individual Hozuki shop items. PR #73 preserved map-first reasoning and corrected out-of-date level-XP notes. Neither silently changes real stats or regional enemy placement.
- **This change:** add an explicit `AGENTS.md` preflight, a mandatory dated JSON decision record for design-impacting PRs, and `tools/guard-design-changes.mjs` in PR CI. New tests show that undocumented adjustments to a coastal preview gear file, core battle data, or enemy/field progression are **rejected**.
- **Still open:** Hozuki four approved pieces sum to attack+4/defense+7 whereas the earlier T1 target was attack+20/defense+14. This is a **design conflict** requiring traceable resolution, not an automatic retune. Shiomachi vendor items are prototype-only and neither their final bonuses nor tier location is user-approved. The required mountain cave and later-zone encounters remain unimplemented.

## 5. Future action contract

Before any change to battle stats, item stats/prices, enemy placement, field progression or tier allocation:

1. **Locate originals** (approved status JSON, `BATTLE_BALANCE`, `BALANCE_PROGRESSION_CONTRACT`, `MAP_ENEMY_EQUIPMENT_RECONCILIATION`, and map/encounter/armory code).
2. **Classify** what is user-confirmed, later user-authorized, merely proposed, or missing. If conflicting or incomplete, do not fill values from intuition.
3. **Obtain explicit instructions for actual gameplay numbers**, including preview-only numerical prototypes. Record *real quote, date, source*, before/after and downstream impact; do **not invent user approval**. See `docs/decisions/README.md`.
4. **Link a decision record in the same PR**. A PR touching the protected implementation/documents without a record will fail the Design decision gate.
5. Test with both original fixed regressions and actual map/balance simulations. Do not edit test expectations to normalize unauthorized changes.
6. Report only what was changed and actually verified. **Automated CI cannot verify human authorization from chat**, and PR review/branch protection still needs external settings; this tooling is a traceability safeguard, not a guarantee.

This incident is attributed to assistant judgment, **not to missing user instructions**.
