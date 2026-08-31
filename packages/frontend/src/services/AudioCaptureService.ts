// @ts-nocheck
/**
 * AudioCaptureService
 *
 * Manages microphone access, audio capture with chunking, silence detection,
 * and pause/resume functionality using the Web Audio API and MediaRecorder API.
 *
 * Requirements: 1.1, 1.2, 1.4, 1.5
 */

import type { AudioChunk, AudioCaptureService as IAudioCaptureService } from '@ptv-discovery-coach/shared';

// ─── Error Types ──────────────────────────────────────────────────────────────

export type AudioCaptureError =
  | { kind: 'permission_denied'; message: string; instructions: string }
  | { kind: 'not_found'; message: string }
  | { kind: 'unknown'; message: string };

// ─── Configuration ────────────────────────────────────────────────────────────

export interface AudioCaptureServiceOptions {
  /** Timeslice for MediaRecorder chunks in milliseconds. Default: 100 */
  chunkTimesliceMs?: number;
  /** RMS threshold below which audio is considered silent (0–1). Default: 0.01 */
  silenceThreshold?: number;
  /** Milliseconds of continuous silence before signal loss is reported. Default: 5000 */
  signalLossTimeoutMs?: number;
  /** Sample rate for audio capture. Default: 16000 */
  sampleRate?: number;
}

// ─── State Type ───────────────────────────────────────────────────────────────

type CaptureState = 'idle' | 'capturing' | 'paused';

// ─── Implementation ───────────────────────────────────────────────────────────

export class AudioCaptureService implements IAudioCaptureService {
  // Configuration
  private readonly chunkTimesliceMs: number;
  private readonly silenceThreshold: number;
  private readonly signalLossTimeoutMs: number;
  private readonly sampleRate: number;

  // State
  private state: CaptureState = 'idle';
  private sessionId: string = '';

  // Media handles
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  // Silence detection
  private silenceCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastAudioSignalAt: number = 0;
  private isSignalLost: boolean = false;

  // Callbacks
  private audioChunkCallback: ((chunk: AudioChunk) => void) | null = null;
  private signalLossCallback: ((durationMs: number) => void) | null = null;

  constructor(options: AudioCaptureServiceOptions = {}) {
    this.chunkTimesliceMs = options.chunkTimesliceMs ?? 100;
    this.silenceThreshold = options.silenceThreshold ?? 0.01;
    this.signalLossTimeoutMs = options.signalLossTimeoutMs ?? 5000;
    this.sampleRate = options.sampleRate ?? 16000;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Request microphone access using the browser's Web Audio API.
   * Returns true if access is granted, throws with actionable error on denial.
   *
   * Requirement 1.1 — request microphone via browser's native Web Audio API
   * Requirement 1.4 — display actionable error on denial
   */
  async requestMicrophoneAccess(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Store stream for later use; release tracks if only checking access
      this.mediaStream = stream;
      return true;
    } catch (err) {
      const error = this.mapGetUserMediaError(err);
      throw error;
    }
  }

  /**
   * Start capturing audio, emitting chunks at the configured interval (100ms).
   *
   * Requirement 1.2 — begin converting audio within 3 seconds
   */
  async startCapture(sessionId: string): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error('AudioCaptureService: capture already in progress. Call stopCapture() first.');
    }

    this.sessionId = sessionId;

    // Ensure we have a media stream (request if not already obtained)
    if (!this.mediaStream) {
      await this.requestMicrophoneAccess();
    }

    if (!this.mediaStream) {
      throw new Error('AudioCaptureService: no media stream available.');
    }

    // Set up audio analysis for silence detection
    this.setupAudioAnalysis(this.mediaStream);

    // Set up MediaRecorder for audio chunking
    this.setupMediaRecorder(this.mediaStream);

    // Start recording with specified timeslice
    this.mediaRecorder!.start(this.chunkTimesliceMs);

    // Initialize silence detection
    this.lastAudioSignalAt = Date.now();
    this.isSignalLost = false;
    this.startSilenceDetection();

    this.state = 'capturing';
  }

  /**
   * Pause audio capture without releasing the microphone.
   */
  pauseCapture(): void {
    if (this.state !== 'capturing') {
      return;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }

    this.stopSilenceDetection();
    this.state = 'paused';
  }

  /**
   * Resume previously paused capture.
   */
  resumeCapture(): void {
    if (this.state !== 'paused') {
      return;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }

    // Reset silence detection from now
    this.lastAudioSignalAt = Date.now();
    this.isSignalLost = false;
    this.startSilenceDetection();

    this.state = 'capturing';
  }

  /**
   * Stop capturing and release the microphone.
   */
  async stopCapture(): Promise<void> {
    this.stopSilenceDetection();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Disconnect audio analysis nodes
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Release microphone tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.mediaRecorder = null;
    this.state = 'idle';
    this.sessionId = '';
  }

  /**
   * Register a callback for audio chunks emitted during capture.
   */
  onAudioChunk(callback: (chunk: AudioChunk) => void): void {
    this.audioChunkCallback = callback;
  }

  /**
   * Register a callback for audio signal loss detection.
   * Called when silence exceeds the configured threshold (default 5s).
   *
   * Requirement 1.5 — display warning when audio signal lost >5 seconds
   */
  onSignalLoss(callback: (durationMs: number) => void): void {
    this.signalLossCallback = callback;
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  /** Current capture state */
  get captureState(): CaptureState {
    return this.state;
  }

  /** Whether audio signal is currently lost */
  get hasSignalLoss(): boolean {
    return this.isSignalLost;
  }

  // ─── Private: Audio Analysis Setup ──────────────────────────────────────────

  private setupAudioAnalysis(stream: MediaStream): void {
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.3;

    this.sourceNode.connect(this.analyserNode);
  }

  // ─── Private: MediaRecorder Setup ──────────────────────────────────────────

  private setupMediaRecorder(stream: MediaStream): void {
    const mimeType = AudioCaptureService.preferredMimeType();
    this.mediaRecorder = new MediaRecorder(stream, { mimeType });

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0 && this.audioChunkCallback) {
        // Convert Blob to ArrayBuffer and emit as AudioChunk
        const dataBlob = event.data;
        dataBlob.arrayBuffer().then((buffer) => {
          const chunk: AudioChunk = {
            data: buffer,
            timestamp: Date.now(),
            sampleRate: this.sampleRate,
            channels: 1,
          };
          this.audioChunkCallback!(chunk);
        });
      }
    };
  }

  // ─── Private: Silence Detection ─────────────────────────────────────────────

  private startSilenceDetection(): void {
    this.stopSilenceDetection();

    // Check audio levels every 250ms
    this.silenceCheckInterval = setInterval(() => {
      this.checkAudioLevel();
    }, 250);
  }

  private stopSilenceDetection(): void {
    if (this.silenceCheckInterval !== null) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }
  }

  private checkAudioLevel(): void {
    if (!this.analyserNode) return;

    const bufferLength = this.analyserNode.fftSize;
    const dataArray = new Float32Array(bufferLength);
    this.analyserNode.getFloatTimeDomainData(dataArray);

    const rms = this.computeRms(dataArray);

    if (rms > this.silenceThreshold) {
      // Audio signal detected
      this.lastAudioSignalAt = Date.now();

      if (this.isSignalLost) {
        // Signal restored
        this.isSignalLost = false;
      }
    } else {
      // Check if silence duration exceeds threshold
      const silenceDuration = Date.now() - this.lastAudioSignalAt;

      if (silenceDuration >= this.signalLossTimeoutMs && !this.isSignalLost) {
        this.isSignalLost = true;
        this.signalLossCallback?.(silenceDuration);
      } else if (this.isSignalLost) {
        // Continue reporting ongoing signal loss duration
        this.signalLossCallback?.(silenceDuration);
      }
    }
  }

  private computeRms(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  // ─── Private: Error Mapping ─────────────────────────────────────────────────

  private mapGetUserMediaError(err: unknown): AudioCaptureError {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return {
          kind: 'permission_denied',
          message: 'Microphone access was denied by the browser.',
          instructions:
            'To enable the microphone:\n' +
            '1. Click the lock/info icon in your browser address bar\n' +
            '2. Find "Microphone" in the permissions list\n' +
            '3. Change the setting to "Allow"\n' +
            '4. Reload the page and try again\n\n' +
            'Alternatively, go to your browser Settings > Privacy & Security > Site Settings > Microphone ' +
            'and add this site to the "Allow" list.',
        };
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        return {
          kind: 'not_found',
          message:
            'No microphone was found on this device. Please connect a microphone and try again.',
        };
      }
    }
    return {
      kind: 'unknown',
      message:
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while accessing the microphone.',
    };
  }

  // ─── Static Utilities ───────────────────────────────────────────────────────

  /** Detect the best supported MIME type for MediaRecorder */
  static preferredMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }
}
