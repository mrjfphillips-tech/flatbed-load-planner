# Implementation Plan: Load Diagram Generator

## Overview

This plan implements a general-purpose 3D bin-packing load diagram generator as a new module alongside the existing flatbed load planner. Supports both metric (mm/kg) and imperial (in/lb) units of measure with canonical internal storage in mm/kg, supports pallets/boxes/mixed freight, and produces visual loading diagrams with PDF export. Implementation follows the same monorepo pattern: shared types first, then backend services, then frontend UI.

## Tasks

- [x] 1. Set up shared types and constants
  - [x] 1.1 Create shared load-diagram types and interfaces
    - Create `packages/shared/src/load-diagram/` directory
    - Define the `UnitSystem` type (`'metric' | 'imperial'`)
    - Define TypeScript interfaces: `DoorConfig`, `LDTrailerProfile` (with `displayUnitSystem`), `LoadItem`, `PlacedItem`, `ItemOrientation`, `LoadPlan` (with `sourceUnitSystem`/`displayUnitSystem`), `PackingResult`, `ValidationError`, `ExcelParseResult` (with `detectedUnitSystem`), `DiagramExportOptions` (with `unitSystem`)
    - Define constants: Excel column definitions (metric + imperial), default stackability classes, European and North American trailer templates
    - Export from `packages/shared/src/load-diagram/index.ts`
    - Re-export from `packages/shared/src/index.ts`
    - _Requirements: 2.1, 2.2, 9.2, 10.1_

  - [x] 1.2 Create shared unit conversion and formatting module
    - Create `packages/shared/src/load-diagram/units.ts`
    - Define exact conversion constants: `MM_PER_INCH = 25.4`, `KG_PER_POUND = 0.45359237`
    - Implement `lengthToCanonical` / `lengthFromCanonical` and `weightToCanonical` / `weightFromCanonical`
    - Implement unit-labeled display formatters `formatLength` / `formatWeight` and label helpers `lengthUnitLabel` / `weightUnitLabel`
    - Write property test: canonical → display unit → canonical round-trips within tolerance for both unit systems
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 2. Implement 3D Bin-Packing Engine
  - [x] 2.1 Implement extreme-point-based placement algorithm
    - Create `packages/shared/src/load-diagram/packing-engine.ts`
    - Implement item sorting: delivery stop DESC, then volume DESC
    - Implement extreme point generation and management
    - Implement orientation enumeration (6 rotations for each item)
    - Implement best-fit placement scoring (prefer lower Z, then back-of-trailer)
    - Implement overflow detection when items don't fit
    - Ensure determinism: same inputs produce identical outputs
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7_

  - [x] 2.2 Implement constraint enforcement during packing
    - Implement stackability class checking (weight-on-top limits)
    - Implement floor-only placement enforcement
    - Implement top-load-prohibited enforcement
    - Implement temperature zone boundary checking
    - Implement axle weight distribution calculation and limit checking
    - _Requirements: 3.3, 3.4, 5.1, 5.2, 5.3, 5.4_

  - [x] 2.3 Write property tests for packing engine
    - No two placed items overlap in 3D space
    - All placed items within trailer bounds
    - Total placed weight <= max payload
    - Sum of axle weights equals total item weight
    - Items with higher delivery stop have lower load sequence (loaded first)
    - Floor-only items always at Z=0
    - Top-load-prohibited items have nothing above them
    - _Requirements: 3.1, 3.3, 3.4, 3.5_

- [x] 3. Implement constraint validator
  - [x] 3.1 Create standalone constraint validation module
    - Create `packages/shared/src/load-diagram/constraint-validator.ts`
    - Implement `validateAllConstraints()` for full plan validation
    - Implement `validateSinglePlacement()` for real-time manual adjustment validation
    - Implement stackability matrix support
    - Report specific conflicting constraints and affected items
    - _Requirements: 5.1, 5.5, 6.2_

- [x] 4. Checkpoint — shared packing engine complete
  - Build shared package, run all tests — PASS (build clean, 496/496 tests)

- [x] 5. Implement backend Excel parser
  - [x] 5.1 Create Excel parsing service
    - Create `packages/backend/src/load-diagram/services/excelParser.ts`
    - Parse .xlsx files using ExcelJS (already a backend dependency; used instead of SheetJS to match project conventions)
    - Detect the file's `UnitSystem` from a declared cell/column or from which dimension columns are present; return a validation error if metric and imperial columns are mixed
    - Validate column presence and data types (metric or imperial column sets)
    - Convert rows to `LoadItem[]`, converting imperial input to canonical mm/kg via the shared `units` module
    - Generate row-level validation errors
    - Produce parse summary in canonical units and report `detectedUnitSystem`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.2, 9.3, 10.2, 10.5_

  - [x] 5.2 Create downloadable Excel template (metric and imperial variants)
    - Generate metric and imperial template variants with pre-defined headers and data validation
    - Include instruction sheet explaining each column and its expected `UnitSystem`
    - Implement round-trip property: export with data then re-upload produces identical items and preserves the `UnitSystem`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.2_

- [x] 6. Implement backend database schema and routes
  - [x] 6.1 Create Drizzle schema for load diagram tables
    - Create `packages/backend/src/db/schema/load-diagram.ts`
    - Define tables: trailer_profiles (with `display_unit_system`), ld_load_plans (with `source_unit_system` and `display_unit_system`), ld_load_items, ld_plan_history
    - Store all dimension/weight columns in canonical units (mm/kg)
    - Add to schema index exports
    - Generate and run migration
    - Seed European trailer templates (13.6m curtainsider, box trailer, mega trailer — metric display) and North American templates (53 ft dry van, 48 ft flatbed — imperial display), all stored in canonical mm/kg
    - _Requirements: 2.1, 2.2, 10.1, 10.2_

  - [x] 6.2 Create API routes
    - Create `packages/backend/src/routes/loadDiagram.ts`
    - Implement upload endpoint (base64 .xlsx body field — avoids a multipart plugin dependency)
    - Implement template download endpoint
    - Implement trailer profile CRUD
    - Implement load plan CRUD with computation trigger
    - Implement recompute and finalize endpoints
    - Implement PDF export endpoint (501 stub until task 7.1)
    - Register routes in app.ts
    - _Requirements: 1.1, 6.1, 7.1_

- [x] 7. Implement PDF diagram generation
  - [x] 7.1 Create PDF generation service
    - Create `packages/backend/src/load-diagram/services/diagramGenerator.ts`
    - Convert canonical values to the export `unitSystem` and label every dimension/weight via the shared `units` module
    - Render top-down view with item IDs, dimensions, color coding by stop
    - Render side view showing vertical stacking
    - Include summary statistics (weight, volume utilization, axle weights) with unit labels
    - Include loading checklist with load sequence order
    - Support A3 and A4 paper sizes
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.1, 7.3, 10.6_

- [x] 8. Checkpoint — backend complete
  - Build backend, run all tests — PASS (build clean, 295/295 tests; export verified end-to-end against Neon returning a valid PDF)

- [x] 9. Implement frontend upload wizard and store
  - [x] 9.1 Create Zustand store and load diagram page
    - Create `packages/frontend/src/features/load-diagram/` directory
    - Create Zustand store with state: trailerProfile, items, plan, validationErrors, displayUnitSystem
    - Add a `setDisplayUnitSystem` action that re-displays existing values without mutating canonical data or the computed plan
    - Create `LoadDiagramPage.tsx` with wizard navigation and a metric/imperial unit toggle
    - Add route `/load-diagram` to router.tsx
    - _Requirements: 6.1, 10.1, 10.4_

  - [x] 9.2 Create upload wizard component
    - File drop zone (drag-and-drop or file picker)
    - Template download links for both metric and imperial variants
    - Validation results display (errors and summary), showing the detected `UnitSystem`
    - Trailer profile selection from templates or custom (with unit-aware dimension display)
    - Generate button to trigger computation
    - _Requirements: 1.1, 1.5, 2.3, 9.1, 10.4_

- [x] 10. Implement frontend diagram viewer
  - [x] 10.1 Create 2D canvas diagram viewer
    - Create `DiagramViewer.tsx` with HTML5 Canvas
    - Render top-down and side views
    - Color code by delivery stop
    - Show load sequence numbers
    - Zoom and pan controls
    - Item hover/click for detail tooltip
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 10.2 Create 3D interactive viewer
    - Create `ThreeDViewer.tsx` with Three.js / @react-three/fiber
    - Trailer wireframe with colored item meshes
    - Orbit controls for rotation/zoom
    - Item selection with highlight
    - _Requirements: 4.7_

- [x] 11. Implement plan editor and export
  - [x] 11.1 Create drag-and-drop plan editor
    - Drag items to new positions on 2D canvas
    - Real-time constraint validation with red outlines
    - Undo/redo support
    - Constraint violation side panel
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 11.2 Create export panel
    - PDF export with paper size, view selection, and unit system selection (defaults to the plan's display unit system)
    - Loading checklist preview with unit-labeled values
    - _Requirements: 7.1, 7.3, 10.6_

- [x] 12. Final checkpoint
  - Build all packages, run all tests, verify end-to-end workflow — PASS (all packages build clean; shared 496/496, backend 295/295, frontend 538/538 = 1329 tests; upload→compute→export verified end-to-end against Neon)

## Notes

- Supports both metric (mm/kg) and imperial (in/lb) units; all values are stored canonically in mm/kg and converted only at ingest and display/export via the shared `units` module
- OptiFlow integration (Req 8) is deferred — implement stubs with TODO markers
- Email distribution (Req 7.2) is deferred — PDF export is the priority
- The packing engine lives in shared/ so it can run both server-side and in a Web Worker
- European trailer templates: 13.6m standard (13600x2480x2700mm), box (13600x2480x2700mm), mega (13600x2480x3000mm)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "3.1"] },
    { "id": 4, "tasks": ["5.1", "6.1"] },
    { "id": 5, "tasks": ["5.2", "6.2"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["9.1", "9.2"] },
    { "id": 8, "tasks": ["10.1"] },
    { "id": 9, "tasks": ["10.2", "11.1"] },
    { "id": 10, "tasks": ["11.2"] }
  ]
}
```
