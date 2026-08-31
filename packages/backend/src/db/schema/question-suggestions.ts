import { pgTable, uuid, varchar, text, timestamp, real, boolean, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { pdifSessions } from './pdif-sessions';

/**
 * Question Suggestions — Every question the platform suggested during a session,
 * whether it was used, and how effective it was.
 *
 * This data becomes training signal: which questions led to valuable answers?
 */
export const questionSuggestions = pgTable(
  'question_suggestions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => pdifSessions.id),

    // The question text
    questionText: text('question_text').notNull(),

    // Which PDIF phase was active when this was suggested?
    pdifPhase: varchar('pdif_phase', { length: 20 }).notNull(),

    // What transportation topic does this question address?
    topicCategory: varchar('topic_category', { length: 100 }),
    // e.g., 'fleet_utilization' | 'planning_process' | 'technology_stack' | 'financial_impact'

    // Why was this question suggested? (shown to rep as "why this matters")
    reasoning: text('reasoning'),

    // How was this question generated?
    source: varchar('source', { length: 50 }).notNull().default('ai_generated'),
    // 'ai_generated' | 'question_bank' | 'pattern_based'

    // Ranking when suggested (1 = top recommendation)
    rank: integer('rank').default(1).notNull(),

    // Scoring factors that led to this suggestion
    scoringFactors: jsonb('scoring_factors').default('{}').notNull(),
    // { businessValue: 87, conversationalFit: 72, novelty: 65, phaseAlignment: 80 }

    // Did the rep use this question?
    wasAsked: boolean('was_asked').default(false).notNull(),
    askedAt: timestamp('asked_at', { withTimezone: true }),

    // Was it useful? (set after session when evidence is evaluated)
    effectiveness: real('effectiveness'), // 0.0 - 1.0, null if not yet evaluated

    suggestedAt: timestamp('suggested_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountIdx: index('suggestions_account_id_idx').on(table.accountId),
    sessionIdx: index('suggestions_session_id_idx').on(table.sessionId),
    phaseIdx: index('suggestions_phase_idx').on(table.pdifPhase),
    askedIdx: index('suggestions_asked_idx').on(table.wasAsked),
  })
);

/**
 * Session Transcripts — Individual transcript segments from a session.
 * Each segment is a short piece of speech (5-15 seconds).
 */
export const sessionTranscripts = pgTable(
  'session_transcripts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => pdifSessions.id),

    // The spoken text
    text: text('text').notNull(),

    // Who spoke this? (diarization)
    speaker: varchar('speaker', { length: 20 }).notNull().default('unknown'),
    // 'rep' | 'customer' | 'unknown'

    // Timing within the session
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),

    // How confident is the transcription? (from Deepgram)
    transcriptionConfidence: real('transcription_confidence').default(0.9).notNull(),

    // Has this segment been processed for entity extraction?
    processed: boolean('processed').default(false).notNull(),

    // What entities/facts were extracted from this segment?
    extractedEntities: jsonb('extracted_entities').default('[]').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('transcripts_session_id_idx').on(table.sessionId),
    speakerIdx: index('transcripts_speaker_idx').on(table.speaker),
    processedIdx: index('transcripts_processed_idx').on(table.processed),
  })
);
