# Design Document: Daily Fleet Load Planner

## Overview

The Daily Fleet Load Planner extends the existing single-truck flatbed load planning tool into a multi-vehicle fleet planning system. The core change is architectural: instead of a single wizard flow that produces one PlanResult, the system introduces a **Fleet_Planner** orchestration layer that parses a fleet manifest, resolves vehicle profiles from the Peru regional presets catalog, matches orders to vehicles via Delivery_Number, and invokes the existing `generateLoadPlan()` engine N times — once per vehicle-to-orders assignment.

The design preserves the existing single-truck wizard flow as an alternative mode and reuses the existing smartMapper, validation pipeline, and drawing renderer without modification. New code is additive, not a rewrite.

### Key Design Decisions

1. **Frontend-first orchestration**: Fleet planning runs entirely in the browser using a Web Worker pool (one worker per vehicle). No backend changes are required since the planning engine is deterministic and runs client-side.
2. **Reuse existing presets**: Vehicle profiles resolve via condition code + vehicle type to the existing `REGIONAL_PRESETS` catalog (Peru section), with weight/dimension overrides from the fleet file.
3. **Additive wizard mode**: A new Zustand store (`fleet-store.ts`) manages fleet state. The existing `wizard-store.ts` remains unchanged and is used per-vehicle for plan visualization.
4. **Smart column mapping**: The fleet file uses the same `smartMapper` pattern already proven for orders import — fuzzy header matching with manual fallback.

## Architecture

```mermaid
graph TD
    subgraph "Frontend — Fleet Mode"
        A[Mode Selector] --> B{Fleet or Single?}
        B -->|Fleet| C[Fleet Wizard Shell]
        B -->|Single| D[Existing Wizard Shell]
        
        C --> E[Step 1: Fleet File Upload]
        E --> F[Fleet File Parser + SmartMapper]
        F --> G[Vehicle_Record[] validated]
        
        C --> H[Step 2: Orders File Upload]
        H --> I[Existing Import Pipeline]
        I --> J[Orders grouped by Delivery_Number]
        
        C --> K[Step 3: Rules Review]
        C --> L[Step 4: Batch Generate]
        
        L --> M[Fleet Planner Service]
        M --> N[Profile Resolver]
        N --> O[Regional Presets Lookup]
        
        M --> P[Delivery Number Matcher]
        P --> Q[Exact / Pattern / Manual]
        
        M --> R[Worker Pool]
        R --> S1[Worker 1: generateLoadPlan]
        R --> S2[Worker 2: generateLoadPlan]
        R --> SN[Worker N: generateLoadPlan]
        
        S1 --> T[Fleet_Plan_Result]
        S2 --> T
        SN --> T
        
        T --> U[Fleet Summary Dashboard]
        U --> V[Per-Vehicle Plan View]
        V --> W[Existing DrawingRenderer + Metrics]
    end
```

## Components and Interfaces

### 1. Fleet Store (`fleet-store.ts`)

New Zustand store managing fleet-level state, separate from the existing per-vehicle wizard store.

```typescript
interface VehicleRecord {
  vehicleId: string;
  vehicleType: string;         // maps to RegionalPreset condition
  licensePlate: string;
  weightCapacity: number;      // tonnes
  platformLength: number;      // metres
  platformWidth: number;       // metres
  conditionCode: ConditionCode;
}

type ConditionCode = 'ZN' | 'ZO' | 'ZB' | 'ZA' | 'ZF';

interface FleetFileValidationError {
  row: number;
  field: string;
  value: unknown;
  message: string;
}

interface VehiclePlanEntry {
  vehicleId: string;
  licensePlate: string;
  vehicleType: string;
  conditionCode: ConditionCode;
  status: 'success' | 'partial' | 'failed' | 'pending';
  planResult: PlanResult | null;
  assignedOrders: SteelOrderLineItem[];
  error?: string;
}

interface UnmatchedOrder {
  orderNumber: string;
  deliveryNumber: string;
  reason: 'no_vehicle_match' | 'ambiguous_match';
}

interface FleetPlanResult {
  vehicles: VehiclePlanEntry[];
  unmatchedOrders: UnmatchedOrder[];
  summary: {
    totalVehicles: number;
    successCount: number;
    partialCount: number;
    failedCount: number;
    totalOrdersPlaced: number;
    totalOrdersUnplaced: number;
  };
}

type FleetWizardStep = 1 | 2 | 3 | 4;

interface FleetPlannerState {
  // Mode
  mode: 'fleet' | 'single';
  
  // Step 1: Fleet File
  vehicleRecords: VehicleRecord[];
  fleetFileErrors: FleetFileValidationError[];
  fleetFieldMappings: FieldMapping[];
  
  // Step 2: Orders (grouped)
  ordersByDeliveryNumber: Map<string, SteelOrderLineItem[]>;
  unmatchedOrders: UnmatchedOrder[];
  deliveryNumberMatchStrategy: 'exact' | 'pattern' | 'custom';
  customExtractionRule?: ExtractionRule;
  
  // Step 3: Rules (shared with existing)
  activeRules: Rule[];
  
  // Step 4: Results
  fleetPlanResult: FleetPlanResult | null;
  selectedVehicleId: string | null;
  isGenerating: boolean;
  generationProgress: { completed: number; total: number };
  
  // Navigation
  currentStep: FleetWizardStep;
  
  // Actions
  setMode: (mode: 'fleet' | 'single') => void;
  setVehicleRecords: (records: VehicleRecord[]) => void;
  setFleetFileErrors: (errors: FleetFileValidationError[]) => void;
  setFleetFieldMappings: (mappings: FieldMapping[]) => void;
  setOrdersByDeliveryNumber: (orders: Map<string, SteelOrderLineItem[]>) => void;
  setUnmatchedOrders: (orders: UnmatchedOrder[]) => void;
  setDeliveryNumberMatchStrategy: (strategy: 'exact' | 'pattern' | 'custom') => void;
  setCustomExtractionRule: (rule: ExtractionRule) => void;
  setFleetPlanResult: (result: FleetPlanResult) => void;
  selectVehicle: (vehicleId: string) => void;
  goToStep: (step: FleetWizardStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  resetFleetWizard: () => void;
  canProceedFromStep: (step: FleetWizardStep) => boolean;
}
```

### 2. Fleet File Parser (`fleet-parser.ts`)

Parses and validates the fleet manifest file.

```typescript
interface FleetParseResult {
  records: VehicleRecord[];
  errors: FleetFileValidationError[];
  duplicates: { vehicleId: string; rows: number[] }[];
}

function parseFleetFile(
  rows: Record<string, unknown>[],
  mappings: FieldMapping[]
): FleetParseResult;

function validateVehicleRecord(
  row: Record<string, unknown>,
  rowIndex: number
): { record: VehicleRecord | null; errors: FleetFileValidationError[] };
```

### 3. Vehicle Profile Resolver (`profile-resolver.ts`)

Maps VehicleRecord → resolved TrailerProfile + TractorProfile using the regional presets catalog with fleet-file overrides.

```typescript
interface ResolvedVehicleProfile {
  trailer: TrailerProfile;
  tractor: TractorProfile;
  equipment: EquipmentCombination;
}

interface ProfileResolutionError {
  vehicleId: string;
  reason: string;
}

// Condition code → preset ID mapping for Peru fleet
const CONDITION_CODE_MAP: Record<ConditionCode, string> = {
  'ZN': 'pe-camion-zn',
  'ZO': 'pe-camion-zo',
  'ZB': 'pe-camion-zb',
  'ZA': 'pe-trailer-13m',
  'ZF': 'pe-camion-grua',
};

function resolveVehicleProfile(
  record: VehicleRecord
): ResolvedVehicleProfile | ProfileResolutionError;
```

The resolver:
1. Looks up the preset by condition code using `CONDITION_CODE_MAP`
2. Clones the preset's trailer and tractor profiles
3. Overrides `maxGrossWeight` with the fleet file's weight capacity (converted to lbs)
4. Overrides `lengthFt` and `deckWidthIn` with the fleet file's platform dimensions (converted to imperial)
5. Returns the resolved profile or an error if the code is unrecognized

### 4. Delivery Number Matcher (`delivery-matcher.ts`)

Matches Delivery_Number values from orders to vehicle IDs in the fleet file.

```typescript
interface ExtractionRule {
  type: 'substring' | 'delimiter' | 'regex';
  startPosition?: number;
  endPosition?: number;
  delimiter?: string;
  fieldIndex?: number;
  pattern?: string;
  captureGroup?: number;
}

interface MatchResult {
  matched: Map<string, string>;        // deliveryNumber → vehicleId
  unmatched: string[];                  // deliveryNumbers with no match
  ambiguous: string[];                  // deliveryNumbers matching multiple vehicles
}

function matchDeliveryNumbers(
  deliveryNumbers: string[],
  vehicleIds: string[],
  strategy: 'exact' | 'pattern' | 'custom',
  extractionRule?: ExtractionRule
): MatchResult;
```

Matching strategy (waterfall):
1. **Exact match**: `deliveryNumber === vehicleId`
2. **Pattern match**: `vehicleId` appears as a substring within `deliveryNumber`
3. **Custom rule**: User-defined extraction (character positions, delimiter split, or regex) to decode the vehicle ID from the delivery number

### 5. Fleet Planner Service (`fleet-planner.ts`)

Orchestrates batch plan generation using the existing `generateLoadPlan` engine.

```typescript
interface FleetPlanRequest {
  vehicles: {
    vehicleId: string;
    licensePlate: string;
    vehicleType: string;
    conditionCode: ConditionCode;
    profile: ResolvedVehicleProfile;
    orders: SteelOrderLineItem[];
  }[];
  rules: Rule[];
}

function generateFleetPlan(
  request: FleetPlanRequest,
  onProgress?: (completed: number, total: number) => void
): Promise<FleetPlanResult>;
```

The service:
1. Filters vehicles with zero assigned orders (skip them)
2. Creates a `PlanRequest` per vehicle using the resolved profile and assigned orders
3. Invokes `generateLoadPlan()` for each vehicle independently (via Web Worker or sequential call)
4. Catches per-vehicle failures, records them as `failed` entries
5. Aggregates results into a `FleetPlanResult` with summary statistics

### 6. Fleet Summary Dashboard (`FleetSummaryDashboard.tsx`)

Displays the fleet-level view after batch generation.

```typescript
interface FleetSummaryProps {
  result: FleetPlanResult;
  onSelectVehicle: (vehicleId: string) => void;
  selectedVehicleId: string | null;
}
```

Shows a table/card grid with:
- Vehicle ID, license plate, vehicle type, condition code
- Status badge (success ✓, partial ⚠, failed ✗)
- Order count and total weight per vehicle
- Click-to-drill into per-vehicle plan view

### 7. Fleet Smart Mapper (`fleet-smart-mapper.ts`)

Reuses the existing `autoMapColumns` approach but with fleet-specific target fields.

```typescript
const FLEET_REQUIRED_FIELDS = [
  'vehicleId',
  'vehicleType',
  'licensePlate',
  'weightCapacity',
  'platformLength',
  'platformWidth',
  'conditionCode',
] as const;

const FLEET_FIELD_ALIASES: Record<string, string> = {
  'vehicle id': 'vehicleId',
  'vehicle_id': 'vehicleId',
  'truck id': 'vehicleId',
  'placa': 'licensePlate',
  'license plate': 'licensePlate',
  'plate': 'licensePlate',
  'tipo': 'vehicleType',
  'vehicle type': 'vehicleType',
  'type': 'vehicleType',
  'capacidad': 'weightCapacity',
  'weight capacity': 'weightCapacity',
  'capacity': 'weightCapacity',
  'peso maximo': 'weightCapacity',
  'largo': 'platformLength',
  'platform length': 'platformLength',
  'length': 'platformLength',
  'ancho': 'platformWidth',
  'platform width': 'platformWidth',
  'width': 'platformWidth',
  'condicion': 'conditionCode',
  'condition code': 'conditionCode',
  'condition': 'conditionCode',
  'zona': 'conditionCode',
};

function autoMapFleetColumns(sourceColumns: string[]): FieldMapping[];
```

## Data Models

### Fleet File Schema (Input)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| vehicleId | string | ✓ | Unique vehicle identifier |
| vehicleType | string | ✓ | Vehicle class (e.g., "Camión", "Trailer c/Plataforma") |
| licensePlate | string | ✓ | Vehicle registration plate |
| weightCapacity | number | ✓ | Maximum payload weight in tonnes |
| platformLength | number | ✓ | Platform/deck length in metres |
| platformWidth | number | ✓ | Platform/deck width in metres |
| conditionCode | ConditionCode | ✓ | Zone classification (ZN, ZO, ZB, ZA, ZF) |

### Orders File Extension

The existing orders file schema remains unchanged. The only additional requirement is the presence of a **Delivery_Number** column (added to the smartMapper aliases):

```typescript
// Additional aliases for delivery number
'delivery_number': 'deliveryNumber',
'delivery number': 'deliveryNumber',
'delivery': 'deliveryNumber',
'numero de entrega': 'deliveryNumber',
'n_entrega': 'deliveryNumber',
'entrega': 'deliveryNumber',
```

The `deliveryNumber` field is used **only** for fleet matching — it does not replace `deliveryStop` (which controls loading sequence per vehicle).

### State Persistence

Fleet plan results are held in-memory for the session. The existing `PlanService` backend can optionally be extended to store fleet plans as a `multiLoadSet`, but this is out of scope for the initial implementation.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Fleet file parsing round trip

*For any* valid set of VehicleRecord objects, serializing them to CSV format and then parsing the CSV through the fleet parser should produce an equivalent array of VehicleRecord objects.

**Validates: Requirements 1.1**

### Property 2: Invalid fleet rows produce per-row errors

*For any* fleet file row that is missing a required field or contains an invalid value (non-positive number for weight/dimensions, empty vehicle ID), the fleet parser should produce at least one FleetFileValidationError referencing that specific row number and field name, and should NOT produce a VehicleRecord for that row.

**Validates: Requirements 1.2, 1.3**

### Property 3: Duplicate vehicle IDs are detected

*For any* fleet file containing two or more rows with the same vehicle ID, the fleet parser should report a duplicate error listing all affected row numbers.

**Validates: Requirements 1.4**

### Property 4: Profile resolution maps condition codes to correct presets

*For any* valid VehicleRecord with a recognized condition code (ZN, ZO, ZB, ZA, ZF), the profile resolver should return a ResolvedVehicleProfile whose trailer `id` matches the expected preset for that condition code.

**Validates: Requirements 2.1**

### Property 5: Fleet file overrides supersede preset defaults

*For any* VehicleRecord where the weight capacity or platform dimensions differ from the preset defaults, the resolved profile's `maxGrossWeight`, `lengthFt`, and `deckWidthIn` should equal the fleet file values (after unit conversion), not the preset defaults.

**Validates: Requirements 2.3, 2.4**

### Property 6: Orders grouped by Delivery_Number partition completely

*For any* set of valid order rows each containing a Delivery_Number, grouping orders by Delivery_Number should produce disjoint groups whose union equals the original set (no orders lost, no orders duplicated).

**Validates: Requirements 3.4**

### Property 7: Delivery number exact match is identity

*For any* set of delivery numbers and vehicle IDs where each delivery number exactly equals one vehicle ID, the matcher with 'exact' strategy should produce a complete one-to-one mapping with zero unmatched entries.

**Validates: Requirements 8.1**

### Property 8: Batch generation produces one result per vehicle with orders

*For any* fleet plan request where N vehicles have at least one assigned order, the Fleet_Plan_Result should contain exactly N VehiclePlanEntry items, each preserving the original vehicle ID, license plate, and vehicle type.

**Validates: Requirements 4.1, 4.2**

### Property 9: Vehicle plan independence (failure isolation)

*For any* fleet plan request, if the planning engine fails for vehicle X (throws an error or produces zero placements), all other vehicles' plan results should remain unaffected — their status and placed items should be identical to what they would be if vehicle X were not in the request.

**Validates: Requirements 4.3**

### Property 10: Fleet summary counts are consistent

*For any* Fleet_Plan_Result, the summary's `successCount + partialCount + failedCount` should equal `totalVehicles`, and `totalVehicles` should equal the length of the vehicles array.

**Validates: Requirements 4.5**

## Error Handling

### Fleet File Errors

| Error Condition | Behavior |
|----------------|----------|
| Unparseable file (corrupt CSV/XLSX) | Display file-level error, prevent proceeding |
| Missing required column after mapping | Show manual mapping interface |
| Invalid field value in a row | Collect per-row error; allow proceeding if ≥1 valid row |
| Duplicate vehicle IDs | Report duplicate error with affected rows; exclude duplicates from planning |
| Zero valid rows after validation | Block wizard progression, show error summary |
| Unrecognized condition code | Flag vehicle as unresolvable; exclude from plan generation |

### Orders File Errors

| Error Condition | Behavior |
|----------------|----------|
| Missing Delivery_Number in a row | Report validation error for that row |
| Delivery_Number doesn't match any vehicle | Collect in unmatched-orders summary; show to user |
| Ambiguous match (multiple vehicles) | Present in manual assignment interface |

### Plan Generation Errors

| Error Condition | Behavior |
|----------------|----------|
| Planning engine throws for one vehicle | Record as `failed` entry with error message; continue others |
| All items unplaced for a vehicle | Record as `partial` with the unplaced items list |
| Worker timeout (>30s per vehicle) | Terminate worker, record as `failed` with timeout message |

### Recovery Strategies

- **Retry**: User can re-trigger plan generation for failed vehicles individually
- **Manual fallback**: User can switch a failed vehicle to single-truck mode for manual planning
- **Partial acceptance**: User can approve successful plans while addressing failed ones separately

## Testing Strategy

### Property-Based Tests (fast-check)

Property-based testing is well-suited for this feature because it involves:
- Pure parsing/validation functions with clear input/output
- Data transformation logic (condition code → profile, delivery number → vehicle matching)
- Deterministic planning with universal invariants (isolation, partitioning, count consistency)

**Library**: [fast-check](https://github.com/dubzzz/fast-check) (already available in the project ecosystem for TypeScript)

**Configuration**: Minimum 100 iterations per property test.

Each property test is tagged with:
```
// Feature: daily-fleet-load-planner, Property {N}: {property_text}
```

Properties to implement:
1. Fleet file parsing round trip (Property 1)
2. Invalid row error reporting (Property 2)
3. Duplicate vehicle ID detection (Property 3)
4. Condition code → preset resolution (Property 4)
5. Fleet file overrides (Property 5)
6. Order grouping partition completeness (Property 6)
7. Delivery number exact match (Property 7)
8. Batch result count per vehicle (Property 8)
9. Vehicle plan failure isolation (Property 9)
10. Summary count consistency (Property 10)

### Unit Tests (Vitest)

- Fleet smart mapper: specific column-name scenarios (Spanish headers, camelCase, etc.)
- Profile resolver: each condition code produces the expected preset
- Delivery matcher: pattern matching (substring), custom extraction rules
- Fleet file validation: edge cases (zero-capacity vehicle, negative dimensions)
- Fleet summary dashboard: renders correct status badges

### Integration Tests

- Full wizard flow: upload fleet file → upload orders → generate → review
- Mode switching: fleet ↔ single without data loss
- Large fleet (20+ vehicles): performance / no UI freeze
- Unmatched orders: manual assignment workflow

### E2E Tests (if applicable)

- CSV and XLSX upload with drag-and-drop
- Fleet summary navigation between vehicles
- Error state recovery (re-upload corrected file)
