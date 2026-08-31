# Implementation Plan: Daily Fleet Load Planner

## Overview

This plan implements a multi-vehicle fleet planning system that extends the existing single-truck flatbed load planner. The implementation is frontend-first (no backend changes), adding a fleet orchestration layer that parses a fleet manifest, resolves vehicle profiles, matches orders to vehicles via Delivery_Number, and batch-invokes the existing `generateLoadPlan()` engine per vehicle. The existing wizard and planning pipeline remain untouched; all new code is additive.

## Tasks

- [x] 1. Set up fleet feature structure and core types
  - [x] 1.1 Create fleet feature directory and define core interfaces
    - Create `packages/frontend/src/features/fleet/` directory
    - Create `packages/frontend/src/features/fleet/types.ts` with all shared interfaces: `VehicleRecord`, `ConditionCode`, `FleetFileValidationError`, `VehiclePlanEntry`, `UnmatchedOrder`, `FleetPlanResult`, `ExtractionRule`, `FleetWizardStep`, `ResolvedVehicleProfile`, `ProfileResolutionError`
    - Create `packages/frontend/src/features/fleet/index.ts` barrel export
    - _Requirements: 1.1, 1.2, 2.1, 4.2_

  - [x] 1.2 Create fleet Zustand store (`fleet-store.ts`)
    - Create `packages/frontend/src/features/fleet/fleet-store.ts`
    - Implement `FleetPlannerState` interface with all state slices (fleet file, orders, rules, results, navigation)
    - Implement all actions: `setMode`, `setVehicleRecords`, `setFleetFileErrors`, `setFleetFieldMappings`, `setOrdersByDeliveryNumber`, `setUnmatchedOrders`, `setDeliveryNumberMatchStrategy`, `setCustomExtractionRule`, `setFleetPlanResult`, `selectVehicle`, `goToStep`, `nextStep`, `previousStep`, `resetFleetWizard`, `canProceedFromStep`
    - _Requirements: 6.1, 6.2, 5.3_

- [x] 2. Implement fleet file parsing and smart mapping
  - [x] 2.1 Implement fleet smart mapper (`fleet-smart-mapper.ts`)
    - Create `packages/frontend/src/features/fleet/fleet-smart-mapper.ts`
    - Define `FLEET_REQUIRED_FIELDS` and `FLEET_FIELD_ALIASES` (including Spanish column names: placa, tipo, capacidad, largo, ancho, condicion, zona)
    - Implement `autoMapFleetColumns(sourceColumns: string[]): FieldMapping[]` using fuzzy header matching pattern from existing `smartMapper.ts`
    - _Requirements: 7.1, 7.2_

  - [x] 2.2 Implement fleet file parser and validator (`fleet-parser.ts`)
    - Create `packages/frontend/src/features/fleet/fleet-parser.ts`
    - Implement `parseFleetFile(rows, mappings): FleetParseResult` that maps rows to VehicleRecord objects using the confirmed field mappings
    - Implement `validateVehicleRecord(row, rowIndex)` that checks all required fields are present and valid (non-empty strings, positive numbers for weight/dimensions, valid condition code)
    - Implement duplicate vehicle ID detection across all rows
    - Return `FleetParseResult` with valid records, per-row errors, and duplicate report
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x]* 2.3 Write property test for fleet file parsing round trip
    - **Property 1: Fleet file parsing round trip**
    - Generate arbitrary valid VehicleRecord arrays, serialize to CSV-style rows, parse through `parseFleetFile`, and assert output matches input records
    - **Validates: Requirements 1.1**

  - [x]* 2.4 Write property test for invalid fleet row error reporting
    - **Property 2: Invalid fleet rows produce per-row errors**
    - Generate rows with missing/invalid fields, assert each produces at least one FleetFileValidationError with correct row number and field name, and no VehicleRecord is produced for that row
    - **Validates: Requirements 1.2, 1.3**

  - [x]* 2.5 Write property test for duplicate vehicle ID detection
    - **Property 3: Duplicate vehicle IDs are detected**
    - Generate fleet files with duplicate IDs, assert all duplicate rows are reported
    - **Validates: Requirements 1.4**

- [x] 3. Implement vehicle profile resolution
  - [x] 3.1 Implement profile resolver (`profile-resolver.ts`)
    - Create `packages/frontend/src/features/fleet/profile-resolver.ts`
    - Define `CONDITION_CODE_MAP` mapping condition codes (ZN, ZO, ZB, ZA, ZF) to Peru preset IDs
    - Implement `resolveVehicleProfile(record: VehicleRecord): ResolvedVehicleProfile | ProfileResolutionError`
    - Clone preset trailer/tractor profiles, override weight capacity (convert tonnes → lbs), override platform length/width (convert metres → imperial)
    - Return `ProfileResolutionError` for unrecognized condition codes or vehicle types
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x]* 3.2 Write property test for condition code to preset resolution
    - **Property 4: Profile resolution maps condition codes to correct presets**
    - For any valid VehicleRecord with recognized condition code, assert the resolved profile's trailer ID matches the expected preset
    - **Validates: Requirements 2.1**

  - [x]* 3.3 Write property test for fleet file overrides
    - **Property 5: Fleet file overrides supersede preset defaults**
    - Generate VehicleRecords with custom weight/dimensions, assert resolved profile uses fleet file values (after conversion) not preset defaults
    - **Validates: Requirements 2.3, 2.4**

- [x] 4. Implement delivery number matching
  - [x] 4.1 Implement delivery number matcher (`delivery-matcher.ts`)
    - Create `packages/frontend/src/features/fleet/delivery-matcher.ts`
    - Implement `matchDeliveryNumbers(deliveryNumbers, vehicleIds, strategy, extractionRule?): MatchResult`
    - Implement exact match strategy: `deliveryNumber === vehicleId`
    - Implement pattern match strategy: vehicleId appears as substring within deliveryNumber
    - Implement custom extraction strategy: support substring (character positions), delimiter split (field index), and regex (capture group) extraction rules
    - Track ambiguous matches (delivery number matching multiple vehicles)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 4.2 Implement order grouping by delivery number
    - Add order grouping logic (can be in `delivery-matcher.ts` or a separate utility)
    - Implement `groupOrdersByDeliveryNumber(orders: SteelOrderLineItem[]): Map<string, SteelOrderLineItem[]>`
    - Add the `deliveryNumber` field aliases to the existing orders smartMapper configuration (`delivery_number`, `delivery number`, `numero de entrega`, `n_entrega`, `entrega`)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x]* 4.3 Write property test for order grouping partition completeness
    - **Property 6: Orders grouped by Delivery_Number partition completely**
    - Generate order sets with delivery numbers, group them, assert groups are disjoint and their union equals the original set
    - **Validates: Requirements 3.4**

  - [x]* 4.4 Write property test for delivery number exact match
    - **Property 7: Delivery number exact match is identity**
    - Generate sets where each delivery number exactly equals one vehicle ID, assert complete one-to-one mapping with zero unmatched
    - **Validates: Requirements 8.1**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement fleet planner service and batch generation
  - [x] 6.1 Implement fleet planner service (`fleet-planner.ts`)
    - Create `packages/frontend/src/features/fleet/fleet-planner.ts`
    - Implement `generateFleetPlan(request: FleetPlanRequest, onProgress?): Promise<FleetPlanResult>`
    - Filter vehicles with zero assigned orders
    - Create a `PlanRequest` per vehicle using resolved profile and assigned orders
    - Invoke `generateLoadPlan()` independently per vehicle (sequential or Web Worker)
    - Catch per-vehicle failures, record as `failed` entries with error message
    - Aggregate results into `FleetPlanResult` with summary statistics (totalVehicles, successCount, partialCount, failedCount, totalOrdersPlaced, totalOrdersUnplaced)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x]* 6.2 Write property test for batch result count
    - **Property 8: Batch generation produces one result per vehicle with orders**
    - For N vehicles each with ≥1 order, assert Fleet_Plan_Result contains exactly N entries preserving vehicle ID, license plate, and vehicle type
    - **Validates: Requirements 4.1, 4.2**

  - [x]* 6.3 Write property test for vehicle plan failure isolation
    - **Property 9: Vehicle plan independence (failure isolation)**
    - Simulate planning engine failure for one vehicle, assert other vehicles' results are unaffected
    - **Validates: Requirements 4.3**

  - [x]* 6.4 Write property test for fleet summary count consistency
    - **Property 10: Fleet summary counts are consistent**
    - For any Fleet_Plan_Result, assert `successCount + partialCount + failedCount === totalVehicles === vehicles.length`
    - **Validates: Requirements 4.5**

- [x] 7. Implement fleet wizard UI flow
  - [x] 7.1 Create mode selector component
    - Create `packages/frontend/src/features/fleet/ModeSelector.tsx`
    - Display a choice between "Single Truck" and "Fleet Planning" modes at the wizard entry point
    - On selection, update fleet store mode and route to the appropriate wizard shell
    - _Requirements: 6.3, 6.4_

  - [x] 7.2 Create fleet wizard shell and navigation
    - Create `packages/frontend/src/features/fleet/FleetWizardShell.tsx`
    - Implement 4-step wizard: Step 1 (Fleet File Upload) → Step 2 (Orders File Upload) → Step 3 (Rules Review) → Step 4 (Generate & Review)
    - Create `packages/frontend/src/features/fleet/FleetWizardNav.tsx` step indicator component
    - Wire step navigation through fleet store (`goToStep`, `nextStep`, `previousStep`, `canProceedFromStep`)
    - _Requirements: 6.1, 6.2_

  - [x] 7.3 Create fleet file upload step (Step 1)
    - Create `packages/frontend/src/features/fleet/steps/FleetFileUploadStep.tsx`
    - Implement file drop zone accepting CSV and XLSX files
    - On upload, parse file using existing `parseCsv`/`parseXlsx` utilities
    - Run `autoMapFleetColumns` on source headers
    - Display mapped field preview table
    - If unmapped fields exist, show manual mapping interface
    - On confirmation, run `parseFleetFile` and display validation errors or vehicle summary
    - Block progression if zero valid rows
    - _Requirements: 1.1, 1.3, 1.5, 7.1, 7.2, 7.3_

  - [x] 7.4 Create orders file upload step (Step 2)
    - Create `packages/frontend/src/features/fleet/steps/OrdersFileUploadStep.tsx`
    - Reuse existing import pipeline (smartMapper + validation) for orders parsing
    - After parsing, run delivery number matching against fleet vehicle IDs
    - Display matched orders summary grouped by vehicle
    - Display unmatched orders with manual assignment interface
    - Allow user to set custom extraction rule if needed
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.2, 8.3, 8.4_

  - [x] 7.5 Create rules review step (Step 3) and generation trigger (Step 4)
    - Create `packages/frontend/src/features/fleet/steps/RulesReviewStep.tsx` — reuse existing `RuleSummaryPanel` component
    - Create `packages/frontend/src/features/fleet/steps/FleetGenerateStep.tsx`
    - On generate: resolve profiles for all valid vehicles, invoke `generateFleetPlan`, show progress indicator (completed/total)
    - On completion: transition to fleet summary dashboard
    - _Requirements: 4.1, 6.1_

- [x] 8. Implement fleet plan review interface
  - [x] 8.1 Create fleet summary dashboard component
    - Create `packages/frontend/src/features/fleet/FleetSummaryDashboard.tsx`
    - Display table/card grid with: vehicle ID, license plate, vehicle type, condition code, status badge (success ✓, partial ⚠, failed ✗), order count, total weight
    - Support click-to-select a vehicle for detail view
    - Show fleet-level totals: planned/success/partial/failed counts, total orders placed/unplaced
    - _Requirements: 5.1, 4.5_

  - [x] 8.2 Create per-vehicle plan view with navigation
    - Create `packages/frontend/src/features/fleet/VehiclePlanView.tsx`
    - Display the selected vehicle's header: license plate, vehicle type, condition code
    - Render the vehicle's PlanResult using the existing `DrawingRenderer` and metrics components
    - Implement previous/next vehicle navigation buttons
    - Allow returning to fleet summary without re-running the planning engine
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 9. Wire fleet mode into application routing
  - [x] 9.1 Integrate fleet mode into existing app routing and entry points
    - Add fleet wizard route to `packages/frontend/src/router.tsx`
    - Add mode selector at the existing wizard entry point (or new fleet-specific page)
    - Ensure single-truck wizard remains accessible as alternative mode
    - Wire fleet store initialization and cleanup on mode transitions
    - _Requirements: 6.3, 6.4_

  - [x]* 9.2 Write unit tests for fleet components
    - Test fleet store actions and state transitions
    - Test fleet smart mapper with various column naming conventions (English, Spanish, camelCase, snake_case)
    - Test fleet file validation edge cases (zero-capacity vehicle, negative dimensions, empty strings)
    - Test delivery matcher pattern and custom extraction strategies
    - _Requirements: 1.3, 7.1, 8.1, 8.2_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases using Vitest
- All implementation is frontend-only (no backend changes required)
- The existing wizard-store.ts, DrawingRenderer, smartMapper, and planning engine remain unchanged
- New fleet feature code lives in `packages/frontend/src/features/fleet/`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "3.2", "3.3", "4.2"] },
    { "id": 4, "tasks": ["4.3", "4.4", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4", "7.5"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["8.2", "9.1"] },
    { "id": 10, "tasks": ["9.2"] }
  ]
}
```
