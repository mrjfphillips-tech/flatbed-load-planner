# OptiFlow Flatbed Steel Load Planner

A browser-based application for planning, visualizing, and verifying flatbed steel load configurations. Built for dispatchers, planners, loaders, and drivers who need to optimize freight placement on flatbed trailers while respecting weight limits, stacking rules, securement requirements, and multi-stop delivery constraints.

## Features

**Single-Truck Planning**
- 4-step wizard: Equipment > Steel Orders > Rules > Generate Load Plan
- Deterministic placement engine with 7 load pattern strategies
- SVG drawing views: top-down, side elevation, front/rear end views
- Drag-and-drop manual adjustment with real-time rule re-evaluation
- FMCSA-compliant securement planning (chains, straps, anchor points)
- Weight distribution across steer, drive, and trailer axle groups
- Multi-stop delivery accessibility enforcement
- Multi-load splitting when freight exceeds single-trailer capacity

**Fleet Planning**
- Multi-vehicle batch planning from fleet manifest files
- Smart column mapping (English, Spanish, camelCase, snake_case)
- Vehicle profile resolution from condition codes
- Delivery number matching (exact, pattern, regex extraction)
- Fleet summary dashboard with per-vehicle drill-down

**Steel-Specific Logic**
- 20+ steel product types (coils, plates, beams, bundles, bars, pipe, etc.)
- Geometric modeling (cylindrical, rectangular, I-beam profiles)
- Stacking rules: no-stack enforcement, max weight/height, anti-roll
- Dunnage insertion between dissimilar-hardness materials
- Long product support (minimum 2 points, max unsupported span)

**Backend**
- Fastify API with JWT authentication and role-based access control
- 6 roles: Planner, Loader, Driver, Supervisor, Administrator, Customer Viewer
- Plan versioning with approval workflow (draft > pending > approved/rejected)
- PDF and Excel export with shareable role-appropriate links
- Driver verification checklists and loader progress tracking
- PostgreSQL with Drizzle ORM

## Project Structure

```
packages/
  shared/     Core computation library (types, planning engine, rules,
              weight calc, securement, geometry, stacking). Pure TypeScript,
              no framework dependencies.
  frontend/   React SPA (Vite, Tailwind, Zustand). Wizard UI, SVG drawing
              renderer, fleet planner, import/export, offline support.
  backend/    Fastify API server. Auth, plans, rules, export, verification.
              PostgreSQL via Drizzle ORM.
```

## Getting Started

**Prerequisites:** Node.js 20+, pnpm 9+, Docker (for PostgreSQL)

```bash
# Install dependencies
pnpm install

# Build shared package (required before frontend/backend)
pnpm build:shared

# Start the frontend dev server
pnpm dev:frontend
# Opens at http://localhost:3000/flatbed

# Start the database
docker compose up -d

# Start the backend dev server
pnpm dev:backend
# Runs at http://localhost:4000
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev:frontend` | Start frontend dev server (Vite) |
| `pnpm dev:backend` | Start backend dev server |
| `pnpm build` | Build all packages |
| `pnpm build:shared` | Build shared package only |
| `pnpm build:frontend` | Build frontend (TypeScript + Vite) |
| `pnpm build:backend` | Build backend (TypeScript) |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all TypeScript files |
| `pnpm format` | Format code with Prettier |
| `pnpm docker:up` | Start PostgreSQL |
| `pnpm docker:down` | Stop PostgreSQL |
| `pnpm docker:reset` | Reset database (destroy + recreate) |

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Zustand, Web Workers
- **Backend:** Fastify, Drizzle ORM, PostgreSQL, JWT
- **Shared:** Pure TypeScript computation library
- **Testing:** Vitest, Testing Library, fast-check (property tests)
- **CI:** GitHub Actions

## Kiro Specs

Design documents live in `.kiro/specs/`:
- `flatbed-load-planner/` - Core single-truck planner (requirements, design, tasks)
- `daily-fleet-load-planner/` - Multi-vehicle fleet extension
- `load-diagram-generator/` - General-purpose trailer loading (planned)
