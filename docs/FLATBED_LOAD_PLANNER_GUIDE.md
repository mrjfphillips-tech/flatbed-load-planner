# OptiFlow Flatbed Steel Load Planner — User Guide

## Overview

The OptiFlow Flatbed Steel Load Planner is a browser-based application for planning, visualizing, verifying, and exporting flatbed steel load configurations. It handles the specialized domain of flatbed steel hauling — deck position, concentrated weight limits, axle distribution, product support, stacking stability, unloading access order, and FMCSA securement compliance.

The system follows a four-step workflow: **Equipment → Steel Orders → Rules → Generate Load Plan**.

---

## Architecture

```
ptv-discovery-coach/
├── packages/
│   ├── shared/        ← Pure computation logic (TypeScript library)
│   ├── frontend/      ← React SPA with Web Worker
│   └── backend/       ← Fastify API with PostgreSQL
```

| Package | Purpose | Key Tech |
|---------|---------|----------|
| `shared` | Equipment validation, geometric modeling, weight calculator, rules engine, securement planner, placement algorithm | TypeScript, fast-check |
| `frontend` | Wizard UI, SVG drawing renderer, import service, manual entry, drag-and-drop, offline support | React, Zustand, Vite, idb-keyval |
| `backend` | REST API, JWT auth, RBAC, plan versioning, PDF/Excel export, shareable links, verification | Fastify, Drizzle ORM, PostgreSQL |

---

## Prerequisites

- **Node.js** 18+ (20 recommended)
- **pnpm** (monorepo package manager — already configured)
- **PostgreSQL** 14+ (for the backend database)
- **Docker** (optional — for containerized PostgreSQL via `docker-compose.yml`)

---

## Installation

### 1. Install dependencies

From the repository root:

```bash
pnpm install
```

### 2. Set up the database

**Option A: Docker (recommended for local dev)**

```bash
docker-compose up -d
```

This starts a PostgreSQL instance on port 5432 with the default credentials from `.env.example`.

**Option B: External PostgreSQL**

Create a database and configure the connection in `packages/backend/.env`:

```env
DATABASE_URL=postgres://user:password@localhost:5432/ptv_discovery_coach
JWT_SECRET=your-secure-secret-here
```

### 3. Run database migrations

```bash
cd packages/backend
npx drizzle-kit push
```

This creates all required tables: users, user_roles, equipment_trailers, equipment_tractors, load_plans, plan_versions, plan_items, plan_warnings, securement_assignments, multi_load_sets, verification_checklists, rules, rule_audit_log.

### 4. Build the shared package

```bash
cd packages/shared
pnpm build
```

The shared package must be built before the frontend and backend can consume it.

---

## Launching the Application

### Development Mode

Open three terminals:

**Terminal 1 — Backend API:**
```bash
cd packages/backend
pnpm dev
```
Starts the Fastify API server on `http://localhost:3001`.

**Terminal 2 — Frontend Dev Server:**
```bash
cd packages/frontend
pnpm dev
```
Starts the Vite dev server on `http://localhost:5173`.

**Terminal 3 — Shared (watch mode, optional):**
```bash
cd packages/shared
pnpm dev
```
Rebuilds the shared package on file changes.

### Production Build

```bash
# Build all packages
pnpm -r build

# Start the backend
cd packages/backend
pnpm start

# Serve the frontend (static files from packages/frontend/dist)
# Use any static file server or configure the backend to serve them
```

---

## Using the Application

### Step 1: Equipment Configuration

1. Select a **tractor profile** (steer/drive axle ratings, tare weight, fifth-wheel position)
2. Select a **trailer profile** (48ft or 53ft flatbed templates are pre-loaded, or create custom)
3. The system displays: available payload, total legal gross weight, per-axle limits
4. If payload is negative, the combination is rejected with an error

### Step 2: Steel Orders

**Import from file:**
- Upload a CSV or Excel (.xlsx) file with your steel order manifest
- Required fields: order number, customer name, delivery stop, product type, quantity, piece weight, dimensions (L×W×H), handling method, stack permission, orientation

**Manual entry:**
- Use the form to add individual line items
- Same validation rules as file import
- Edit or remove items at any time

**Supported steel product types (22):**
Coils (hot-rolled, cold-rolled, galvanized), sheet bundles, plate, rebar bundles, wire rod coils, structural beams (I/H/wide-flange), channels, angles, flat bar, round bar, pipe, tube, HSS, roofing sheets, wire mesh panels, fabricated assemblies, palletized steel, mixed bundles.

### Step 3: Rules

- Review active hard constraints, soft preferences, and advisory rules
- Acknowledge advisory rules before proceeding
- Optionally override the detected load pattern (layered, column building, row building, long product, nested, customer zoning, mixed)
- Administrators can add/modify custom rules

### Step 4: Generate Load Plan

Click **"Generate Load Plan"** — the planning engine runs in a Web Worker (non-blocking UI) and produces:

- **Placed freight positions** with x, y, z coordinates, orientation, layer, support method
- **Weight metrics** — steer/drive/trailer axle weights, CG position, lateral balance
- **Securement plan** — tie-down count, WLL, anchor assignments, coil-specific details
- **Loading sequence** — numbered steps in placement order
- **Warnings** — Error (blocks approval), Warning (allows with ack), Info (advisory)

### Drawing Views

The plan is visualized in 5 SVG views:
- **Top-down (plan)** — deck layout with freight, axles, kingpin, anchor points
- **Left side elevation** — height stacking, axle wheels
- **Right side elevation** — mirror of left side
- **Front view** — lateral placement from cab
- **Rear view** — lateral placement from rear

Each view supports:
- Zoom and pan (mouse wheel + drag)
- Color coding by stop, product type, or weight
- Cross-view highlighting (hover an item in any view, highlighted in all)
- Securement overlay (tie-down positions, chain routing)
- Dunnage overlay (material positions and types)

### Manual Adjustments

After generation, you can:
- **Drag items** to new deck positions in top-down view
- **Change orientation** (longitudinal ↔ transverse)
- **Swap** two items' positions
- **Remove** items to the unassigned list
- **Reassign** items between trailers (multi-load)

Weight metrics recalculate within 2 seconds. Rule violations display immediately.

### Multi-Load Splitting

When freight exceeds a single trailer's capacity:
- The engine automatically splits across multiple load plans
- Items for the same delivery stop stay on the same trailer (when possible)
- A master summary shows item-to-trailer assignments
- Manual reassignment between trailers is available

---

## Roles and Permissions

| Role | Capabilities |
|------|-------------|
| **Planner** | Create, edit, submit plans; view instructions/checklists |
| **Loader** | View loading instructions, mark steps complete |
| **Driver** | View plans, complete verification checklists |
| **Supervisor** | Approve/reject plans, override warnings |
| **Administrator** | All above + manage equipment, rules, users |
| **Customer Viewer** | Read-only: see only their assigned delivery items |

Users can hold multiple roles simultaneously (union of permissions).

---

## Plan Approval Workflow

```
draft → pending_approval → approved / rejected → superseded
```

1. Planner creates and submits plan
2. Supervisor reviews — approves or rejects (with reason)
3. Approved plans are locked; edits create a new version requiring re-approval
4. All versions are retained for comparison and audit

---

## Verification and Loading

### Driver Verification Checklist
After plan approval, drivers verify:
- ☐ Item presence (each item on trailer matches plan)
- ☐ Securement check (tie-downs in place and tensioned)
- ☐ Weight check (scale weights within tolerance)
- ☐ Damage check (no visible freight damage)

Non-conforming items trigger supervisor notification with mandatory description.

### Loader Progress Tracking
Loaders mark each loading step as complete in sequence:
- Real-time progress indicator (completedSteps / totalSteps)
- Steps must be completed in order
- Each completion records timestamp and loader identity

---

## Exports

| Format | Contents |
|--------|----------|
| **PDF** | Cover page, all drawing views, loading sequence, securement details, weight summary, warnings, driver checklist |
| **Excel** | Sheets: freight manifest, placement coordinates, weight calculations, securement requirements, loading sequence |
| **Single-page summary** | Printable clipboard/cab attachment |
| **Shareable links** | Role-appropriate views: full plan (Planner/Supervisor), loading instructions (Loader), checklist (Driver), customer items (Customer Viewer) |

---

## Offline Support

- Unsaved changes are automatically persisted to IndexedDB
- Network interruption displays an offline indicator
- Changes synchronize automatically when connectivity resumes
- Works on Chrome, Firefox, Edge, and Safari (current versions)

---

## Running Tests

```bash
# All packages
pnpm -r test

# Individual packages
cd packages/shared && pnpm test
cd packages/frontend && pnpm test
cd packages/backend && pnpm test

# Property-based tests only (shared package)
cd packages/shared && npx vitest run --grep "Property"
```

The test suite includes:
- **483 unit/property tests** in `packages/shared` (17 property-based tests)
- **~400 tests** in `packages/frontend` (components, hooks, import validation)
- **~500 tests** in `packages/backend` (API routes, services, RBAC, export)

---

## Configuration

### Environment Variables

**Backend (`packages/backend/.env`):**

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_SECRET` | `dev-secret-change-me` | Secret for JWT signing (change in production) |
| `CORS_ORIGIN` | `true` (all origins) | Allowed origins |
| `RATE_LIMIT_MAX` | `100` | Max requests per minute |
| `PORT` | `3001` | API server port |
| `LOG_LEVEL` | `info` | Logging level |

### Equipment Templates

Two standard flatbed templates are seeded:
- **48-foot flatbed** — 576" deck, 96" width, dual axles
- **53-foot flatbed** — 636" deck, 102" width, dual axles

Custom trailer/tractor profiles can be created through the Equipment Configurator or Admin API.

---

## API Endpoints (Backend)

| Prefix | Description |
|--------|-------------|
| `POST /api/flatbed/auth/register` | Register new user |
| `POST /api/flatbed/auth/login` | Login (returns JWT) |
| `GET/POST /api/flatbed/plans` | Plan CRUD |
| `POST /api/flatbed/plans/:id/generate` | Generate load plan |
| `POST /api/flatbed/plans/:id/submit` | Submit for approval |
| `POST /api/flatbed/plans/:id/approve` | Approve plan (Supervisor) |
| `GET /api/flatbed/plans/:id/versions` | Version history |
| `GET/POST /api/flatbed/rules` | Rules management |
| `POST /api/flatbed/plans/:id/export/pdf` | PDF export |
| `POST /api/flatbed/plans/:id/export/excel` | Excel export |
| `POST /api/flatbed/plans/:id/share` | Generate shareable link |
| `GET /api/flatbed/shared/:token` | Resolve shared link |
| `GET/PATCH /api/flatbed/verification/checklist/:pvId` | Verification checklist |
| `POST /api/flatbed/verification/progress/:planId/step/:n/complete` | Mark loading step |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Payload is negative" | Tractor + trailer tare weights exceed the trailer's max gross. Select a lighter combination. |
| Plan generation timeout (>30s) | Reduce item count or relax soft preferences. |
| Unplaceable items | Check item dimensions vs. deck space, or try a different pattern. |
| Axle overweight warning | Items need redistribution. Drag heavy items toward the opposite axle group. |
| Offline indicator won't clear | Check network connection. Click "Retry" to force sync. |
| Tests failing on `Property 10` | Fixed in latest — run `pnpm build` in shared package to pick up the fix. |

---

## Key Design Decisions

1. **Deterministic heuristic** — Same inputs always produce identical outputs. No randomness.
2. **Pure computation core** — All weight/geometry/rules logic is side-effect-free in `packages/shared`.
3. **Client-side planning** — Runs in a Web Worker for responsiveness.
4. **SVG rendering** — Scalable, printable, accessible drawings.
5. **Property-based testing** — 17 universal correctness properties validated with fast-check.
