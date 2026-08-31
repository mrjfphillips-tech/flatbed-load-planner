/**
 * Message types for Web Worker communication with the planning engine.
 *
 * Protocol:
 * - UI sends WorkerRequest messages to the worker
 * - Worker responds with WorkerResponse messages
 * - Worker may send progress updates during computation
 */
import type { PlanRequest, PlanResult } from '@ptv-discovery-coach/shared';

// ─── Request Messages (UI → Worker) ─────────────────────────────────────────

export interface GeneratePlanMessage {
  type: 'generate';
  requestId: string;
  payload: PlanRequest;
}

export interface CancelMessage {
  type: 'cancel';
  requestId: string;
}

export type WorkerRequest = GeneratePlanMessage | CancelMessage;

// ─── Response Messages (Worker → UI) ─────────────────────────────────────────

export interface PlanResultMessage {
  type: 'result';
  requestId: string;
  payload: PlanResult;
}

export interface PlanErrorMessage {
  type: 'error';
  requestId: string;
  error: string;
}

export interface PlanProgressMessage {
  type: 'progress';
  requestId: string;
  message: string;
  percent?: number;
}

export interface WorkerReadyMessage {
  type: 'ready';
}

export type WorkerResponse =
  | PlanResultMessage
  | PlanErrorMessage
  | PlanProgressMessage
  | WorkerReadyMessage;

// ─── Hook State ──────────────────────────────────────────────────────────────

export type PlannerStatus =
  | 'idle'
  | 'generating'
  | 'success'
  | 'error'
  | 'timeout'
  | 'cancelled';

export interface PlannerState {
  status: PlannerStatus;
  result: PlanResult | null;
  error: string | null;
  progress: string | null;
  progressPercent: number | null;
}
