/**
 * WebSocketClient
 *
 * Manages a WebSocket connection to the backend for streaming audio chunks
 * and receiving real-time transcript segments and coaching events.
 *
 * Features:
 * - JWT-authenticated WebSocket connection
 * - Audio chunk streaming from AudioCaptureService to server
 * - Real-time receipt of transcript segments and coaching events
 * - Automatic reconnection with exponential backoff (max 5 retries)
 * - Audio chunk buffering during disconnection with replay on reconnect
 *
 * Requirements: 1.3, 23.1, 23.4
 */

import type { TranscriptSegment, AudioChunk, CoachingEvent } from '@ptv-discovery-coach/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'reconnecting';

export type WsMessageType =
  | 'audio_chunk'
  | 'transcript_segment'
  | 'coaching_event'
  | 'coverage_update'
  | 'error'
  | 'ping'
  | 'pong'
  | 'auth'
  | 'session_start'
  | 'session_end';

export interface WsMessage {
  type: WsMessageType;
  payload: unknown;
  timestamp: number;
}

export interface AudioChunkPayload {
  sessionId: string;
  /** Base64-encoded audio data */
  data: string;
  timestamp: number;
  sampleRate: number;
  channels: number;
  /** Sequence number for ordering and replay detection */
  sequenceNumber: number;
}

export interface SessionStartPayload {
  sessionId: string;
  language?: string;
  enableDiarization?: boolean;
  maxSpeakers?: number;
}

export interface WebSocketClientOptions {
  /** Backend WebSocket URL (e.g., ws://localhost:3000/ws) */
  url: string;
  /** JWT token for authentication */
  token: string;
  /** Maximum reconnection attempts. Default: 5 */
  maxReconnectAttempts?: number;
  /** Base delay for exponential backoff in ms. Default: 1000 */
  baseReconnectDelayMs?: number;
  /** Maximum buffer size for audio chunks during disconnect. Default: 500 */
  maxBufferSize?: number;
  /** Ping interval in ms. Default: 30000 */
  pingIntervalMs?: number;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class WebSocketClient {
  // Configuration
  private readonly url: string;
  private token: string;
  private readonly maxReconnectAttempts: number;
  private readonly baseReconnectDelayMs: number;
  private readonly maxBufferSize: number;
  private readonly pingIntervalMs: number;

  // State
  private _connectionState: ConnectionState = 'disconnected';
  private socket: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private activeSessionId: string | null = null;
  private sequenceNumber: number = 0;

  // Buffer for audio chunks during disconnect
  private audioBuffer: AudioChunkPayload[] = [];

  // Callbacks
  private onTranscriptSegmentCallback: ((segment: TranscriptSegment) => void) | null = null;
  private onCoachingEventCallback: ((event: CoachingEvent) => void) | null = null;
  private onConnectionStateChangeCallback: ((state: ConnectionState) => void) | null = null;
  private onErrorCallback: ((error: { code: string; message: string }) => void) | null = null;

  constructor(options: WebSocketClientOptions) {
    this.url = options.url;
    this.token = options.token;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.baseReconnectDelayMs = options.baseReconnectDelayMs ?? 1000;
    this.maxBufferSize = options.maxBufferSize ?? 500;
    this.pingIntervalMs = options.pingIntervalMs ?? 30000;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Connect to the WebSocket server and authenticate with JWT.
   */
  connect(): void {
    if (this._connectionState === 'connected' || this._connectionState === 'connecting') {
      return;
    }

    this.setConnectionState('connecting');
    this.createSocket();
  }

  /**
   * Gracefully disconnect from the WebSocket server.
   */
  disconnect(): void {
    this.clearReconnectTimer();
    this.clearPingTimer();
    this.reconnectAttempts = 0;

    if (this.socket) {
      // Use code 1000 for normal closure
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }

    this.setConnectionState('disconnected');
  }

  /**
   * Start a transcription session on the server.
   */
  startSession(payload: SessionStartPayload): void {
    this.activeSessionId = payload.sessionId;
    this.sequenceNumber = 0;
    this.audioBuffer = [];

    this.sendMessage({
      type: 'session_start',
      payload,
      timestamp: Date.now(),
    });
  }

  /**
   * End the active transcription session.
   */
  endSession(): void {
    if (!this.activeSessionId) return;

    this.sendMessage({
      type: 'session_end',
      payload: { sessionId: this.activeSessionId },
      timestamp: Date.now(),
    });

    this.activeSessionId = null;
    this.sequenceNumber = 0;
    this.audioBuffer = [];
  }

  /**
   * Send an audio chunk to the server.
   * If disconnected, buffers the chunk for replay on reconnect.
   */
  sendAudioChunk(chunk: AudioChunk): void {
    if (!this.activeSessionId) return;

    const payload: AudioChunkPayload = {
      sessionId: this.activeSessionId,
      data: this.arrayBufferToBase64(chunk.data),
      timestamp: chunk.timestamp,
      sampleRate: chunk.sampleRate,
      channels: chunk.channels,
      sequenceNumber: this.sequenceNumber++,
    };

    if (this._connectionState === 'connected') {
      this.sendMessage({
        type: 'audio_chunk',
        payload,
        timestamp: Date.now(),
      });
    } else {
      // Buffer the chunk for replay on reconnect
      this.bufferAudioChunk(payload);
    }
  }

  /**
   * Update the JWT token (e.g., after token refresh).
   */
  updateToken(token: string): void {
    this.token = token;
  }

  // ─── Event Callbacks ────────────────────────────────────────────────────────

  /**
   * Register callback for incoming transcript segments.
   */
  onTranscriptSegment(callback: (segment: TranscriptSegment) => void): void {
    this.onTranscriptSegmentCallback = callback;
  }

  /**
   * Register callback for incoming coaching events.
   */
  onCoachingEvent(callback: (event: CoachingEvent) => void): void {
    this.onCoachingEventCallback = callback;
  }

  /**
   * Register callback for connection state changes.
   */
  onConnectionStateChange(callback: (state: ConnectionState) => void): void {
    this.onConnectionStateChangeCallback = callback;
  }

  /**
   * Register callback for WebSocket errors from the server.
   */
  onError(callback: (error: { code: string; message: string }) => void): void {
    this.onErrorCallback = callback;
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  /** Current connection state */
  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  /** Number of buffered audio chunks awaiting replay */
  get bufferedChunkCount(): number {
    return this.audioBuffer.length;
  }

  /** Current reconnection attempt count */
  get currentReconnectAttempt(): number {
    return this.reconnectAttempts;
  }

  /** Whether there is an active session */
  get hasActiveSession(): boolean {
    return this.activeSessionId !== null;
  }

  // ─── Private: Socket Management ─────────────────────────────────────────────

  private createSocket(): void {
    try {
      this.socket = new WebSocket(this.url);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
    } catch {
      this.scheduleReconnect();
    }
  }

  private handleOpen(): void {
    this.setConnectionState('authenticating');
    // Send auth message with JWT token
    this.sendMessage({
      type: 'auth',
      payload: this.token,
      timestamp: Date.now(),
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WsMessage = JSON.parse(
        typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data),
      );

      switch (message.type) {
        case 'auth':
          this.handleAuthResponse(message);
          break;

        case 'transcript_segment':
          if (this.onTranscriptSegmentCallback && message.payload) {
            this.onTranscriptSegmentCallback(message.payload as TranscriptSegment);
          }
          break;

        case 'coaching_event':
          if (this.onCoachingEventCallback && message.payload) {
            this.onCoachingEventCallback(message.payload as CoachingEvent);
          }
          break;

        case 'ping':
          // Respond to server ping with pong
          this.sendMessage({
            type: 'pong',
            payload: null,
            timestamp: Date.now(),
          });
          break;

        case 'error':
          this.handleServerError(message);
          break;

        case 'session_start':
        case 'session_end':
          // Acknowledgments — no action needed
          break;

        default:
          break;
      }
    } catch {
      // Invalid JSON — ignore malformed messages
    }
  }

  private handleAuthResponse(message: WsMessage): void {
    const payload = message.payload as { success?: boolean } | null;

    if (payload?.success) {
      this.setConnectionState('connected');
      this.reconnectAttempts = 0;
      this.startPingTimer();
      this.replayBufferedChunks();
    } else {
      // Auth failed — do not reconnect (invalid credentials)
      this.onErrorCallback?.({ code: 'AUTH_FAILED', message: 'Authentication failed' });
      this.disconnect();
    }
  }

  private handleServerError(message: WsMessage): void {
    const payload = message.payload as { code?: string; message?: string } | null;
    if (payload) {
      this.onErrorCallback?.({
        code: payload.code ?? 'UNKNOWN',
        message: payload.message ?? 'Unknown server error',
      });
    }
  }

  private handleClose(event: CloseEvent): void {
    this.clearPingTimer();
    this.socket = null;

    // Don't reconnect on normal closure or auth failure
    if (event.code === 1000 || event.code === 4001) {
      this.setConnectionState('disconnected');
      return;
    }

    // Attempt reconnection for abnormal closures
    if (this._connectionState !== 'disconnected') {
      this.scheduleReconnect();
    }
  }

  private handleError(): void {
    // The close event will follow — handle reconnection there
  }

  // ─── Private: Reconnection ──────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setConnectionState('disconnected');
      this.onErrorCallback?.({
        code: 'MAX_RECONNECT_EXCEEDED',
        message: `Failed to reconnect after ${this.maxReconnectAttempts} attempts`,
      });
      return;
    }

    this.setConnectionState('reconnecting');
    this.reconnectAttempts++;

    // Exponential backoff: baseDelay * 2^(attempt - 1), capped at 30s
    const delay = Math.min(
      this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      30_000,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.createSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ─── Private: Audio Buffer ──────────────────────────────────────────────────

  private bufferAudioChunk(payload: AudioChunkPayload): void {
    if (this.audioBuffer.length >= this.maxBufferSize) {
      // Drop oldest chunk to make room (FIFO overflow)
      this.audioBuffer.shift();
    }
    this.audioBuffer.push(payload);
  }

  private replayBufferedChunks(): void {
    if (this.audioBuffer.length === 0) return;

    const chunks = [...this.audioBuffer];
    this.audioBuffer = [];

    for (const payload of chunks) {
      this.sendMessage({
        type: 'audio_chunk',
        payload,
        timestamp: Date.now(),
      });
    }
  }

  // ─── Private: Ping/Keep-Alive ───────────────────────────────────────────────

  private startPingTimer(): void {
    this.clearPingTimer();
    this.pingTimer = setInterval(() => {
      if (this._connectionState === 'connected') {
        this.sendMessage({
          type: 'ping',
          payload: null,
          timestamp: Date.now(),
        });
      }
    }, this.pingIntervalMs);
  }

  private clearPingTimer(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  // ─── Private: Utilities ─────────────────────────────────────────────────────

  private sendMessage(message: WsMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private setConnectionState(state: ConnectionState): void {
    if (this._connectionState !== state) {
      this._connectionState = state;
      this.onConnectionStateChangeCallback?.(state);
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
