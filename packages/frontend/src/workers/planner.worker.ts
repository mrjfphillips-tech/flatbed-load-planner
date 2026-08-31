/**
 * Web Worker entry point for the planning engine.
 *
 * Runs generateLoadPlan in a dedicated thread so the UI stays responsive.
 * Communicates via structured messages (WorkerRequest / WorkerResponse).
 */
import { generateLoadPlan } from '@ptv-discovery-coach/shared';
import type { WorkerRequest, WorkerResponse } from '../features/planner/types';

// Track the current request so we can report cancellation
let currentRequestId: string | null = null;
let cancelled = false;

/**
 * Post a typed response back to the main thread.
 */
function respond(msg: WorkerResponse): void {
  self.postMessage(msg);
}

/**
 * Handle incoming messages from the main thread.
 */
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'generate': {
      currentRequestId = msg.requestId;
      cancelled = false;

      // Send progress update before starting
      respond({
        type: 'progress',
        requestId: msg.requestId,
        message: 'Starting plan generation...',
        percent: 0,
      });

      try {
        // Run the deterministic planning engine
        const result = generateLoadPlan(msg.payload);

        // Check if cancelled while computing
        if (cancelled) {
          respond({
            type: 'error',
            requestId: msg.requestId,
            error: 'Plan generation was cancelled.',
          });
        } else {
          respond({
            type: 'result',
            requestId: msg.requestId,
            payload: result,
          });
        }
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error during plan generation';
        respond({
          type: 'error',
          requestId: msg.requestId,
          error: errorMessage,
        });
      } finally {
        currentRequestId = null;
      }
      break;
    }

    case 'cancel': {
      if (currentRequestId === msg.requestId) {
        cancelled = true;
      }
      break;
    }
  }
};

// Signal that the worker is ready
respond({ type: 'ready' });
