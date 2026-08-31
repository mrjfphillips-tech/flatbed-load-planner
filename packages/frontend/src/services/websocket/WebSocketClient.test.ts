/**
 * Tests for WebSocketClient
 *
 * Verifies:
 * - JWT authentication on connect
 * - Audio chunk streaming and buffering during disconnect
 * - Transcript segment and coaching event dispatch
 * - Automatic reconnection with exponential backoff (max 5 retries)
 * - Buffer replay on reconnect
 *
 * Requirements: 1.3, 23.1, 23.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient } from './WebSocketClient';
import type { ConnectionState, WsMessage } from './WebSocketClient';

// ─── Mock WebSocket ───────────────────────────────────────────────────────────

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  binaryType: string = 'blob';
  url: string;

  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  sentMessages: string[] = [];
  closeCode?: number;
  closeReason?: string;

  constructor(url: string) {
    this.url = url;
    // Simulate async open
    setTimeout(() => this.simulateOpen(), 0);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = MockWebSocket.CLOSED;
    // Trigger close event
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code ?? 1000, reason }));
    }
  }

  // ─── Test Helpers ─────────────────────────────────────────────────────────

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: WsMessage): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateClose(code: number = 1006, reason: string = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code, reason }));
  }

  simulateError(): void {
    this.onerror?.(new Event('error'));
  }

  getParsedMessages(): WsMessage[] {
    return this.sentMessages.map((msg) => JSON.parse(msg));
  }
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

let mockSocket: MockWebSocket;
const originalWebSocket = globalThis.WebSocket;

function setupMockWebSocket(): void {
  (globalThis as unknown as Record<string, unknown>).WebSocket = vi.fn((url: string) => {
    mockSocket = new MockWebSocket(url);
    return mockSocket;
  }) as unknown as typeof WebSocket;
  // Attach static properties
  (globalThis.WebSocket as unknown as Record<string, number>).OPEN = MockWebSocket.OPEN;
  (globalThis.WebSocket as unknown as Record<string, number>).CONNECTING = MockWebSocket.CONNECTING;
  (globalThis.WebSocket as unknown as Record<string, number>).CLOSING = MockWebSocket.CLOSING;
  (globalThis.WebSocket as unknown as Record<string, number>).CLOSED = MockWebSocket.CLOSED;
}

function createClient(overrides: Partial<Parameters<typeof WebSocketClient['prototype']['connect']> extends [] ? Record<string, unknown> : never> = {}): WebSocketClient {
  return new WebSocketClient({
    url: 'ws://localhost:3000/ws',
    token: 'test-jwt-token',
    maxReconnectAttempts: 5,
    baseReconnectDelayMs: 100,
    maxBufferSize: 10,
    pingIntervalMs: 30000,
    ...overrides,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WebSocketClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupMockWebSocket();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
  });

  describe('Connection and Authentication', () => {
    it('should connect and send auth message on open', async () => {
      const client = createClient();
      client.connect();

      // Trigger the async open
      await vi.advanceTimersByTimeAsync(1);

      const messages = mockSocket.getParsedMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].type).toBe('auth');
      expect(messages[0].payload).toBe('test-jwt-token');
    });

    it('should transition through connecting -> authenticating -> connected states', async () => {
      const client = createClient();
      const states: ConnectionState[] = [];
      client.onConnectionStateChange((state) => states.push(state));

      client.connect();
      expect(states).toContain('connecting');

      // Open event
      await vi.advanceTimersByTimeAsync(1);
      expect(states).toContain('authenticating');

      // Auth success response
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true, userId: 'user-1', role: 'rep' },
        timestamp: Date.now(),
      });

      expect(states).toContain('connected');
      expect(client.connectionState).toBe('connected');
    });

    it('should disconnect on auth failure without reconnecting', async () => {
      const client = createClient();
      const errorCallback = vi.fn();
      client.onError(errorCallback);

      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      // Auth failure
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: false },
        timestamp: Date.now(),
      });

      expect(client.connectionState).toBe('disconnected');
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'AUTH_FAILED' }),
      );
    });

    it('should not create a new connection if already connected', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      const firstSocket = mockSocket;
      client.connect(); // Should not create a new socket
      expect(mockSocket).toBe(firstSocket);
    });
  });

  describe('Audio Chunk Streaming', () => {
    it('should send audio chunks with sequence numbers when connected', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      client.startSession({ sessionId: 'session-1' });

      const chunk = {
        data: new ArrayBuffer(8),
        timestamp: 1000,
        sampleRate: 16000,
        channels: 1,
      };

      client.sendAudioChunk(chunk);
      client.sendAudioChunk(chunk);

      const messages = mockSocket.getParsedMessages();
      const audioMessages = messages.filter((m) => m.type === 'audio_chunk');
      expect(audioMessages.length).toBe(2);

      const payload0 = audioMessages[0].payload as Record<string, unknown>;
      const payload1 = audioMessages[1].payload as Record<string, unknown>;
      expect(payload0.sequenceNumber).toBe(0);
      expect(payload1.sequenceNumber).toBe(1);
      expect(payload0.sessionId).toBe('session-1');
    });

    it('should not send audio if no active session', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      const chunk = {
        data: new ArrayBuffer(8),
        timestamp: 1000,
        sampleRate: 16000,
        channels: 1,
      };

      client.sendAudioChunk(chunk);

      const messages = mockSocket.getParsedMessages();
      const audioMessages = messages.filter((m) => m.type === 'audio_chunk');
      expect(audioMessages.length).toBe(0);
    });

    it('should encode audio data as base64', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      client.startSession({ sessionId: 'session-1' });

      const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const chunk = {
        data: data.buffer,
        timestamp: 1000,
        sampleRate: 16000,
        channels: 1,
      };

      client.sendAudioChunk(chunk);

      const messages = mockSocket.getParsedMessages();
      const audioMsg = messages.find((m) => m.type === 'audio_chunk');
      const payload = audioMsg?.payload as Record<string, unknown>;
      expect(payload.data).toBe(btoa('Hello'));
    });
  });

  describe('Receiving Transcript Segments and Coaching Events', () => {
    it('should dispatch transcript segments to callback', async () => {
      const client = createClient();
      const segmentCallback = vi.fn();
      client.onTranscriptSegment(segmentCallback);

      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      const segment = {
        id: 'seg-1',
        sessionId: 'session-1',
        speaker: 'rep',
        text: 'Hello',
        startTimeMs: 0,
        endTimeMs: 1000,
        confidence: 0.95,
        source: 'audio',
        createdAt: new Date().toISOString(),
      };

      mockSocket.simulateMessage({
        type: 'transcript_segment',
        payload: segment,
        timestamp: Date.now(),
      });

      expect(segmentCallback).toHaveBeenCalledWith(segment);
    });

    it('should dispatch coaching events to callback', async () => {
      const client = createClient();
      const coachingCallback = vi.fn();
      client.onCoachingEvent(coachingCallback);

      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      const event = {
        type: 'coverage_update',
        data: { field: 'pain', score: 75 },
      };

      mockSocket.simulateMessage({
        type: 'coaching_event',
        payload: event,
        timestamp: Date.now(),
      });

      expect(coachingCallback).toHaveBeenCalledWith(event);
    });

    it('should respond to server pings with pong', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      mockSocket.simulateMessage({
        type: 'ping',
        payload: null,
        timestamp: Date.now(),
      });

      const messages = mockSocket.getParsedMessages();
      const pongMessages = messages.filter((m) => m.type === 'pong');
      expect(pongMessages.length).toBe(1);
    });
  });

  describe('Reconnection with Exponential Backoff', () => {
    it('should attempt reconnection on abnormal close', async () => {
      const client = createClient();
      const states: ConnectionState[] = [];
      client.onConnectionStateChange((state) => states.push(state));

      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      // Simulate abnormal close
      mockSocket.simulateClose(1006, 'Connection lost');

      expect(states).toContain('reconnecting');
      expect(client.connectionState).toBe('reconnecting');
    });

    it('should use exponential backoff for reconnection delays', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      // First disconnect
      mockSocket.simulateClose(1006);
      expect(client.currentReconnectAttempt).toBe(1);

      // Advance past first backoff (100ms * 2^0 = 100ms)
      await vi.advanceTimersByTimeAsync(100);

      // New socket created - simulate open and another failure
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateClose(1006);
      expect(client.currentReconnectAttempt).toBe(2);

      // Second backoff should be longer (100ms * 2^1 = 200ms)
      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateClose(1006);
      expect(client.currentReconnectAttempt).toBe(3);
    });

    it('should stop reconnecting after max attempts and emit error', async () => {
      const client = createClient();
      const errorCallback = vi.fn();
      client.onError(errorCallback);

      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      // Exhaust all 5 reconnection attempts
      for (let i = 0; i < 5; i++) {
        mockSocket.simulateClose(1006);
        const delay = 100 * Math.pow(2, i);
        await vi.advanceTimersByTimeAsync(delay);
        await vi.advanceTimersByTimeAsync(1);
      }

      // 6th close — should exceed max
      mockSocket.simulateClose(1006);

      expect(client.connectionState).toBe('disconnected');
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'MAX_RECONNECT_EXCEEDED' }),
      );
    });

    it('should not reconnect on normal closure (code 1000)', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      mockSocket.simulateClose(1000, 'Normal closure');

      expect(client.connectionState).toBe('disconnected');
      expect(client.currentReconnectAttempt).toBe(0);
    });

    it('should reset reconnect counter on successful reconnection', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      // First disconnect
      mockSocket.simulateClose(1006);
      expect(client.currentReconnectAttempt).toBe(1);

      // Reconnect successfully
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      expect(client.connectionState).toBe('connected');
      expect(client.currentReconnectAttempt).toBe(0);
    });
  });

  describe('Buffer and Replay', () => {
    it('should buffer audio chunks when disconnected', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      client.startSession({ sessionId: 'session-1' });

      // Disconnect
      mockSocket.simulateClose(1006);

      // Send chunks while disconnected
      const chunk = {
        data: new ArrayBuffer(8),
        timestamp: 1000,
        sampleRate: 16000,
        channels: 1,
      };

      client.sendAudioChunk(chunk);
      client.sendAudioChunk(chunk);

      expect(client.bufferedChunkCount).toBe(2);
    });

    it('should replay buffered chunks on reconnection', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      client.startSession({ sessionId: 'session-1' });

      // Disconnect
      mockSocket.simulateClose(1006);

      // Buffer some chunks
      const chunk = {
        data: new ArrayBuffer(4),
        timestamp: 1000,
        sampleRate: 16000,
        channels: 1,
      };
      client.sendAudioChunk(chunk);
      client.sendAudioChunk(chunk);
      client.sendAudioChunk(chunk);

      expect(client.bufferedChunkCount).toBe(3);

      // Reconnect
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      // Buffer should be empty (replayed)
      expect(client.bufferedChunkCount).toBe(0);

      // Verify buffered chunks were sent
      const messages = mockSocket.getParsedMessages();
      const audioMessages = messages.filter((m) => m.type === 'audio_chunk');
      expect(audioMessages.length).toBe(3);
    });

    it('should drop oldest chunks when buffer exceeds max size', async () => {
      const client = createClient({ maxBufferSize: 3 });
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      client.startSession({ sessionId: 'session-1' });

      // Disconnect
      mockSocket.simulateClose(1006);

      // Send more chunks than buffer capacity
      for (let i = 0; i < 5; i++) {
        client.sendAudioChunk({
          data: new ArrayBuffer(4),
          timestamp: i * 100,
          sampleRate: 16000,
          channels: 1,
        });
      }

      // Only the last 3 should be retained
      expect(client.bufferedChunkCount).toBe(3);
    });
  });

  describe('Session Management', () => {
    it('should send session_start message', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      client.startSession({
        sessionId: 'session-1',
        language: 'en',
        enableDiarization: true,
        maxSpeakers: 4,
      });

      const messages = mockSocket.getParsedMessages();
      const startMsg = messages.find((m) => m.type === 'session_start');
      expect(startMsg).toBeDefined();
      const payload = startMsg?.payload as Record<string, unknown>;
      expect(payload.sessionId).toBe('session-1');
      expect(payload.language).toBe('en');
      expect(payload.enableDiarization).toBe(true);
      expect(payload.maxSpeakers).toBe(4);
    });

    it('should send session_end message and clear session', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      client.startSession({ sessionId: 'session-1' });
      expect(client.hasActiveSession).toBe(true);

      client.endSession();
      expect(client.hasActiveSession).toBe(false);

      const messages = mockSocket.getParsedMessages();
      const endMsg = messages.find((m) => m.type === 'session_end');
      expect(endMsg).toBeDefined();
    });
  });

  describe('Disconnect', () => {
    it('should close socket with code 1000 on disconnect', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      client.disconnect();

      expect(mockSocket.closeCode).toBe(1000);
      expect(client.connectionState).toBe('disconnected');
    });

    it('should clear reconnect timer on disconnect', async () => {
      const client = createClient();
      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      // Trigger reconnect state
      mockSocket.simulateClose(1006);
      expect(client.connectionState).toBe('reconnecting');

      // Disconnect should cancel pending reconnect
      client.disconnect();
      expect(client.connectionState).toBe('disconnected');
      expect(client.currentReconnectAttempt).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should forward server error messages to error callback', async () => {
      const client = createClient();
      const errorCallback = vi.fn();
      client.onError(errorCallback);

      client.connect();
      await vi.advanceTimersByTimeAsync(1);
      mockSocket.simulateMessage({
        type: 'auth',
        payload: { success: true },
        timestamp: Date.now(),
      });

      mockSocket.simulateMessage({
        type: 'error',
        payload: { code: 'NO_SESSION', message: 'No active session' },
        timestamp: Date.now(),
      });

      expect(errorCallback).toHaveBeenCalledWith({
        code: 'NO_SESSION',
        message: 'No active session',
      });
    });
  });
});
