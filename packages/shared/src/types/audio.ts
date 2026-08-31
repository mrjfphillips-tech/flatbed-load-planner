// ─── Audio and Transcription Types ────────────────────────────────────────────
// Requirements: 7.1, 7.2, 7.3

/**
 * Speaker labels for diarized transcripts.
 * 'rep' is the sales rep; customer_N identifies distinct customer speakers.
 */
export type SpeakerLabel = 'rep' | `customer_${number}`;

/**
 * States of the audio capture service.
 */
export type AudioCaptureState = 'idle' | 'capturing' | 'paused' | 'error';

/**
 * A chunk of audio data captured from the microphone.
 */
export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  sampleRate: number;
  channels: number;
}

/**
 * A single diarized transcript segment with speaker label and timing.
 */
export interface TranscriptSegment {
  id: string;
  sessionId: string;
  speaker: SpeakerLabel;
  text: string;
  startTimeMs: number;
  endTimeMs: number;
  confidence: number;
  source: TranscriptSource;
  createdAt: Date;
}

/**
 * Transcript segment source type.
 */
export type TranscriptSource = 'audio' | 'ocr';

/**
 * Configuration for starting a transcription session.
 */
export interface TranscriptionConfig {
  sessionId: string;
  repId: string;
  voiceProfileId?: string;
  language: 'en';
  enableDiarization: boolean;
  maxSpeakers: number;
}

/**
 * Handle returned after starting a transcription session.
 */
export interface SessionHandle {
  sessionId: string;
  startedAt: Date;
}

/**
 * The complete finalized transcript for a session.
 */
export interface FinalTranscript {
  sessionId: string;
  segments: TranscriptSegment[];
  durationMs: number;
  speakerCount: number;
}

/**
 * A registered voice signature for a Rep used to improve Speaker Diarization accuracy.
 */
export interface VoiceProfile {
  id: string;
  repId: string;
  sampleAudioUrl?: string;
  createdAt: Date;
}
