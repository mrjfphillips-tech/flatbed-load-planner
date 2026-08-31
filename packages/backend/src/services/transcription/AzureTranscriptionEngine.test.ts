/**
 * Unit tests for AzureTranscriptionEngine
 *
 * Uses mocked Azure Speech SDK to test:
 * - Session lifecycle (start, process audio, end)
 * - Transcript segment creation with timestamps and confidence scores
 * - Automatic reconnection on connection loss with exponential backoff
 * - Real-time segment callback emission
 * - Voice profile registration
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  TranscriptionConfig,
  AudioChunk,
  TranscriptSegment,
} from '@ptv-discovery-coach/shared';

// ─── Mock Azure Speech SDK ────────────────────────────────────────────────────

const mockPushStreamWrite = vi.fn();
const mockPushStreamClose = vi.fn();
const mockRecognizerClose = vi.fn();
const mockStartContinuous = vi.fn();
const mockStopContinuous = vi.fn();

// Store event handlers registered by the recognizer
let recognizerEventHandlers: Record<string, any> = {};

const mockRecognizer = {
  close: mockRecognizerClose,
  startContinuousRecognitionAsync: mockStartContinuous,
  stopContinuousRecognitionAsync: mockStopContinuous,
  set recognized(handler: any) {
    recognizerEventHandlers.recognized = handler;
  },
  get recognized() {
    return recognizerEventHandlers.recognized;
  },
  set sessionStarted(handler: any) {
    recognizerEventHandlers.sessionStarted = handler;
  },
  get sessionStarted() {
    return recognizerEventHandlers.sessionStarted;
  },
  set sessionStopped(handler: any) {
    recognizerEventHandlers.sessionStopped = handler;
  },
  get sessionStopped() {
    return recognizerEventHandlers.sessionStopped;
  },
  set canceled(handler: any) {
    recognizerEventHandlers.canceled = handler;
  },
  get canceled() {
    return recognizerEventHandlers.canceled;
  },
};

const mockPushStream = {
  write: mockPushStreamWrite,
  close: mockPushStreamClose,
};

vi.mock('microsoft-cognitiveservices-speech-sdk', () => {
  const ResultReason = { RecognizedSpeech: 1, NoMatch: 2 };
  const CancellationReason = { Error: 1, EndOfStream: 2 };
  const OutputFormat = { Detailed: 1, Simple: 0 };
  const PropertyId = {
    SpeechServiceResponse_JsonResult: 'SpeechServiceResponse_JsonResult',
    SpeechServiceConnection_LanguageIdMode: 'SpeechServiceConnection_LanguageIdMode',
  };

  return {
    ResultReason,
    CancellationReason,
    OutputFormat,
    PropertyId,
    SpeechConfig: {
      fromSubscription: vi.fn(() => ({
        speechRecognitionLanguage: '',
        outputFormat: 0,
        setProperty: vi.fn(),
      })),
    },
    AudioStreamFormat: {
      getWaveFormatPCM: vi.fn(() => ({})),
    },
    AudioInputStream: {
      createPushStream: vi.fn(() => mockPushStream),
    },
    AudioConfig: {
      fromStreamInput: vi.fn(() => ({})),
    },
    SpeechRecognizer: vi.fn(() => mockRecognizer),
  };
});

// ─── Import after mocking ─────────────────────────────────────────────────────

import { AzureTranscriptionEngine } from './AzureTranscriptionEngine';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createTestConfig(overrides?: Partial<TranscriptionConfig>): TranscriptionConfig {
  return {
    sessionId: 'test-session-1',
    repId: 'rep-1',
    language: 'en',
    enableDiarization: true,
    maxSpeakers: 3,
    ...overrides,
  };
}

function createTestAudioChunk(overrides?: Partial<AudioChunk>): AudioChunk {
  return {
    data: new ArrayBuffer(3200), // 100ms of 16kHz 16-bit mono
    timestamp: Date.now(),
    sampleRate: 16000,
    channels: 1,
    ...overrides,
  };
}

function createMockRecognitionResult(options: {
  text: string;
  offset?: number;
  duration?: number;
  confidence?: number;
  speakerId?: string;
}) {
  const { text, offset = 10000000, duration = 20000000, confidence = 0.92, speakerId } = options;

  const jsonResult: Record<string, any> = {
    NBest: [{ Confidence: confidence }],
  };
  if (speakerId) {
    jsonResult.SpeakerId = speakerId;
  }

  return {
    text,
    offset: BigInt(offset),
    duration: BigInt(duration),
    reason: 1, // RecognizedSpeech
    properties: {
      getProperty: vi.fn((propId: string) => {
        if (propId === 'SpeechServiceResponse_JsonResult') {
          return JSON.stringify(jsonResult);
        }
        return '';
      }),
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AzureTranscriptionEngine', () => {
  let engine: AzureTranscriptionEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    recognizerEventHandlers = {};

    // Default: startContinuous resolves immediately
    mockStartContinuous.mockImplementation((resolve: () => void) => resolve());
    mockStopContinuous.mockImplementation((resolve: () => void) => resolve());

    engine = new AzureTranscriptionEngine({
      speechKey: 'test-key',
      speechRegion: 'eastus',
      maxReconnectAttempts: 3,
      baseReconnectDelayMs: 100,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startSession', () => {
    it('should create a session and return a SessionHandle', async () => {
      const config = createTestConfig();
      const handle = await engine.startSession(config);

      expect(handle.sessionId).toBe('test-session-1');
      expect(handle.startedAt).toBeInstanceOf(Date);
    });

    it('should throw if session already exists', async () => {
      const config = createTestConfig();
      await engine.startSession(config);

      await expect(engine.startSession(config)).rejects.toThrow(
        'Session test-session-1 already exists',
      );
    });

    it('should start continuous recognition', async () => {
      const config = createTestConfig();
      await engine.startSession(config);

      expect(mockStartContinuous).toHaveBeenCalled();
    });

    it('should propagate recognition start errors', async () => {
      mockStartContinuous.mockImplementation(
        (_resolve: () => void, reject: (err: string) => void) => reject('Connection failed'),
      );

      const config = createTestConfig();
      await expect(engine.startSession(config)).rejects.toThrow(
        'Failed to start recognition: Connection failed',
      );
    });
  });

  describe('processAudioChunk', () => {
    it('should write audio data to the push stream', async () => {
      const config = createTestConfig();
      await engine.startSession(config);

      const chunk = createTestAudioChunk();
      await engine.processAudioChunk('test-session-1', chunk);

      expect(mockPushStreamWrite).toHaveBeenCalledTimes(1);
    });

    it('should throw if session does not exist', async () => {
      const chunk = createTestAudioChunk();
      await expect(engine.processAudioChunk('nonexistent', chunk)).rejects.toThrow(
        'Session nonexistent not found',
      );
    });
  });

  describe('endSession', () => {
    it('should stop recognition and return final transcript', async () => {
      const config = createTestConfig();
      await engine.startSession(config);

      const transcript = await engine.endSession('test-session-1');

      expect(mockStopContinuous).toHaveBeenCalled();
      expect(mockPushStreamClose).toHaveBeenCalled();
      expect(mockRecognizerClose).toHaveBeenCalled();
      expect(transcript.sessionId).toBe('test-session-1');
      expect(transcript.segments).toEqual([]);
      expect(transcript.durationMs).toBeGreaterThanOrEqual(0);
      expect(transcript.speakerCount).toBe(0);
    });

    it('should throw if session does not exist', async () => {
      await expect(engine.endSession('nonexistent')).rejects.toThrow(
        'Session nonexistent not found',
      );
    });

    it('should include accumulated segments in the final transcript', async () => {
      const config = createTestConfig();
      await engine.startSession(config);

      // Simulate recognized speech event
      const result = createMockRecognitionResult({
        text: 'Hello, how can I help you today?',
        confidence: 0.95,
        speakerId: '1',
      });
      recognizerEventHandlers.recognized(null, { result });

      const transcript = await engine.endSession('test-session-1');

      expect(transcript.segments).toHaveLength(1);
      expect(transcript.segments[0].text).toBe('Hello, how can I help you today?');
      expect(transcript.segments[0].confidence).toBe(0.95);
      expect(transcript.segments[0].speaker).toBe('rep');
      expect(transcript.speakerCount).toBe(1);
    });
  });

  describe('segment creation', () => {
    it('should create segments with correct timestamps', async () => {
      const config = createTestConfig();
      await engine.startSession(config);

      const result = createMockRecognitionResult({
        text: 'Test speech',
        offset: 50000000, // 5000ms in ticks
        duration: 20000000, // 2000ms in ticks
      });
      recognizerEventHandlers.recognized(null, { result });

      const transcript = await engine.endSession('test-session-1');
      const segment = transcript.segments[0];

      expect(segment.startTimeMs).toBe(5000);
      expect(segment.endTimeMs).toBe(7000);
    });

    it('should extract confidence from Azure detailed results', async () => {
      const config = createTestConfig();
      await engine.startSession(config);

      const result = createMockRecognitionResult({
        text: 'High confidence speech',
        confidence: 0.97,
      });
      recognizerEventHandlers.recognized(null, { result });

      const transcript = await engine.endSession('test-session-1');

      expect(transcript.segments[0].confidence).toBe(0.97);
    });

    it('should default confidence to 0.85 if parsing fails', async () => {
      const config = createTestConfig();
      await engine.startSession(config);

      const result = {
        text: 'Test',
        offset: BigInt(10000000),
        duration: BigInt(5000000),
        reason: 1,
        properties: {
          getProperty: vi.fn(() => 'invalid-json'),
        },
      };
      recognizerEventHandlers.recognized(null, { result });

      const transcript = await engine.endSession('test-session-1');

      expect(transcript.segments[0].confidence).toBe(0.85);
    });

    it('should assign speaker labels from diarization data', async () => {
      const config = createTestConfig();
      await engine.startSession(config);

      // Rep speaking
      const repResult = createMockRecognitionResult({
        text: 'Rep speaking',
        speakerId: '1',
      });
      recognizerEventHandlers.recognized(null, { result: repResult });

      // Customer speaking
      const customerResult = createMockRecognitionResult({
        text: 'Customer speaking',
        speakerId: '2',
      });
      recognizerEventHandlers.recognized(null, { result: customerResult });

      const transcript = await engine.endSession('test-session-1');

      expect(transcript.segments[0].speaker).toBe('rep');
      expect(transcript.segments[1].speaker).toBe('customer_2');
      expect(transcript.speakerCount).toBe(2);
    });

    it('should set source to "audio" for all segments', async () => {
      const config = createTestConfig();
      await engine.startSession(config);

      const result = createMockRecognitionResult({ text: 'Test' });
      recognizerEventHandlers.recognized(null, { result });

      const transcript = await engine.endSession('test-session-1');

      expect(transcript.segments[0].source).toBe('audio');
    });

    it('should not create segments for empty recognition results', async () => {
      const config = createTestConfig();
      await engine.startSession(config);

      // Empty text should be skipped
      const result = {
        text: '',
        offset: BigInt(10000000),
        duration: BigInt(5000000),
        reason: 1, // RecognizedSpeech
        properties: { getProperty: vi.fn(() => '') },
      };
      recognizerEventHandlers.recognized(null, { result });

      const transcript = await engine.endSession('test-session-1');

      expect(transcript.segments).toHaveLength(0);
    });
  });

  describe('onSegment callback', () => {
    it('should emit segments to registered callbacks in real time', async () => {
      const segmentCallback = vi.fn();
      engine.onSegment(segmentCallback);

      const config = createTestConfig();
      await engine.startSession(config);

      const result = createMockRecognitionResult({
        text: 'Real-time segment',
        confidence: 0.9,
      });
      recognizerEventHandlers.recognized(null, { result });

      expect(segmentCallback).toHaveBeenCalledTimes(1);
      const emittedSegment: TranscriptSegment = segmentCallback.mock.calls[0][0];
      expect(emittedSegment.text).toBe('Real-time segment');
      expect(emittedSegment.confidence).toBe(0.9);
      expect(emittedSegment.sessionId).toBe('test-session-1');
    });

    it('should support multiple callbacks', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      engine.onSegment(callback1);
      engine.onSegment(callback2);

      const config = createTestConfig();
      await engine.startSession(config);

      const result = createMockRecognitionResult({ text: 'Broadcast test' });
      recognizerEventHandlers.recognized(null, { result });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should not fail if a callback throws', async () => {
      const failingCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const healthyCallback = vi.fn();
      engine.onSegment(failingCallback);
      engine.onSegment(healthyCallback);

      const config = createTestConfig();
      await engine.startSession(config);

      const result = createMockRecognitionResult({ text: 'Error resilience' });
      recognizerEventHandlers.recognized(null, { result });

      // Healthy callback still called despite the first one throwing
      expect(healthyCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('automatic reconnection', () => {
    it('should attempt reconnection on connection error', async () => {
      const config = createTestConfig();
      await engine.startSession(config);

      // Reset mock call count from initial start
      mockStartContinuous.mockClear();

      // Simulate connection loss via cancellation event
      recognizerEventHandlers.canceled(null, {
        reason: 1, // CancellationReason.Error
      });

      // Advance timers past the first backoff delay (100ms)
      await vi.advanceTimersByTimeAsync(100);

      expect(mockStartContinuous).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff for reconnection', async () => {
      // Make reconnection fail on first attempt, succeed on second
      let callCount = 0;
      mockStartContinuous.mockImplementation(
        (resolve: () => void, reject: (err: string) => void) => {
          callCount++;
          if (callCount <= 1) {
            resolve(); // Initial start succeeds
          } else if (callCount === 2) {
            reject('Still disconnected'); // First reconnect fails
          } else {
            resolve(); // Second reconnect succeeds
          }
        },
      );

      const config = createTestConfig();
      await engine.startSession(config);

      // Trigger connection loss
      recognizerEventHandlers.canceled(null, { reason: 1 });

      // First backoff: 100ms
      await vi.advanceTimersByTimeAsync(100);

      // Second backoff: 200ms (100 * 2^1)
      await vi.advanceTimersByTimeAsync(200);

      // Should have attempted start 3 times total (1 initial + 2 retries)
      expect(callCount).toBe(3);
    });

    it('should stop retrying after max attempts', async () => {
      // Make all reconnection attempts fail
      let callCount = 0;
      mockStartContinuous.mockImplementation(
        (resolve: () => void, reject: (err: string) => void) => {
          callCount++;
          if (callCount === 1) {
            resolve(); // Initial start succeeds
          } else {
            reject('Connection refused');
          }
        },
      );

      const config = createTestConfig();
      await engine.startSession(config);

      // Trigger connection loss
      recognizerEventHandlers.canceled(null, { reason: 1 });

      // Advance through all backoff delays: 100, 200, 400 (3 max attempts)
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(400);
      await vi.advanceTimersByTimeAsync(800); // Extra time to ensure no more attempts

      // 1 initial + 3 retries (maxReconnectAttempts = 3)
      expect(callCount).toBe(4);
    });
  });

  describe('registerVoiceProfile', () => {
    it('should return a voice profile with the rep ID', async () => {
      const audioSample = new ArrayBuffer(1024);
      const profile = await engine.registerVoiceProfile('rep-123', audioSample);

      expect(profile.repId).toBe('rep-123');
      expect(profile.id).toBeTruthy();
      expect(profile.createdAt).toBeInstanceOf(Date);
    });
  });
});
