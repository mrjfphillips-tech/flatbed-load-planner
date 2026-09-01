# Load Diagram Generator — User Manual

The Load Diagram Generator turns a spreadsheet of freight into an optimized 3D
loading plan for a trailer, then produces a printable loading diagram. It works
in **metric (mm / kg)** or **imperial (in / lb)** units, supports pallets, boxes,
and mixed freight, and shows exactly where each item goes and in what order to
load it.

This manual covers everyday use. If you are helping evaluate a pre-release
build, see the companion `LOAD_DIAGRAM_GENERATOR_BETA_TEST_GUIDE.md`.

---

## 1. What it does

1. You upload an Excel file listing the items to ship (dimensions, weight,
   quantity, and optional constraints).
2. You choose a trailer.
3. The system computes an optimal 3D arrangement that respects the trailer's
   size, payload, axle limits, and your stacking/handling rules.
4. You review the plan as a top-down view, a side view, or an interactive 3D
   model, and optionally drag items to fine-tune placement.
5. You export a PDF loading diagram with a step-by-step loading checklist.

---

## 2. Getting started

### Opening the tool

1. Start the application (see the project README, or run `LAUNCH-FLATBED.bat`
   on Windows).
2. In your browser go to **http://localhost:3000/load-diagram**.

You will see a three-step wizard: **Upload → Diagram → Export**, with a
**metric / imperial toggle** in the top-right corner.

### The unit toggle

The toggle in the header controls how all measurements are *displayed* — it does
not change your data. Switching between metric and imperial re-labels every
dimension and weight instantly (in the app and in the exported PDF). You can
upload an imperial file and view it in metric, or vice versa.

---

## 3. Preparing your Excel file

### Download a template

On the Upload step, click **Metric template** or **Imperial template**. Each
template has two sheets:

- **Load Items** — the sheet you fill in (headers are pre-filled).
- **Instructions** — a description of every column and example values.

### Columns

Fill one row per item. Use **either** the metric or the imperial dimension
columns — do not mix both in one file.

| Column | Required | Meaning |
|---|---|---|
| `Item_ID` | Yes | Unique identifier for the item (e.g. `SKU-0001`). |
| `Description` | No | Free text. |
| `Length_mm` / `Length_in` | Yes | Item length. |
| `Width_mm` / `Width_in` | Yes | Item width. |
| `Height_mm` / `Height_in` | Yes | Item height. |
| `Weight_kg` / `Weight_lb` | Yes | Item weight. |
| `Quantity` | No (default 1) | Number of identical units. |
| `Stackability_Class` | No | Label used for stacking rules (e.g. `standard`, `fragile`). |
| `Max_Stack_Weight_kg` / `Max_Stack_Weight_lb` | No | Maximum weight allowed on top of this item. |
| `Delivery_Stop` | No | Delivery stop number. Higher stops are loaded first (nearest the front) so the first stop is nearest the doors. |
| `Temperature_Zone` | No | Zone label; temperature-sensitive items stay within a consistent zone. |
| `Floor_Only_Flag` | No | `TRUE` / `yes` / `x` if the item must sit directly on the floor. |

**Metric dimension columns:** `Length_mm`, `Width_mm`, `Height_mm`, `Weight_kg`,
`Max_Stack_Weight_kg`.
**Imperial dimension columns:** `Length_in`, `Width_in`, `Height_in`,
`Weight_lb`, `Max_Stack_Weight_lb`.

### Tips

- Dimensions and weights must be positive numbers.
- The tool detects the unit system automatically from which dimension columns
  are present. A file that contains *both* metric and imperial columns is
  rejected with a clear message — pick one.

---

## 4. Step 1 — Upload

1. Drag your Excel file onto the drop zone, or click to choose a file.
2. The file is parsed and validated:
   - **Green summary** — number of items parsed, the detected unit system, total
     weight, and approximate total volume.
   - **Red list** — any validation problems, with the row and column for each so
     you can fix the spreadsheet and re-upload.
3. Choose a **trailer profile** from the dropdown. Five templates are provided:
   - **Standard 13.6m Curtainsider**, **Box Trailer 13.6m**, **Mega Trailer
     13.6m** (European, shown in metric).
   - **53 ft Dry Van**, **48 ft Flatbed** (North American, shown in imperial).
4. Click **Generate load plan**. The tool computes the arrangement and advances
   to the Diagram step.

---

## 5. Step 2 — Diagram

Two modes are available via the **View / Edit** toggle.

### View mode

- **Top-down** and **Side** buttons switch between the bird's-eye and profile
  views. A **3D** button opens an interactive model.
- Items are **color-coded by delivery stop** (see the legend) and labeled with
  their **load-sequence number**.
- Use the **zoom** controls (− / % / +) and **click-drag** to pan.
- **Hover** over an item to see its ID, dimensions, weight, and stop.
- In **3D**, drag to orbit, scroll to zoom, and click an item to highlight it and
  see its details.

The summary shows items placed, total weight, volume utilization, and weight per
axle. If any items did not fit, they are reported as overflow (consider a second
trailer).

### Edit mode

- **Drag** any item to a new position in the top-down view. Positions snap to a
  small grid and are kept inside the trailer.
- Placement is validated **in real time**. An item that breaks a rule (overlap,
  floating, exceeding a stack-weight limit, etc.) gets a **red outline**, and the
  reason appears in the **violations panel** on the right.
- Use **Undo** / **Redo** to step back and forth through your changes.

---

## 6. Step 3 — Export

1. Choose a **paper size** (A4 or A3).
2. Choose the **units** for the PDF (defaults to your current display units).
3. Select which **views** to include (top-down, side).
4. Toggle **summary statistics** and the **loading checklist** on or off.
5. Review the **checklist preview** — items in load order, formatted in the
   selected units.
6. Click **Download PDF**.

The PDF contains the selected views (color-coded, load-sequence labeled), a
summary block (weights, utilization, per-axle weights), and a checkbox loading
checklist ordered so the first delivery ends up nearest the doors. Every
dimension and weight is labeled with its unit.

---

## 7. How placement works (in brief)

- Items are loaded in **reverse delivery order**: higher stop numbers go in
  first (toward the front), so the first stop ends up nearest the doors.
- The engine keeps the load low and packs toward the back, respecting:
  - trailer length / width / height and maximum payload,
  - per-axle weight limits,
  - stack-weight limits and stackability classes,
  - floor-only and top-load-prohibited flags,
  - temperature-zone consistency.
- All math is done in a single internal unit and only converted for display, so
  results are identical regardless of the units you work in.

---

## 8. Troubleshooting

| Symptom | What to do |
|---|---|
| "File mixes metric and imperial dimension columns" | Keep only one unit system's columns in the file. |
| "No dimension columns found" | Use the provided template; the headers must match exactly. |
| Rows flagged with errors | Fix the listed row/column (usually a missing `Item_ID` or a non-positive dimension) and re-upload. |
| Some items show as overflow | They did not fit; reduce quantities or use a larger trailer / a second load. |
| Diagram looks empty | Confirm the plan generated (Step 1) and that items are within the trailer's dimensions. |
| Numbers look wrong for my region | Use the header unit toggle, or set the export units on the Export step. |

---

## 9. Quick reference

- **URL:** `http://localhost:3000/load-diagram`
- **Wizard:** Upload → Diagram (View / Edit) → Export
- **Units:** metric (mm / kg) or imperial (in / lb); toggle any time
- **Templates:** metric and imperial variants, each with an Instructions sheet
- **Export:** PDF (A4 / A3), views + summary + checklist, in your chosen units
