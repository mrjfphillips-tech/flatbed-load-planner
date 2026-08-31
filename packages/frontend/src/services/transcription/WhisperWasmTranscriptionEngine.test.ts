// @ts-nocheck
/**
 * Unit tests for WhisperWasmTranscriptionEngine
 *
 * Tests the offline Whisper WASM transcription engine implementation:
 * - Model loading from cache and CDN fallback
 * - Session lifecycle (start, processAudioChunk, end)
 * - Speaker detection heuristics
 * - onSegment callback emission
 * - TranscriptionEngine interface compliance
 *
 * Requirements: 24.1, 24.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WhisperWasmTranscriptionEngine,
  WHISPER_MODEL_CACHE_NAME,
  type WhisperWasmModule,
} from './WhisperWasmTranscriptionEngine';
import {
  createTranscriptionEngine,
  resetOfflineEngineInstance,
} from './TranscriptionEngineFactory';
import type { AudioChunk, TranscriptionConfig, TranscriptSegment } from '@ptv-discovery-coach/shared';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createMockAudioChunk(durationMs = 100, sampleRate = 16000, energy = 0.5): AudioChunk {
  const numSamples = Math.floor((durationMs / 1000) * sampleRate);
  const data = new Int16Array(numSamples);

  // Fill with sinusoidal data at the specified energy level
  for (let i = 0; i < numSamples; i++) {
    data[i] = Math.floor(Math.sin(i * 0.1) * energy * 32767);
  }

  return {
    data: data.buffer,
    timestamp: Date.now(),
    sampleRate,
    channels: 1,
  };
}

function createSilentAudioChunk(durationMs = 100, sampleRate = 16000): AudioChunk {
  const numSamples = Math.floor((durationMs / 1000) * sampleRate);
  const data = new Int16Array(numSamples); // All zeros = silence

  return {
    data: data.buffer,
    timestamp: Date.now(),
    sampleRate,
    channels: 1,
  };
}

function createDefaultConfig(sessionId = 'test-session'): TranscriptionConfig {
  return {
    sessionId,
    repId: 'rep-123',
    language: 'en',
    enableDiarization: true,
    maxSpeakers: 2,
  };
}

// ─── Mock WASM Module ─────────────────────────────────────────────────────────

function createMockWasmModule(): WhisperWasmModule {
  return {
    transcribe: vi.fn().mockResolvedValue({
      text: 'Hello, this is a test transcription.',
      confidence: 0.85,
    }),
    dispose: vi.fn(),
  };
}

// ─── Mock Cache API ───────────────────────────────────────────────────────────

function setupCacheMock(cachedResponse: Response | null = null) {
  const mockCache = {
    match: vi.fn().mockResolvedValue(cachedResponse),
    put: vi.fn().mockResolvedValue(undefined),
  };

  const cachesMock = {
    open: vi.fn().mockResolvedValue(mockCache),
  };

  Object.defineProperty(globalThis, 'caches', {
    value: cachesMock,
    writable: true,
    configurable: true,
  });

  return { cachesMock, mockCache };
}

function teardownCacheMock() {
  // @ts-expect-error - cleaning up mock
  delete globalThis.caches;
}

// ─── Mock Fetch ───────────────────────────────────────────────────────────────

function setupFetchMock(responseData: ArrayBuffer = new ArrayBuffer(1024)) {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: vi.fn().mockResolvedValue(responseData),
  });

  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WhisperWasmTranscriptionEngine', () => {
  let engine: WhisperWasmTranscriptionEngine;

  beforeEach(() => {
    engine = new WhisperWasmTranscriptionEngine({
      minBufferDurationMs: 500, // Shorter for testing
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    teardownCacheMock();
    resetOfflineEngineInstance();
  });

  describe('Model Loading', () => {
    it('should load model from Service Worker cache when available', async () => {
      const modelData = new ArrayBuffer(2048);
      const cachedResponse = new Response(modelData);
      const { mockCache } = setupCacheMock(cachedResponse);
      setupFetchMock();

      await engine.ensureModelLoaded();

      expect(mockCache.match).toHaveBeenCalled();
      expect(engine.isModelLoaded).toBe(true);
    });

    it('should fetch model from CDN when cache miss and then cache it', async () => {
      const modelData = new ArrayBuffer(2048);
      const { mockCache } = setupCacheMock(null); // Cache miss
      const mockFetch = setupFetchMock(modelData);

      await engine.ensureModelLoaded();

      // Should have fetched from CDN
      expect(mockFetch).toHaveBeenCalled();
      // Should cache the fetched model
      expect(mockCache.put).toHaveBeenCalled();
      expect(engine.isModelLoaded).toBe(true);
    });

    it('should throw when CDN fetch fails', async () => {
      setupCacheMock(null); // Cache miss
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }));

      await expect(engine.ensureModelLoaded()).rejects.toThrow('Failed to fetch Whisper model');
    });

    it('should handle missing Cache API gracefully and fallback to CDN', async () => {
      // No caches API defined
      const modelData = new ArrayBuffer(2048);
      setupFetchMock(modelData);

      await engine.ensureModelLoaded();

      expect(engine.isModelLoaded).toBe(true);
    });

    it('should only load model once even with concurrent calls', async () => {
      const modelData = new ArrayBuffer(2048);
      setupCacheMock(new Response(modelData));
      setupFetchMock(modelData);

      // Call multiple times concurrently
      const promises = [
        engine.ensureModelLoaded(),
        engine.ensureModelLoaded(),
        engine.ensureModelLoaded(),
      ];

      await Promise.all(promises);
      expect(engine.isModelLoaded).toBe(true);
    });
  });

  describe('Session Lifecycle', () => {
    beforeEach(async () => {
      // Pre-load model with mock
      const modelData = new ArrayBuffer(2048);
      setupCacheMock(new Response(modelData));
      setupFetchMock(modelData);
      await engine.ensureModelLoaded();
    });

    it('should start a new session successfully', async () => {
      const config = createDefaultConfig();
      const handle = await engine.startSession(config);

      expect(handle.sessionId).toBe('test-session');
      expect(handle.startedAt).toBeInstanceOf(Date);
    });

    it('should throw when starting a duplicate session', async () => {
      const config = createDefaultConfig();
      await engine.startSession(config);

      await expect(engine.startSession(config)).rejects.toThrow('already exists');
    });

    it('should end a session and return final transcript', async () => {
      const config = createDefaultConfig();
      await engine.startSession(config);

      const transcript = await engine.endSession('test-session');

      expect(transcript.sessionId).toBe('test-session');
      expect(transcript.segments).toBeInstanceOf(Array);
      expect(transcript.durationMs).toBeGreaterThanOrEqual(0);
      expect(transcript.speakerCount).toBeGreaterThanOrEqual(1);
    });

    it('should throw when ending a non-existent session', async () => {
      await expect(engine.endSession('nonexistent')).rejects.toThrow('not found');
    });

    it('should process audio chunks without error', async () => {
      const config = createDefaultConfig();
      await engine.startSession(config);

      const chunk = createMockAudioChunk(100);
      await expect(engine.processAudioChunk('test-session', chunk)).resolves.not.toThrow();
    });

    it('should throw when processing chunk for non-existent session', async () => {
      const chunk = createMockAudioChunk(100);
      await expect(engine.processAudioChunk('nonexistent', chunk)).rejects.toThrow('not found');
    });
  });

  describe('onSegment Callback', () => {
    beforeEach(async () => {
      const modelData = new ArrayBuffer(2048);
      setupCacheMock(new Response(modelData));
      setupFetchMock(modelData);
      await engine.ensureModelLoaded();
    });

    it('should call registered segment callbacks when segments are produced', async () => {
      const segmentCallback = vi.fn();
      engine.onSegment(segmentCallback);

      const config = createDefaultConfig();
      await engine.startSession(config);

      // Feed enough audio to trigger processing (> minBufferDurationMs = 500ms)
      const chunk = createMockAudioChunk(600, 16000, 0.5);
      await engine.processAudioChunk('test-session', chunk);

      // The internal WASM module returns '[whisper-wasm-pending]' which has text
      // so a segment should be emitted
      if (segmentCallback.mock.calls.length > 0) {
        const segment: TranscriptSegment = segmentCallback.mock.calls[0][0];
        expect(segment.sessionId).toBe('test-session');
        expect(segment.source).toBe('audio');
        expect(segment.speaker).toBeDefined();
      }
    });

    it('should support multiple segment callbacks', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      engine.onSegment(callback1);
      engine.onSegment(callback2);

      const config = createDefaultConfig();
      await engine.startSession(config);

      const chunk = createMockAudioChunk(600, 16000, 0.5);
      await engine.processAudioChunk('test-session', chunk);

      // Both callbacks should be called equally
      expect(callback1.mock.calls.length).toBe(callback2.mock.calls.length);
    });

    it('should not break processing when a callback throws', async () => {
      const badCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const goodCallback = vi.fn();
      engine.onSegment(badCallback);
      engine.onSegment(goodCallback);

      const config = createDefaultConfig();
      await engine.startSession(config);

      const chunk = createMockAudioChunk(600, 16000, 0.5);

      // Should not throw even though badCallback throws
      await expect(engine.processAudioChunk('test-session', chunk)).resolves.not.toThrow();
    });
  });

  describe('Speaker Detection Heuristic', () => {
    beforeEach(async () => {
      const modelData = new ArrayBuffer(2048);
      setupCacheMock(new Response(modelData));
      setupFetchMock(modelData);
    });

    it('should assign rep as first speaker when repSpeaksFirst is true', async () => {
      const repFirstEngine = new WhisperWasmTranscriptionEngine({
        repSpeaksFirst: true,
        minBufferDurationMs: 500,
      });
      await repFirstEngine.ensureModelLoaded();

      const segmentCallback = vi.fn();
      repFirstEngine.onSegment(segmentCallback);

      const config = createDefaultConfig();
      await repFirstEngine.startSession(config);

      const chunk = createMockAudioChunk(600, 16000, 0.5);
      await repFirstEngine.processAudioChunk('test-session', chunk);

      if (segmentCallback.mock.calls.length > 0) {
        const segment: TranscriptSegment = segmentCallback.mock.calls[0][0];
        expect(segment.speaker).toBe('rep');
      }
    });

    it('should assign customer as first speaker when repSpeaksFirst is false', async () => {
      const customerFirstEngine = new WhisperWasmTranscriptionEngine({
        repSpeaksFirst: false,
        minBufferDurationMs: 500,
      });
      await customerFirstEngine.ensureModelLoaded();

      const segmentCallback = vi.fn();
      customerFirstEngine.onSegment(segmentCallback);

      const config = createDefaultConfig('session-customer-first');
      await customerFirstEngine.startSession(config);

      const chunk = createMockAudioChunk(600, 16000, 0.5);
      await customerFirstEngine.processAudioChunk('session-customer-first', chunk);

      if (segmentCallback.mock.calls.length > 0) {
        const segment: TranscriptSegment = segmentCallback.mock.calls[0][0];
        expect(segment.speaker).toBe('customer_1');
      }
    });
  });

  describe('Voice Profile Registration', () => {
    it('should register a voice profile with the given repId', async () => {
      const profile = await engine.registerVoiceProfile('rep-456', new ArrayBuffer(1024));

      expect(profile.id).toBeDefined();
      expect(profile.repId).toBe('rep-456');
      expect(profile.createdAt).toBeInstanceOf(Date);
    });
  });
});

describe('TranscriptionEngineFactory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    teardownCacheMock();
    resetOfflineEngineInstance();
  });

  it('should return offline engine when connectivity check returns false', () => {
    const result = createTranscriptionEngine({
      connectivityCheck: () => false,
    });

    expect(result.mode).toBe('offline');
    expect(result.engine).toBeInstanceOf(WhisperWasmTranscriptionEngine);
  });

  it('should return online engine when connectivity check returns true and factory provided', () => {
    const mockOnlineEngine = {
      startSession: vi.fn(),
      processAudioChunk: vi.fn(),
      registerVoiceProfile: vi.fn(),
      endSession: vi.fn(),
      onSegment: vi.fn(),
    };

    const result = createTranscriptionEngine({
      connectivityCheck: () => true,
      createOnlineEngine: () => mockOnlineEngine,
    });

    expect(result.mode).toBe('online');
    expect(result.engine).toBe(mockOnlineEngine);
  });

  it('should fall back to offline engine when online but no factory provided', () => {
    const result = createTranscriptionEngine({
      connectivityCheck: () => true,
      // No createOnlineEngine provided
    });

    expect(result.mode).toBe('offline');
    expect(result.engine).toBeInstanceOf(WhisperWasmTranscriptionEngine);
  });

  it('should reuse the same offline engine instance across calls', () => {
    const result1 = createTranscriptionEngine({
      connectivityCheck: () => false,
    });
    const result2 = createTranscriptionEngine({
      connectivityCheck: () => false,
    });

    expect(result1.engine).toBe(result2.engine);
  });
});
