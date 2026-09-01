# Design Document: Load Diagram Generator

## Overview

The Load Diagram Generator is a new module added to the existing ptv-discovery-coach monorepo, leveraging the established Fastify backend, React frontend, and PostgreSQL database. It provides an end-to-end workflow where planners upload Excel files, the system computes optimal 3D packing arrangements, and produces visual loading diagrams for warehouse distribution.

### Unit of Measure Strategy

The system supports both metric (mm/kg) and imperial (in/lb) units. To keep the packing engine, constraint validator, and persistence layer simple and unambiguous, the design uses a **canonical-internal-unit** approach:

- All stored and computed values use **canonical units: millimeters for length and kilograms for weight**. The packing engine, constraint validator, and database only ever deal with canonical units.
- The `UnitSystem` (`'metric' | 'imperial'`) is a property of input (Excel upload, trailer profile entry) and output (display, diagram export), not of computation.
- Conversion happens at the boundaries: the Excel parser converts imperial input to canonical on ingest; the frontend and diagram generator convert canonical to the selected `UnitSystem` for display/export.
- Conversion uses exact factors (1 in = 25.4 mm, 1 lb = 0.45359237 kg). A round-trip (canonical → display unit → canonical) is preserved within display rounding tolerance.
- Both the source `UnitSystem` (as uploaded) and the display `UnitSystem` (for output) are recorded on the load plan so diagrams can be regenerated in the intended units.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                   │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Upload   │  │  Trailer     │  │  Diagram Viewer        │ │
│  │  Wizard   │  │  Config UI   │  │  (2D Canvas + 3D)      │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST API
┌─────────────────────────▼───────────────────────────────────┐
│                   Backend (Fastify + TypeScript)              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Excel    │  │  Packing     │  │  Diagram Generation    │ │
│  │  Parser   │  │  Engine      │  │  Service               │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Trailer  │  │  Constraint  │  │  OptiFlow              │ │
│  │  Profiles │  │  Validator   │  │  Integration           │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   PostgreSQL (via Drizzle ORM)                │
│  trailer_profiles | load_plans | load_items | plan_history   │
└─────────────────────────────────────────────────────────────┘
```

### Technology Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend Framework | React 18 + TypeScript | Already in use in the project |
| State Management | Zustand | Already in use in the project |
| Styling | Tailwind CSS | Already in use in the project |
| 2D Rendering | HTML5 Canvas API | Lightweight, no extra dependency, good for print-quality diagrams |
| 3D Rendering | Three.js | Industry-standard WebGL library for interactive 3D trailer views |
| Backend Framework | Fastify 4 | Already in use in the project |
| Excel Parsing | SheetJS (xlsx) | Most popular Excel parsing library, handles .xls and .xlsx |
| PDF Generation | PDFKit | Server-side PDF generation with canvas-like drawing API |
| Database ORM | Drizzle ORM | Already in use in the project |
| Database | PostgreSQL | Already in use in the project |
| Packing Algorithm | Custom implementation | 3D bin-packing with constraint awareness (no suitable off-the-shelf library handles all constraints) |
| Testing | Vitest + fast-check | Already in use in the project |

## Data Models

### Database Schema

```typescript
// packages/backend/src/load-diagram/schema.ts

import { pgTable, uuid, text, integer, real, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const trailerProfiles = pgTable('trailer_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // Canonical storage: always mm / kg regardless of entry unit system
  internalLength: integer('internal_length_mm').notNull(), // mm (canonical)
  internalWidth: integer('internal_width_mm').notNull(),   // mm (canonical)
  internalHeight: integer('internal_height_mm').notNull(), // mm (canonical)
  maxPayloadWeight: real('max_payload_weight_kg').notNull(), // kg (canonical)
  axleCount: integer('axle_count').notNull(),
  axleWeightLimits: jsonb('axle_weight_limits').$type<number[]>().notNull(), // kg per axle (canonical)
  displayUnitSystem: text('display_unit_system').$type<UnitSystem>().notNull().default('metric'), // 'metric' | 'imperial' — preferred display unit for this profile
  doorConfig: jsonb('door_config').$type<DoorConfig>().default({ rear: true, sideLeft: false, sideRight: false }),
  isTemplate: boolean('is_template').default(false),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const loadPlans = pgTable('load_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  trailerProfileId: uuid('trailer_profile_id').references(() => trailerProfiles.id).notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'), // draft | computed | reviewed | finalized
  sourceUnitSystem: text('source_unit_system').$type<UnitSystem>().notNull().default('metric'), // unit system of the uploaded data
  displayUnitSystem: text('display_unit_system').$type<UnitSystem>().notNull().default('metric'), // unit system for display/export
  totalWeight: real('total_weight_kg'), // kg (canonical)
  volumeUtilization: real('volume_utilization_percent'),
  axleWeights: jsonb('axle_weights').$type<number[]>(),
  itemCount: integer('item_count'),
  computedAt: timestamp('computed_at'),
  finalizedAt: timestamp('finalized_at'),
  optiflowRouteId: text('optiflow_route_id'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const loadItems = pgTable('load_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  loadPlanId: uuid('load_plan_id').references(() => loadPlans.id).notNull(),
  itemId: text('item_id').notNull(), // from Excel
  description: text('description'),
  length: integer('length_mm').notNull(),
  width: integer('width_mm').notNull(),
  height: integer('height_mm').notNull(),
  weight: real('weight_kg').notNull(),
  quantity: integer('quantity').notNull().default(1),
  stackabilityClass: text('stackability_class'),
  maxStackWeight: real('max_stack_weight_kg'),
  deliveryStop: integer('delivery_stop'),
  temperatureZone: text('temperature_zone'),
  floorOnly: boolean('floor_only').default(false),
  topLoadProhibited: boolean('top_load_prohibited').default(false),
  // Computed placement fields
  placedX: integer('placed_x_mm'),
  placedY: integer('placed_y_mm'),
  placedZ: integer('placed_z_mm'),
  placedOrientation: text('placed_orientation'), // 'LWH' | 'WLH' | 'LHW' | 'WHL' | 'HLW' | 'HWL'
  loadSequence: integer('load_sequence'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const planHistory = pgTable('plan_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  loadPlanId: uuid('load_plan_id').references(() => loadPlans.id).notNull(),
  action: text('action').notNull(), // 'computed' | 'manual_adjustment' | 'finalized'
  previousState: jsonb('previous_state'),
  newState: jsonb('new_state'),
  adjustedBy: text('adjusted_by'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### TypeScript Interfaces

```typescript
// packages/shared/src/load-diagram/types.ts

export type UnitSystem = 'metric' | 'imperial';

// Canonical internal units are always millimeters and kilograms.
// UnitSystem only governs how values are entered (Excel/UI) and displayed (UI/PDF).

export interface DoorConfig {
  rear: boolean;
  sideLeft: boolean;
  sideRight: boolean;
  sideLeftPosition?: number; // mm from front (canonical)
  sideRightPosition?: number;
}

export interface TrailerProfile {
  id: string;
  name: string;
  internalLength: number; // mm (canonical)
  internalWidth: number;  // mm (canonical)
  internalHeight: number; // mm (canonical)
  maxPayloadWeight: number; // kg (canonical)
  axleCount: number;
  axleWeightLimits: number[]; // kg per axle (canonical)
  displayUnitSystem: UnitSystem; // preferred display units for this profile
  doorConfig: DoorConfig;
  isTemplate: boolean;
}

export interface LoadItem {
  id: string;
  itemId: string;
  description?: string;
  length: number; // mm (canonical)
  width: number;  // mm (canonical)
  height: number; // mm (canonical)
  weight: number; // kg (canonical)
  quantity: number;
  stackabilityClass?: string;
  maxStackWeight?: number;
  deliveryStop?: number;
  temperatureZone?: string;
  floorOnly: boolean;
  topLoadProhibited: boolean;
}

export interface PlacedItem extends LoadItem {
  placedX: number; // mm from front-left-floor origin
  placedY: number;
  placedZ: number;
  placedOrientation: ItemOrientation;
  loadSequence: number;
}

export type ItemOrientation = 'LWH' | 'WLH' | 'LHW' | 'WHL' | 'HLW' | 'HWL';

export interface LoadPlan {
  id: string;
  trailerProfile: TrailerProfile;
  items: PlacedItem[];
  totalWeight: number; // kg (canonical)
  volumeUtilization: number;
  axleWeights: number[]; // kg (canonical)
  sourceUnitSystem: UnitSystem; // unit system the data was uploaded in
  displayUnitSystem: UnitSystem; // unit system used for display/export
  status: 'draft' | 'computed' | 'reviewed' | 'finalized';
  overflowItems?: LoadItem[]; // items that didn't fit
}

export interface PackingResult {
  placedItems: PlacedItem[];
  overflowItems: LoadItem[];
  volumeUtilization: number;
  totalWeight: number;
  axleWeights: number[];
  computeTimeMs: number;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  value?: string;
}

export interface ExcelParseResult {
  items: LoadItem[]; // dimensions/weights converted to canonical units
  detectedUnitSystem: UnitSystem; // unit system detected from the uploaded file
  errors: ValidationError[];
  summary: {
    totalItems: number;
    totalWeight: number; // kg (canonical)
    totalVolume: number; // cubic mm (canonical)
  };
}

export interface DiagramExportOptions {
  format: 'pdf' | 'png';
  paperSize: 'A3' | 'A4';
  unitSystem: UnitSystem; // unit system for all dimensions/weights rendered in the export
  includeChecklist: boolean;
  includeSummary: boolean;
  views: ('topDown' | 'sideView' | 'rearView')[];
}
```

## Component Design

### Shared Components

#### Unit Conversion & Formatting (`packages/shared/src/load-diagram/units.ts`)

The single source of truth for converting between canonical units (mm/kg) and the metric/imperial display units. Used by both backend (Excel parser, PDF generator) and frontend (UI display, editor) so conversion behavior is identical everywhere.

Responsibilities:
- Convert length and weight between canonical units and a given `UnitSystem`
- Format canonical values as unit-labeled display strings (e.g., `"1200 mm"` / `"47.2 in"`, `"850 kg"` / `"1874 lb"`)
- Provide the column-name sets and unit labels for each `UnitSystem`

Constants and key functions:
```typescript
export const MM_PER_INCH = 25.4;          // exact
export const KG_PER_POUND = 0.45359237;   // exact

// Canonical (mm/kg) -> display unit value
lengthFromCanonical(mm: number, unit: UnitSystem): number       // mm or in
weightFromCanonical(kg: number, unit: UnitSystem): number       // kg or lb

// Display unit value -> canonical (mm/kg)
lengthToCanonical(value: number, unit: UnitSystem): number      // -> mm
weightToCanonical(value: number, unit: UnitSystem): number      // -> kg

// Unit-labeled display strings for diagrams/UI
formatLength(mm: number, unit: UnitSystem, precision?: number): string
formatWeight(kg: number, unit: UnitSystem, precision?: number): string

// Labels used in headers and diagram annotations
lengthUnitLabel(unit: UnitSystem): 'mm' | 'in'
weightUnitLabel(unit: UnitSystem): 'kg' | 'lb'
```

Design notes:
- All packing math, constraint checks, and DB values stay in canonical units. Conversion happens only at ingest (imperial → canonical) and at display/export (canonical → selected unit).
- A property test asserts round-trip stability: `lengthToCanonical(lengthFromCanonical(mm, u), u) ≈ mm` within tolerance for both unit systems (same for weight).

### Backend Components

#### 1. Excel Parser Service (`packages/backend/src/load-diagram/services/excelParser.ts`)

Responsibilities:
- Parse .xlsx and .xls files using SheetJS
- Detect the file's `UnitSystem` (declared cell/column or by which dimension columns are present) and reject files that mix metric and imperial columns
- Validate column presence and data types
- Convert raw rows into `LoadItem[]`, converting imperial values to canonical units (mm/kg) via the shared `units` module
- Generate validation errors with row-level detail
- Produce parse summary (in canonical units) and report the detected `UnitSystem`

Key functions:
```typescript
parseExcelFile(buffer: Buffer): ExcelParseResult
detectUnitSystem(sheet: WorkSheet): UnitSystem  // throws/flags on mixed units
validateRow(row: Record<string, unknown>, rowIndex: number, unitSystem: UnitSystem): ValidationError[]
downloadTemplate(unitSystem: UnitSystem): Buffer  // metric or imperial template variant
```

#### 2. Packing Engine (`packages/backend/src/load-diagram/services/packingEngine.ts`)

Responsibilities:
- Implement 3D bin-packing using a layered approach (bottom-left-fill with best-fit decreasing)
- Enforce all constraints during placement
- Compute weight distribution across axles
- Handle delivery-sequence ordering
- Report overflow items

Algorithm approach:
1. Sort items by delivery stop (descending) then by volume (descending)
2. For each item, try all valid orientations
3. Find the best position using extreme-point-based placement
4. Validate stackability, weight, and zone constraints before confirming placement
5. Track remaining spaces using a free-space list (guillotine cuts)

Key functions:
```typescript
computeLoadPlan(items: LoadItem[], trailer: TrailerProfile, constraints: PackingConstraints): PackingResult
findBestPosition(item: LoadItem, spaces: FreeSpace[], constraints: PackingConstraints): Placement | null
validatePlacement(item: LoadItem, position: Position, currentPlan: PlacedItem[]): ConstraintViolation[]
calculateAxleWeights(placedItems: PlacedItem[], trailer: TrailerProfile): number[]
```

#### 3. Constraint Validator (`packages/backend/src/load-diagram/services/constraintValidator.ts`)

Responsibilities:
- Maintain stackability matrix
- Validate weight-on-top constraints
- Enforce temperature zone boundaries
- Check floor-only and top-load-prohibited flags
- Real-time validation for manual adjustments

Key functions:
```typescript
validateAllConstraints(placedItems: PlacedItem[], trailer: TrailerProfile): ConstraintViolation[]
validateSinglePlacement(item: LoadItem, position: Position, existingItems: PlacedItem[]): ConstraintViolation[]
getStackabilityMatrix(): StackabilityMatrix
```

#### 4. Diagram Generation Service (`packages/backend/src/load-diagram/services/diagramGenerator.ts`)

Responsibilities:
- Generate PDF documents with multi-view diagrams
- Render top-down and side-view representations using PDFKit canvas primitives
- Apply color coding by delivery stop
- Include summary statistics and loading checklist
- Convert canonical values to the export's `UnitSystem` and label every dimension/weight with its unit via the shared `units` module
- Handle A3/A4 scaling

Key functions:
```typescript
generatePDF(loadPlan: LoadPlan, options: DiagramExportOptions): Buffer
renderTopDownView(ctx: PDFContext, plan: LoadPlan, bounds: Rect): void
renderSideView(ctx: PDFContext, plan: LoadPlan, bounds: Rect): void
generateChecklist(plan: LoadPlan): ChecklistEntry[]
```

#### 5. OptiFlow Integration Service (`packages/backend/src/load-diagram/services/optiflowIntegration.ts`)

Responsibilities:
- Authenticate with OptiFlow API
- Import delivery stop sequences from route plans
- Export load plan data back to OptiFlow
- Monitor route changes and flag affected plans

Key functions:
```typescript
importRouteSequence(routeId: string): DeliverySequence[]
exportLoadPlan(planId: string, routeId: string): void
checkRouteChanges(routeId: string, lastKnownVersion: string): boolean
```

### Frontend Components

#### 1. Upload Wizard (`packages/frontend/src/load-diagram/components/UploadWizard.tsx`)

Multi-step component:
- Step 1: File drop zone (drag-and-drop or file picker)
- Step 2: Validation results display (errors or summary confirmation)
- Step 3: Trailer profile selection
- Step 4: Trigger computation

#### 2. Trailer Profile Manager (`packages/frontend/src/load-diagram/components/TrailerProfileManager.tsx`)

- CRUD interface for trailer profiles
- Visual trailer dimension inputs with live preview
- Template library browser
- Axle weight configuration

#### 3. Diagram Viewer (`packages/frontend/src/load-diagram/components/DiagramViewer.tsx`)

- 2D Canvas rendering for top-down and side views
- Color-coded item blocks with labels
- Zoom and pan controls
- Item hover/click for detail tooltip
- Load sequence numbering overlay

#### 4. Interactive 3D View (`packages/frontend/src/load-diagram/components/ThreeDViewer.tsx`)

- Three.js scene with trailer wireframe
- Colored box meshes for each placed item
- Orbit controls for rotation/zoom
- Item selection with highlight
- Toggle between filled and wireframe modes

#### 5. Plan Editor (`packages/frontend/src/load-diagram/components/PlanEditor.tsx`)

- Drag-and-drop item repositioning on 2D canvas
- Real-time constraint violation highlighting (red outlines)
- Undo/redo support
- Side panel with constraint violation list

#### 6. Export Panel (`packages/frontend/src/load-diagram/components/ExportPanel.tsx`)

- PDF export configuration (paper size, views to include)
- Email distribution form
- Checklist preview
- OptiFlow attachment trigger

### API Routes

```typescript
// packages/backend/src/load-diagram/routes.ts

// Excel & Load Items
POST   /api/load-diagram/upload          // Upload Excel file, returns parse result
GET    /api/load-diagram/template        // Download Excel template

// Trailer Profiles
GET    /api/load-diagram/trailers        // List all profiles
POST   /api/load-diagram/trailers        // Create profile
GET    /api/load-diagram/trailers/:id    // Get profile
PUT    /api/load-diagram/trailers/:id    // Update profile
DELETE /api/load-diagram/trailers/:id    // Delete profile

// Load Plans
POST   /api/load-diagram/plans           // Create plan (triggers computation)
GET    /api/load-diagram/plans           // List plans
GET    /api/load-diagram/plans/:id       // Get plan with placed items
PUT    /api/load-diagram/plans/:id       // Update plan (manual adjustments)
POST   /api/load-diagram/plans/:id/recompute  // Recompute after changes
POST   /api/load-diagram/plans/:id/finalize   // Mark as finalized

// Export & Distribution
POST   /api/load-diagram/plans/:id/export     // Generate PDF
POST   /api/load-diagram/plans/:id/email      // Send diagram via email

// Validation
POST   /api/load-diagram/plans/:id/validate   // Validate constraints

// OptiFlow Integration
POST   /api/load-diagram/optiflow/import-route   // Import route sequence
POST   /api/load-diagram/optiflow/export-plan    // Export plan to OptiFlow
```

## Packing Algorithm Design

### Approach: Extreme Point-Based 3D Bin Packing

The algorithm uses a variant of the Extreme Point (EP) heuristic combined with Best-Fit Decreasing (BFD) volume ordering:

```
1. SORT items:
   - Primary: delivery stop DESC (last stop loaded first)
   - Secondary: volume DESC (largest items placed first within each stop group)

2. INITIALIZE extreme points: [(0, 0, 0)] (front-left-floor corner)

3. FOR EACH item in sorted order:
   a. FOR EACH valid orientation of item:
      b. FOR EACH extreme point (sorted by Z asc, then X asc, then Y asc):
         c. IF item fits at point without:
            - Exceeding trailer dimensions
            - Violating stackability rules
            - Exceeding axle weight limits
            - Violating temperature zone boundaries
            - Conflicting with floor-only / top-load rules
         d. THEN score this placement (prefer lower Z, then back-of-trailer)
   e. PLACE item at best-scored position
   f. UPDATE extreme points (generate new EPs from placed item corners)
   g. REMOVE dominated extreme points

4. ITEMS not placed → overflow list
5. COMPUTE final axle weights and volume utilization
```

### Weight Distribution Calculation

Axle weight is computed by treating each item as a point mass at its center of gravity, then distributing load across axles based on longitudinal position:

```
For a 2-axle trailer (front axle at position Af, rear axle at Ar):
  For each item with CoG at position X along trailer length:
    rear_load_fraction = (X - Af) / (Ar - Af)
    front_load_fraction = 1 - rear_load_fraction
    axle_weights[front] += item.weight * front_load_fraction
    axle_weights[rear] += item.weight * rear_load_fraction
```

## File Structure

```
packages/
├── shared/src/load-diagram/
│   ├── types.ts                    # Shared TypeScript interfaces (incl. UnitSystem)
│   ├── constants.ts                # Excel column definitions (metric + imperial), default values
│   ├── units.ts                    # Unit conversion & display formatting (canonical <-> metric/imperial)
│   └── validation.ts               # Shared validation logic
├── backend/src/load-diagram/
│   ├── routes.ts                   # Fastify route definitions
│   ├── schema.ts                   # Drizzle DB schema
│   ├── services/
│   │   ├── excelParser.ts          # Excel file parsing and validation
│   │   ├── packingEngine.ts        # 3D bin-packing algorithm
│   │   ├── constraintValidator.ts  # Constraint checking logic
│   │   ├── diagramGenerator.ts     # PDF/diagram generation
│   │   ├── optiflowIntegration.ts  # OptiFlow API client
│   │   └── emailService.ts         # Email distribution
│   ├── tests/
│   │   ├── excelParser.test.ts
│   │   ├── packingEngine.test.ts
│   │   ├── constraintValidator.test.ts
│   │   └── diagramGenerator.test.ts
│   └── migrations/
│       └── 001_load_diagram_tables.sql
└── frontend/src/load-diagram/
    ├── pages/
    │   ├── LoadDiagramHome.tsx       # Main dashboard
    │   ├── NewLoadPlan.tsx           # Upload wizard page
    │   └── ViewLoadPlan.tsx          # Plan viewer/editor page
    ├── components/
    │   ├── UploadWizard.tsx
    │   ├── TrailerProfileManager.tsx
    │   ├── DiagramViewer.tsx
    │   ├── ThreeDViewer.tsx
    │   ├── PlanEditor.tsx
    │   └── ExportPanel.tsx
    ├── hooks/
    │   ├── useLoadPlan.ts
    │   ├── useTrailerProfiles.ts
    │   └── useDiagramRenderer.ts
    └── store/
        └── loadDiagramStore.ts      # Zustand store
```

## Testing Strategy

### Property-Based Tests (fast-check)

1. **Excel Parser Round-Trip**: For all valid LoadItem arrays and either UnitSystem, exporting to the matching Excel template format then re-parsing produces an equivalent item set with the same detected UnitSystem.
1a. **Unit Conversion Round-Trip**: For any canonical length/weight, converting to a UnitSystem and back is preserved within display rounding tolerance, for both metric and imperial.
2. **Packing Engine Invariants**: For any computed LoadPlan, no two items overlap in 3D space, all items are within trailer bounds, and total placed weight ≤ max payload.
3. **Constraint Validator Consistency**: For any placement flagged as valid by the validator, re-validating the full plan still shows no violations.
4. **Weight Distribution Conservation**: Sum of axle weights equals total item weight (conservation of mass).
5. **Load Sequence Ordering**: Items with higher delivery stop numbers always have lower load sequence numbers (loaded first, unloaded last).

### Unit Tests

- Excel parser column detection and error reporting
- Individual constraint checks (stackability, floor-only, top-load)
- Axle weight calculation for known configurations
- PDF generation produces valid PDF buffer

### Integration Tests

- Full workflow: upload → compute → export
- OptiFlow API mocking and response handling
- Database CRUD operations for trailer profiles and plans

## Dependencies to Add

### Backend
```json
{
  "xlsx": "^0.18.5",        // Excel parsing
  "pdfkit": "^0.15.0",      // PDF generation
  "nodemailer": "^6.9.0"    // Email distribution
}
```

### Frontend
```json
{
  "three": "^0.165.0",                // 3D rendering
  "@react-three/fiber": "^8.16.0",    // React Three.js bindings
  "@react-three/drei": "^9.105.0",    // Three.js helpers
  "react-dropzone": "^14.2.0"         // File upload drag-and-drop
}
```

## Performance Considerations

- Packing computation runs server-side to avoid blocking the UI thread
- For large item sets (>100 items), use a Web Worker on the frontend for 3D rendering
- PDF generation is async with progress notification
- Canvas-based 2D rendering uses virtualization for plans with many items
- Three.js uses instanced meshes for plans with many similarly-shaped items

## Security Considerations

- File upload size limited to 10MB with Fastify multipart plugin
- Excel file content sanitized (no formula execution)
- OptiFlow API keys stored server-side, never exposed to frontend
- Rate limiting on computation endpoint to prevent resource exhaustion
- Input validation on all dimension/weight values (positive numbers, reasonable ranges)
