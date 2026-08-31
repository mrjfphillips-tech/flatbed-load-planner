// @ts-nocheck
/**
 * DeepgramTranscriptionService
 *
 * Handles real-time speech-to-text transcription using Deepgram's streaming API.
 * Provides speaker diarization (who is speaking) and transportation industry
 * vocabulary boost for better accuracy.
 *
 * Architecture:
 * - Frontend captures audio via MediaRecorder API
 * - Audio chunks are sent to backend via WebSocket
 * - Backend streams audio to Deepgram
 * - Deepgram returns transcription with speaker labels
 * - Backend stores transcript segments and notifies the intelligence layer
 *
 * PDIF V1 Task 1.3
 */

import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { LiveClient } from '@deepgram/sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranscriptSegment {
  text: string;
  speaker: 'rep' | 'customer' | 'unknown';
  startMs: number;
  endMs: number;
  confidence: number;
  isFinal: boolean;
}

export interface TranscriptionSessionConfig {
  sessionId: string;
  language?: string;           // Default: 'en'
  enableDiarization?: boolean; // Default: true
  sampleRate?: number;         // Default: 16000
}

export type OnSegmentCallback = (segment: TranscriptSegment) => void;
export type OnErrorCallback = (error: Error) => void;

// ─── Transportation Industry Keywords (improves transcription accuracy) ───────

const TRANSPORTATION_KEYWORDS = [
  // General
  'logistics', 'transportation', 'freight', 'shipment', 'carrier',
  // Operations
  'dispatch', 'routing', 'deadhead', 'backhaul', 'cross-dock', 'drayage',
  'linehaul', 'last mile', 'first mile', 'middle mile',
  // Fleet
  'tractor', 'trailer', 'straight truck', 'bobtail', 'reefer', 'flatbed',
  'tanker', 'intermodal', 'chassis',
  // Load types
  'LTL', 'TL', 'FTL', 'truckload', 'less-than-truckload', 'parcel',
  'palletized', 'floor-loaded',
  // Metrics
  'cost per mile', 'cost per stop', 'on-time delivery', 'OTD',
  'utilization', 'dwell time', 'detention', 'demurrage',
  'hours of service', 'HOS', 'ELD',
  // Technology
  'TMS', 'WMS', 'ERP', 'telematics', 'GPS', 'EDI', 'API',
  'route optimization', 'load planning', 'visibility platform',
  // Companies/Products
  'PTV', 'Blue Yonder', 'Manhattan', 'Oracle TMS', 'Descartes',
  'MercuryGate', 'SAP', 'Samsara', 'Geotab', 'Omnitracs',
  'project44', 'FourKites', 'Transporeon',
  // Financial
  'fuel surcharge', 'accessorial', 'detention charge', 'lumper fee',
  'deadhead miles', 'empty miles', 'revenue per truck',
];

// ─── Service ──────────────────────────────────────────────────────────────────

export class DeepgramTranscriptionService {
  private deepgramClient;
  private liveConnection: LiveClient | null = null;
  private onSegment: OnSegmentCallback | null = null;
  private onError: OnErrorCallback | null = null;
  private sessionStartTime: number = 0;
  private isActive: boolean = false;

  constructor() {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY environment variable is required');
    }
    this.deepgramClient = createClient(apiKey);
  }

  /**
   * Start a new transcription session.
   * Call this when a rep begins a live coaching session.
   */
  async startSession(
    config: TranscriptionSessionConfig,
    onSegment: OnSegmentCallback,
    onError?: OnErrorCallback
  ): Promise<void> {
    if (this.isActive) {
      throw new Error('Transcription session already active. End current session first.');
    }

    this.onSegment = onSegment;
    this.onError = onError || ((err) => console.error('[Deepgram] Error:', err.message));
    this.sessionStartTime = Date.now();
    this.isActive = true;

    try {
      // Open live transcription connection to Deepgram
      this.liveConnection = this.deepgramClient.listen.live({
        model: 'nova-2',                    // Deepgram's best model
        language: config.language || 'en',
        smart_format: true,                 // Punctuation, capitalization
        diarize: config.enableDiarization !== false, // Speaker identification
        punctuate: true,
        interim_results: true,              // Get partial results for responsiveness
        utterance_end_ms: 1500,             // Detect end of utterance after 1.5s silence
        vad_events: true,                   // Voice activity detection
        sample_rate: config.sampleRate || 16000,
        encoding: 'linear16',
        channels: 1,
        // Transportation-specific keyword boosting
        keywords: TRANSPORTATION_KEYWORDS.slice(0, 100).map(kw => `${kw}:2`), // Boost weight of 2
      });

      // Handle transcription results
      this.liveConnection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        this.handleTranscriptResult(data);
      });

      // Handle errors
      this.liveConnection.on(LiveTranscriptionEvents.Error, (err: any) => {
        console.error('[Deepgram] Connection error:', err);
        this.onError?.(new Error(err.message || 'Deepgram connection error'));
      });

      // Handle connection close
      this.liveConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log('[Deepgram] Connection closed');
        this.isActive = false;
      });

      // Handle connection open
      this.liveConnection.on(LiveTranscriptionEvents.Open, () => {
        console.log('[Deepgram] Connection opened — ready for audio');
      });

    } catch (err) {
      this.isActive = false;
      throw new Error(`Failed to start Deepgram session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Send audio data to Deepgram for transcription.
   * Call this continuously as audio chunks arrive from the frontend.
   *
   * @param audioData - Raw audio bytes (PCM 16-bit, mono, 16kHz)
   */
  sendAudio(audioData: Buffer): void {
    if (!this.isActive || !this.liveConnection) {
      return; // Silently ignore if session not active
    }

    try {
      this.liveConnection.send(audioData);
    } catch (err) {
      console.error('[Deepgram] Failed to send audio:', err);
    }
  }

  /**
   * End the current transcription session.
   * Call this when the rep ends the coaching session.
   */
  async endSession(): Promise<void> {
    if (!this.isActive || !this.liveConnection) {
      return;
    }

    try {
      this.liveConnection.requestClose();
    } catch (err) {
      console.error('[Deepgram] Error closing connection:', err);
    }

    this.liveConnection = null;
    this.isActive = false;
    this.onSegment = null;
    this.onError = null;
  }

  /**
   * Check if a transcription session is currently active.
   */
  get active(): boolean {
    return this.isActive;
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  /**
   * Process transcription results from Deepgram and emit normalized segments.
   */
  private handleTranscriptResult(data: any): void {
    if (!data?.channel?.alternatives?.[0]) return;

    const alternative = data.channel.alternatives[0];
    const transcript = alternative.transcript;

    // Skip empty results
    if (!transcript || transcript.trim().length === 0) return;

    const isFinal = data.is_final === true;
    const startMs = Math.round((data.start || 0) * 1000);
    const endMs = Math.round((data.duration || 0) * 1000) + startMs;
    const confidence = alternative.confidence || 0.9;

    // Determine speaker from diarization
    let speaker: 'rep' | 'customer' | 'unknown' = 'unknown';
    if (alternative.words && alternative.words.length > 0) {
      // Deepgram assigns speaker IDs (0, 1, etc.)
      // Convention: Speaker 0 = rep (they start talking first usually), Speaker 1+ = customer
      const speakerId = alternative.words[0].speaker;
      if (speakerId === 0) {
        speaker = 'rep';
      } else if (speakerId !== undefined) {
        speaker = 'customer';
      }
    }

    const segment: TranscriptSegment = {
      text: transcript.trim(),
      speaker,
      startMs,
      endMs,
      confidence,
      isFinal,
    };

    // Only emit final results to the intelligence layer
    // (interim results shown in UI for responsiveness but not stored)
    this.onSegment?.(segment);
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────────────

let _instance: DeepgramTranscriptionService | null = null;

export function getTranscriptionService(): DeepgramTranscriptionService {
  if (!_instance) {
    _instance = new DeepgramTranscriptionService();
  }
  return _instance;
}
