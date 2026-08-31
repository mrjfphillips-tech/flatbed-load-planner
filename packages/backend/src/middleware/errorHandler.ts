/**
 * Error Handler Middleware
 *
 * Ensures the platform NEVER crashes or leaves a rep stranded during
 * a live customer meeting. All errors are caught, logged, and returned
 * as graceful JSON responses.
 *
 * PDIF V1 Task 5.1
 */

import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export function registerErrorHandler(app: FastifyInstance): void {
  // Global error handler — catches all unhandled errors
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode || 500;

    // Log error details server-side (not exposed to client)
    console.error(`[ERROR] ${request.method} ${request.url}:`, {
      statusCode,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    // Rate limit errors
    if (statusCode === 429) {
      return reply.status(429).send({
        error: 'Too many requests',
        message: 'Please wait a moment and try again.',
        retryAfter: 30,
      });
    }

    // Validation errors
    if (statusCode === 400) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: error.message || 'The request was malformed.',
      });
    }

    // Auth errors
    if (statusCode === 401 || statusCode === 403) {
      return reply.status(statusCode).send({
        error: statusCode === 401 ? 'Unauthorized' : 'Forbidden',
        message: error.message || 'Authentication required.',
      });
    }

    // AI service errors (OpenAI, Deepgram)
    if (error.message?.includes('OpenAI') || error.message?.includes('Deepgram')) {
      return reply.status(503).send({
        error: 'AI service temporarily unavailable',
        message: 'The AI service is not responding. The session can continue without AI suggestions.',
        recoverable: true,
      });
    }

    // Database errors
    if (error.message?.includes('database') || error.message?.includes('ECONNREFUSED')) {
      return reply.status(503).send({
        error: 'Database temporarily unavailable',
        message: 'Data storage is not responding. Please try again in a moment.',
        recoverable: true,
      });
    }

    // Generic 500 — never expose internal details
    return reply.status(500).send({
      error: 'Internal server error',
      message: 'Something went wrong. The session is still active — try again.',
      recoverable: true,
    });
  });

  // 404 handler
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      error: 'Not found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });
}
