import { FastifyInstance } from 'fastify';
import { requireAnyRole, getUserId } from '../middleware/auth.js';

export async function offlineRecoveryRoutes(app: FastifyInstance): Promise<void> {
  // POST /offline-recovery/upload — upload audio for offline transcription
  app.post<{ Body: { accountId: string; fileName: string; audioBase64: string } }>(
    '/upload', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { accountId, fileName, audioBase64 } = request.body;
      if (!accountId || !audioBase64) {
        return reply.status(400).send({ error: 'accountId and audioBase64 are required' });
      }

      const userId = getUserId(request);

      // TODO: Queue audio for transcription + MEDDIC analysis
      // For now, return a job ID that can be polled
      const jobId = `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      return reply.status(202).send({
        jobId,
        status: 'queued',
        message: 'Audio queued for transcription and analysis.',
        fileName: fileName || 'recording.wav',
        accountId,
        userId,
      });
    }
  );

  // GET /offline-recovery/status/:jobId — poll job status
  app.get<{ Params: { jobId: string } }>('/status/:jobId', { preHandler: [requireAnyRole] }, async (request, _reply) => {
    const { jobId } = request.params;

    // TODO: Implement actual job status tracking
    return {
      jobId,
      status: 'pending',
      progress: 0,
      message: 'Transcription processing not yet implemented.',
    };
  });
}
