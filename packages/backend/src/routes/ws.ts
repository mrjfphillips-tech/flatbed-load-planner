import { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import type { JwtPayload } from '../middleware/auth.js';
import type { TranscriptSegment, CoachingEvent, AudioChunk } from '@ptv-discovery-coach/shared';

/**
 * Message types for the WebSocket protocol.
 */
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

/**
 * Payload for audio_chunk messages sent from the client.
 */
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

/**
 * Payload for session_start messages.
 */
export interface SessionStartPayload {
  sessionId: string;
  language?: string;
  enableDiarization?: boolean;
  maxSpeakers?: number;
}

/**
 * Tracks per-connection state for session management.
 */
interface ConnectionState {
  authenticated: boolean;
  userPayload: JwtPayload | null;
  activeSessionId: string | null;
  lastSequenceNumber: number;
}

/**
 * Interface for the transcription engine dependency.
 * Allows injection for testing or swapping implementations.
 */
export interface TranscriptionEngineAdapter {
  startSession(sessionId: string, config: { language: string; enableDiarization: boolean; maxSpeakers: number }): Promise<void>;
  processAudioChunk(sessionId: string, chunk: AudioChunk): Promise<void>;
  endSession(sessionId: string): Promise<void>;
  onSegment(callback: (segment: TranscriptSegment) => void): void;
}

/**
 * Interface for the AI engine dependency for coaching events.
 */
export interface CoachingEngineAdapter {
  onCoachingEvent(callback: (event: CoachingEvent) => void): void;
}

/**
 * WebSocket routes for streaming audio and coaching responses.
 * The /ws endpoint handles bidirectional communication for:
 * - Streaming audio chunks from the client to the server
 * - Streaming transcription segments back to the client
 * - Streaming coaching events (coverage updates, question suggestions, objection alerts)
 *
 * Requirements: 1.3, 23.1, 23.4
 */
export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    const state: ConnectionState = {
      authenticated: false,
      userPayload: null,
      activeSessionId: null,
      lastSequenceNumber: -1,
    };

    // Set up ping/pong for connection keep-alive
    const pingInterval = setInterval(() => {
      if (socket.readyState === socket.OPEN) {
        const msg: WsMessage = {
          type: 'ping',
          payload: null,
          timestamp: Date.now(),
        };
        socket.send(JSON.stringify(msg));
      }
    }, 30_000);

    // Get the transcription engine from the app context (if registered as a decorator)
    const transcriptionEngine: TranscriptionEngineAdapter | undefined =
      (app as unknown as Record<string, unknown>).transcriptionEngine as TranscriptionEngineAdapter | undefined;

    const coachingEngine: CoachingEngineAdapter | undefined =
      (app as unknown as Record<string, unknown>).coachingEngine as CoachingEngineAdapter | undefined;

    // Register segment listener for this connection
    const segmentHandler = (segment: TranscriptSegment) => {
      if (segment.sessionId === state.activeSessionId) {
        sendMessage(socket, {
          type: 'transcript_segment',
          payload: segment,
          timestamp: Date.now(),
        });
      }
    };

    // Register coaching event listener for this connection
    const coachingHandler = (event: CoachingEvent) => {
      if (state.activeSessionId) {
        sendMessage(socket, {
          type: 'coaching_event',
          payload: event,
          timestamp: Date.now(),
        });
      }
    };

    if (transcriptionEngine) {
      transcriptionEngine.onSegment(segmentHandler);
    }

    if (coachingEngine) {
      coachingEngine.onCoachingEvent(coachingHandler);
    }

    socket.on('message', async (data: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const raw = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data);
        const message: WsMessage = JSON.parse(raw);

        // First message must be auth
        if (!state.authenticated) {
          if (message.type === 'auth') {
            handleAuth(app, socket, message, state);
          } else {
            sendMessage(socket, {
              type: 'error',
              payload: { code: 'AUTH_REQUIRED', message: 'First message must be auth' },
              timestamp: Date.now(),
            });
            socket.close(4000, 'Authentication required');
          }
          return;
        }

        // Handle authenticated messages
        switch (message.type) {
          case 'session_start':
            await handleSessionStart(socket, message, state, transcriptionEngine);
            break;

          case 'audio_chunk':
            await handleAudioChunk(socket, message, state, transcriptionEngine);
            break;

          case 'session_end':
            await handleSessionEnd(socket, state, transcriptionEngine);
            break;

          case 'pong':
            // Client responded to our ping — connection is alive
            break;

          default:
            sendMessage(socket, {
              type: 'error',
              payload: { code: 'UNKNOWN_TYPE', message: `Unknown message type: ${message.type}` },
              timestamp: Date.now(),
            });
        }
      } catch {
        sendMessage(socket, {
          type: 'error',
          payload: { code: 'PARSE_ERROR', message: 'Invalid JSON message' },
          timestamp: Date.now(),
        });
      }
    });

    socket.on('close', async () => {
      clearInterval(pingInterval);

      // Clean up active session if connection drops
      if (state.activeSessionId && transcriptionEngine) {
        try {
          await transcriptionEngine.endSession(state.activeSessionId);
        } catch {
          // Best-effort cleanup on disconnect
        }
      }

      if (state.userPayload) {
        request.log.info?.({ userId: state.userPayload.sub }, 'WebSocket connection closed');
      }
    });

    socket.on('error', (err) => {
      request.log.error?.({ err }, 'WebSocket error');
      clearInterval(pingInterval);
    });
  });
}

// ─── Message Handlers ─────────────────────────────────────────────────────────

function handleAuth(
  app: FastifyInstance,
  socket: WebSocket,
  message: WsMessage,
  state: ConnectionState,
): void {
  try {
    const token = message.payload as string;
    const decoded = app.jwt.verify<JwtPayload>(token);
    state.authenticated = true;
    state.userPayload = decoded;

    sendMessage(socket, {
      type: 'auth',
      payload: { success: true, userId: decoded.sub, role: decoded.role },
      timestamp: Date.now(),
    });
  } catch {
    sendMessage(socket, {
      type: 'error',
      payload: { code: 'AUTH_FAILED', message: 'Invalid token' },
      timestamp: Date.now(),
    });
    socket.close(4001, 'Authentication failed');
  }
}

async function handleSessionStart(
  socket: WebSocket,
  message: WsMessage,
  state: ConnectionState,
  transcriptionEngine?: TranscriptionEngineAdapter,
): Promise<void> {
  const payload = message.payload as SessionStartPayload;

  if (!payload?.sessionId) {
    sendMessage(socket, {
      type: 'error',
      payload: { code: 'INVALID_PAYLOAD', message: 'sessionId is required for session_start' },
      timestamp: Date.now(),
    });
    return;
  }

  state.activeSessionId = payload.sessionId;
  state.lastSequenceNumber = -1;

  if (transcriptionEngine) {
    try {
      await transcriptionEngine.startSession(payload.sessionId, {
        language: payload.language ?? 'en',
        enableDiarization: payload.enableDiarization ?? true,
        maxSpeakers: payload.maxSpeakers ?? 4,
      });
    } catch (err) {
      sendMessage(socket, {
        type: 'error',
        payload: {
          code: 'SESSION_START_FAILED',
          message: err instanceof Error ? err.message : 'Failed to start transcription session',
        },
        timestamp: Date.now(),
      });
      return;
    }
  }

  sendMessage(socket, {
    type: 'session_start',
    payload: { sessionId: payload.sessionId, status: 'started' },
    timestamp: Date.now(),
  });
}

async function handleAudioChunk(
  socket: WebSocket,
  message: WsMessage,
  state: ConnectionState,
  transcriptionEngine?: TranscriptionEngineAdapter,
): Promise<void> {
  const payload = message.payload as AudioChunkPayload;

  if (!state.activeSessionId) {
    sendMessage(socket, {
      type: 'error',
      payload: { code: 'NO_SESSION', message: 'No active session. Send session_start first.' },
      timestamp: Date.now(),
    });
    return;
  }

  if (!payload?.data) {
    sendMessage(socket, {
      type: 'error',
      payload: { code: 'INVALID_PAYLOAD', message: 'Audio chunk data is required' },
      timestamp: Date.now(),
    });
    return;
  }

  // Detect duplicate/out-of-order chunks via sequence number
  if (payload.sequenceNumber !== undefined && payload.sequenceNumber <= state.lastSequenceNumber) {
    // Skip duplicate chunk (can happen during buffer replay after reconnection)
    return;
  }

  if (payload.sequenceNumber !== undefined) {
    state.lastSequenceNumber = payload.sequenceNumber;
  }

  if (transcriptionEngine) {
    try {
      // Decode base64 audio data
      const audioBuffer = Buffer.from(payload.data, 'base64');
      const chunk: AudioChunk = {
        data: audioBuffer.buffer.slice(
          audioBuffer.byteOffset,
          audioBuffer.byteOffset + audioBuffer.byteLength,
        ),
        timestamp: payload.timestamp ?? Date.now(),
        sampleRate: payload.sampleRate ?? 16000,
        channels: payload.channels ?? 1,
      };

      await transcriptionEngine.processAudioChunk(state.activeSessionId, chunk);
    } catch (err) {
      sendMessage(socket, {
        type: 'error',
        payload: {
          code: 'AUDIO_PROCESSING_FAILED',
          message: err instanceof Error ? err.message : 'Failed to process audio chunk',
        },
        timestamp: Date.now(),
      });
    }
  } else {
    // No transcription engine available — acknowledge receipt
    sendMessage(socket, {
      type: 'transcript_segment',
      payload: {
        sessionId: state.activeSessionId,
        status: 'received',
        sequenceNumber: payload.sequenceNumber,
      },
      timestamp: Date.now(),
    });
  }
}

async function handleSessionEnd(
  socket: WebSocket,
  state: ConnectionState,
  transcriptionEngine?: TranscriptionEngineAdapter,
): Promise<void> {
  if (!state.activeSessionId) {
    sendMessage(socket, {
      type: 'error',
      payload: { code: 'NO_SESSION', message: 'No active session to end.' },
      timestamp: Date.now(),
    });
    return;
  }

  const sessionId = state.activeSessionId;

  if (transcriptionEngine) {
    try {
      await transcriptionEngine.endSession(sessionId);
    } catch (err) {
      sendMessage(socket, {
        type: 'error',
        payload: {
          code: 'SESSION_END_FAILED',
          message: err instanceof Error ? err.message : 'Failed to end session',
        },
        timestamp: Date.now(),
      });
      return;
    }
  }

  state.activeSessionId = null;
  state.lastSequenceNumber = -1;

  sendMessage(socket, {
    type: 'session_end',
    payload: { sessionId, status: 'ended' },
    timestamp: Date.now(),
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sendMessage(socket: WebSocket, message: WsMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}
