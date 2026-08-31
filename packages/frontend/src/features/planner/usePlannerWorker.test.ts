/**
 * Tests for usePlannerWorker hook — validates Web Worker communication protocol,
 * timeout handling, and crash recovery.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlannerWorker } from './usePlannerWorker';
import type { PlanRequest } from '@ptv-discovery-coach/shared';
import type { WorkerResponse } from './types';

// ─── Mock Worker ─────────────────────────────────────────────────────────────

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  // Helper to simulate messages from the worker
  simulateMessage(data: WorkerResponse) {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }

  // Helper to simulate worker crash
  simulateError() {
    if (this.onerror) {
      this.onerror(new ErrorEvent('error', { message: 'Worker crashed' }));
    }
  }
}

let mockWorkerInstance: MockWorker;

// Mock the Worker constructor via URL pattern used by Vite
vi.stubGlobal('Worker', class {
  constructor() {
    mockWorkerInstance = new MockWorker();
    return mockWorkerInstance as unknown as Worker;
  }
});

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-request-id-' + Math.random().toString(36).slice(2),
});

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const mockPlanRequest: PlanRequest = {
  items: [
    {
      orderNumber: 'ORD-001',
      customerName: 'Test Customer',
      deliveryStop: 1,
      productType: 'plate',
      quantity: 1,
      pieceWeight: 5000,
      dimensions: { length: 120, width: 48, height: 6 },
      totalLineWeight: 5000,
      handlingMethod: 'crane',
      stackPermission: 'yes',
      maxStackHeight: 60,
      maxStackWeight: 20000,
      orientationRequirement: 'longitudinal',
      dunnageRequired: false,
      specialNotes: '',
    },
  ],
  trailer: {
    id: 'trailer-1',
    name: '48ft Standard',
    lengthFt: 48,
    deckWidthIn: 96,
    deckHeightIn: 60,
    maxGrossWeight: 80000,
    tareWeight: 14000,
    axleCount: 2,
    axlePositions: [400, 440],
    axleWeightRatings: [34000, 34000],
    kingpinPosition: 36,
    rearOverhangLimit: 48,
    deckMaterial: 'steel',
    stakePockets: [],
    anchorPoints: [
      { x: 50, y: -46 }, { x: 50, y: 46 },
      { x: 150, y: -46 }, { x: 150, y: 46 },
      { x: 250, y: -46 }, { x: 250, y: 46 },
      { x: 350, y: -46 }, { x: 350, y: 46 },
    ],
    maxConcentratedLoadPSF: 500,
  },
  tractor: {
    id: 'tractor-1',
    name: 'Test Tractor',
    steerAxleRating: 12000,
    driveAxleRating: 34000,
    fifthWheelPosition: 180,
    tareWeight: 18000,
    driveAxleCount: 2,
  },
  equipment: {
    tractorId: 'tractor-1',
    trailerId: 'trailer-1',
    availablePayload: 48000,
    totalLegalGross: 80000,
    perAxleLimits: { steer: 12000, drive: 34000, trailer: 34000 },
  },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePlannerWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start in idle state', () => {
    const { result } = renderHook(() => usePlannerWorker());

    expect(result.current.status).toBe('idle');
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should transition to generating state when generate is called', () => {
    const { result } = renderHook(() => usePlannerWorker());

    act(() => {
      result.current.generate(mockPlanRequest);
    });

    expect(result.current.status).toBe('generating');
    expect(result.current.isGenerating).toBe(true);
    expect(result.current.progress).toBe('Preparing plan generation...');
  });

  it('should send a generate message to the worker', () => {
    const { result } = renderHook(() => usePlannerWorker());

    act(() => {
      result.current.generate(mockPlanRequest);
    });

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'generate',
        payload: mockPlanRequest,
      })
    );
  });

  it('should transition to success when worker returns a result', async () => {
    const { result } = renderHook(() => usePlannerWorker());

    act(() => {
      result.current.generate(mockPlanRequest);
    });

    const requestId = mockWorkerInstance.postMessage.mock.calls[0][0].requestId;

    const mockResult = {
      success: true,
      placedFreight: [],
      unplacedItems: [],
      weightMetrics: {} as any,
      securement: {} as any,
      loadingSequence: [],
      detectedPattern: 'mixed' as const,
      ruleResults: [],
      stackingEvaluation: { violations: [], dunnageInsertions: [], longProductSupports: [], edgeProtections: [], passed: true },
      canApprove: true,
      warnings: [],
    };

    act(() => {
      mockWorkerInstance.simulateMessage({
        type: 'result',
        requestId,
        payload: mockResult,
      });
    });

    expect(result.current.status).toBe('success');
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.result).toEqual(mockResult);
    expect(result.current.error).toBeNull();
  });

  it('should transition to error when worker reports an error', () => {
    const { result } = renderHook(() => usePlannerWorker());

    act(() => {
      result.current.generate(mockPlanRequest);
    });

    const requestId = mockWorkerInstance.postMessage.mock.calls[0][0].requestId;

    act(() => {
      mockWorkerInstance.simulateMessage({
        type: 'error',
        requestId,
        error: 'Something went wrong',
      });
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Something went wrong');
    expect(result.current.isGenerating).toBe(false);
  });

  it('should update progress when worker sends progress messages', () => {
    const { result } = renderHook(() => usePlannerWorker());

    act(() => {
      result.current.generate(mockPlanRequest);
    });

    const requestId = mockWorkerInstance.postMessage.mock.calls[0][0].requestId;

    act(() => {
      mockWorkerInstance.simulateMessage({
        type: 'progress',
        requestId,
        message: 'Placing items...',
        percent: 50,
      });
    });

    expect(result.current.progress).toBe('Placing items...');
    expect(result.current.progressPercent).toBe(50);
  });

  it('should timeout after 30 seconds and report timeout status', () => {
    const { result } = renderHook(() => usePlannerWorker());

    act(() => {
      result.current.generate(mockPlanRequest);
    });

    // Advance time by 30 seconds
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.status).toBe('timeout');
    expect(result.current.error).toContain('30-second time limit');
    expect(result.current.isGenerating).toBe(false);
  });

  it('should send cancel message to worker on timeout', () => {
    const { result } = renderHook(() => usePlannerWorker());

    act(() => {
      result.current.generate(mockPlanRequest);
    });

    const requestId = mockWorkerInstance.postMessage.mock.calls[0][0].requestId;

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // Should have sent a cancel message
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cancel',
        requestId,
      })
    );
  });

  it('should allow manual cancellation', () => {
    const { result } = renderHook(() => usePlannerWorker());

    act(() => {
      result.current.generate(mockPlanRequest);
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.status).toBe('cancelled');
    expect(result.current.isGenerating).toBe(false);
  });

  it('should attempt restart on worker crash and retry once', () => {
    const { result } = renderHook(() => usePlannerWorker());

    act(() => {
      result.current.generate(mockPlanRequest);
    });

    // Simulate worker crash
    act(() => {
      mockWorkerInstance.simulateError();
    });

    expect(result.current.progress).toBe('Worker crashed, retrying...');

    // After the retry delay, it should have created a new worker and sent the request
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // The new worker should receive the generate message
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'generate',
        payload: mockPlanRequest,
      })
    );
  });

  it('should report failure after max retries are exhausted', () => {
    const { result } = renderHook(() => usePlannerWorker());

    act(() => {
      result.current.generate(mockPlanRequest);
    });

    // First crash → retry
    act(() => {
      mockWorkerInstance.simulateError();
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Second crash → failure (max retries = 1)
    act(() => {
      mockWorkerInstance.simulateError();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('crashed and could not recover');
    expect(result.current.isGenerating).toBe(false);
  });

  it('should reset state when reset is called', () => {
    const { result } = renderHook(() => usePlannerWorker());

    act(() => {
      result.current.generate(mockPlanRequest);
    });

    const requestId = mockWorkerInstance.postMessage.mock.calls[0][0].requestId;

    act(() => {
      mockWorkerInstance.simulateMessage({
        type: 'error',
        requestId,
        error: 'Some error',
      });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('should ignore messages from stale request IDs', () => {
    const { result } = renderHook(() => usePlannerWorker());

    act(() => {
      result.current.generate(mockPlanRequest);
    });

    // Simulate a result with a wrong requestId
    act(() => {
      mockWorkerInstance.simulateMessage({
        type: 'result',
        requestId: 'stale-request-id',
        payload: {} as any,
      });
    });

    // Should still be in generating state
    expect(result.current.status).toBe('generating');
  });
});
