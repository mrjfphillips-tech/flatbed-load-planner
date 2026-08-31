import { FastifyInstance } from 'fastify';
import { requireAnyRole } from '../middleware/auth.js';
import { AIEngineService } from '../services/AIEngineService.js';
import { defaultMEDDICScores } from '@ptv-discovery-coach/shared';

const aiEngine = new AIEngineService();

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  // POST /ai/suggest-questions
  app.post<{ Body: { element: string; context?: string; persona?: string; industry?: string } }>(
    '/suggest-questions', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { element } = request.body;
      if (!element) {
        return reply.status(400).send({ error: 'element is required' });
      }
      try {
        const scores = defaultMEDDICScores();
        const questions = await aiEngine.generateDynamicFollowUps([], scores, element as any);
        return { questions };
      } catch (err) {
        return reply.status(500).send({ error: err instanceof Error ? err.message : 'AI error' });
      }
    }
  );

  // POST /ai/answer-summary
  app.post<{ Body: { questionText: string; element: string; recentTranscript?: string } }>(
    '/answer-summary', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { questionText, element, recentTranscript } = request.body;
      if (!questionText || !element) {
        return reply.status(400).send({ error: 'questionText and element are required' });
      }
      try {
        const summary = await aiEngine.generateAnswerSummary(questionText, element, recentTranscript ?? '');
        return { summary };
      } catch (err) {
        return reply.status(500).send({ error: err instanceof Error ? err.message : 'AI error' });
      }
    }
  );

  // POST /ai/gap-recommendations
  app.post<{ Body: { scores: Record<string, number> } }>(
    '/gap-recommendations', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { scores } = request.body;
      if (!scores) {
        return reply.status(400).send({ error: 'scores object is required' });
      }
      try {
        const gaps = aiEngine.computeGapRecommendations(scores as any);
        return { gaps };
      } catch (err) {
        return reply.status(500).send({ error: err instanceof Error ? err.message : 'AI error' });
      }
    }
  );

  // POST /ai/analyze-answer — core coaching endpoint: analyze transcript, score, suggest next question
  app.post<{ Body: { questionText: string; element: string; recentTranscript: string; currentScores: Record<string, number>; askedQuestionTexts?: string[]; accountIndustry?: string } }>(
    '/analyze-answer', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { questionText, element, recentTranscript, currentScores, askedQuestionTexts, accountIndustry } = request.body;
      if (!questionText || !recentTranscript) {
        return reply.status(400).send({ error: 'questionText and recentTranscript are required' });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return reply.status(503).send({ error: 'OpenAI API key not configured' });
      }

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{
              role: 'system',
              content: `You are a MEDDIC sales coaching AI. A sales rep just asked a discovery question and the customer responded. Analyze the response quality and suggest the next best question.

MEDDIC elements: Metrics, EconomicBuyer, DecisionCriteria, DecisionProcess, IdentifyPain, Champion, People, Organization, Goals, Plans, Obstacles, PlansToOvercomeObstacles

Current coverage scores (0-100): ${JSON.stringify(currentScores)}
Industry: ${accountIndustry || 'unknown'}
Questions already asked: ${(askedQuestionTexts || []).slice(-5).join('; ')}

Return a JSON object:
{
  "summary": "1-2 sentence summary of what the customer revealed",
  "qualityScore": number 0-100 (how well did this response advance discovery?),
  "scoreDelta": { "ElementName": points_gained } (only elements this answer touched, +5 to +20 each),
  "coveredElements": ["ElementName"] (which elements got new info),
  "nextQuestion": {
    "text": "the next question to ask",
    "element": "which MEDDIC element it targets",
    "reason": "why this is the best next question"
  }
}

Pick the next question targeting the LOWEST scoring element that hasn't been asked about recently. Return ONLY valid JSON.`
            }, {
              role: 'user',
              content: `Question asked: "${questionText}" (targeting: ${element})\n\nCustomer response transcript:\n"${recentTranscript}"`
            }],
            max_tokens: 500,
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          console.error('[AI] analyze-answer error:', err);
          return reply.status(500).send({ error: 'AI analysis failed' });
        }

        const data = await response.json() as any;
        const content = data.choices?.[0]?.message?.content || '{}';
        const result = JSON.parse(content);
        return result;
      } catch (err) {
        console.error('[AI] analyze-answer error:', err);
        return reply.status(500).send({ error: 'AI analysis failed' });
      }
    }
  );

  // POST /ai/detect-segment — auto-detect industry segment from company name
  app.post<{ Body: { companyName: string; title?: string } }>(
    '/detect-segment', { preHandler: [requireAnyRole] }, async (request, reply) => {
      const { companyName, title } = request.body;
      if (!companyName) {
        return reply.status(400).send({ error: 'companyName is required' });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return reply.status(503).send({ error: 'OpenAI API key not configured' });
      }

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: `Given the company "${companyName}"${title ? ` (contact title: "${title}")` : ''}, which industry segment best fits?

Existing segments:
- ThirdPartyLogistics (3PL, freight brokers, carriers, warehousing providers)
- BuildingSupply (building materials, lumber, hardware distribution)
- ManufacturingDistribution (manufacturers, industrial distributors)
- RetailEcommerce (retailers, online stores, consumer goods)
- FoodBeverageFMCG (food/beverage production, FMCG, grocery distribution)
- HealthcarePharma (healthcare, pharmaceutical, medical device)
- FieldServices (HVAC, plumbing, electrical, home services, maintenance)

IMPORTANT: Do NOT return "Other". If the company does not clearly fit one of the above segments, you MUST create a new specific segment.

If the company fits one of the above, respond with ONLY the segment ID (e.g. "ManufacturingDistribution").
If the company does NOT fit any of the above, respond with a JSON object for a NEW segment:
{"new": true, "id": "CamelCaseId", "label": "Short Label (2-3 words)", "icon": "single emoji"}

Examples:
- Shell, BP, Exxon → {"new": true, "id": "EnergyOilGas", "label": "Oil & Gas", "icon": "⛽"}
- Lufthansa, Delta → {"new": true, "id": "Aviation", "label": "Aviation", "icon": "✈️"}
- Deutsche Bank, Chase → {"new": true, "id": "FinancialServices", "label": "Financial Services", "icon": "🏦"}
- Siemens, ABB → {"new": true, "id": "IndustrialTech", "label": "Industrial Tech", "icon": "🔌"}
- DHL, FedEx, UPS → ThirdPartyLogistics

Return ONLY the segment ID string OR the JSON object. Nothing else.`
            }],
            max_tokens: 80,
            temperature: 0,
          }),
        });

        if (!response.ok) {
          return reply.status(500).send({ error: 'OpenAI request failed' });
        }

        const data = await response.json() as any;
        const raw = data.choices?.[0]?.message?.content?.trim() || '';
        
        // Check if it's a JSON response (new segment)
        if (raw.startsWith('{')) {
          try {
            const parsed = JSON.parse(raw);
            return { segmentId: parsed.id, isNew: true, label: parsed.label, icon: parsed.icon, raw };
          } catch {
            return { segmentId: 'Other', isNew: false, raw };
          }
        }
        
        // Clean up plain segment ID
        const segmentId = raw.replace(/['"]/g, '').trim();
        return { segmentId, isNew: false, raw };
      } catch (err) {
        return reply.status(500).send({ error: 'Segment detection failed' });
      }
    }
  );
}
