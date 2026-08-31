/**
 * PDIF Session Routes — Live coaching session API
 *
 * These endpoints power the real-time coaching experience:
 *   POST /api/pdif/sessions           — Start a new session
 *   GET  /api/pdif/sessions/:id       — Get session state
 *   POST /api/pdif/sessions/:id/transcript — Process a transcript segment
 *   GET  /api/pdif/sessions/:id/suggestions — Get current question suggestions
 *   GET  /api/pdif/sessions/:id/confidence — Get confidence scores
 *   GET  /api/pdif/sessions/:id/graph — Get discovered knowledge
 *   POST /api/pdif/sessions/:id/phase — Update current phase
 *   POST /api/pdif/sessions/:id/end   — End session + generate summary
 *
 * PDIF V1 Task 3.1
 */

import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAnyRole, getUserId } from '../middleware/auth.js';
import { getDiscoveryGraphService } from '../services/DiscoveryGraphService.js';
import { getSuggestionEngine } from '../intelligence/QuestionSuggestionEngine.js';
import { getPhaseEngine } from '../intelligence/PDIFPhaseEngine.js';
import { getConfidenceEngine } from '../intelligence/ConfidenceEngine.js';

export async function pdifSessionRoutes(app: FastifyInstance): Promise<void> {

  // ─── POST /sessions — Start a new PDIF session ──────────────────────
  app.post<{ Body: { accountId: string; attendees?: any[] } }>(
    '/', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { accountId, attendees } = request.body;
      const userId = getUserId(request);

      if (!accountId) {
        return reply.status(400).send({ error: 'accountId is required' });
      }

      // Count existing sessions for this account
      const existing = await db.select()
        .from(schema.pdifSessions)
        .where(eq(schema.pdifSessions.accountId, accountId));
      const sessionNumber = existing.length + 1;

      const [session] = await db.insert(schema.pdifSessions).values({
        accountId,
        repId: userId || 'anonymous',
        currentPhase: 'discover',
        status: 'active',
        sessionNumber,
        attendees: attendees || [],
      }).returning();

      // Initialize confidence scores for this session
      const categories = [
        'company_operations', 'fleet_network',
        'technology_data', 'financial_drivers', 'buying_process'
      ];
      for (const category of categories) {
        await db.insert(schema.confidenceScores).values({
          accountId, sessionId: session.id, category, score: 0,
        });
      }

      return reply.status(201).send(session);
    }
  );

  // ─── GET /sessions/:id — Get session state ──────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { id } = request.params;
      const [session] = await db.select()
        .from(schema.pdifSessions)
        .where(eq(schema.pdifSessions.id, id));

      if (!session) return reply.status(404).send({ error: 'Session not found' });

      // Get phase progress
      const graphNodes = await db.select({
        nodeType: schema.discoveryGraphNodes.nodeType,
        confidence: schema.discoveryGraphNodes.confidence,
      }).from(schema.discoveryGraphNodes)
        .where(eq(schema.discoveryGraphNodes.accountId, session.accountId));

      const phaseEngine = getPhaseEngine();
      const phaseState = phaseEngine.assessPhaseState(
        session.currentPhase as any,
        graphNodes
      );

      // Get confidence scores
      const confidence = await db.select()
        .from(schema.confidenceScores)
        .where(eq(schema.confidenceScores.sessionId, id));

      return {
        ...session,
        phaseState,
        confidence,
      };
    }
  );

  // ─── POST /sessions/:id/transcript — Process transcript segment ─────
  app.post<{ Params: { id: string }; Body: { text: string; speaker: string; startMs: number; endMs: number; confidence?: number } }>(
    '/:id/transcript', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { id } = request.params;
      const { text, speaker, startMs, endMs, confidence } = request.body;

      if (!text?.trim()) {
        return reply.status(400).send({ error: 'text is required' });
      }

      // Get session
      const [session] = await db.select()
        .from(schema.pdifSessions)
        .where(eq(schema.pdifSessions.id, id));
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      // Store transcript segment
      const [segment] = await db.insert(schema.sessionTranscripts).values({
        sessionId: id,
        text: text.trim(),
        speaker: speaker || 'unknown',
        startMs: startMs || 0,
        endMs: endMs || 0,
        transcriptionConfidence: confidence || 0.9,
      }).returning();

      // Process through Discovery Graph (extract entities + relationships)
      const graphService = getDiscoveryGraphService();
      const extraction = await graphService.processTranscript(
        id, session.accountId, text, speaker
      );

      // Update confidence scores if entities were extracted
      if (extraction.confidenceUpdates.length > 0) {
        for (const update of extraction.confidenceUpdates) {
          const [existing] = await db.select()
            .from(schema.confidenceScores)
            .where(and(
              eq(schema.confidenceScores.sessionId, id),
              eq(schema.confidenceScores.category, update.category)
            ));

          if (existing) {
            await db.update(schema.confidenceScores)
              .set({ score: Math.min(100, (existing.score || 0) + update.delta), updatedAt: new Date() })
              .where(eq(schema.confidenceScores.id, existing.id));
          }
        }
      }

      // Mark transcript as processed
      await db.update(schema.sessionTranscripts)
        .set({ processed: true, extractedEntities: extraction.entities })
        .where(eq(schema.sessionTranscripts.id, segment.id));

      return {
        segmentId: segment.id,
        entitiesExtracted: extraction.entities.length,
        relationshipsCreated: extraction.relationships.length,
        confidenceUpdates: extraction.confidenceUpdates,
      };
    }
  );

  // ─── GET /sessions/:id/suggestions — Get question suggestions ────────
  app.get<{ Params: { id: string } }>(
    '/:id/suggestions', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { id } = request.params;

      const [session] = await db.select()
        .from(schema.pdifSessions)
        .where(eq(schema.pdifSessions.id, id));
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      // Get recent transcript (last 5 segments)
      const recentSegments = await db.select()
        .from(schema.sessionTranscripts)
        .where(eq(schema.sessionTranscripts.sessionId, id))
        .orderBy(desc(schema.sessionTranscripts.createdAt))
        .limit(5);
      const recentTranscript = recentSegments.map(s => s.text).reverse().join(' ');

      // Get known facts from graph
      const graphNodes = await db.select()
        .from(schema.discoveryGraphNodes)
        .where(eq(schema.discoveryGraphNodes.accountId, session.accountId));
      const knownFacts: Record<string, any> = {};
      for (const node of graphNodes) {
        knownFacts[node.label] = node.properties;
      }

      // Get knowledge gaps
      const graphService = getDiscoveryGraphService();
      const gaps = await graphService.getKnowledgeGaps(session.accountId);

      // Get previously asked question IDs this session
      const asked = await db.select({ id: schema.questionSuggestions.id })
        .from(schema.questionSuggestions)
        .where(and(
          eq(schema.questionSuggestions.sessionId, id),
          eq(schema.questionSuggestions.wasAsked, true)
        ));
      const askedIds = asked.map(a => a.id);

      // Generate suggestions
      const engine = getSuggestionEngine();
      const suggestions = await engine.generateSuggestions({
        accountId: session.accountId,
        sessionId: id,
        currentPhase: session.currentPhase as any,
        recentTranscript,
        knownFacts,
        knowledgeGaps: gaps,
        askedQuestionIds: askedIds,
      });

      // Store suggestions in DB for tracking
      for (let i = 0; i < suggestions.length; i++) {
        await db.insert(schema.questionSuggestions).values({
          accountId: session.accountId,
          sessionId: id,
          questionText: suggestions[i].text,
          pdifPhase: suggestions[i].pdifPhase,
          topicCategory: suggestions[i].topic,
          reasoning: suggestions[i].whyItMatters,
          source: suggestions[i].source,
          rank: i + 1,
          scoringFactors: { score: suggestions[i].score },
        });
      }

      return { suggestions };
    }
  );

  // ─── GET /sessions/:id/confidence — Get confidence scores ────────────
  app.get<{ Params: { id: string } }>(
    '/:id/confidence', { preHandler: [requireAnyRole] }, async (request, _reply) => {
      const { id } = request.params;

      const scores = await db.select()
        .from(schema.confidenceScores)
        .where(eq(schema.confidenceScores.sessionId, id));

      const engine = getConfidenceEngine();
      const overall = engine.getOverallConfidence(
        scores.map(s => ({ category: s.category as any, score: s.score || 0, evidence: [], gaps: [], topQuestion: '' }))
      );

      return {
        overall,
        categories: scores.map(s => ({
          category: s.category,
          label: engine.getCategoryLabel(s.category as any),
          score: s.score || 0,
          gaps: s.gaps,
          recommendedQuestions: s.recommendedQuestions,
        })),
      };
    }
  );

  // ─── GET /sessions/:id/graph — Get discovered knowledge ──────────────
  app.get<{ Params: { id: string } }>(
    '/:id/graph', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { id } = request.params;

      const [session] = await db.select()
        .from(schema.pdifSessions)
        .where(eq(schema.pdifSessions.id, id));
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      const nodes = await db.select()
        .from(schema.discoveryGraphNodes)
        .where(eq(schema.discoveryGraphNodes.accountId, session.accountId));

      const edges = await db.select()
        .from(schema.discoveryGraphEdges)
        .where(eq(schema.discoveryGraphEdges.accountId, session.accountId));

      return { nodes, edges };
    }
  );

  // ─── POST /sessions/:id/phase — Update phase ────────────────────────
  app.post<{ Params: { id: string }; Body: { phase: string } }>(
    '/:id/phase', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { id } = request.params;
      const { phase } = request.body;

      const validPhases = ['discover', 'diagnose', 'design', 'demonstrate', 'deliver'];
      if (!validPhases.includes(phase)) {
        return reply.status(400).send({ error: 'Invalid phase' });
      }

      const [updated] = await db.update(schema.pdifSessions)
        .set({ currentPhase: phase })
        .where(eq(schema.pdifSessions.id, id))
        .returning();

      return updated || reply.status(404).send({ error: 'Session not found' });
    }
  );

  // ─── POST /sessions/:id/end — End session ───────────────────────────
  app.post<{ Params: { id: string } }>(
    '/:id/end', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { id } = request.params;

      const [session] = await db.select()
        .from(schema.pdifSessions)
        .where(eq(schema.pdifSessions.id, id));
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      // Calculate duration
      const startedAt = new Date(session.startedAt).getTime();
      const durationSeconds = Math.round((Date.now() - startedAt) / 1000);

      // Get all transcript for summary generation
      const transcripts = await db.select()
        .from(schema.sessionTranscripts)
        .where(eq(schema.sessionTranscripts.sessionId, id));
      const fullTranscript = transcripts.map(t => `[${t.speaker}]: ${t.text}`).join('\n');

      // Get confidence scores
      const confidence = await db.select()
        .from(schema.confidenceScores)
        .where(eq(schema.confidenceScores.sessionId, id));

      // Get graph nodes for summary
      const nodes = await db.select()
        .from(schema.discoveryGraphNodes)
        .where(eq(schema.discoveryGraphNodes.sessionId, id));

      // Generate AI summary
      let summary = '';
      let actionItems: any[] = [];
      try {
        const summaryResult = await generateSessionSummary(fullTranscript, confidence, nodes);
        summary = summaryResult.summary;
        actionItems = summaryResult.actionItems;
      } catch {
        summary = `Session ${session.sessionNumber} completed. ${nodes.length} facts captured. Duration: ${Math.round(durationSeconds / 60)} minutes.`;
      }

      // Update session
      const [updated] = await db.update(schema.pdifSessions)
        .set({
          status: 'ended',
          endedAt: new Date(),
          durationSeconds,
          summary,
          actionItems,
        })
        .where(eq(schema.pdifSessions.id, id))
        .returning();

      return {
        session: updated,
        summary,
        actionItems,
        entitiesDiscovered: nodes.length,
        durationMinutes: Math.round(durationSeconds / 60),
        confidenceScores: confidence,
      };
    }
  );

  // ─── POST /sessions/:id/question-asked — Mark a suggestion as used ───
  app.post<{ Params: { id: string }; Body: { questionText: string } }>(
    '/:id/question-asked', { preHandler: [requireAnyRole] }, async (request, _reply) => {
      const { id } = request.params;
      const { questionText } = request.body;

      // Find the most recent suggestion matching this text
      const [suggestion] = await db.select()
        .from(schema.questionSuggestions)
        .where(and(
          eq(schema.questionSuggestions.sessionId, id),
          eq(schema.questionSuggestions.questionText, questionText)
        ))
        .orderBy(desc(schema.questionSuggestions.suggestedAt))
        .limit(1);

      if (suggestion) {
        await db.update(schema.questionSuggestions)
          .set({ wasAsked: true, askedAt: new Date() })
          .where(eq(schema.questionSuggestions.id, suggestion.id));
      }

      return { marked: !!suggestion };
    }
  );
}

// ─── Summary Generation Helper ────────────────────────────────────────────────

async function generateSessionSummary(
  transcript: string,
  confidence: any[],
  nodes: any[]
): Promise<{ summary: string; actionItems: any[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !transcript.trim()) {
    return { summary: 'Session completed.', actionItems: [] };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `You are a transportation consulting AI generating a post-session debrief.

Confidence scores: ${JSON.stringify(confidence.map(c => ({ category: c.category, score: c.score })))}
Entities discovered: ${nodes.length} facts/contacts/processes captured

Generate a JSON response:
{
  "summary": "3-5 sentence executive summary of what was learned this session",
  "actionItems": [
    { "action": "what needs to happen", "owner": "rep or customer", "priority": "high|medium|low", "deadline": "suggested timeframe" }
  ]
}

Focus on:
- Key discoveries and their business implications
- Validated or invalidated hypotheses
- Financial impact identified
- Gaps that need follow-up
- Recommended next steps`
      }, {
        role: 'user',
        content: transcript.substring(0, 4000)
      }],
      max_tokens: 600,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) throw new Error('AI summary failed');

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);

  return {
    summary: parsed.summary || 'Session completed.',
    actionItems: parsed.actionItems || [],
  };
}
