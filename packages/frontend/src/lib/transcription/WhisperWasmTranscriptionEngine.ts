// @ts-nocheck
/**
 * WhisperWasmTranscriptionEngine
 *
 * Implements the TranscriptionEngine interface using Whisper.cpp compiled to
 * WebAssembly for fully on-device, offline-capable transcription.
 *
 * Audio chunks are accumulated in a buffer and inference runs periodically
 * (every ~2-3 seconds of audio) to produce TranscriptSegment results.
 *
 * The WASM model binary is cached via the Service Worker for fast subsequent loads.
 *
 * Requirements: 24.1, 24.3
 */

import type {
  TranscriptionEngine,
} from '@ptv-discovery-coach/shared'
import type {
  TranscriptionConfig,
  SessionHandle,
  AudioChunk,
  FinalTranscript,
  TranscriptSegment,
  VoiceProfile,
} from '@ptv-discovery-coach/shared'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default URL from which to fetch the Whisper WASM binary */
const DEFAULT_WASM_URL = '/wasm/whisper.wasm'

/** Default URL from which to fetch the Whisper model weights */
const DEFAULT_MODEL_URL = '/models/ggml-base.en.bin'

/** Service Worker cache name for WASM and model assets */
const WASM_CACHE_NAME = 'whisper-wasm-v1'

/** Inference runs after accumulating this many seconds of audio */
const INFERENCE_INTERVAL_SECONDS = 2.5

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhisperWasmOptions {
  /** URL of the Whisper WASM binary. Default: /wasm/whisper.wasm */
  wasmUrl?: string
  /** URL of the Whisper model file. Default: /models/ggml-base.en.bin */
  modelUrl?: string
  /** Seconds of audio to accumulate before running inference. Default: 2.5 */
  inferenceIntervalSeconds?: number
  /** Sample rate expected by the engine. Default: 16000 */
  sampleRate?: number
}

export type WhisperWasmError =
  | { kind: 'wasm_load_failed'; message: string }
  | { kind: 'model_load_failed'; message: string }
  | { kind: 'inference_failed'; message: string }
  | { kind: 'not_initialized'; message: string }

// ─── WASM Context Stub ────────────────────────────────────────────────────────

/**
 * Represents the Whisper.cpp WASM module context.
 * In production this would be the actual WASM module instance;
 * for now this is a typed placeholder to enable the integration code.
 */
interface WhisperWasmContext {
  /** Initialize the model from an ArrayBuffer of model weights */
  loadModel(modelBuffer: ArrayBuffer): Promise<void>
  /** Run inference on a Float32Array of PCM audio samples (16kHz mono) */
  transcribe(pcm: Float32Array): Promise<{ text: string; confidence: number }>
  /** Free WASM memory and context */
  dispose(): void
}

// ─── Engine Implementation ────────────────────────────────────────────────────

export class WhisperWasmTranscriptionEngine implements TranscriptionEngine {
  // ─── Callbacks ────────────────────────────────────────────────────────────

  private _segmentCallback: ((segment: TranscriptSegment) => void) | null = null
  private _errorCallback: ((error: WhisperWasmError) => void) | null = null

  // ─── State ────────────────────────────────────────────────────────────────

  private _initialized = false
  private _sessionId: string | null = null
  private _sessionStartedAt: Date | null = null
  private _segmentCounter = 0
  private _allSegments: TranscriptSegment[] = []

  // ─── Audio buffer ─────────────────────────────────────────────────────────

  private _pcmBuffer: Float32Array[] = []
  private _bufferedSamples = 0
  private _inferenceTimer: ReturnType<typeof setInterval> | null = null
  private _sessionElapsedMs = 0

  // ─── WASM context ─────────────────────────────────────────────────────────

  private _wasmContext: WhisperWasmContext | null = null

  // ─── Config ───────────────────────────────────────────────────────────────

  private readonly _wasmUrl: string
  private readonly _modelUrl: string
  private readonly _inferenceIntervalSeconds: number
  private readonly _sampleRate: number

  constructor(options: WhisperWasmOptions = {}) {
    this._wasmUrl = options.wasmUrl ?? DEFAULT_WASM_URL
    this._modelUrl = options.modelUrl ?? DEFAULT_MODEL_URL
    this._inferenceIntervalSeconds = options.inferenceIntervalSeconds ?? INFERENCE_INTERVAL_SECONDS
    this._sampleRate = options.sampleRate ?? 16000
  }

  // ─── TranscriptionEngine Interface ──────────────────────────────────────────

  /**
   * Start a transcription session.
   * Loads the WASM module and model binary (from SW cache if available).
   */
  async startSession(config: TranscriptionConfig): Promise<SessionHandle> {
    this._sessionId = config.sessionId
    this._sessionStartedAt = new Date()
    this._segmentCounter = 0
    this._allSegments = []
    this._pcmBuffer = []
    this._bufferedSamples = 0
    this._sessionElapsedMs = 0

    // Load WASM context and model
    await this._initializeWasm()

    this._initialized = true

    return {
      sessionId: config.sessionId,
      startedAt: this._sessionStartedAt,
    }
  }

  /**
   * Process an audio chunk.
   * Accumulates PCM data and runs inference when enough audio has been buffered.
   */
  async processAudioChunk(sessionId: string, chunk: AudioChunk): Promise<void> {
    if (!this._initialized || this._sessionId !== sessionId) {
      return
    }

    // Convert ArrayBuffer to Float32Array if needed
    const pcm = chunk.data instanceof Float32Array
      ? chunk.data
      : new Float32Array(chunk.data)

    this._pcmBuffer.push(pcm)
    this._bufferedSamples += pcm.length

    // Calculate buffered duration in seconds
    const bufferedDurationSeconds = this._bufferedSamples / this._sampleRate

    // Run inference when we've accumulated enough audio
    if (bufferedDurationSeconds >= this._inferenceIntervalSeconds) {
      await this._runInference()
    }
  }

  /**
   * Register a voice profile for improved diarization.
   * Not supported in offline/WASM mode — returns a stub profile.
   */
  async registerVoiceProfile(repId: string, _audioSample: ArrayBuffer): Promise<VoiceProfile> {
    // Voice profile registration is not supported in offline Whisper.cpp mode.
    // Return a stub profile so callers don't break.
    return {
      id: `offline-stub-${repId}`,
      repId,
      createdAt: new Date(),
    }
  }

  /**
   * End the session and return the finalized transcript.
   * Runs final inference on any remaining buffered audio.
   */
  async endSession(sessionId: string): Promise<FinalTranscript> {
    if (this._sessionId !== sessionId) {
      return {
        sessionId,
        segments: [],
        durationMs: 0,
        speakerCount: 0,
      }
    }

    // Process any remaining buffered audio
    if (this._bufferedSamples > 0) {
      await this._runInference()
    }

    const finalTranscript: FinalTranscript = {
      sessionId,
      segments: [...this._allSegments],
      durationMs: this._sessionElapsedMs,
      speakerCount: this._countUniqueSpeakers(),
    }

    // Clean up
    this._cleanup()

    return finalTranscript
  }

  /**
   * Register a callback to receive transcript segments as they're recognized.
   */
  onSegment(callback: (segment: TranscriptSegment) => void): void {
    this._segmentCallback = callback
  }

  // ─── Additional Public API ──────────────────────────────────────────────────

  /**
   * Register a callback for error events.
   */
  onError(callback: (error: WhisperWasmError) => void): void {
    this._errorCallback = callback
  }

  /**
   * Whether the engine is initialized and ready for processing.
   */
  get isInitialized(): boolean {
    return this._initialized
  }

  // ─── Private: WASM Loading ──────────────────────────────────────────────────

  /**
   * Initialize the Whisper.cpp WASM context and load the model.
   * Attempts to load from Service Worker cache first, falling back to network.
   */
  private async _initializeWasm(): Promise<void> {
    try {
      // Load WASM binary (from cache or network)
      const wasmBinary = await this._fetchWithCache(this._wasmUrl)

      // Load model weights (from cache or network)
      const modelBinary = await this._fetchWithCache(this._modelUrl)

      // Instantiate the WASM context
      // In production: this would be WebAssembly.instantiate(wasmBinary, imports)
      // and then loading the model into the WASM memory.
      this._wasmContext = await this._createWasmContext(wasmBinary, modelBinary)
    } catch (err) {
      const error: WhisperWasmError = {
        kind: 'wasm_load_failed',
        message: `Failed to load Whisper WASM: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }
      this._errorCallback?.(error)
      throw error
    }
  }

  /**
   * Fetch a resource, using the Service Worker cache when available.
   * On cache miss, fetches from network and stores in the SW cache.
   */
  private async _fetchWithCache(url: string): Promise<ArrayBuffer> {
    // Try Service Worker cache first
    if ('caches' in globalThis) {
      try {
        const cache = await caches.open(WASM_CACHE_NAME)
        const cachedResponse = await cache.match(url)

        if (cachedResponse) {
          return await cachedResponse.arrayBuffer()
        }

        // Cache miss: fetch from network and cache
        const networkResponse = await fetch(url)

        if (!networkResponse.ok) {
          throw new Error(`HTTP ${networkResponse.status}: ${networkResponse.statusText}`)
        }

        // Clone the response before consuming it (can only read body once)
        const responseToCache = networkResponse.clone()
        await cache.put(url, responseToCache)

        return await networkResponse.arrayBuffer()
      } catch (err) {
        // If cache API fails, fall through to direct fetch
        if (err instanceof TypeError) {
          // Network error or cache API not available — try direct fetch
        } else {
          throw err
        }
      }
    }

    // Fallback: direct fetch without caching
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return await response.arrayBuffer()
  }

  /**
   * Create the WASM context from loaded binaries.
   * This is the integration point where the actual Whisper.cpp WASM module
   * would be instantiated. Currently returns a stub context.
   */
  private async _createWasmContext(
    _wasmBinary: ArrayBuffer,
    modelBinary: ArrayBuffer,
  ): Promise<WhisperWasmContext> {
    // TODO: Replace with actual WASM instantiation:
    //
    //   const wasmModule = await WebAssembly.compile(wasmBinary)
    //   const instance = await WebAssembly.instantiate(wasmModule, imports)
    //   const ctx = new WhisperContext(instance)
    //   await ctx.loadModel(modelBinary)
    //   return ctx
    //
    // For now, return a stub context that simulates transcription behavior.

    const context: WhisperWasmContext = {
      async loadModel(_buffer: ArrayBuffer): Promise<void> {
        // Model loading simulated
        await Promise.resolve()
      },
      async transcribe(pcm: Float32Array): Promise<{ text: string; confidence: number }> {
        // In production, this would invoke the WASM transcription function.
        // Stub: generate placeholder text based on audio duration.
        const durationSec = pcm.length / 16000
        if (durationSec < 0.1) {
          return { text: '', confidence: 0 }
        }
        return {
          text: `[whisper transcription ${Math.round(durationSec * 10) / 10}s]`,
          confidence: 0.85,
        }
      },
      dispose(): void {
        // Free WASM memory in production
      },
    }

    await context.loadModel(modelBinary)
    return context
  }

  // ─── Private: Inference ─────────────────────────────────────────────────────

  /**
   * Merge buffered PCM chunks and run Whisper inference.
   */
  private async _runInference(): Promise<void> {
    if (!this._wasmContext || this._pcmBuffer.length === 0) {
      return
    }

    // Merge buffered chunks into a single contiguous Float32Array
    const totalLength = this._pcmBuffer.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of this._pcmBuffer) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    // Clear the buffer
    this._pcmBuffer = []
    this._bufferedSamples = 0

    // Calculate timing
    const chunkDurationMs = Math.round((totalLength / this._sampleRate) * 1000)
    const startTimeMs = this._sessionElapsedMs
    this._sessionElapsedMs += chunkDurationMs

    try {
      const result = await this._wasmContext.transcribe(merged)

      // Only emit segments with actual content
      if (result.text && result.text.trim().length > 0) {
        this._segmentCounter++

        const segment: TranscriptSegment = {
          id: `whisper-${this._sessionId}-${this._segmentCounter}`,
          sessionId: this._sessionId!,
          text: result.text.trim(),
          startMs: startTimeMs,
          endMs: startTimeMs + chunkDurationMs,
          source: 'speech',
          createdAt: new Date(),
        }

        this._allSegments.push(segment)
        this._segmentCallback?.(segment)
      }
    } catch (err) {
      const error: WhisperWasmError = {
        kind: 'inference_failed',
        message: `Whisper inference failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }
      this._errorCallback?.(error)
      // Don't throw — gracefully continue; the buffered audio is lost for this chunk
      // but the session can continue processing subsequent audio.
    }
  }

  // ─── Private: Helpers ───────────────────────────────────────────────────────

  private _countUniqueSpeakers(): number {
    const speakers = new Set(
      this._allSegments
        .filter((s) => 'speaker' in s && s.speaker)
        .map((s) => (s as TranscriptSegment & { speaker: string }).speaker),
    )
    // At minimum, assume 1 speaker (the rep) if we have any segments
    return Math.max(speakers.size, this._allSegments.length > 0 ? 1 : 0)
  }

  private _cleanup(): void {
    if (this._inferenceTimer) {
      clearInterval(this._inferenceTimer)
      this._inferenceTimer = null
    }

    this._wasmContext?.dispose()
    this._wasmContext = null
    this._initialized = false
    this._sessionId = null
    this._sessionStartedAt = null
    this._pcmBuffer = []
    this._bufferedSamples = 0
  }
}

// ─── Service Worker Cache Registration ────────────────────────────────────────

/**
 * Pre-cache Whisper WASM and model binaries in the Service Worker cache.
 * Call this during app initialization or Service Worker install event
 * to ensure the model is available for offline use.
 *
 * Requirements: 24.1, 24.3
 */
export async function precacheWhisperWasmModel(
  options: { wasmUrl?: string; modelUrl?: string } = {},
): Promise<boolean> {
  const wasmUrl = options.wasmUrl ?? DEFAULT_WASM_URL
  const modelUrl = options.modelUrl ?? DEFAULT_MODEL_URL

  if (!('caches' in globalThis)) {
    // Cache API not available (e.g., non-HTTPS context or unsupported browser)
    return false
  }

  try {
    const cache = await caches.open(WASM_CACHE_NAME)

    // Check if already cached
    const [wasmCached, modelCached] = await Promise.all([
      cache.match(wasmUrl),
      cache.match(modelUrl),
    ])

    const fetchPromises: Promise<void>[] = []

    if (!wasmCached) {
      fetchPromises.push(
        fetch(wasmUrl).then(async (response) => {
          if (response.ok) {
            await cache.put(wasmUrl, response)
          }
        }),
      )
    }

    if (!modelCached) {
      fetchPromises.push(
        fetch(modelUrl).then(async (response) => {
          if (response.ok) {
            await cache.put(modelUrl, response)
          }
        }),
      )
    }

    await Promise.all(fetchPromises)
    return true
  } catch {
    // Graceful failure — offline transcription will attempt download at session start
    return false
  }
}
