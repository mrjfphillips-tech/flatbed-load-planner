/**
 * PDIF Briefing Routes — Pre-session prep and post-session summary
 *
 *   GET  /api/pdif/accounts/:id/briefing  — Pre-session intelligence briefing
 *   GET  /api/pdif/sessions/:id/summary   — Post-session summary with action items
 *
 * PDIF V1 Tasks 4.1 + 4.2
 */

import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, desc } from 'drizzle-orm';
import { requireAnyRole } from '../middleware/auth.js';
import { getPhaseEngine } from '../intelligence/PDIFPhaseEngine.js';
import { getConfidenceEngine } from '../intelligence/ConfidenceEngine.js';

export async function pdifBriefingRoutes(app: FastifyInstance): Promise<void> {

  // ─── GET /accounts/:id/briefing — Pre-session intelligence ───────────
  app.get<{ Params: { id: string } }>(
    '/accounts/:id/briefing', { preHandler: [requireAnyRole] }, async (request, _reply) => {
      const { id: accountId } = request.params;

      // Get previous sessions for this account
      const sessions = await db.select()
        .from(schema.pdifSessions)
        .where(eq(schema.pdifSessions.accountId, accountId))
        .orderBy(desc(schema.pdifSessions.startedAt))
        .limit(5);

      const sessionCount = sessions.length;
      const lastSession = sessions[0];

      // Get all graph nodes for this account (accumulated knowledge)
      const graphNodes = await db.select()
        .from(schema.discoveryGraphNodes)
        .where(eq(schema.discoveryGraphNodes.accountId, accountId));

      // Get latest confidence scores
      let confidence: any[] = [];
      if (lastSession) {
        confidence = await db.select()
          .from(schema.confidenceScores)
          .where(eq(schema.confidenceScores.sessionId, lastSession.id));
      }

      // Calculate phase recommendation
      const phaseEngine = getPhaseEngine();
      const phaseProgress = phaseEngine.calculatePhaseProgress(
        graphNodes.map(n => ({ nodeType: n.nodeType, confidence: n.confidence || 0 }))
      );
      const recommendedFocus = phaseEngine.getRecommendedFocus(phaseProgress, sessionCount + 1);

      // Get knowledge gaps
      const knownTypes = new Set(graphNodes.map(n => n.nodeType));
      const gaps: string[] = [];
      if (!knownTypes.has('asset')) gaps.push('Fleet size and composition');
      if (!knownTypes.has('process')) gaps.push('Planning and dispatch processes');
      if (!knownTypes.has('system')) gaps.push('Technology stack');
      if (!knownTypes.has('metric')) gaps.push('Current KPIs and performance');
      if (!knownTypes.has('pain_point')) gaps.push('Operational pain points');
      if (!knownTypes.has('objective')) gaps.push('Business objectives');
      if (!knownTypes.has('contact')) gaps.push('Key stakeholders');

      // Build key facts summary
      const keyFacts = graphNodes
        .filter(n => n.confidence && n.confidence >= 0.6)
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, 8)
        .map(n => ({ type: n.nodeType, label: n.label, confidence: n.confidence }));

      // Get contacts known
      const contacts = graphNodes
        .filter(n => n.nodeType === 'contact')
        .map(n => ({ name: n.label, properties: n.properties }));

      // Generate suggested opening questions (top 3 gaps)
      const openingQuestions = gaps.slice(0, 3).map(gap => {
        const questions: Record<string, string> = {
          'Fleet size and composition': 'Tell me about your fleet — how many vehicles, what types, and how are they deployed?',
          'Planning and dispatch processes': 'Walk me through how your team plans and dispatches routes each day.',
          'Technology stack': 'What systems does your logistics team rely on today?',
          'Current KPIs and performance': 'What metrics do you track to measure transportation performance?',
          'Operational pain points': 'What are the biggest operational challenges keeping your team up at night?',
          'Business objectives': 'What are the key business objectives driving your transportation strategy this year?',
          'Key stakeholders': 'Who else is involved in transportation technology decisions?',
        };
        return { gap, question: questions[gap] || `What can you tell me about ${gap.toLowerCase()}?` };
      });

      // Build the briefing
      return {
        accountId,
        sessionNumber: sessionCount + 1,

        // Quick brief (30 seconds)
        quickBrief: {
          headline: sessionCount === 0
            ? `First meeting — focus on understanding their business`
            : `Session ${sessionCount + 1} — ${keyFacts.length} facts known, ${gaps.length} gaps remaining`,
          recommendedPhase: recommendedFocus,
          phaseProgress,
          overallConfidence: confidence.length > 0
            ? Math.round(confidence.reduce((s, c) => s + (c.score || 0), 0) / confidence.length)
            : 0,
        },

        // Key facts (what we already know)
        keyFacts,

        // Knowledge gaps (what's still unknown)
        gaps,

        // Contacts known
        contacts,

        // Suggested opening questions
        openingQuestions,

        // Last session summary (if exists)
        lastSession: lastSession ? {
          date: lastSession.startedAt,
          phase: lastSession.currentPhase,
          summary: lastSession.summary,
          actionItems: lastSession.actionItems,
          durationMinutes: lastSession.durationSeconds ? Math.round(lastSession.durationSeconds / 60) : null,
        } : null,
      };
    }
  );

  // ─── GET /sessions/:id/summary — Post-session summary ────────────────
  app.get<{ Params: { id: string } }>(
    '/sessions/:id/summary', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { id: sessionId } = request.params;

      const [session] = await db.select()
        .from(schema.pdifSessions)
        .where(eq(schema.pdifSessions.id, sessionId));

      if (!session) return reply.status(404).send({ error: 'Session not found' });

      // Get all entities discovered this session
      const nodesThisSession = await db.select()
        .from(schema.discoveryGraphNodes)
        .where(eq(schema.discoveryGraphNodes.sessionId, sessionId));

      // Get confidence scores
      const confidence = await db.select()
        .from(schema.confidenceScores)
        .where(eq(schema.confidenceScores.sessionId, sessionId));

      // Get question usage stats
      const suggestionsUsed = await db.select()
        .from(schema.questionSuggestions)
        .where(eq(schema.questionSuggestions.sessionId, sessionId));
      const asked = suggestionsUsed.filter(s => s.wasAsked);

      // Get all transcript for this session
      const transcripts = await db.select()
        .from(schema.sessionTranscripts)
        .where(eq(schema.sessionTranscripts.sessionId, sessionId));

      // Calculate gaps for next session
      const allNodes = await db.select({
        nodeType: schema.discoveryGraphNodes.nodeType,
        confidence: schema.discoveryGraphNodes.confidence,
      }).from(schema.discoveryGraphNodes)
        .where(eq(schema.discoveryGraphNodes.accountId, session.accountId));

      const phaseEngine = getPhaseEngine();
      const phaseProgress = phaseEngine.calculatePhaseProgress(allNodes);

      // Build summary response
      return {
        session: {
          id: session.id,
          sessionNumber: session.sessionNumber,
          phase: session.currentPhase,
          status: session.status,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          durationMinutes: session.durationSeconds ? Math.round(session.durationSeconds / 60) : null,
        },

        // AI-generated summary (stored when session ended)
        summary: session.summary || 'Session in progress — summary generates on end.',
        actionItems: session.actionItems || [],

        // Discovery quality scorecard
        scorecard: {
          entitiesDiscovered: nodesThisSession.length,
          questionsAsked: asked.length,
          questionsSuggested: suggestionsUsed.length,
          transcriptSegments: transcripts.length,
          confidenceGained: confidence.reduce((sum, c) => sum + (c.score || 0), 0),
        },

        // Confidence breakdown
        confidence: confidence.map(c => ({
          category: c.category,
          score: c.score,
          label: getConfidenceEngine().getCategoryLabel(c.category as any),
        })),

        // Phase progress (all phases)
        phaseProgress,

        // What was learned (top entities by confidence)
        discoveries: nodesThisSession
          .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
          .slice(0, 10)
          .map(n => ({
            type: n.nodeType,
            label: n.label,
            confidence: n.confidence,
          })),

        // Gaps to close next session
        remainingGaps: (() => {
          const types = new Set(allNodes.map(n => n.nodeType));
          const g: string[] = [];
          if (!types.has('metric')) g.push('Financial KPIs and cost metrics');
          if (!types.has('system')) g.push('Full technology stack mapping');
          if (!types.has('pain_point') || allNodes.filter(n => n.nodeType === 'pain_point').length < 3) g.push('Additional pain points to quantify');
          if (!types.has('objective')) g.push('Executive objectives and success criteria');
          if (allNodes.filter(n => n.nodeType === 'contact').length < 2) g.push('Additional stakeholders in buying committee');
          return g;
        })(),

        // CRM export status
        crmExported: session.crmExported,

        // Follow-up email (if generated)
        followUpEmail: session.followUpEmail,
      };
    }
  );
}
