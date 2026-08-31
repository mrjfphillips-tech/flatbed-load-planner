// @ts-nocheck
/**
 * LeexiService
 *
 * Integrates with Leexi's public API (https://leexi.readme.io) to:
 * 1. Pull calls/transcripts FROM Leexi into Discovery Coach
 * 2. Push audio recordings TO Leexi for transcription
 * 3. Handle incoming webhooks when Leexi finishes processing a call
 *
 * Auth: Basic auth with API Key ID + Key Secret (base64).
 * Base URL: https://public-api.leexi.ai/v1
 * Rate limits: 50 req/min general, 10 req/min for call creation.
 */

import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import {
  type Session,
  type TranscriptSegment,
  defaultMEDDICScores,
} from '@ptv-discovery-coach/shared'
import { AIEngineService } from './AIEngineService'
import { SessionService } from './SessionService'

// ─── Leexi API Types (matching actual API response format) ────────────────────

/** Speaker object as returned by Leexi */
export interface LeexiSpeaker {
  uuid: string
  name: string
  email_address: string | null
  phone_number: string | null
  index: number
  is_user: boolean
}

/** Word-level transcript item */
export interface LeexiTranscriptItem {
  content: string
  start_time: number
  end_time: number
}

/** Paragraph-level transcript segment (word-level timestamps in items) */
export interface LeexiTranscriptSegment {
  speaker_index: number
  start_time: number
  end_time: number
  items: LeexiTranscriptItem[]
}

/** Call topic detected by Leexi */
export interface LeexiCallTopic {
  uuid: string
  topic_name: string
  keyphrase: string
  speaker: LeexiSpeaker
  start_time: number
  end_time: number
  created_at: string
  updated_at: string
}

/** Prompt completion (summary, chaptering, follow-up tasks, etc.) */
export interface LeexiPromptCompletion {
  uuid: string
  title: string
  category: string
  completions: string[]
}

/** Conversation type */
export interface LeexiConversationType {
  uuid: string
  slug: string
  active: boolean
}

/** Full call/meeting object as returned by GET /v1/calls/{uuid} and webhook */
export interface LeexiCallData {
  uuid: string
  title: string
  description: string | null
  source: string
  source_id: string
  direction: 'inbound' | 'outbound'
  duration: number
  locale: string
  is_video: boolean
  visible: boolean
  performed_at: string
  created_at: string
  updated_at: string
  leexi_url: string
  recording_url: string | null
  transcript_url: string | null
  audio_archived_at: string | null
  transcript_archived_at: string | null
  completions_archived_at: string | null
  video_archived_at: string | null
  owner: { uuid: string; name: string; email: string }
  participating_users: Array<{ uuid: string; name: string; email: string }>
  speakers: LeexiSpeaker[]
  customer_email_addresses: string[]
  customer_phone_numbers: string[]
  conversation_type: LeexiConversationType | null
  deal: unknown | null
  feedbacks: unknown[]
  scorecards: unknown[]
  call_topics: LeexiCallTopic[]
  prompts: LeexiPromptCompletion[]
  /** Paragraph-level transcript with speaker names and timestamps */
  simple_transcript: string | null
  /** Word-level transcript segments */
  transcript: LeexiTranscriptSegment[]
  meeting_event: unknown | null
}

/** Webhook payload for "call.processed" event */
export interface LeexiWebhookPayload {
  event: 'call.processed'
  data: LeexiCallData
}

/** List calls response */
export interface LeexiListCallsResponse {
  calls: LeexiCallData[]
  page: number
  items: number
  total: number
}

/** Presigned URL response for audio upload */
export interface LeexiPresignResponse {
  url: string
  key: string
  headers: Record<string, string>
}

/** List users response */
export interface LeexiUser {
  uuid: string
  name: string
  email: string
  active: boolean
}

// ─── Our types ────────────────────────────────────────────────────────────────

export interface LeexiServiceOptions {
  apiKeyId?: string
  apiKeySecret?: string
  baseUrl?: string
  /** Timeout in ms for Leexi API requests (default: 15_000) */
  timeoutMs?: number
}

/** Simplified call list item for the frontend */
export interface LeexiCallListItem {
  id: string
  title: string
  date: string
  duration: number
  participants: string[]
  hasTranscript: boolean
  source: string
  summary: string | null
}

/** Result of importing a Leexi call */
export interface LeexiImportResult {
  sessionId: string
  segmentsImported: number
  coverageScores: Record<string, number>
  summaryGenerated: boolean
  leexiSummary: string | null
  followUpTasks: string[]
  topics: string[]
}

/** Result of uploading audio to Leexi */
export interface LeexiUploadResult {
  leexiCallUuid: string
  externalId: string
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class LeexiService {
  private readonly prisma: PrismaClient
  private readonly aiEngine: AIEngineService
  private readonly sessionService: SessionService
  private readonly apiKeyId: string
  private readonly apiKeySecret: string
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(prisma: PrismaClient, options: LeexiServiceOptions = {}) {
    this.prisma = prisma
    this.apiKeyId = options.apiKeyId ?? process.env.LEEXI_API_KEY_ID ?? ''
    this.apiKeySecret = options.apiKeySecret ?? process.env.LEEXI_API_KEY_SECRET ?? ''
    this.baseUrl = options.baseUrl ?? 'https://public-api.leexi.ai/v1'
    this.timeoutMs = options.timeoutMs ?? 15_000
    this.aiEngine = new AIEngineService()
    this.sessionService = new SessionService(prisma, this.aiEngine)
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // PULL: Import calls FROM Leexi
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List recent calls from Leexi.
   * GET /v1/calls?page=1&items=20&from=...&to=...
   */
  async listRecentCalls(
    limit: number = 20,
    from?: string,
    to?: string,
  ): Promise<LeexiCallListItem[]> {
    const params = new URLSearchParams({ items: String(limit) })
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    const response = await this.leexiFetch(`${this.baseUrl}/calls?${params}`)

    if (!response.ok) {
      throw new Error(`Leexi API error ${response.status}: ${await response.text()}`)
    }

    const json = (await response.json()) as { data?: LeexiCallData[] }
    const calls = json.data ?? []

    return calls.map((call) => ({
      id: call.uuid,
      title: call.title || 'Untitled call',
      date: call.performed_at || call.created_at,
      duration: call.duration || 0,
      participants: [
        ...call.participating_users.map((u) => u.name),
        ...call.speakers.filter((s) => !s.is_user).map((s) => s.name),
      ],
      hasTranscript: call.transcript != null && call.transcript.length > 0,
      source: call.source,
      summary: this.extractSummary(call.prompts),
    }))
  }

  /**
   * Get full call details including transcript.
   * GET /v1/calls/{uuid}
   */
  async getCall(leexiCallUuid: string): Promise<LeexiCallData> {
    const response = await this.leexiFetch(`${this.baseUrl}/calls/${leexiCallUuid}`)

    if (!response.ok) {
      throw new Error(`Leexi API error ${response.status}: ${await response.text()}`)
    }

    const json = (await response.json()) as { data?: LeexiCallData }
    return json.data as LeexiCallData
  }

  /**
   * Import a specific call from Leexi by UUID.
   * Fetches the full transcript and runs MEDDIC analysis.
   */
  async importCall(
    leexiCallUuid: string,
    accountId: string,
    repId: string,
  ): Promise<LeexiImportResult> {
    const callData = await this.getCall(leexiCallUuid)
    return this.processCallData(callData, accountId, repId)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUSH: Upload audio TO Leexi
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Step 1: Request a presigned URL for uploading audio.
   * POST /v1/presign_recording_url
   */
  async requestPresignedUrl(): Promise<LeexiPresignResponse> {
    const response = await this.leexiFetch(`${this.baseUrl}/presign_recording_url`, {
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(`Leexi presign error ${response.status}: ${await response.text()}`)
    }

    return (await response.json()) as LeexiPresignResponse
  }

  /**
   * Step 2: Upload the audio file to the presigned S3 URL.
   * PUT to the presigned URL with the headers from step 1.
   */
  async uploadAudio(
    presignedUrl: string,
    presignedHeaders: Record<string, string>,
    audioBuffer: Buffer,
    contentType: string = 'audio/webm',
  ): Promise<void> {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        ...presignedHeaders,
        'Content-Type': contentType,
      },
      body: audioBuffer,
    })

    if (!response.ok) {
      throw new Error(`Audio upload failed ${response.status}: ${await response.text()}`)
    }
  }

  /**
   * Step 3: Create the call record in Leexi.
   * POST /v1/calls
   */
  async createCall(params: {
    recordingS3Key: string
    externalId: string
    direction: 'inbound' | 'outbound'
    performedAt: string
    userUuid: string
    title?: string
    locale?: string
    participantEmails?: string[]
    customerPhoneNumber?: string
  }): Promise<LeexiUploadResult> {
    const body: Record<string, unknown> = {
      recording_s3_key: params.recordingS3Key,
      external_id: params.externalId,
      direction: params.direction,
      performed_at: params.performedAt,
      user_uuid: params.userUuid,
    }
    if (params.title) body.title = params.title
    if (params.locale) body.locale = params.locale
    if (params.participantEmails) body.participant_emails = params.participantEmails
    if (params.customerPhoneNumber) body.customer_phone_number = params.customerPhoneNumber

    const response = await this.leexiFetch(`${this.baseUrl}/calls`, {
      method: 'POST',
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Leexi create call error ${response.status}: ${await response.text()}`)
    }

    const data = (await response.json()) as { uuid: string }

    return {
      leexiCallUuid: data.uuid,
      externalId: params.externalId,
    }
  }

  /**
   * Convenience: upload audio and create call in one step.
   * Returns the Leexi call UUID. Leexi will process the audio async
   * and send a webhook when the transcript is ready.
   */
  async uploadAndCreateCall(
    audioBuffer: Buffer,
    contentType: string,
    params: {
      externalId: string
      direction: 'inbound' | 'outbound'
      performedAt: string
      userUuid: string
      title?: string
      locale?: string
      participantEmails?: string[]
      customerPhoneNumber?: string
    },
  ): Promise<LeexiUploadResult> {
    // Step 1: Get presigned URL
    const presign = await this.requestPresignedUrl()

    // Step 2: Upload audio
    await this.uploadAudio(presign.url, presign.headers, audioBuffer, contentType)

    // Step 3: Create call record
    return this.createCall({
      ...params,
      recordingS3Key: presign.key,
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBHOOK: Handle incoming "call.processed" events
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handle incoming Leexi webhook "call.processed" event.
   * Creates a session, imports the transcript, and runs MEDDIC analysis.
   */
  async handleWebhook(
    payload: LeexiWebhookPayload,
    accountId: string,
    repId: string,
  ): Promise<LeexiImportResult> {
    if (payload.event !== 'call.processed') {
      throw new Error(`Unexpected webhook event: ${payload.event}`)
    }
    return this.processCallData(payload.data, accountId, repId)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS: List Leexi users (needed for user_uuid when creating calls)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List all users in the Leexi workspace.
   * GET /v1/users
   */
  async listUsers(): Promise<LeexiUser[]> {
    const response = await this.leexiFetch(`${this.baseUrl}/users`)

    if (!response.ok) {
      throw new Error(`Leexi API error ${response.status}: ${await response.text()}`)
    }

    const json = (await response.json()) as { data?: LeexiUser[] }
    return json.data ?? []
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Build auth headers for Leexi API.
   * Basic auth: base64(KEY_ID:KEY_SECRET)
   * Note: Leexi's API may redirect, so Node fetch needs `redirect: 'follow'`.
   */
  private authHeaders(): Record<string, string> {
    const credentials = Buffer.from(
      `${this.apiKeyId}:${this.apiKeySecret}`
    ).toString('base64')
    return {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'PTV-Discovery-Coach/1.0',
    }
  }

  /**
   * Make a fetch request that follows redirects (Leexi API uses Cloudflare
   * which may redirect). Node 18+ fetch follows by default, but we set it
   * explicitly for safety.
   */
  private async leexiFetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await fetch(url, {
        ...options,
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          ...this.authHeaders(),
          ...(options.headers as Record<string, string> ?? {}),
        },
      })
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Extract summary text from Leexi prompt completions.
   * Leexi stores summaries in the `prompts` array with category "summary".
   */
  private extractSummary(prompts: LeexiPromptCompletion[] | undefined): string | null {
    if (!prompts) return null
    const summaryPrompt = prompts.find((p) => p.category === 'summary')
    if (!summaryPrompt || !summaryPrompt.completions.length) return null
    return summaryPrompt.completions.join('\n')
  }

  /**
   * Extract follow-up tasks from Leexi prompt completions.
   */
  private extractFollowUpTasks(prompts: LeexiPromptCompletion[] | undefined): string[] {
    if (!prompts) return []
    const taskPrompt = prompts.find(
      (p) => p.category === 'follow_up_tasks' || p.title === 'follow_up_tasks'
    )
    return taskPrompt?.completions ?? []
  }

  /**
   * Convert Leexi transcript segments to our internal TranscriptSegment format.
   * Leexi provides word-level timestamps in `transcript` and paragraph-level
   * in `simple_transcript`. We use the word-level data and concatenate items
   * per paragraph.
   */
  private mapLeexiTranscript(
    sessionId: string,
    leexiSegments: LeexiTranscriptSegment[],
    speakers: LeexiSpeaker[],
  ): TranscriptSegment[] {
    return leexiSegments.map((seg, idx) => {
      // Concatenate word-level items into paragraph text
      const text = seg.items.map((item) => item.content).join(' ')
      // Resolve speaker name
      const speaker = speakers.find((s) => s.index === seg.speaker_index)
      const speakerPrefix = speaker ? `${speaker.name}: ` : ''

      return {
        id: randomUUID(),
        sessionId,
        text: speakerPrefix + text,
        startMs: Math.round(seg.start_time * 1000),
        endMs: Math.round(seg.end_time * 1000),
        source: 'speech' as const,
        createdAt: new Date(),
      }
    })
  }

  /**
   * Process a full Leexi call data object: create session, import transcript,
   * run MEDDIC analysis, generate summary.
   * Used by both importCall() and handleWebhook().
   */
  private async processCallData(
    callData: LeexiCallData,
    accountId: string,
    repId: string,
  ): Promise<LeexiImportResult> {
    // Create session
    const session = await this.prisma.session.create({
      data: {
        accountId,
        repId,
        coverageScores: defaultMEDDICScores() as object,
        sessionType: 'offline_recovery',
        audioRecordingUrl: callData.recording_url ?? null,
      },
    })

    // Import transcript segments in one batch
    const segments = this.mapLeexiTranscript(
      session.id,
      callData.transcript ?? [],
      callData.speakers ?? [],
    )
    if (segments.length > 0) {
      await this.prisma.transcriptSegment.createMany({
        data: segments.map((seg) => ({
          id: seg.id,
          sessionId: session.id,
          text: seg.text,
          startMs: seg.startMs,
          endMs: seg.endMs,
          source: 'speech' as const,
          ocrLabel: null,
          createdAt: seg.createdAt,
        })),
      })
    }

    // Run MEDDIC analysis — non-fatal if GPT is unavailable
    let analysisResult = { coverageScores: defaultMEDDICScores() }
    try {
      analysisResult = await this.aiEngine.analyzeTranscript(segments, defaultMEDDICScores(), {})
    } catch (err) {
      console.warn('[LeexiService] MEDDIC analysis failed, using empty scores:', err)
    }

    // Persist coverage scores and duration
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        coverageScores: analysisResult.coverageScores as object,
        endedAt: new Date(),
        durationSeconds: Math.round(callData.duration ?? 0),
      },
    })

    // Generate summary
    let summaryGenerated = false
    try {
      await this.sessionService.generateSummary(session.id)
      summaryGenerated = true
    } catch {
      // Non-fatal — summary can be generated later
    }

    return {
      sessionId: session.id,
      segmentsImported: segments.length,
      coverageScores: analysisResult.coverageScores,
      summaryGenerated,
      leexiSummary: this.extractSummary(callData.prompts),
      followUpTasks: this.extractFollowUpTasks(callData.prompts),
      topics: (callData.call_topics ?? []).map((t) => t.topic_name),
    }
  }
}
