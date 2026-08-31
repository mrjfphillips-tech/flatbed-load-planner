/**
 * PDIF Export Routes — CRM export and document generation
 *
 *   POST /api/pdif/sessions/:id/export/crm     — Push to Salesforce
 *   POST /api/pdif/sessions/:id/export/email    — Generate follow-up email
 *
 * V1 Salesforce export is BASIC — updates opportunity fields and creates an activity.
 * Full bidirectional sync is V2.
 *
 * PDIF V1 Task 4.3
 */

import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { requireAnyRole } from '../middleware/auth.js';

export async function pdifExportRoutes(app: FastifyInstance): Promise<void> {

  // ─── POST /sessions/:id/export/crm — Push to Salesforce ──────────────
  app.post<{ Params: { id: string }; Body: { opportunityId?: string } }>(
    '/sessions/:id/export/crm', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { id: sessionId } = request.params;
      const { opportunityId: _opportunityId } = request.body;

      const [session] = await db.select()
        .from(schema.pdifSessions)
        .where(eq(schema.pdifSessions.id, sessionId));
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      // Get confidence for opportunity fields
      const confidence = await db.select()
        .from(schema.confidenceScores)
        .where(eq(schema.confidenceScores.sessionId, sessionId));
      const overallConfidence = confidence.length > 0
        ? Math.round(confidence.reduce((s, c) => s + (c.score || 0), 0) / confidence.length)
        : 0;

      // Get node count for activity description
      const nodes = await db.select()
        .from(schema.discoveryGraphNodes)
        .where(eq(schema.discoveryGraphNodes.sessionId, sessionId));

      // V1: Generate the CRM update payload (Salesforce format)
      // In V2 this actually calls the Salesforce API. V1 returns the payload for manual paste.
      const crmPayload = {
        opportunity: {
          stageName: mapPhaseToStage(session.currentPhase || 'discover'),
          discoveryConfidence: overallConfidence,
          pdifPhase: session.currentPhase,
          lastDiscoverySession: session.startedAt,
          nextSteps: session.summary?.substring(0, 255) || '',
        },
        activity: {
          subject: `PDIF Discovery Session ${session.sessionNumber}`,
          description: [
            `Duration: ${session.durationSeconds ? Math.round(session.durationSeconds / 60) : '?'} minutes`,
            `Phase: ${session.currentPhase}`,
            `Discovery Confidence: ${overallConfidence}%`,
            `Entities Captured: ${nodes.length}`,
            '',
            'Summary:',
            session.summary || 'No summary generated.',
            '',
            'Action Items:',
            ...(session.actionItems as any[] || []).map((a: any) => `- [${a.priority}] ${a.action} (${a.owner})`),
          ].join('\n'),
          activityDate: new Date().toISOString().split('T')[0],
        },
        customFields: confidence.map(c => ({
          fieldName: `Discovery_${c.category}__c`,
          value: c.score,
        })),
      };

      // Mark session as CRM exported
      await db.update(schema.pdifSessions)
        .set({ crmExported: true })
        .where(eq(schema.pdifSessions.id, sessionId));

      return {
        status: 'ready_for_export',
        message: 'CRM payload generated. V1: Copy to Salesforce manually. V2: Auto-push via API.',
        payload: crmPayload,
      };
    }
  );

  // ─── POST /sessions/:id/export/email — Generate follow-up email ──────
  app.post<{ Params: { id: string }; Body: { recipientName?: string; recipientEmail?: string } }>(
    '/sessions/:id/export/email', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { id: sessionId } = request.params;
      const { recipientName, recipientEmail } = request.body;

      const [session] = await db.select()
        .from(schema.pdifSessions)
        .where(eq(schema.pdifSessions.id, sessionId));
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      // Get account name
      const [account] = await db.select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, session.accountId));

      // Generate email using AI
      const apiKey = process.env.OPENAI_API_KEY;
      let emailContent = '';

      if (apiKey && session.summary) {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{
                role: 'system',
                content: `Generate a professional follow-up email after a transportation discovery meeting. Be warm but business-focused. Reference specific topics discussed. Include clear next steps.`
              }, {
                role: 'user',
                content: `Meeting with: ${account?.name || 'the customer'}
Recipient: ${recipientName || 'the stakeholder'}
Session summary: ${session.summary}
Action items: ${JSON.stringify(session.actionItems)}

Write a brief, professional follow-up email (4-6 paragraphs max).`
              }],
              max_tokens: 400,
              temperature: 0.4,
            }),
          });

          if (response.ok) {
            const data = await response.json() as any;
            emailContent = data.choices?.[0]?.message?.content || '';
          }
        } catch {}
      }

      if (!emailContent) {
        emailContent = `Hi ${recipientName || 'there'},

Thank you for taking the time to meet today. I appreciated learning more about your transportation operation.

${session.summary || 'We covered several important topics during our discussion.'}

As discussed, here are the next steps:
${(session.actionItems as any[] || []).map((a: any) => `- ${a.action}`).join('\n') || '- Follow up with additional information'}

I look forward to continuing our conversation.

Best regards`;
      }

      // Store email on session
      await db.update(schema.pdifSessions)
        .set({ followUpEmail: emailContent })
        .where(eq(schema.pdifSessions.id, sessionId));

      return {
        email: emailContent,
        subject: `Follow-up: Transportation Discovery — ${account?.name || 'Our Discussion'}`,
        to: recipientEmail || '',
      };
    }
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function mapPhaseToStage(phase: string): string {
  const mapping: Record<string, string> = {
    discover: 'Discovery',
    diagnose: 'Qualification',
    design: 'Solution Design',
    demonstrate: 'Proposal/Demo',
    deliver: 'Negotiation',
  };
  return mapping[phase] || 'Discovery';
}
