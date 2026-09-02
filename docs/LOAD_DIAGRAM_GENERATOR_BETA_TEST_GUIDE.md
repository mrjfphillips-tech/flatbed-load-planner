# Load Diagram Generator — Beta Test Guide

Thanks for helping test the Load Diagram Generator. This guide walks you through
setup and a set of focused scenarios. The goal is to confirm the tool produces
correct, usable loading plans in **both metric and imperial units** and to catch
anything confusing or broken before general release.

For day-to-day usage details, see `LOAD_DIAGRAM_GENERATOR_USER_MANUAL.md`.

---

## 1. What we most want feedback on

1. **Unit handling** — does switching metric/imperial always show correct,
   clearly labeled values, and does an imperial upload behave the same as metric?
2. **Correctness of placement** — do items stay inside the trailer, avoid
   overlaps, and respect stacking/floor/weight rules?
3. **Diagram clarity** — are the top-down, side, and 3D views readable and does
   the load-sequence order make sense?
4. **Editing** — is drag-and-drop intuitive, and does the live validation flag
   the right problems?
5. **Export** — is the PDF accurate, readable, and correctly unit-labeled?
6. **Rough edges** — anything slow, confusing, or unexpected.

---

## 2. Setup

**Prerequisites:** Node.js 20+, pnpm 9+, and access to the configured database.

```bash
pnpm install
pnpm build:shared
pnpm dev:backend      # API on http://localhost:4000
pnpm dev:frontend     # app on http://localhost:3000
```

On Windows you can instead run `LAUNCH-FLATBED.bat`, which starts both servers.

Then open **http://localhost:3000/load-diagram**.

If the trailer dropdown is empty, the templates may not be seeded yet. Seed them
with:

```bash
pnpm --filter @ptv-discovery-coach/backend db:seed:load-diagram
```

---

## 3. Test data

Use the built-in templates as your starting point: on the Upload step, download
**Metric template** and **Imperial template**. Fill in a handful of rows each.
A good starter set (metric) is:

| Item_ID | Length_mm | Width_mm | Height_mm | Weight_kg | Quantity | Delivery_Stop |
|---|---|---|---|---|---|---|
| PAL-1 | 1200 | 1000 | 1200 | 400 | 6 | 2 |
| PAL-2 | 1200 | 800 | 1000 | 300 | 4 | 1 |
| BOX-1 | 600 | 400 | 400 | 60 | 10 | 1 |

For the imperial run, enter equivalent values in the imperial template
(`Length_in`, `Weight_lb`, etc.). They do not have to be exact conversions — the
point is to exercise the imperial path.

---

## 4. Test scenarios

Work through these in order. For each, note the result and anything off. A
reporting template is in section 6.

### Scenario A — Metric happy path
1. Download the metric template, fill in the starter rows, upload it.
2. **Expect:** green summary, "detected metric", correct item count and total
   weight.
3. Select **Standard 13.6m Curtainsider**, click **Generate load plan**.
4. **Expect:** advances to the Diagram step; items placed with no (or few)
   overflow.

### Scenario B — Imperial happy path
1. Download the imperial template, fill it, upload.
2. **Expect:** "detected imperial"; weights/dimensions shown in in/lb.
3. Select **53 ft Dry Van**, generate.
4. **Expect:** a valid plan, same as metric but in imperial units.

### Scenario C — Unit toggle
1. With a plan open, flip the header toggle metric ↔ imperial repeatedly.
2. **Expect:** all numbers re-label instantly and stay consistent (e.g. a
   1,200 mm item shows ~47.24 in). Nothing should shift position or change the
   plan — only the displayed units change.

### Scenario D — Mixed-unit rejection
1. In a template, add an imperial column (e.g. `Length_in`) alongside the metric
   columns and upload.
2. **Expect:** the upload is rejected with a message about mixing metric and
   imperial columns; no items are imported.

### Scenario E — Validation errors
1. Upload a file with a row missing `Item_ID`, and another with a negative or
   zero dimension.
2. **Expect:** a red list naming the offending rows/columns; you can fix and
   re-upload.

### Scenario F — Diagram views
1. On the Diagram step, switch **Top-down / Side / 3D**.
2. **Expect:** items color-coded by delivery stop (matching the legend), labeled
   with load-sequence numbers; zoom/pan work; hover shows details; 3D orbits and
   selecting an item highlights it.

### Scenario G — Load order
1. Look at the load-sequence numbers relative to `Delivery_Stop`.
2. **Expect:** items with a **higher** delivery stop have **lower** sequence
   numbers (loaded first / toward the front); the first stop ends up nearest the
   doors.

### Scenario H — Editing and live validation
1. Switch to **Edit**. Drag an item so it overlaps another or floats above the
   floor.
2. **Expect:** the item gets a **red outline** and the violations panel explains
   why. **Undo** restores the previous position; **Redo** reapplies it.

### Scenario I — Overflow
1. Add many large/heavy items (or a tiny trailer) so not everything fits.
2. **Expect:** the summary reports overflow items rather than placing them
   invalidly.

### Scenario J — Export
1. On the Export step, try A4 and A3, toggle views and the checklist, and switch
   the export units independent of the display units.
2. **Expect:** the checklist preview updates; **Download PDF** produces a file
   whose views, summary, and checklist match the plan and are labeled in the
   chosen units.

---

## 5. Known limitations (not bugs)

- **OptiFlow integration** and **email distribution** are not yet implemented;
  PDF export is the delivery path for now.
- The `/load-diagram` route currently has no authentication in this build.
- The 3D view loads a larger bundle on first open, so the initial render of the
  `/load-diagram` page may take a moment.
- Very large item counts have not been performance-tuned for this beta.

If you hit any of these, no need to report them — but do report if they behave
worse than described.

---

## 6. How to report an issue

Please include:

- **Scenario / steps:** what you did (which scenario letter, or a step list).
- **Unit system:** metric or imperial, and whether you had toggled the display.
- **Expected vs. actual:** what you thought would happen and what did.
- **Data:** attach or paste the Excel rows you used (small sample is fine).
- **Evidence:** a screenshot of the diagram/error and, for export issues, the
  PDF.
- **Environment:** browser + OS, and whether backend/frontend were both running.

### Copy-paste template

```
Title:
Scenario:
Unit system (metric/imperial + toggled?):
Steps to reproduce:
Expected:
Actual:
Sample data (rows):
Screenshot / PDF attached? (y/n):
Browser / OS:
Severity (blocker / major / minor / cosmetic):
Notes:
```

---

## 7. Beta checklist

Copy this and mark each as you go:

- [ ] A — Metric happy path
- [ ] B — Imperial happy path
- [ ] C — Unit toggle keeps values consistent
- [ ] D — Mixed-unit file rejected
- [ ] E — Validation errors reported per row/column
- [ ] F — Top-down / Side / 3D views render correctly
- [ ] G — Load order matches delivery stops
- [ ] H — Editing + live validation + undo/redo
- [ ] I — Overflow reported when items do not fit
- [ ] J — PDF export correct in chosen units and paper size

Thanks — your feedback directly shapes the release.
