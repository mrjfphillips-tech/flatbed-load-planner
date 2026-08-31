---
inclusion: fileMatch
fileMatchPattern: "**/flatbed/**,**/import/**,**/planner*,**/stacking*"
---

# Steel Stacking Logic (Soft Constraint)

This file documents PTV/Aceros Arequipa's steel-handling and truck-stacking
defaults so any code touching them stays consistent. **These are defaults,
not hard rules.**

Apply them automatically when generating or editing code that assigns
Handling Method, Stack Permission, Max Stack Height, Max Stack Weight,
Orientation, or Dunnage Required — but never let them silently override a
more authoritative signal, and never treat a violation as a bug to "fix" by
itself.

## Why this is a soft constraint, not a hard one

None of these values exist in the source order data (the Daily_Order
workbook). They're informed defaults per product family — a starting point
for ops to confirm, not a certified rule set. Two things always outrank them:

1. **The optimized route plan's own stacking judgment.** When a completed
   OptiFlow plan is available, its `orderLabels` (Layer, e.g. `P0_L5`) and
   `orderTags` (Deck) reflect a human loader's actual decision for that
   specific shipment. If code is joining plan data with these defaults,
   the plan's values win — the defaults only fill gaps, they don't override
   real judgment.

2. **Explicit business exceptions.** If a user or a data source says "handle
   this one by crane" for a product family we default to forklift, honor
   that override rather than forcing the default back.

When code applies one of these defaults, keep it discoverable (e.g. a Notes
column, a log line, a comment) rather than baking it in silently — someone
downstream needs to be able to tell "this was assumed" from "this was
confirmed."

## The defaults

| Product family | Handling | Stack permission | Max stack height | Max stack weight | Orientation | Dunnage | Why |
|---|---|---|---|---|---|---|---|
| `rebar_corrugated`, `rebar_dowel` | crane | yes | 48 in | 20,000 kg | longitudinal | no | Banded bundles, heavy enough to need crane; bands hold shape so no spacers needed. |
| `rebar_accessory` | forklift | yes | 36 in | 5,000 kg | n/a | no | Pre-bent accessories (stirrups), lighter, boxed/banded. |
| `round_bar_smooth`, `square_bar` | crane | yes | 48 in | 15,000–20,000 kg | longitudinal | no | Heavy banded bundles, bands do the protecting. |
| `round_bar_polished` | crane | yes | 48 in | 15,000 kg | longitudinal | **yes** | Polished surface scratches easily — the one bar family where dunnage matters. |
| `flat_bar`, `angle_bar`, `tee_bar`, `channel_bar` | forklift | yes | 40 in | 15,000 kg | longitudinal | yes | Profiles have exposed edges/corners that damage each other without spacers. |
| `purlin_z` | forklift | yes | 36 in | 10,000 kg | longitudinal | yes | Thin-gauge formed profile — lighter stack limit to avoid crushing. |
| `tube_square`, `tube_round`, `tube_rectangular`, `pipe` | forklift | yes | 48 in | 15,000 kg | longitudinal | yes | Tube rolls or dents without dunnage; stops rolling off stack. |
| `plate_hot_rolled`, `structural_plate`, `checkered_plate` | crane | yes | 24 in | 18,000–20,000 kg | flat | yes | Heavy flat stock; low stack height because weight compounds fast; dunnage prevents surface damage. |
| `sheet_cold_rolled`, `sheet_galvanized` | forklift | yes | 30 in | 8,000 kg | flat | yes | Lighter gauge, forklift-capable, but same flat-stacking surface-damage risk. |
| `corrugated_roofing_sheet` | forklift | yes | 24 in | 3,000 kg | flat | yes | Very thin gauge (calamina, ~0.14–0.23mm) — fragile under stack load. |
| `base_plate` | forklift | yes | 24 in | 5,000 kg | flat | yes | Small heavy plates (bolt base plates), moderate stack limit. |
| `wire_coil` | forklift | limited (2 high max) | 40 in | 5,000 kg | vertical | no | Rolls are unstable stacked >2 high; self-contained coil, no edge damage risk. |
| `electrode_box`, `fastener_box`, `hardware_misc` | manual | yes | 60 in | 1,000 kg | n/a | no | Palletized/boxed goods, standard warehouse handling. |

## Applying this when writing or reviewing code

- When new code assigns these six attributes for a steel product, look up
  the family in the table above rather than inventing a new default value.
- When a family isn't in the table (a new SAP material pattern), don't guess
  silently — flag it (`unclassified` / TBD) so a human adds a real default.
- When reviewing a change that hard-codes one of these values inline instead
  of reading from the shared defaults table, prefer refactoring it to read
  from the shared source — `handling-defaults.ts` is the single source.

## Reference implementation

The canonical code source is:
#[[file:packages/shared/src/flatbed/handling-defaults.ts]]
