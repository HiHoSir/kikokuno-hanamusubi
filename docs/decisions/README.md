# Design-decision records for battle, maps and equipment

## Why this exists

On 2026-11-22, review of PRs #64, #69, #70 and #71 showed that **previously recorded T0–T6 bonuses and the "vendor, price and tier allocation undecided" boundary were not followed**. Detailed November 15 map-distance reasoning had also not been fully preserved. See [the incident report](../incidents/2026-11-22-design-override.md).

**Do not use a new shop, rest stop, map location or enemy payout to invent a different balance curve.** Read `AGENTS.md`, `docs/BALANCE_PROGRESSION_CONTRACT.md`, `docs/MAP_ENEMY_EQUIPMENT_RECONCILIATION.md`, `docs/BATTLE_BALANCE.md`, `docs/FOUR_VILLAGES_EQUIPMENT_PLAN.md` and the affected runtime code *before* editing.

## Required workflow

1. Find the original design and any **later explicit user decisions**, note their relative priority, inspect the live code and state what is missing or conflicting.
2. Separate **approved canon**, **user-requested changes**, **assistant proposals** and **preview-only values**. A request to connect interiors or "continue" does **not** authorize new damage, price, drop, encounter, or tier decisions.
3. For a protected change, add a new dated JSON record under `docs/decisions/changes/`, in **the same PR** as the affected change. Reuse the schema below, and state the previous design, concrete intended difference, downstream effects, preserved constraints and tests.
4. For ANY edit to protected gameplay code, `kind` MUST be `user-approved` with the user's **actual words, original date and provenance**. Do not treat your own recommendation, generated PR description, an old test, or silence as approval. If no explicit instruction exists, **do not change gameplay values**. Write a proposal without committing new numbers instead.
5. Documentation corrections may use `kind: "documentation-correction"`; they must still explain which existing source was corrected and why.
6. Run `npm test` and PR `Design decision gate`, and inspect the results. Do not change the guard or tests to normalize unauthorized changes.
7. After the fact, compare what was written in the record with user intent. **The automation checks that a record exists and has required fields. It cannot independently verify an old chat quote or confer user approval.** A human must inspect that evidence before merging. Repository settings/branch protection must be configured separately to require review; this file does not pretend to enable protection.

The PR gate covers changes to `data/characters/hizuki-status.json`, `src/game/battle/rules.mjs`, `data/maps/*/armory.mjs`, the Shiomachi test storefront, field terrain/world/walk code, and the core battle/progression/equipment design documents. It only runs on PRs and is not a substitute for branch protection.

## Record template

Create `docs/decisions/changes/YYYY-MM-DD-clear-subject.json` (the `id` must equal its filename without `.json`):

```json
{
  "schemaVersion": 1,
  "id": "2026-11-22-clear-subject",
  "kind": "user-approved",
  "scopes": ["equipment", "balance"],
  "readBeforeEditing": [
    "docs/BALANCE_PROGRESSION_CONTRACT.md (the exact confirmed values)",
    "src/game/battle/rules.mjs (the actual runtime data)"
  ],
  "previousDesign": "Describe the old recorded authority and which version of the map it used.",
  "intendedDifference": "State exact item IDs, stat modifications, price and reason.",
  "impactAnalysis": "Describe level, enemy, gold, save and region consequences before writing code.",
  "preservedBoundaries": "State which original tier values and unrelated maps remain unchanged.",
  "verification": "List precise unit, browser and deployment checks needed.",
  "userEvidence": {
    "status": "explicit-user-instruction",
    "date": "2026-11-22",
    "quote": "Copy the real user's actual instruction here, not an assistant summary.",
    "source": "Identify the original conversation or a verifiable user-authored GitHub comment."
  }
}
```

For documentation-only changes, use `kind: "documentation-correction"` and `userEvidence: {"status":"documentation-only","source":"..."}`. Fill all five impact/review fields. Do not create empty boilerplate records.

**Conflict resolution:** if two approved decisions disagree, do not choose based on the later date alone. Check whether the later instruction explicitly replaces the earlier one. Otherwise mark the conflict and obtain a resolution before changing numbers.
