/**
 * React hook for managing Web Worker communication with the planning engine.
 *
 * Features:
 * - Message-based request/response/progress protocol
 * - 30-second timeout with partial result reporting
 * - Crash recovery: restarts worker once, then reports failure
 * - Loading state management for the "Generate Load Plan" button
 *
 * Requirements: 5.1, 20.1, 20.2
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanRequest } from '@ptv-discovery-coach/shared';
import type {
  PlannerState,
  WorkerRequest,
  WorkerResponse,
} from './types';

/** Timeout for plan generation (ms) — cancel after 30 seconds per Req 5.1 */
const GENERATION_TIMEOUT_MS = 30_000;

/** Maximum number of worker restart attempts before reporting failure */
const MAX_RETRIES = 1;

/**
 * Creates a new planner Web Worker instance using Vite's worker import syntax.
 */
function createWorker(): Worker {
  return new Worker(
    new URL('../../workers/planner.worker.ts', import.meta.url),
    { type: 'module' }
  );
}

/**
 * Hook that manages the planning engine Web Worker lifecycle.
 *
 * Returns the current planner state and a `generate` function to invoke
 * the planning engine with a PlanRequest.
 */
export function usePlannerWorker() {
  const [state, setState] = useState<PlannerState>({
    status: 'idle',
    result: null,
    error: null,
    progress: null,
    progressPercent: null,
  });

  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const pendingRequestRef = useRef<PlanRequest | null>(null);
  const workerReadyRef = useRef(false);

  /**
   * Clean up timeout timer.
   */
  const clearTimeoutTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Terminate the current worker and clean up resources.
   */
  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    workerReadyRef.current = false;
    clearTimeoutTimer();
  }, [clearTimeoutTimer]);

  /**
   * Handle messages received from the worker.
   */
  const handleMessage = useCallback(
    (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;

      switch (msg.type) {
        case 'ready':
          workerReadyRef.current = true;
          break;

        case 'progress':
          if (msg.requestId === currentRequestIdRef.current) {
            setState((prev) => ({
              ...prev,
              progress: msg.message,
              progressPercent: msg.percent ?? prev.progressPercent,
            }));
          }
          break;

        case 'result':
          if (msg.requestId === currentRequestIdRef.current) {
            clearTimeoutTimer();
            retryCountRef.current = 0;
            currentRequestIdRef.current = null;
            pendingRequestRef.current = null;
            setState({
              status: 'success',
              result: msg.payload,
              error: null,
              progress: null,
              progressPercent: null,
            });
          }
          break;

        case 'error':
          if (msg.requestId === currentRequestIdRef.current) {
            clearTimeoutTimer();
            currentRequestIdRef.current = null;
            pendingRequestRef.current = null;
            setState({
              status: 'error',
              result: null,
              error: msg.error,
              progress: null,
              progressPercent: null,
            });
          }
          break;
      }
    },
    [clearTimeoutTimer]
  );

  /**
   * Handle worker crash (error event). Attempt one restart + retry.
   */
  const handleError = useCallback(
    (_event: ErrorEvent) => {
      clearTimeoutTimer();

      if (retryCountRef.current < MAX_RETRIES && pendingRequestRef.current) {
        // Restart the worker and retry the last request
        retryCountRef.current += 1;
        terminateWorker();

        setState((prev) => ({
          ...prev,
          progress: 'Worker crashed, retrying...',
        }));

        // Re-initialize and retry
        const newWorker = createWorker();
        newWorker.onmessage = handleMessage;
        newWorker.onerror = handleError;
        workerRef.current = newWorker;

        // Re-send the pending request after a brief delay for worker initialization
        const requestId = currentRequestIdRef.current ?? crypto.randomUUID();
        currentRequestIdRef.current = requestId;

        setTimeout(() => {
          const request: WorkerRequest = {
            type: 'generate',
            requestId,
            payload: pendingRequestRef.current!,
          };
          newWorker.postMessage(request);

          // Re-start timeout
          timeoutRef.current = setTimeout(() => {
            handleTimeout();
          }, GENERATION_TIMEOUT_MS);
        }, 100);
      } else {
        // Max retries exhausted — report failure
        currentRequestIdRef.current = null;
        pendingRequestRef.current = null;
        retryCountRef.current = 0;
        terminateWorker();
        setState({
          status: 'error',
          result: null,
          error: 'Planning worker crashed and could not recover. Please try again.',
          progress: null,
          progressPercent: null,
        });
      }
    },
    [clearTimeoutTimer, handleMessage, terminateWorker]
  );

  /**
   * Handle generation timeout (30s exceeded).
   */
  const handleTimeout = useCallback(() => {
    // Send cancel to worker
    if (workerRef.current && currentRequestIdRef.current) {
      const cancelMsg: WorkerRequest = {
        type: 'cancel',
        requestId: currentRequestIdRef.current,
      };
      workerRef.current.postMessage(cancelMsg);
    }

    // Terminate and report timeout
    terminateWorker();
    currentRequestIdRef.current = null;
    pendingRequestRef.current = null;
    retryCountRef.current = 0;
    setState({
      status: 'timeout',
      result: null,
      error: 'Plan generation exceeded the 30-second time limit. Try reducing the number of items or relaxing constraints.',
      progress: null,
      progressPercent: null,
    });
  }, [terminateWorker]);

  /**
   * Initialize the worker on mount.
   */
  useEffect(() => {
    const worker = createWorker();
    worker.onmessage = handleMessage;
    worker.onerror = handleError;
    workerRef.current = worker;

    return () => {
      terminateWorker();
    };
  }, [handleMessage, handleError, terminateWorker]);

  /**
   * Generate a load plan by sending a request to the Web Worker.
   * Returns immediately — results arrive via state updates.
   */
  const generate = useCallback(
    (request: PlanRequest) => {
      // Ensure worker is available; recreate if terminated
      if (!workerRef.current) {
        const worker = createWorker();
        worker.onmessage = handleMessage;
        worker.onerror = handleError;
        workerRef.current = worker;
      }

      const requestId = crypto.randomUUID();
      currentRequestIdRef.current = requestId;
      pendingRequestRef.current = request;
      retryCountRef.current = 0;

      // Update state to generating
      setState({
        status: 'generating',
        result: null,
        error: null,
        progress: 'Preparing plan generation...',
        progressPercent: 0,
      });

      // Send request to worker
      const msg: WorkerRequest = {
        type: 'generate',
        requestId,
        payload: request,
      };
      workerRef.current.postMessage(msg);

      // Start timeout timer (30s per Req 5.1)
      clearTimeoutTimer();
      timeoutRef.current = setTimeout(() => {
        handleTimeout();
      }, GENERATION_TIMEOUT_MS);
    },
    [handleMessage, handleError, clearTimeoutTimer, handleTimeout]
  );

  /**
   * Cancel the current generation request.
   */
  const cancel = useCallback(() => {
    if (currentRequestIdRef.current && workerRef.current) {
      const cancelMsg: WorkerRequest = {
        type: 'cancel',
        requestId: currentRequestIdRef.current,
      };
      workerRef.current.postMessage(cancelMsg);
    }

    clearTimeoutTimer();
    currentRequestIdRef.current = null;
    pendingRequestRef.current = null;
    setState({
      status: 'cancelled',
      result: null,
      error: null,
      progress: null,
      progressPercent: null,
    });
  }, [clearTimeoutTimer]);

  /**
   * Reset the planner state back to idle.
   */
  const reset = useCallback(() => {
    setState({
      status: 'idle',
      result: null,
      error: null,
      progress: null,
      progressPercent: null,
    });
  }, []);

  return {
    ...state,
    isGenerating: state.status === 'generating',
    generate,
    cancel,
    reset,
  };
}
