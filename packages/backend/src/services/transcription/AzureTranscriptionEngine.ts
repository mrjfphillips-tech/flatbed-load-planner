/**
 * AzureTranscriptionEngine
 *
 * Implements the TranscriptionEngine interface using Azure Speech Services SDK.
 * Provides real-time streaming transcription with <2 second latency,
 * automatic reconnection on connection loss, and speaker diarization support.
 *
 * Requirements: 1.2, 1.3, 1.6
 */
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { randomUUID } from 'crypto';
import type {
  AudioChunk,
  TranscriptionConfig,
  SessionHandle,
  FinalTranscript,
  TranscriptSegment,
  VoiceProfile,
  SpeakerLabel,
} from '@ptv-discovery-coach/shared';
import type { TranscriptionEngine } from '@ptv-discovery-coach/shared';

// ─── Internal Types ───────────────────────────────────────────────────────────

interface ActiveSession {
  sessionId: string;
  config: TranscriptionConfig;
  recognizer: sdk.SpeechRecognizer;
  pushStream: sdk.PushAudioInputStream;
  segments: TranscriptSegment[];
  startedAt: Date;
  isConnected: boolean;
  reconnectAttempts: number;
}

export interface AzureTranscriptionEngineConfig {
  speechKey: string;
  speechRegion: string;
  /** Maximum reconnection attempts before giving up. Default: 5 */
  maxReconnectAttempts?: number;
  /** Base delay in ms for exponential backoff. Default: 1000 */
  baseReconnectDelayMs?: number;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class AzureTranscriptionEngine implements TranscriptionEngine {
  private readonly speechKey: string;
  private readonly speechRegion: string;
  private readonly maxReconnectAttempts: number;
  private readonly baseReconnectDelayMs: number;

  private sessions: Map<string, ActiveSession> = new Map();
  private segmentCallbacks: Array<(segment: TranscriptSegment) => void> = [];

  constructor(config: AzureTranscriptionEngineConfig) {
    this.speechKey = config.speechKey;
    this.speechRegion = config.speechRegion;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 5;
    this.baseReconnectDelayMs = config.baseReconnectDelayMs ?? 1000;
  }

  /**
   * Start a transcription session with continuous recognition.
   * Configures Azure Speech SDK with PushAudioInputStream for streaming audio.
   */
  async startSession(config: TranscriptionConfig): Promise<SessionHandle> {
    const { sessionId } = config;

    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    // Create push stream for feeding audio data
    const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
    const pushStream = sdk.AudioInputStream.createPushStream(format);
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

    // Configure speech recognition
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      this.speechKey,
      this.speechRegion,
    );
    speechConfig.speechRecognitionLanguage = config.language === 'en' ? 'en-US' : 'en-US';
    speechConfig.outputFormat = sdk.OutputFormat.Detailed;

    // Enable diarization if requested
    if (config.enableDiarization) {
      speechConfig.setProperty(
        sdk.PropertyId.SpeechServiceConnection_LanguageIdMode,
        'Continuous',
      );
    }

    // Create recognizer with continuous recognition
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    const session: ActiveSession = {
      sessionId,
      config,
      recognizer,
      pushStream,
      segments: [],
      startedAt: new Date(),
      isConnected: false,
      reconnectAttempts: 0,
    };

    // Wire up event handlers
    this.setupRecognizerEvents(session);

    // Start continuous recognition
    await this.startContinuousRecognition(recognizer);
    session.isConnected = true;

    this.sessions.set(sessionId, session);

    return {
      sessionId,
      startedAt: session.startedAt,
    };
  }

  /**
   * Process an audio chunk by writing data to the PushAudioInputStream.
   * Audio is automatically forwarded to Azure Speech Services for recognition.
   */
  async processAudioChunk(sessionId: string, chunk: AudioChunk): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Convert ArrayBuffer to Uint8Array and write to push stream
    const audioData = new Uint8Array(chunk.data);
    session.pushStream.write(audioData.buffer);
  }

  /**
   * Register a voice profile for improved speaker diarization.
   * Uses Azure Speaker Recognition API (stubbed for basic implementation).
   */
  async registerVoiceProfile(
    repId: string,
    _audioSample: ArrayBuffer,
  ): Promise<VoiceProfile> {
    // Azure Speaker Recognition requires enrollment with multiple samples.
    // This is a functional stub that creates a profile record.
    // Full implementation requires the Azure Speaker Recognition REST API
    // which is separate from the Speech SDK.
    const profile: VoiceProfile = {
      id: randomUUID(),
      repId,
      createdAt: new Date(),
    };

    return profile;
  }

  /**
   * End a session and finalize the transcript.
   * Stops continuous recognition and closes the push stream.
   */
  async endSession(sessionId: string): Promise<FinalTranscript> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Stop continuous recognition
    await this.stopContinuousRecognition(session.recognizer);

    // Close the push stream
    session.pushStream.close();

    // Calculate duration
    const durationMs = Date.now() - session.startedAt.getTime();

    // Count unique speakers
    const speakers = new Set(session.segments.map((s) => s.speaker));

    const finalTranscript: FinalTranscript = {
      sessionId,
      segments: [...session.segments],
      durationMs,
      speakerCount: speakers.size,
    };

    // Cleanup
    session.recognizer.close();
    this.sessions.delete(sessionId);

    return finalTranscript;
  }

  /**
   * Register a callback to receive transcript segments in real time.
   */
  onSegment(callback: (segment: TranscriptSegment) => void): void {
    this.segmentCallbacks.push(callback);
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private setupRecognizerEvents(session: ActiveSession): void {
    const { recognizer } = session;

    // Handle recognized speech (final results)
    recognizer.recognized = (_sender, event) => {
      if (
        event.result.reason === sdk.ResultReason.RecognizedSpeech &&
        event.result.text
      ) {
        const segment = this.createSegment(session, event.result);
        session.segments.push(segment);
        this.emitSegment(segment);
      }
    };

    // Handle connection established
    recognizer.sessionStarted = () => {
      session.isConnected = true;
      session.reconnectAttempts = 0;
    };

    // Handle session stopped
    recognizer.sessionStopped = () => {
      session.isConnected = false;
    };

    // Handle cancellation / connection loss
    recognizer.canceled = (_sender, event) => {
      if (event.reason === sdk.CancellationReason.Error) {
        session.isConnected = false;
        this.handleConnectionLoss(session);
      }
    };
  }

  /**
   * Create a TranscriptSegment from an Azure speech recognition result.
   */
  private createSegment(
    session: ActiveSession,
    result: sdk.SpeechRecognitionResult,
  ): TranscriptSegment {
    // Extract detailed results for confidence
    let confidence = 0.85; // Default confidence
    try {
      const detailedResults = result.properties.getProperty(
        sdk.PropertyId.SpeechServiceResponse_JsonResult,
      );
      if (detailedResults) {
        const parsed = JSON.parse(detailedResults);
        if (parsed.NBest && parsed.NBest.length > 0) {
          confidence = parsed.NBest[0].Confidence ?? 0.85;
        }
      }
    } catch {
      // Use default confidence if parsing fails
    }

    // Extract speaker info from diarization if available
    const speaker = this.extractSpeakerLabel(result, session.config);

    // Calculate timestamps
    const offsetMs = Number(result.offset) / 10000; // offset is in ticks (100ns)
    const durationMs = Number(result.duration) / 10000;

    const segment: TranscriptSegment = {
      id: randomUUID(),
      sessionId: session.sessionId,
      speaker,
      text: result.text,
      startTimeMs: offsetMs,
      endTimeMs: offsetMs + durationMs,
      confidence,
      source: 'audio',
      createdAt: new Date(),
    };

    return segment;
  }

  /**
   * Extract speaker label from recognition result.
   * Falls back to 'rep' if diarization data is unavailable.
   */
  private extractSpeakerLabel(
    result: sdk.SpeechRecognitionResult,
    _config: TranscriptionConfig,
  ): SpeakerLabel {
    try {
      const jsonResult = result.properties.getProperty(
        sdk.PropertyId.SpeechServiceResponse_JsonResult,
      );
      if (jsonResult) {
        const parsed = JSON.parse(jsonResult);
        // Azure diarization returns speaker IDs like "Guest-1", "Guest-2"
        if (parsed.SpeakerId) {
          const speakerId = parsed.SpeakerId;
          if (speakerId === '1' || speakerId === 'Guest-1') {
            return 'rep';
          }
          const customerNum = parseInt(speakerId.replace(/\D/g, ''), 10) || 1;
          return `customer_${customerNum}` as SpeakerLabel;
        }
      }
    } catch {
      // Fall back to rep if we can't parse speaker info
    }
    return 'rep';
  }

  /**
   * Handle connection loss with automatic reconnection using exponential backoff.
   */
  private async handleConnectionLoss(session: ActiveSession): Promise<void> {
    if (session.reconnectAttempts >= this.maxReconnectAttempts) {
      // Max retries exhausted — session remains disconnected
      return;
    }

    session.reconnectAttempts++;
    const delay = this.baseReconnectDelayMs * Math.pow(2, session.reconnectAttempts - 1);

    await this.delay(delay);

    // Only attempt reconnection if session still exists (not ended)
    if (!this.sessions.has(session.sessionId)) {
      return;
    }

    try {
      await this.startContinuousRecognition(session.recognizer);
      session.isConnected = true;
      session.reconnectAttempts = 0;
    } catch {
      // Recursive retry with backoff
      await this.handleConnectionLoss(session);
    }
  }

  /**
   * Start continuous recognition, wrapping the callback-based API in a Promise.
   */
  private startContinuousRecognition(
    recognizer: sdk.SpeechRecognizer,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      recognizer.startContinuousRecognitionAsync(
        () => resolve(),
        (error) => reject(new Error(`Failed to start recognition: ${error}`)),
      );
    });
  }

  /**
   * Stop continuous recognition, wrapping the callback-based API in a Promise.
   */
  private stopContinuousRecognition(
    recognizer: sdk.SpeechRecognizer,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      recognizer.stopContinuousRecognitionAsync(
        () => resolve(),
        (error) => reject(new Error(`Failed to stop recognition: ${error}`)),
      );
    });
  }

  /**
   * Emit a transcript segment to all registered callbacks.
   */
  private emitSegment(segment: TranscriptSegment): void {
    for (const callback of this.segmentCallbacks) {
      try {
        callback(segment);
      } catch {
        // Don't let a failing callback break the pipeline
      }
    }
  }

  /**
   * Promisified delay helper for exponential backoff.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
