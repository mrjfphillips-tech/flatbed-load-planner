// Entry point for the PTV Discovery Coach backend.
// When run directly, starts the server. Also re-exports buildApp for testing/programmatic use.
export { buildApp } from './app.js';
export type { AppOptions } from './app.js';
export { authenticateHook, requireRole, requireAdmin, requireRepOrAdmin, requireManagerOrAdmin, requireAnyRole, getUserId, getUserRole } from './middleware/auth.js';
export type { JwtPayload } from './middleware/auth.js';
