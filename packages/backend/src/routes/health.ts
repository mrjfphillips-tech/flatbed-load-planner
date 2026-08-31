import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Health check and readiness endpoints.
 * These are public (no auth required) and used by load balancers and orchestrators.
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * Basic health check — indicates the server process is running and accepting connections.
   */
  app.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  /**
   * GET /ready
   * Readiness check — indicates the server is ready to accept traffic.
   * Can be extended to verify database connectivity, external service availability, etc.
   */
  app.get('/ready', async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Future: check DB connection, Redis, external services
    const checks: Record<string, 'ok' | 'degraded' | 'down'> = {
      server: 'ok',
    };

    const allOk = Object.values(checks).every((v) => v === 'ok');

    return {
      status: allOk ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  });
}
