# Implementation Plan: OptiFlow Flatbed Steel Load Planner

## Overview

This plan implements a browser-based flatbed steel load planner following a monorepo structure with three packages: `shared` (pure computation logic), `frontend` (React SPA with Web Worker), and `backend` (Fastify API with PostgreSQL). The shared package is built first since it contains the core domain logic consumed by both frontend and backend. Implementation progresses from foundational types and calculations through the planning engine, then to UI and API layers, and finally to export, versioning, and verification features.

## Tasks

- [x] 1. Set up shared package with core types and interfaces
  - [x] 1.1 Create shared package structure and core type definitions
    - Create `packages/shared/` directory with `tsconfig.json` and `package.json`
    - Define all core TypeScript interfaces: `TrailerProfile`, `TractorProfile`, `EquipmentCombination`, `SteelOrderLineItem`, `SteelProductType`, `FreightGeometry`, `GeometricType`, `PlacedFreight`, `Position2D`, `Position3D`, `FreightDimensions`
    - Define enums and union types: `AxleGroup`, `LoadPattern`, `RuleType`, `HandlingMethod`, `StackPermission`, `Orientation`
    - Export all types from `packages/shared/src/index.ts`
    - _Requirements: 1.1, 2.2, 3.1, 3.5_

  - [x] 1.2 Create equipment validation functions
    - Implement `validateTrailerProfile()` — verify axle ratings sum ≥ (maxGross − tare)
    - Implement `validateTractorProfile()` — verify all ratings are positive
    - Implement `calculateEquipmentCombination()` — compute available payload, total legal gross, per-axle limits
    - Implement `isPayloadValid()` — reject combinations with negative payload
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 1.3 Write property tests for equipment validation
    - **Property 1: Equipment payload calculation consistency** — For any valid tractor-trailer combination, available payload = totalLegalGross − tractorTare − trailerTare; negative payload rejects combination
    - **Property 2: Trailer profile axle rating validation** — Profile accepted iff sum(axleRatings) ≥ (maxGross − tare)
    - Create `arbitraryTrailerProfile()` and `arbitraryTractorProfile()` generators
    - **Validates: Requirements 1.4, 1.5, 1.6**

- [x] 2. Implement Geometric Modeler
  - [x] 2.1 Implement geometric type assignment and footprint calculations
    - Create `packages/shared/src/geometry/` module
    - Implement `assignGeometricType(productType)` — deterministic mapping from all 20+ steel product types to geometric types
    - Implement `calculateContactFootprint(geometry)` — compute contact area based on geometric type
    - Implement `calculateDeckPressure(weight, footprint)` — PSF calculation
    - Implement `calculateCradleAngle(diameter, cradleWidth)` — angle for horizontal cylindrical items
    - Implement `calculateChockDimensions(diameter)` — chock sizing for horizontal coils
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.2 Write property tests for geometric modeler
    - **Property 5: Geometric type assignment and footprint calculation** — For any product type and valid dimensions, geometric type is deterministic, footprint is positive finite, horizontal cylinders produce valid cradle angle (0° < angle < 90°)
    - Create `arbitrarySteelOrderLineItem()` generator
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 3. Implement Weight Calculator
  - [x] 3.1 Implement weight distribution and axle load calculations
    - Create `packages/shared/src/weight/` module
    - Implement `calculateAxleLoads(itemWeight, itemCGPosition, trailerAxlePositions, kingpinToFifthWheel)` — distribute weight across axle groups using lever arm physics
    - Implement `calculateWeightMetrics(placedFreight, equipment, trailer, tractor)` — compute full WeightMetrics including steer/drive/trailer weights, CG position, lateral offset, max concentrated load
    - Implement `calculateConcentratedLoad(item, overlappingItems)` — PSF at worst deck point
    - Implement axle percentage calculations (% of rating used per axle group)
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [x] 3.2 Write property tests for weight calculator
    - **Property 6: Weight metrics conservation invariant** — sum(axle weights) = totalGross = tractorTare + trailerTare + sum(freightWeights); invariant holds after any placement change
    - Create `arbitraryPlacedFreight(trailer)` generator for freight within valid deck bounds
    - **Validates: Requirements 6.1, 6.2, 6.6, 11.5**

- [x] 4. Implement Rules Engine
  - [x] 4.1 Implement rules engine core and default rule set
    - Create `packages/shared/src/rules/` module
    - Define `Rule` interface with `evaluate(context)` and `applicability(context)` methods
    - Implement default hard constraints: axle overweight, gross weight, concentrated load, stop-order accessibility, anti-roll securement, boundary violations
    - Implement default soft preferences: heavier items lower, CG between 40-50% of trailer length, lateral imbalance ≤ 5%, dunnage between dissimilar metals
    - Implement `evaluateAllRules(rules, context)` — returns results array and `canApprove` flag
    - Ensure all warning messages use plain language with item references, thresholds, and suggested actions
    - _Requirements: 4.1, 4.2, 4.3, 12.1, 12.2, 12.3_

  - [x] 4.2 Write property tests for rules engine
    - **Property 8: Hard constraint satisfaction in generated plans** — any successful plan has zero hard constraint violations
    - **Property 14: Warning severity classification mapping** — hard→Error, soft→Warning, advisory→Info; canApprove iff zero Errors
    - **Validates: Requirements 4.1, 4.2, 5.3, 12.2, 12.5**

  - [x] 4.3 Implement custom rules and rule management
    - Implement rule CRUD: add custom rules with name, description, type, and applicability conditions
    - Implement rule classification change with audit logging (timestamp, user, previous/new type)
    - Implement rule summary presentation for planner acknowledgment before generation
    - _Requirements: 4.4, 4.5, 4.6_

- [x] 5. Implement Securement Planner
  - [x] 5.1 Implement securement calculation logic
    - Create `packages/shared/src/securement/` module
    - Implement `calculateMinTieDowns(itemLength, itemWeight)` — FMCSA formula: max(2, ceil(L/120))
    - Implement `calculateRequiredWLL(cargoWeight)` — 50% aggregate WLL rule
    - Implement `assignSecurement(placedFreight, trailer)` — full SecurementPlan generation
    - Implement securement type recommendations per freight category (chains for coils/plate, straps for bundles, edge protectors for sharp edges)
    - Implement coil-specific securement (chain through eye, blocking fore/aft, chocking)
    - Implement anchor point assignment with overflow detection
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 5.2 Write property tests for securement planner
    - **Property 12: Securement FMCSA compliance** — for any item with length L and weight W: tieDowns ≥ max(2, ceil(L/120)), aggregate WLL ≥ 50% of W, each tie-down references valid anchor, coils have coil-specific securement
    - **Validates: Requirements 9.1, 9.3, 9.4, 9.5**

- [x] 6. Checkpoint - Core shared logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Planning Engine (Placement Algorithm)
  - [x] 7.1 Implement load pattern detection and placement heuristic
    - Create `packages/shared/src/planner/` module
    - Implement load pattern recognition: layered, column_building, row_building, long_product, nested, customer_zoning, mixed
    - Implement deterministic placement heuristic following priority order: (1) stop-order accessibility, (2) hard constraints, (3) weight distribution optimization, (4) steel stacking/support rules, (5) soft preferences, (6) minimize unused space
    - Implement `generateLoadPlan(request)` — produces complete PlanResult with placement, metrics, securement, and loading sequence
    - Ensure determinism: same inputs always produce identical outputs
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 19.1, 19.2, 19.3, 19.4_

  - [x] 7.2 Implement stacking and support rule enforcement
    - Enforce "no stack" items never placed beneath others
    - Enforce max stack weight and max stack height limits
    - Implement horizontal coil anti-roll securement requirement (racks/cradles/chocking)
    - Implement dunnage insertion between dissimilar-hardness materials
    - Implement long product support rules (≥ 2 support points, max unsupported span)
    - Implement plate/sheet edge protection and banding requirements
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 7.3 Implement stop-order accessibility logic
    - Implement delivery stop assignment and validation
    - Enforce stop-N items accessible without moving stop-M items (M > N)
    - Implement overhead crane unloading clearance (vertical access)
    - Implement side unloading lateral access validation
    - Implement forklift-from-rear access validation
    - Report conflicts with affected items and suggested corrective actions
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 7.4 Implement multi-load splitting
    - Detect when freight exceeds single-trailer capacity (weight or volume)
    - Split freight across multiple load plans preserving stop integrity
    - Produce linked plan set with master summary of item-to-trailer assignments
    - Report unplaceable items with constraint details and suggestions
    - _Requirements: 5.5, 5.6, 16.1, 16.2, 16.3, 16.4_

  - [x] 7.5 Write property tests for planning engine
    - **Property 7: Placement determinism** — identical inputs produce bit-for-bit identical placements
    - **Property 9: Stop-order accessibility invariant** — no later-stop item blocks access to earlier-stop items
    - **Property 10: Stacking safety invariant** — no-stack respected, max stack weight/height enforced
    - **Property 11: Steel-specific support and protection requirements** — coils have anti-roll, dissimilar items have dunnage, long products have ≥ 2 supports, plates have edge protection
    - **Property 13: Multi-load split item conservation** — union of items across loads = original input set, stop integrity preserved
    - Create `arbitraryFreightSet(n)` generator
    - **Validates: Requirements 5.2, 7.1-7.7, 8.2, 8.4, 8.5, 16.1-16.3**

- [x] 8. Implement loading and unloading instructions
  - [x] 8.1 Implement loading sequence and instruction generation
    - Generate numbered loading sequence (first-placed = step 1)
    - Include per-step details: item description, plain-language placement position, orientation, dunnage to place first, securement to apply after
    - Generate unloading instructions per delivery stop with removal order
    - Include securement removal steps in unloading instructions
    - Generate warehouse-view and driver-view formatting
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 8.2 Write property tests for loading sequence
    - **Property 15: Loading sequence reproduces plan** — executing loading steps in order reproduces the exact placed freight configuration
    - **Validates: Requirements 13.1, 13.2**

- [x] 9. Checkpoint - Planning engine complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Import Service (Frontend)
  - [x] 10.1 Implement CSV and Excel file parsing
    - Create `packages/frontend/src/features/import/` module
    - Implement CSV parsing using `papaparse` with field mapping to `SteelOrderLineItem`
    - Implement XLSX parsing using `xlsx` library with field mapping
    - Validate all required fields: order number, customer name, stop, product type, quantity, weight, dimensions, handling, stacking, orientation, dunnage, notes
    - Identify and report row/field-specific errors with descriptive messages
    - Detect and flag duplicate order-line combinations
    - Support all 20+ steel product type categories
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [x] 10.2 Implement manual order entry form
    - Create manual entry form with the same field set as file import
    - Implement inline validation matching import validation rules
    - Allow adding, editing, and removing individual line items
    - _Requirements: 2.4_

  - [x] 10.3 Write property tests for import service
    - **Property 3: Import field round-trip preservation** — serialize to CSV then parse back produces equivalent object with all fields preserved
    - **Property 4: Import validation error identification** — invalid items produce non-empty error set identifying row and field
    - **Validates: Requirements 2.2, 2.3, 2.5**

- [x] 11. Implement Equipment Configurator UI
  - [x] 11.1 Build equipment configuration forms and Zustand store
    - Create `packages/frontend/src/features/equipment/` module
    - Create Zustand store slice for equipment state (`selectedTractor`, `selectedTrailer`, `combination`)
    - Build trailer profile form with all attributes (length, deck width, height, weights, axles, positions, ratings, kingpin, overhang, material, stake pockets, anchor points, concentrated load)
    - Build tractor profile form (steer rating, drive rating, fifth-wheel, tare, drive axle count)
    - Pre-load 48-foot and 53-foot standard flatbed templates
    - Display calculated payload capacity, total legal gross, per-axle limits on combination selection
    - Show error and block selection when payload < 0
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

- [x] 12. Implement Drawing Renderer
  - [x] 12.1 Build SVG drawing renderer with multiple views
    - Create `packages/frontend/src/features/drawing/` module
    - Implement top-down (plan) view showing deck outline, freight items, axle positions, kingpin, stake pockets, anchor points
    - Implement left-side and right-side elevation views
    - Implement front view (cab toward rear) and rear view (rear toward cab)
    - Render each item with distinct visual identifier: geometric outline, order/item label, stop color coding, weight annotation, dimensions
    - Support zoom, pan, and high-resolution print via SVG viewBox manipulation
    - _Requirements: 10.1, 10.2, 10.3, 10.7_

  - [x] 12.2 Implement securement and dunnage overlay views
    - Create securement overlay showing tie-down positions, chain/strap routing, anchor point assignments
    - Create dunnage overlay showing material positions, dimensions, and types
    - Implement item highlighting: hover/select highlights across all views simultaneously
    - _Requirements: 10.4, 10.5, 10.6_

  - [x] 12.3 Write unit tests for drawing renderer
    - Test all 5 view types are generated
    - Test color coding by stop/product type/weight
    - Test cross-view highlighting behavior
    - Test responsive rendering from 1024px to 3840px screen widths
    - _Requirements: 10.1, 10.6, 10.7, 20.4_

- [x] 13. Implement Manual Load Adjustment UI
  - [x] 13.1 Build drag-and-drop adjustment interface
    - Implement drag-to-reposition in top-down view
    - Implement orientation toggle (longitudinal/transverse) for any item
    - Implement position swap between two items
    - Implement item removal to unassigned list
    - Trigger weight recalculation within 2 seconds of any adjustment
    - Trigger rule re-evaluation and display violations/warnings immediately
    - Show hard constraint violation warnings with override requiring Supervisor acknowledgment
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 13.2 Implement multi-load manual reassignment
    - Allow manual reassignment of items between trailers in a multi-load set
    - Recalculate weight metrics for all affected trailers on reassignment
    - _Requirements: 16.5, 16.6_

- [x] 14. Implement Web Worker integration for planning engine
  - [x] 14.1 Set up Web Worker for client-side plan generation
    - Create Web Worker entry point that imports shared planning engine
    - Implement message-based communication between UI and worker (request/response/progress)
    - Implement timeout handling (cancel after 30s, report partial results)
    - Handle worker crash recovery (restart worker, retry once, then report failure)
    - Wire "Generate Load Plan" button to worker invocation with loading state
    - _Requirements: 5.1, 20.1, 20.2_

- [x] 15. Implement Warnings and Notifications UI
  - [x] 15.1 Build warning display panel
    - Implement warning summary panel with severity counts (Error, Warning, Info)
    - Display scrollable list of all active warnings
    - Format each warning with: what is wrong, affected items, limit/threshold, corrective action
    - Enable "Approve Plan" only when zero Error-severity warnings exist
    - Style warnings in plain language without formulas, referencing items by order number and description
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 16. Implement four-step wizard UI shell
  - [x] 16.1 Build wizard navigation and Zustand store
    - Create `packages/frontend/src/features/wizard/` module
    - Implement step navigation: Equipment → Steel Orders → Rules → Generate Load Plan
    - Create main Zustand store with `LoadPlannerState` shape (currentStep, isGenerating, unsavedChanges)
    - Wire equipment, import, rules, and plan steps to their respective feature modules
    - Implement rule summary presentation with advisory rule acknowledgment before generation
    - Implement pattern override selection (allow planner to choose alternative before generation)
    - _Requirements: 4.6, 19.3, 20.5_

- [x] 17. Checkpoint - Frontend planning workflow complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Implement Backend API and Database
  - [x] 18.1 Set up database schema with Drizzle ORM
    - Create/update Drizzle schema in `packages/backend/src/db/` for tables: users, user_roles, equipment_trailers, equipment_tractors, load_plans, plan_versions, plan_items, plan_warnings, securement_assignments, multi_load_sets, verification_checklists, rules, rule_audit_log
    - Generate and run migrations
    - Seed 48-foot and 53-foot standard trailer templates
    - _Requirements: 1.2, 14.1_

  - [x] 18.2 Implement authentication and role-based access control
    - Implement user authentication middleware (session-based or JWT)
    - Implement RBAC middleware enforcing role permissions: Planner (create/edit/submit), Loader (view instructions/mark complete), Driver (view plans/checklists), Supervisor (approve/reject/override), Administrator (manage all), Customer_Viewer (read-only assigned items)
    - Deny unauthorized actions with clear "insufficient permissions" response
    - Support multiple roles per user (union of permissions)
    - Restrict equipment/rules/user management to Administrator_Role only
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 18.3 Write property tests for RBAC
    - **Property 16: Role-based access control enforcement** — effective permissions = union of role permissions; non-admin users denied admin-only actions
    - **Validates: Requirements 17.2, 17.4, 17.5**

  - [x] 18.4 Implement Plan Service with versioning
    - Implement plan CRUD endpoints (create, save, retrieve, list)
    - Implement version history: increment version on every save
    - Implement plan status workflow: draft → pending_approval → approved/rejected → superseded
    - Lock approved plans against edits; new modifications create new version requiring re-approval
    - Implement plan comparison between any two versions
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 18.5 Implement rules management API
    - Implement rules CRUD endpoints (list, create, update classification, delete)
    - Implement rule audit logging on classification change (timestamp, user, previous/new type)
    - _Requirements: 4.4, 4.5_

- [x] 19. Implement Export Service
  - [x] 19.1 Implement PDF export
    - Create `packages/backend/src/services/export/` module
    - Generate multi-page PDF containing: cover page with summary, all drawing views, loading sequence instructions, securement details, weight summary, warning summary, driver verification checklist
    - Generate printable single-page loading summary (clipboard/cab attachment)
    - _Requirements: 15.1, 15.3_

  - [x] 19.2 Implement Excel export
    - Generate Excel workbook with separate sheets: freight manifest, placement coordinates, weight calculations, securement requirements, loading sequence
    - _Requirements: 15.2_

  - [x] 19.3 Implement shareable links with role-appropriate views
    - Generate shareable links with access control: full plan for Planners/Supervisors, loading instructions for Loaders, verification checklist for Drivers
    - Implement Customer_Viewer access: display only items assigned to that customer's delivery stops
    - _Requirements: 15.4, 15.5_

  - [x] 19.4 Write property tests for customer view isolation
    - **Property 17: Customer view data isolation** — displayed items contain only freight for that customer's stops; no other customer items visible
    - **Validates: Requirements 15.5**

- [x] 20. Implement Driver and Loader Verification
  - [x] 20.1 Build verification checklist and loader progress tracking
    - Generate verification checklist for approved plans: item presence, securement check, weight check, damage check
    - Record verification timestamp and driver identity on completion
    - Implement non-conforming item workflow: require discrepancy description, notify Supervisor
    - Implement loader step-by-step completion marking with real-time progress indicator
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [x] 21. Implement Offline Support and Performance
  - [x] 21.1 Implement offline data preservation and sync
    - Implement local state persistence using IndexedDB (via `idb-keyval`) for unsaved changes
    - Detect network interruption and display offline indicator
    - Synchronize local changes when connectivity resumes
    - Implement responsive rendering: readable/interactive on 1024px to 3840px screens
    - Ensure browser compatibility: Chrome, Firefox, Edge, Safari (current versions)
    - _Requirements: 20.3, 20.4, 20.5, 20.6_

- [x] 22. Final checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The shared package (tasks 1-8) contains all pure computation logic and should be implemented first
- Frontend features (tasks 10-16) consume the shared package and can be parallelized after shared is stable
- Backend features (tasks 18-21) can be developed in parallel with frontend after the database schema is set up
- Web Worker integration (task 14) depends on the planning engine being complete (tasks 7-8)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["2.2", "3.1"] },
    { "id": 4, "tasks": ["3.2", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "5.1"] },
    { "id": 6, "tasks": ["5.2", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3"] },
    { "id": 8, "tasks": ["7.4"] },
    { "id": 9, "tasks": ["7.5", "8.1"] },
    { "id": 10, "tasks": ["8.2", "10.1", "11.1", "18.1"] },
    { "id": 11, "tasks": ["10.2", "10.3", "12.1", "18.2"] },
    { "id": 12, "tasks": ["12.2", "12.3", "18.3", "18.4"] },
    { "id": 13, "tasks": ["13.1", "14.1", "18.5"] },
    { "id": 14, "tasks": ["13.2", "15.1", "16.1"] },
    { "id": 15, "tasks": ["19.1", "19.2", "19.3", "20.1"] },
    { "id": 16, "tasks": ["19.4", "21.1"] }
  ]
}
```
