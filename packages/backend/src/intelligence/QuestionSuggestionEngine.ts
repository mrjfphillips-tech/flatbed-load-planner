/**
 * QuestionSuggestionEngine
 *
 * The core coaching intelligence. Decides what 2-3 questions to suggest
 * at any moment based on:
 *   1. What we already know (Discovery Graph)
 *   2. What's the most valuable unknown (gap analysis)
 *   3. What phase are we in (PDIF Phase Engine)
 *   4. What fits the current conversation (recent transcript)
 *   5. What hasn't been asked yet (question history)
 *
 * Questions are framed as a consultant would ask — not checklist items.
 *
 * PDIF V1 Task 2.3
 */

import { getQuestionsForPhase, getRelevantPatterns } from './TransportationKnowledgePack.js';
import type { PDIFPhase } from './PDIFPhaseEngine.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SuggestedQuestion {
  text: string;
  whyItMatters: string;
  pdifPhase: string;
  topic: string;
  score: number;            // 0-100 composite ranking score
  source: 'template' | 'ai_generated' | 'pattern_driven';
}

export interface SuggestionContext {
  accountId: string;
  sessionId: string;
  currentPhase: PDIFPhase;
  recentTranscript: string;       // Last 60s of conversation
  knownFacts: Record<string, any>; // What's in the graph
  knowledgeGaps: string[];        // What's still unknown
  askedQuestionIds: string[];     // What's already been asked this session
  industry?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class QuestionSuggestionEngine {
  private openaiApiKey: string;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
  }

  /**
   * Generate 2-3 contextual question suggestions.
   * This is called every 8-10 seconds when new transcript arrives.
   */
  async generateSuggestions(context: SuggestionContext): Promise<SuggestedQuestion[]> {
    // Strategy: Combine template-based and AI-generated questions
    // 1. Get phase-appropriate templates
    // 2. Score them by relevance to current conversation
    // 3. If AI available, generate 1 dynamic question from context
    // 4. Return top 2-3 ranked suggestions

    const templateSuggestions = this.scoreTemplates(context);
    const patternSuggestions = this.getPatternDrivenQuestions(context);

    let aiSuggestion: SuggestedQuestion | null = null;
    if (this.openaiApiKey && context.recentTranscript.length > 30) {
      aiSuggestion = await this.generateAIQuestion(context);
    }

    // Combine all suggestions
    const all: SuggestedQuestion[] = [
      ...templateSuggestions,
      ...patternSuggestions,
      ...(aiSuggestion ? [aiSuggestion] : []),
    ];

    // Sort by score, deduplicate, return top 3
    const ranked = all
      .sort((a, b) => b.score - a.score)
      .filter((q, i, arr) => arr.findIndex(x => x.text === q.text) === i)
      .slice(0, 3);

    return ranked;
  }

  /**
   * Score template questions by relevance to current context.
   */
  private scoreTemplates(context: SuggestionContext): SuggestedQuestion[] {
    const templates = getQuestionsForPhase(context.currentPhase, context.askedQuestionIds);

    return templates.map(t => {
      let score = 50; // Base score

      // Boost if targets a known gap
      if (context.knowledgeGaps.some(gap =>
        gap.toLowerCase().includes(t.topic.replace(/_/g, ' '))
      )) {
        score += 25;
      }

      // Boost if topic matches recent conversation
      const topicWords = t.topic.replace(/_/g, ' ').split(' ');
      const recentLower = context.recentTranscript.toLowerCase();
      if (topicWords.some(w => recentLower.includes(w))) {
        score += 15; // Conversational fit
      }

      // Boost for earlier phases (fill fundamentals first)
      const phaseOrder = ['discover', 'diagnose', 'design', 'demonstrate', 'deliver'];
      const phaseIdx = phaseOrder.indexOf(t.pdifPhase);
      score += Math.max(0, (4 - phaseIdx) * 3);

      // Slight randomness to avoid always showing the same order
      score += Math.random() * 5;

      return {
        text: t.text,
        whyItMatters: t.whyItMatters,
        pdifPhase: t.pdifPhase,
        topic: t.topic,
        score: Math.round(score),
        source: 'template' as const,
      };
    });
  }

  /**
   * Generate questions from causal patterns that match known facts.
   * E.g., if we know they plan manually, suggest the utilization question.
   */
  private getPatternDrivenQuestions(context: SuggestionContext): SuggestedQuestion[] {
    const patterns = getRelevantPatterns(context.knownFacts);

    return patterns.slice(0, 2).map(p => ({
      text: p.validationQuestion,
      whyItMatters: `Pattern detected: ${p.effect}. This question validates a potential ${p.financialImpact.includes('$') ? p.financialImpact : 'significant'} opportunity.`,
      pdifPhase: p.pdifPhase,
      topic: p.id,
      score: Math.round(70 + (p.confidence * 20)), // Pattern confidence boosts score
      source: 'pattern_driven' as const,
    }));
  }

  /**
   * Use OpenAI to generate a contextually perfect follow-up question
   * based on what was just said in the conversation.
   */
  private async generateAIQuestion(context: SuggestionContext): Promise<SuggestedQuestion | null> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'system',
            content: `You are a senior transportation consultant generating the SINGLE best follow-up question for a discovery conversation.

Current PDIF phase: ${context.currentPhase}
Known about this customer: ${JSON.stringify(context.knownFacts).substring(0, 500)}
Knowledge gaps: ${context.knowledgeGaps.join('; ')}
Industry: ${context.industry || 'transportation/logistics'}

Rules:
- Sound like an experienced consultant, NOT a checklist
- Flow naturally from what was just discussed
- Target the highest-value unknown information
- Be specific enough to get a quantifiable answer
- Demonstrate transportation industry expertise in how you frame it

Return JSON: { "text": "the question", "whyItMatters": "one sentence why", "topic": "category" }`
          }, {
            role: 'user',
            content: `Recent conversation:\n"${context.recentTranscript.substring(0, 500)}"\n\nWhat's the single best follow-up question?`
          }],
          max_tokens: 200,
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) return null;

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      if (!parsed.text) return null;

      return {
        text: parsed.text,
        whyItMatters: parsed.whyItMatters || 'AI-generated based on conversation context',
        pdifPhase: context.currentPhase,
        topic: parsed.topic || 'ai_contextual',
        score: 85, // AI-generated questions get high base score (contextually relevant)
        source: 'ai_generated',
      };
    } catch {
      return null;
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _suggestionEngine: QuestionSuggestionEngine | null = null;

export function getSuggestionEngine(): QuestionSuggestionEngine {
  if (!_suggestionEngine) {
    _suggestionEngine = new QuestionSuggestionEngine();
  }
  return _suggestionEngine;
}
