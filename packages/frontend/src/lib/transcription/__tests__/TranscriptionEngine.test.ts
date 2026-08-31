/**
 * Unit tests for TranscriptionEngine
 *
 * Covers:
 *  - Microphone denied path (Req 1.4)
 *  - Audio loss detection and auto-resume (Req 1.5)
 *  - WASM load failure fallback
 *
 * Requirements: 1.4, 1.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TranscriptionEngine } from '../TranscriptionEngine'
import type { MicrophoneError } from '../TranscriptionEngine'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePcm(length: number, amplitude: number): Float32Array {
  const pcm = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    pcm[i] = amplitude * (i % 2 === 0 ? 1 : -1)
  }
  return pcm
}

const SILENT_PCM = makePcm(4096, 0)
const LOUD_PCM = makePcm(4096, 0.5)

// ─── Mocks ────────────────────────────────────────────────────────────────────

function mockGetUserMedia(impl: () => Promise<MediaStream>) {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(impl) },
    writable: true,
    configurable: true,
  })
}

function buildFakeStream(): MediaStream {
  return {
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream
}

function buildFakeAudioContext() {
  const processorNode = {
    onaudioprocess: null as ((e: unknown) => void) | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  const sourceNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  const ctx = {
    state: 'running' as AudioContextState,
    sampleRate: 16000,
    createMediaStreamSource: vi.fn(() => sourceNode),
    createScriptProcessor: vi.fn(() => processorNode),
    destination: {},
    close: vi.fn(),
  }
  return { ctx, processorNode, sourceNode }
}

function installFakeAudioContext(fake: ReturnType<typeof buildFakeAudioContext>) {
  // @ts-expect-error — replacing global for test
  global.AudioContext = vi.fn(() => fake.ctx)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TranscriptionEngine', () => {
  let originalAudioContext: typeof AudioContext

  beforeEach(() => {
    originalAudioContext = global.AudioContext
    vi.useFakeTimers()
  })

  afterEach(() => {
    global.AudioContext = originalAudioContext
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // ─── Microphone denied path ────────────────────────────────────────────────

  describe('microphone denied path (Req 1.4)', () => {
    it('calls onError with kind=permission_denied when getUserMedia throws NotAllowedError', async () => {
      const permissionError = new DOMException('Permission denied', 'NotAllowedError')
      mockGetUserMedia(() => Promise.reject(permissionError))

      const engine = new TranscriptionEngine()
      const onError = vi.fn<[MicrophoneError], void>()
      engine.onError = onError

      await expect(engine.initialize('session-1')).rejects.toBeDefined()

      expect(onError).toHaveBeenCalledOnce()
      const err = onError.mock.calls[0][0]
      expect(err.kind).toBe('permission_denied')
      expect(err.message).toContain('denied')
    })

    it('includes actionable instructions in the permission_denied error', async () => {
      const permissionError = new DOMException('Permission denied', 'NotAllowedError')
      mockGetUserMedia(() => Promise.reject(permissionError))

      const engine = new TranscriptionEngine()
      const onError = vi.fn<[MicrophoneError], void>()
      engine.onError = onError

      await expect(engine.initialize('session-1')).rejects.toBeDefined()

      const err = onError.mock.calls[0][0]
      expect(err.kind).toBe('permission_denied')
      if (err.kind === 'permission_denied') {
        expect(err.instructions.length).toBeGreaterThan(10)
      }
    })

    it('calls onError with kind=not_found when no microphone device exists', async () => {
      const notFoundError = new DOMException('No device', 'NotFoundError')
      mockGetUserMedia(() => Promise.reject(notFoundError))

      const engine = new TranscriptionEngine()
      const onError = vi.fn<[MicrophoneError], void>()
      engine.onError = onError

      await expect(engine.initialize('session-1')).rejects.toBeDefined()

      const err = onError.mock.calls[0][0]
      expect(err.kind).toBe('not_found')
    })

    it('does NOT emit any segments when microphone is denied', async () => {
      const permissionError = new DOMException('Permission denied', 'NotAllowedError')
      mockGetUserMedia(() => Promise.reject(permissionError))

      const engine = new TranscriptionEngine()
      const onSegment = vi.fn()
      engine.onSegment = onSegment
      engine.onError = vi.fn()

      await expect(engine.initialize('session-1')).rejects.toBeDefined()

      expect(onSegment).not.toHaveBeenCalled()
    })

    it('engine is not running after microphone denial', async () => {
      const permissionError = new DOMException('Permission denied', 'NotAllowedError')
      mockGetUserMedia(() => Promise.reject(permissionError))

      const engine = new TranscriptionEngine()
      engine.onError = vi.fn()

      await expect(engine.initialize('session-1')).rejects.toBeDefined()

      expect(engine.isRunning).toBe(false)
    })
  })

  // ─── Audio loss detection and auto-resume ─────────────────────────────────

  describe('audio loss detection and auto-resume (Req 1.5)', () => {
    it('calls onAudioLost after silence exceeds audioLostTimeoutMs', async () => {
      const fake = buildFakeAudioContext()
      installFakeAudioContext(fake)
      mockGetUserMedia(() => Promise.resolve(buildFakeStream()))

      const engine = new TranscriptionEngine({ audioLostTimeoutMs: 5000 })
      const onAudioLost = vi.fn()
      engine.onAudioLost = onAudioLost
      engine.onError = vi.fn()

      await engine.initialize('session-2')

      // Simulate a loud chunk to start the clock
      fake.processorNode.onaudioprocess?.({
        inputBuffer: { getChannelData: () => LOUD_PCM },
      } as unknown as AudioProcessingEvent)

      // Advance time past the 5 s threshold without any more audio
      vi.advanceTimersByTime(5001)

      expect(onAudioLost).toHaveBeenCalledOnce()
      expect(engine.audioLost).toBe(true)

      engine.stop()
    })

    it('does NOT call onAudioLost when audio is continuous', async () => {
      const fake = buildFakeAudioContext()
      installFakeAudioContext(fake)
      mockGetUserMedia(() => Promise.resolve(buildFakeStream()))

      const engine = new TranscriptionEngine({ audioLostTimeoutMs: 5000 })
      const onAudioLost = vi.fn()
      engine.onAudioLost = onAudioLost
      engine.onError = vi.fn()

      await engine.initialize('session-3')

      // Feed loud chunks every 1 s for 10 s — should never trigger audio lost
      for (let i = 0; i < 10; i++) {
        fake.processorNode.onaudioprocess?.({
          inputBuffer: { getChannelData: () => LOUD_PCM },
        } as unknown as AudioProcessingEvent)
        vi.advanceTimersByTime(1000)
      }

      expect(onAudioLost).not.toHaveBeenCalled()

      engine.stop()
    })

    it('calls onAudioRestored and clears audioLost flag when audio resumes', async () => {
      const fake = buildFakeAudioContext()
      installFakeAudioContext(fake)
      mockGetUserMedia(() => Promise.resolve(buildFakeStream()))

      const engine = new TranscriptionEngine({ audioLostTimeoutMs: 5000 })
      const onAudioLost = vi.fn()
      const onAudioRestored = vi.fn()
      engine.onAudioLost = onAudioLost
      engine.onAudioRestored = onAudioRestored
      engine.onError = vi.fn()

      await engine.initialize('session-4')

      // Trigger audio loss
      fake.processorNode.onaudioprocess?.({
        inputBuffer: { getChannelData: () => LOUD_PCM },
      } as unknown as AudioProcessingEvent)
      vi.advanceTimersByTime(5001)

      expect(engine.audioLost).toBe(true)
      expect(onAudioLost).toHaveBeenCalledOnce()

      // Restore audio — send a loud chunk
      fake.processorNode.onaudioprocess?.({
        inputBuffer: { getChannelData: () => LOUD_PCM },
      } as unknown as AudioProcessingEvent)

      expect(onAudioRestored).toHaveBeenCalledOnce()
      expect(engine.audioLost).toBe(false)

      engine.stop()
    })

    it('audioLost is false initially', async () => {
      const fake = buildFakeAudioContext()
      installFakeAudioContext(fake)
      mockGetUserMedia(() => Promise.resolve(buildFakeStream()))

      const engine = new TranscriptionEngine()
      engine.onError = vi.fn()

      await engine.initialize('session-5')

      expect(engine.audioLost).toBe(false)

      engine.stop()
    })

    it('silent PCM chunks do not reset the silence timer', async () => {
      const fake = buildFakeAudioContext()
      installFakeAudioContext(fake)
      mockGetUserMedia(() => Promise.resolve(buildFakeStream()))

      const engine = new TranscriptionEngine({ audioLostTimeoutMs: 5000 })
      const onAudioLost = vi.fn()
      engine.onAudioLost = onAudioLost
      engine.onError = vi.fn()

      await engine.initialize('session-6')

      // Start with a loud chunk
      fake.processorNode.onaudioprocess?.({
        inputBuffer: { getChannelData: () => LOUD_PCM },
      } as unknown as AudioProcessingEvent)

      // Feed silent chunks — these should NOT reset the timer
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(1000)
        fake.processorNode.onaudioprocess?.({
          inputBuffer: { getChannelData: () => SILENT_PCM },
        } as unknown as AudioProcessingEvent)
      }

      // After 5 s of silence, audio lost should fire
      expect(onAudioLost).toHaveBeenCalledOnce()

      engine.stop()
    })
  })

  // ─── WASM load failure fallback ───────────────────────────────────────────

  describe('WASM load failure fallback', () => {
    it('calls onError with kind=wasm_load_failed when WASM throws', async () => {
      // Patch the private _loadWasm method to simulate failure
      const engine = new TranscriptionEngine()
      // @ts-expect-error — accessing private for test
      engine._loadWasm = vi.fn().mockRejectedValue(new Error('WASM init failed'))

      const onError = vi.fn<[MicrophoneError], void>()
      engine.onError = onError

      await expect(engine.initialize('session-7')).rejects.toBeDefined()

      expect(onError).toHaveBeenCalledOnce()
      const err = onError.mock.calls[0][0]
      expect(err.kind).toBe('wasm_load_failed')
    })

    it('getWordErrorEstimate returns high estimate when WASM is not loaded', () => {
      const engine = new TranscriptionEngine()
      // WASM not loaded — estimate should be high (> 0.15)
      expect(engine.getWordErrorEstimate()).toBeGreaterThan(0.15)
    })

    it('getWordErrorEstimate returns low estimate after successful initialization', async () => {
      const fake = buildFakeAudioContext()
      installFakeAudioContext(fake)
      mockGetUserMedia(() => Promise.resolve(buildFakeStream()))

      const engine = new TranscriptionEngine()
      engine.onError = vi.fn()

      await engine.initialize('session-8')

      // After successful init (WASM loaded), WER estimate should be < 0.15
      expect(engine.getWordErrorEstimate()).toBeLessThan(0.15)

      engine.stop()
    })
  })

  // ─── Segment emission ─────────────────────────────────────────────────────

  describe('segment emission', () => {
    it('emits TranscriptSegment with source=speech when processAudioChunk is called', async () => {
      const fake = buildFakeAudioContext()
      installFakeAudioContext(fake)
      mockGetUserMedia(() => Promise.resolve(buildFakeStream()))

      const engine = new TranscriptionEngine()
      const onSegment = vi.fn()
      engine.onSegment = onSegment
      engine.onError = vi.fn()

      await engine.initialize('session-9')

      engine.processAudioChunk(LOUD_PCM)

      expect(onSegment).toHaveBeenCalledOnce()
      const segment = onSegment.mock.calls[0][0]
      expect(segment.source).toBe('speech')
      expect(segment.sessionId).toBe('session-9')
      expect(typeof segment.text).toBe('string')
      expect(segment.startMs).toBeLessThanOrEqual(segment.endMs)

      engine.stop()
    })

    it('does not emit segments before initialize is called', () => {
      const engine = new TranscriptionEngine()
      const onSegment = vi.fn()
      engine.onSegment = onSegment

      engine.processAudioChunk(LOUD_PCM)

      expect(onSegment).not.toHaveBeenCalled()
    })
  })

  // ─── Stop / cleanup ───────────────────────────────────────────────────────

  describe('stop and cleanup', () => {
    it('isRunning returns false after stop()', async () => {
      const fake = buildFakeAudioContext()
      installFakeAudioContext(fake)
      mockGetUserMedia(() => Promise.resolve(buildFakeStream()))

      const engine = new TranscriptionEngine()
      engine.onError = vi.fn()

      await engine.initialize('session-10')
      engine.stop()

      expect(engine.isRunning).toBe(false)
    })

    it('stops all media tracks on stop()', async () => {
      const stopTrack = vi.fn()
      const fakeStream = {
        getTracks: () => [{ stop: stopTrack }],
      } as unknown as MediaStream

      const fake = buildFakeAudioContext()
      installFakeAudioContext(fake)
      mockGetUserMedia(() => Promise.resolve(fakeStream))

      const engine = new TranscriptionEngine()
      engine.onError = vi.fn()

      await engine.initialize('session-11')
      engine.stop()

      expect(stopTrack).toHaveBeenCalled()
    })
  })
})
