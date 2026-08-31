// @ts-nocheck
/**
 * Unit tests for AudioCaptureService
 *
 * Covers:
 *  - Microphone permission request (grant and deny) — Req 1.1, 1.4
 *  - Audio chunking via MediaRecorder — Req 1.2
 *  - Signal loss detection (>5s silence) — Req 1.5
 *  - Pause/resume audio capture
 *
 * Requirements: 1.1, 1.2, 1.4, 1.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioCaptureService } from '../AudioCaptureService';

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

function buildFakeMediaStream() {
  const stopTrack = vi.fn();
  return {
    getTracks: () => [{ stop: stopTrack, kind: 'audio' }],
    _stopTrack: stopTrack,
  } as unknown as MediaStream & { _stopTrack: ReturnType<typeof vi.fn> };
}

function mockGetUserMedia(impl: () => Promise<MediaStream>) {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(impl) },
    writable: true,
    configurable: true,
  });
}

interface FakeMediaRecorderInstance {
  state: string;
  ondataavailable: ((e: { data: { size: number; arrayBuffer: () => Promise<ArrayBuffer> } }) => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  emitChunk: (data: ArrayBuffer) => void;
}

function installFakeMediaRecorder(): FakeMediaRecorderInstance {
  const startFn = vi.fn();
  const stopFn = vi.fn();
  const pauseFn = vi.fn();
  const resumeFn = vi.fn();

  const instance: FakeMediaRecorderInstance = {
    state: 'inactive',
    ondataavailable: null,
    start: startFn,
    stop: stopFn,
    pause: pauseFn,
    resume: resumeFn,
    emitChunk(data: ArrayBuffer) {
      if (this.ondataavailable) {
        this.ondataavailable({
          data: {
            size: data.byteLength,
            arrayBuffer: () => Promise.resolve(data),
          },
        });
      }
    },
  };

  startFn.mockImplementation((timeslice?: number) => {
    instance.state = 'recording';
  });
  stopFn.mockImplementation(() => {
    instance.state = 'inactive';
  });
  pauseFn.mockImplementation(() => {
    instance.state = 'paused';
  });
  resumeFn.mockImplementation(() => {
    instance.state = 'recording';
  });

  // @ts-expect-error — replacing global for test
  global.MediaRecorder = vi.fn(() => instance);
  // @ts-expect-error — static method mock
  global.MediaRecorder.isTypeSupported = vi.fn(() => true);

  return instance;
}

function buildFakeAudioContext() {
  const analyserNode = {
    fftSize: 2048,
    smoothingTimeConstant: 0.3,
    getFloatTimeDomainData: vi.fn((arr: Float32Array) => {
      // Default: fill with silence
      arr.fill(0);
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const sourceNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const ctx = {
    sampleRate: 16000,
    createMediaStreamSource: vi.fn(() => sourceNode),
    createAnalyser: vi.fn(() => analyserNode),
    close: vi.fn(() => Promise.resolve()),
  };

  // @ts-expect-error — replacing global for test
  global.AudioContext = vi.fn(() => ctx);

  return { ctx, analyserNode, sourceNode };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AudioCaptureService', () => {
  let originalMediaRecorder: typeof MediaRecorder;
  let originalAudioContext: typeof AudioContext;

  beforeEach(() => {
    originalMediaRecorder = global.MediaRecorder;
    originalAudioContext = global.AudioContext;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.MediaRecorder = originalMediaRecorder;
    global.AudioContext = originalAudioContext;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── Microphone Permission (Req 1.1, 1.4) ─────────────────────────────────

  describe('requestMicrophoneAccess (Req 1.1, 1.4)', () => {
    it('returns true when microphone access is granted', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));

      const service = new AudioCaptureService();
      const result = await service.requestMicrophoneAccess();

      expect(result).toBe(true);
    });

    it('throws with kind=permission_denied when getUserMedia throws NotAllowedError', async () => {
      const permissionError = new DOMException('Permission denied', 'NotAllowedError');
      mockGetUserMedia(() => Promise.reject(permissionError));

      const service = new AudioCaptureService();

      try {
        await service.requestMicrophoneAccess();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.kind).toBe('permission_denied');
        expect(err.message).toContain('denied');
      }
    });

    it('includes actionable instructions in permission_denied error', async () => {
      const permissionError = new DOMException('Permission denied', 'NotAllowedError');
      mockGetUserMedia(() => Promise.reject(permissionError));

      const service = new AudioCaptureService();

      try {
        await service.requestMicrophoneAccess();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.kind).toBe('permission_denied');
        expect(err.instructions).toBeDefined();
        expect(err.instructions.length).toBeGreaterThan(20);
        expect(err.instructions).toContain('Allow');
      }
    });

    it('throws with kind=not_found when no microphone device exists', async () => {
      const notFoundError = new DOMException('No device', 'NotFoundError');
      mockGetUserMedia(() => Promise.reject(notFoundError));

      const service = new AudioCaptureService();

      try {
        await service.requestMicrophoneAccess();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.kind).toBe('not_found');
        expect(err.message).toContain('microphone');
      }
    });

    it('throws with kind=unknown for unrecognized errors', async () => {
      mockGetUserMedia(() => Promise.reject(new Error('Something went wrong')));

      const service = new AudioCaptureService();

      try {
        await service.requestMicrophoneAccess();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.kind).toBe('unknown');
      }
    });
  });

  // ─── Audio Chunking (Req 1.2) ──────────────────────────────────────────────

  describe('audio chunking via MediaRecorder (Req 1.2)', () => {
    it('starts MediaRecorder with 100ms timeslice by default', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      const recorder = installFakeMediaRecorder();
      buildFakeAudioContext();

      const service = new AudioCaptureService();
      await service.startCapture('session-1');

      expect(recorder.start).toHaveBeenCalledWith(100);
    });

    it('uses custom timeslice when configured', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      const recorder = installFakeMediaRecorder();
      buildFakeAudioContext();

      const service = new AudioCaptureService({ chunkTimesliceMs: 200 });
      await service.startCapture('session-1');

      expect(recorder.start).toHaveBeenCalledWith(200);
    });

    it('emits AudioChunk objects via onAudioChunk callback', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      const recorder = installFakeMediaRecorder();
      buildFakeAudioContext();

      const service = new AudioCaptureService();
      const chunkCallback = vi.fn();
      service.onAudioChunk(chunkCallback);

      await service.startCapture('session-1');

      // Simulate a data chunk from MediaRecorder
      const fakeData = new Uint8Array([1, 2, 3, 4]).buffer;
      recorder.emitChunk(fakeData);

      // Since arrayBuffer() is async, flush microtasks
      await Promise.resolve();
      await Promise.resolve();

      expect(chunkCallback).toHaveBeenCalledOnce();
      const chunk = chunkCallback.mock.calls[0][0];
      expect(chunk.data).toBeInstanceOf(ArrayBuffer);
      expect(chunk.sampleRate).toBe(16000);
      expect(chunk.channels).toBe(1);
      expect(typeof chunk.timestamp).toBe('number');
    });

    it('does not emit chunk when data size is 0', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      const recorder = installFakeMediaRecorder();
      buildFakeAudioContext();

      const service = new AudioCaptureService();
      const chunkCallback = vi.fn();
      service.onAudioChunk(chunkCallback);

      await service.startCapture('session-1');

      // Emit an empty buffer (size 0)
      recorder.emitChunk(new ArrayBuffer(0));

      await Promise.resolve();
      await Promise.resolve();

      expect(chunkCallback).not.toHaveBeenCalled();
    });
  });

  // ─── Signal Loss Detection (Req 1.5) ───────────────────────────────────────

  describe('signal loss detection (Req 1.5)', () => {
    it('calls onSignalLoss callback after 5 seconds of silence', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      installFakeMediaRecorder();
      const fakeAudio = buildFakeAudioContext();

      // AnalyserNode always returns silence (default fill with 0)
      const service = new AudioCaptureService({ signalLossTimeoutMs: 5000 });
      const signalLossCb = vi.fn();
      service.onSignalLoss(signalLossCb);

      await service.startCapture('session-1');

      // Advance past the silence threshold (checks happen every 250ms)
      vi.advanceTimersByTime(5250);

      expect(signalLossCb).toHaveBeenCalled();
      const duration = signalLossCb.mock.calls[0][0];
      expect(duration).toBeGreaterThanOrEqual(5000);
    });

    it('does NOT trigger signal loss when audio level is above threshold', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      installFakeMediaRecorder();
      const fakeAudio = buildFakeAudioContext();

      // Make analyser return loud audio
      fakeAudio.analyserNode.getFloatTimeDomainData = vi.fn((arr: Float32Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = 0.5 * (i % 2 === 0 ? 1 : -1);
        }
      });

      const service = new AudioCaptureService({ signalLossTimeoutMs: 5000 });
      const signalLossCb = vi.fn();
      service.onSignalLoss(signalLossCb);

      await service.startCapture('session-1');

      // Advance well past the threshold
      vi.advanceTimersByTime(10000);

      expect(signalLossCb).not.toHaveBeenCalled();
    });

    it('clears signal loss flag when audio resumes', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      installFakeMediaRecorder();
      const fakeAudio = buildFakeAudioContext();

      // Start with silence
      const service = new AudioCaptureService({ signalLossTimeoutMs: 5000 });
      const signalLossCb = vi.fn();
      service.onSignalLoss(signalLossCb);

      await service.startCapture('session-1');

      // Trigger signal loss
      vi.advanceTimersByTime(5250);
      expect(service.hasSignalLoss).toBe(true);

      // Now switch to loud audio
      fakeAudio.analyserNode.getFloatTimeDomainData = vi.fn((arr: Float32Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = 0.5 * (i % 2 === 0 ? 1 : -1);
        }
      });

      // Next check should detect audio and clear the flag
      vi.advanceTimersByTime(250);

      expect(service.hasSignalLoss).toBe(false);
    });
  });

  // ─── Pause/Resume ───────────────────────────────────────────────────────────

  describe('pause/resume audio capture', () => {
    it('pauses MediaRecorder without releasing the stream', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      const recorder = installFakeMediaRecorder();
      buildFakeAudioContext();

      const service = new AudioCaptureService();
      await service.startCapture('session-1');

      service.pauseCapture();

      expect(recorder.pause).toHaveBeenCalledOnce();
      expect(service.captureState).toBe('paused');
      // Stream should NOT be released
      expect(fakeStream._stopTrack).not.toHaveBeenCalled();
    });

    it('resumes MediaRecorder after pause', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      const recorder = installFakeMediaRecorder();
      buildFakeAudioContext();

      const service = new AudioCaptureService();
      await service.startCapture('session-1');

      service.pauseCapture();
      service.resumeCapture();

      expect(recorder.resume).toHaveBeenCalledOnce();
      expect(service.captureState).toBe('capturing');
    });

    it('pauseCapture is a no-op when not capturing', () => {
      const service = new AudioCaptureService();
      // Should not throw
      service.pauseCapture();
      expect(service.captureState).toBe('idle');
    });

    it('resumeCapture is a no-op when not paused', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      installFakeMediaRecorder();
      buildFakeAudioContext();

      const service = new AudioCaptureService();
      await service.startCapture('session-1');

      // Resume without pausing first — should be a no-op
      service.resumeCapture();
      expect(service.captureState).toBe('capturing');
    });

    it('stops silence detection during pause and restarts on resume', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      installFakeMediaRecorder();
      buildFakeAudioContext();

      const service = new AudioCaptureService({ signalLossTimeoutMs: 5000 });
      const signalLossCb = vi.fn();
      service.onSignalLoss(signalLossCb);

      await service.startCapture('session-1');
      service.pauseCapture();

      // Silence during pause should NOT trigger signal loss
      vi.advanceTimersByTime(10000);
      expect(signalLossCb).not.toHaveBeenCalled();

      // Resume and verify silence detection restarts
      service.resumeCapture();
      vi.advanceTimersByTime(5250);
      expect(signalLossCb).toHaveBeenCalled();
    });
  });

  // ─── Stop and Cleanup ──────────────────────────────────────────────────────

  describe('stopCapture', () => {
    it('releases microphone tracks on stop', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      installFakeMediaRecorder();
      buildFakeAudioContext();

      const service = new AudioCaptureService();
      await service.startCapture('session-1');
      await service.stopCapture();

      expect(fakeStream._stopTrack).toHaveBeenCalled();
    });

    it('resets state to idle after stop', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      installFakeMediaRecorder();
      buildFakeAudioContext();

      const service = new AudioCaptureService();
      await service.startCapture('session-1');
      await service.stopCapture();

      expect(service.captureState).toBe('idle');
    });

    it('can start a new capture after stopping', async () => {
      const fakeStream = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream));
      const recorder = installFakeMediaRecorder();
      buildFakeAudioContext();

      const service = new AudioCaptureService();
      await service.startCapture('session-1');
      await service.stopCapture();

      // Start again — should not throw
      const fakeStream2 = buildFakeMediaStream();
      mockGetUserMedia(() => Promise.resolve(fakeStream2));
      await service.startCapture('session-2');

      expect(service.captureState).toBe('capturing');
    });
  });
});
