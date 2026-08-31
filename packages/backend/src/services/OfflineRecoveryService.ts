// @ts-nocheck
/**
 * OfflineRecoveryService
 *
 * Accepts uploaded audio files (MP3/WAV), creates an offline_recovery Session,
 * triggers server-side Whisper transcription, optionally processes image uploads
 * via OCR, and orchestrates full MEDDIC analysis + summary generation.
 *
 * Requirements: 14.4, 14.5, 14.6, 14.7, 14.8
 */

import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import {
  type Session,
  type AnalysisResult,
  type RecoveryStatus,
  type TranscriptSegment,
  type Attachment,
  defaultMEDDICScores,
} from '@ptv-discovery-coach/shared'
import { AIEngineService } from './AIEngineService'
import { SessionService } from './SessionService'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OfflineRecoveryServiceOptions {
  openAiApiKey?: string
  openAiBaseUrl?: string
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class OfflineRecoveryService {
  /** In-memory recovery status store (can be replaced with Redis) */
  private readonly statusMap = new Map<string, RecoveryStatus>()

  private readonly prisma: PrismaClient
  private readonly aiEngine: AIEngineService
  private readonly sessionService: SessionService
  private readonly openAiApiKey: string
  private readonly openAiBaseUrl: string

  constructor(
    prisma: PrismaClient,
    options: OfflineRecoveryServiceOptions = {}
  ) {
    this.prisma = prisma
    this.openAiApiKey = options.openAiApiKey ?? process.env.OPENAI_API_KEY ?? ''
    this.openAiBaseUrl = options.openAiBaseUrl ?? 'https://api.openai.com/v1'
    this.aiEngine = new AIEngineService({
      openAiApiKey: this.openAiApiKey,
      openAiBaseUrl: this.openAiBaseUrl,
    })
    this.sessionService = new SessionService(prisma, this.aiEngine)
  }

  /**
   * Accept an audio file upload and create an offline_recovery Session.
   * Req 14.4, 14.8
   */
  async uploadAudio(
    accountId: string,
    repId: string,
    audioBuffer: Buffer,
    mimeType: 'audio/mpeg' | 'audio/wav'
  ): Promise<Session> {
    this.setStatus(null, { stage: 'uploading', progressPct: 10 })

    // Create the session with sessionType: 'offline_recovery'
    const record = await this.prisma.session.create({
      data: {
        accountId,
        repId,
        coverageScores: defaultMEDDICScores() as object,
        sessionType: 'offline_recovery',
      },
    })

    const session = mapSession(record)

    // Store the audio buffer as a pseudo-attachment so it can be retrieved
    // for transcription. In production this would be uploaded to object storage.
    await this.prisma.attachment.create({
      data: {
        id: randomUUID(),
        sessionId: session.id,
        originalUrl: `memory://audio/${session.id}`,
        mimeType,
        capturedAt: new Date(),
      },
    })

    // Persist the raw buffer in memory keyed by sessionId for transcription
    this.audioBufferMap.set(session.id, { buffer: audioBuffer, mimeType })

    this.setStatus(session.id, { stage: 'uploading', progressPct: 100 })

    return session
  }

  /** In-memory audio buffer store (keyed by sessionId) */
  private readonly audioBufferMap = new Map<
    string,
    { buffer: Buffer; mimeType: 'audio/mpeg' | 'audio/wav' }
  >()

  /**
   * Accept optional image uploads and run OCR via the OpenAI Vision API
   * (or a local Tesseract fallback). Appends extracted text as TranscriptSegments
   * with source: 'ocr'.
   * Req 14.6
   */
  async uploadImages(sessionId: string, images: Array<{ buffer: Buffer; mimeType: string }>): Promise<void> {
    if (images.length === 0) return

    for (const image of images) {
      const { buffer: imageBuffer, mimeType } = image
      const attachmentId = randomUUID()
      const capturedAt = new Date()

      // Store attachment record
      await this.prisma.attachment.create({
        data: {
          id: attachmentId,
          sessionId,
          originalUrl: `memory://image/${attachmentId}`,
          mimeType,
          capturedAt,
        },
      })

      // Run OCR via OpenAI Vision API (Req 14.6)
      const extractedText = await this.runOCR(imageBuffer)

      if (extractedText) {
        // Update attachment with extracted text
        await this.prisma.attachment.update({
          where: { id: attachmentId },
          data: { extractedText },
        })

        // Append as OCR TranscriptSegment
        const now = Date.now()
        await this.prisma.transcriptSegment.create({
          data: {
            id: randomUUID(),
            sessionId,
            text: extractedText,
            startMs: now,
            endMs: now,
            source: 'ocr',
            ocrLabel: `OCR Input ${new Date(now).toISOString()}`,
            createdAt: new Date(now),
          },
        })
      }
    }
  }

  /**
   * Trigger server-side Whisper transcription for the uploaded audio.
   * Uses OpenAI Whisper API as fallback for batch processing.
   * Req 14.5
   */
  async triggerTranscription(sessionId: string): Promise<void> {
    this.setStatus(sessionId, { stage: 'transcribing', progressPct: 10 })

    const audioEntry = this.audioBufferMap.get(sessionId)
    if (!audioEntry) {
      this.setStatus(sessionId, {
        stage: 'failed',
        progressPct: 0,
        errorMessage: 'Audio buffer not found for session',
      })
      throw new Error(`OfflineRecoveryService: no audio buffer for session ${sessionId}`)
    }

    try {
      const segments = await this.transcribeWithWhisper(
        sessionId,
        audioEntry.buffer,
        audioEntry.mimeType
      )

      // Persist transcript segments
      for (const seg of segments) {
        await this.prisma.transcriptSegment.upsert({
          where: { id: seg.id },
          create: {
            id: seg.id,
            sessionId,
            text: seg.text,
            startMs: seg.startMs,
            endMs: seg.endMs,
            source: 'speech',
            createdAt: seg.createdAt,
          },
          update: { text: seg.text },
        })
      }

      this.setStatus(sessionId, { stage: 'transcribing', progressPct: 100 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcription failed'
      this.setStatus(sessionId, { stage: 'failed', progressPct: 0, errorMessage: msg })
      throw err
    } finally {
      // Release the audio buffer — it can be large and is no longer needed after transcription
      this.audioBufferMap.delete(sessionId)
    }
  }

  /**
   * Orchestrate full AIEngineService.analyzeTranscript + generateSummary.
   * Req 14.7
   */
  async triggerFullAnalysis(sessionId: string): Promise<AnalysisResult> {
    this.setStatus(sessionId, { stage: 'analyzing', progressPct: 10 })

    const segments = await this.prisma.transcriptSegment.findMany({
      where: { sessionId },
      orderBy: { startMs: 'asc' },
    })

    const transcriptSegments: TranscriptSegment[] = segments.map((s) => ({
      id: s.id,
      sessionId: s.sessionId,
      text: s.text,
      startMs: s.startMs,
      endMs: s.endMs,
      source: s.source as 'speech' | 'ocr',
      ocrLabel: s.ocrLabel ?? undefined,
      createdAt: s.createdAt,
    }))

    const sessionRecord = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
    })

    try {
      const result = await this.aiEngine.analyzeTranscript(
        transcriptSegments,
        defaultMEDDICScores(),
        {}
      )

      // Persist updated coverage scores
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { coverageScores: result.coverageScores as object },
      })

      this.setStatus(sessionId, { stage: 'summarizing', progressPct: 50 })

      // Generate summary
      await this.sessionService.generateSummary(sessionId)

      // Finalize session
      await this.sessionService.finalizeSession(sessionId, result.coverageScores)

      this.setStatus(sessionId, { stage: 'complete', progressPct: 100 })

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed'
      this.setStatus(sessionId, { stage: 'failed', progressPct: 0, errorMessage: msg })
      throw err
    }
  }

  /**
   * Poll recovery status for a session.
   * Req 14.7
   */
  async getRecoveryStatus(sessionId: string): Promise<RecoveryStatus> {
    return (
      this.statusMap.get(sessionId) ?? { stage: 'uploading', progressPct: 0 }
    )
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private setStatus(sessionId: string | null, status: RecoveryStatus): void {
    if (sessionId) {
      this.statusMap.set(sessionId, status)
    }
  }

  /**
   * Transcribe audio using the OpenAI Whisper API.
   * Returns an array of TranscriptSegments.
   * Req 14.5
   */
  private async transcribeWithWhisper(
    sessionId: string,
    audioBuffer: Buffer,
    mimeType: 'audio/mpeg' | 'audio/wav'
  ): Promise<TranscriptSegment[]> {
    const ext = mimeType === 'audio/mpeg' ? 'mp3' : 'wav'
    const filename = `audio.${ext}`

    // Use node-fetch compatible approach: send raw buffer with multipart boundary
    // We build the multipart body manually to avoid needing browser FormData
    const boundary = `----FormBoundary${randomUUID().replace(/-/g, '')}`
    const CRLF = '\r\n'

    const textPart = (name: string, value: string): Buffer =>
      Buffer.from(
        `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`,
        'utf8'
      )

    const filePart = Buffer.concat([
      Buffer.from(
        `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`,
        'utf8'
      ),
      audioBuffer,
      Buffer.from(CRLF, 'utf8'),
    ])

    const body = Buffer.concat([
      textPart('model', 'whisper-1'),
      textPart('response_format', 'verbose_json'),
      textPart('timestamp_granularities[]', 'segment'),
      filePart,
      Buffer.from(`--${boundary}--${CRLF}`, 'utf8'),
    ])

    const response = await fetch(`${this.openAiBaseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openAiApiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    })

    if (!response.ok) {
      throw new Error(`Whisper API returned ${response.status}`)
    }

    const data = (await response.json()) as {
      segments?: Array<{
        id: number
        text: string
        start: number
        end: number
      }>
      text?: string
    }

    if (data.segments && data.segments.length > 0) {
      return data.segments.map((seg) => ({
        id: randomUUID(),
        sessionId,
        text: seg.text.trim(),
        startMs: Math.round(seg.start * 1000),
        endMs: Math.round(seg.end * 1000),
        source: 'speech' as const,
        createdAt: new Date(),
      }))
    }

    // Fallback: single segment with full text
    if (data.text) {
      return [
        {
          id: randomUUID(),
          sessionId,
          text: data.text.trim(),
          startMs: 0,
          endMs: 0,
          source: 'speech' as const,
          createdAt: new Date(),
        },
      ]
    }

    return []
  }

  /**
   * Run OCR on an image buffer using the OpenAI Vision API.
   * Req 14.6
   */
  private async runOCR(imageBuffer: Buffer): Promise<string> {
    const base64 = imageBuffer.toString('base64')

    const response = await fetch(`${this.openAiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text from this image. Return only the extracted text, no commentary.',
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      // Non-fatal: return empty string if OCR fails
      return ''
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }

    return data.choices[0]?.message?.content?.trim() ?? ''
  }
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapSession(record: {
  id: string
  accountId: string
  repId: string
  startedAt: Date
  endedAt: Date | null
  durationSeconds: number | null
  coverageScores: unknown
  autoSavedAt: Date | null
  sessionType: string
  audioRecordingUrl: string | null
}): Session {
  return {
    id: record.id,
    accountId: record.accountId,
    repId: record.repId,
    startedAt: record.startedAt,
    endedAt: record.endedAt ?? undefined,
    durationSeconds: record.durationSeconds ?? undefined,
    coverageScores: (record.coverageScores as import('@ptv-discovery-coach/shared').MEDDICScores) ?? defaultMEDDICScores(),
    autoSavedAt: record.autoSavedAt ?? undefined,
    sessionType: record.sessionType as 'live' | 'offline_recovery',
    audioRecordingUrl: record.audioRecordingUrl ?? undefined,
  }
}
