// ─── Barrel Export for @ptv-discovery-coach/shared ────────────────────────────
// OptiFlow Flatbed Steel Load Planner types and computation library

export * from './flatbed';

// ─── Load Diagram Generator ───────────────────────────────────────────────────
// Exported under a namespace to avoid name collisions with the flatbed module
// (e.g. both define a `TrailerProfile` type with different shapes).
export * as loadDiagram from './load-diagram';
