/**
 * DiscoveryGraphService
 *
 * The platform's memory. Takes transcript segments and extracts structured
 * knowledge: facts, contacts, processes, systems, pain points, metrics, and assets.
 *
 * This service is the bridge between raw conversation text and the Discovery Graph.
 * It uses OpenAI to perform entity extraction and relationship detection.
 *
 * Architecture:
 *   TranscriptSegment → DiscoveryGraphService → Graph Nodes + Edges stored in DB
 *
 * PDIF V1 Task 1.4
 */

import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedEntity {
  nodeType: string;
  label: string;
  properties: Record<string, any>;
  confidence: number;
  evidenceText: string;
}

export interface ExtractedRelationship {
  sourceLabel: string;
  targetLabel: string;
  edgeType: string;
  confidence: number;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  confidenceUpdates: Array<{ category: string; delta: number; reason: string }>;
}

export interface GraphNode {
  id: string;
  nodeType: string;
  label: string;
  properties: Record<string, any>;
  confidence: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class DiscoveryGraphService {
  private openaiApiKey: string;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    if (!this.openaiApiKey) {
      console.warn('[DiscoveryGraph] OPENAI_API_KEY not set — entity extraction will not function');
    }
  }

  /**
   * Process a transcript segment: extract entities, relationships, and confidence updates.
   * This is the main entry point — called every time a new final transcript arrives.
   */
  async processTranscript(
    sessionId: string,
    accountId: string,
    text: string,
    speaker: string
  ): Promise<ExtractionResult> {
    if (!text.trim() || text.trim().length < 10) {
      return { entities: [], relationships: [], confidenceUpdates: [] };
    }

    // Get existing graph context (what do we already know about this account?)
    const existingNodes = await this.getExistingNodes(accountId);
    const existingContext = existingNodes
      .slice(0, 20) // Limit context to avoid token overflow
      .map(n => `${n.nodeType}: ${n.label}`)
      .join('; ');

    // Call OpenAI to extract entities and relationships
    const extraction = await this.extractFromText(text, speaker, existingContext);

    // Store extracted entities as graph nodes
    const createdNodeIds: Map<string, string> = new Map();
    for (const entity of extraction.entities) {
      const nodeId = await this.upsertNode(accountId, sessionId, entity);
      createdNodeIds.set(entity.label, nodeId);
    }

    // Store relationships as graph edges
    for (const rel of extraction.relationships) {
      const sourceId = createdNodeIds.get(rel.sourceLabel) || await this.findNodeByLabel(accountId, rel.sourceLabel);
      const targetId = createdNodeIds.get(rel.targetLabel) || await this.findNodeByLabel(accountId, rel.targetLabel);

      if (sourceId && targetId) {
        await this.createEdge(accountId, sessionId, sourceId, targetId, rel.edgeType, rel.confidence);
      }
    }

    return extraction;
  }

  /**
   * Get all current nodes for an account (for context and display).
   */
  async getExistingNodes(accountId: string): Promise<GraphNode[]> {
    const nodes = await db.select({
      id: schema.discoveryGraphNodes.id,
      nodeType: schema.discoveryGraphNodes.nodeType,
      label: schema.discoveryGraphNodes.label,
      properties: schema.discoveryGraphNodes.properties,
      confidence: schema.discoveryGraphNodes.confidence,
    })
    .from(schema.discoveryGraphNodes)
    .where(
      and(
        eq(schema.discoveryGraphNodes.accountId, accountId),
        // Only get current facts (validUntil is null)
      )
    )
    .limit(100);

    return nodes as GraphNode[];
  }

  /**
   * Get knowledge gaps — what's important but still unknown.
   */
  async getKnowledgeGaps(accountId: string): Promise<string[]> {
    const nodes = await this.getExistingNodes(accountId);
    const gaps: string[] = [];

    // Check for missing critical knowledge areas
    const nodeTypes = new Set(nodes.map(n => n.nodeType));

    if (!nodeTypes.has('asset')) gaps.push('Fleet size and composition unknown');
    if (!nodeTypes.has('process')) gaps.push('Planning and dispatch processes not yet explored');
    if (!nodeTypes.has('system')) gaps.push('Technology stack not identified');
    if (!nodeTypes.has('metric')) gaps.push('Current KPIs and performance not established');
    if (!nodeTypes.has('pain_point')) gaps.push('Operational pain points not yet uncovered');
    if (!nodeTypes.has('objective')) gaps.push('Business objectives and goals not discussed');
    if (!nodeTypes.has('contact')) gaps.push('Key stakeholders not yet identified');

    return gaps;
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  /**
   * Call OpenAI to extract entities and relationships from transcript text.
   */
  private async extractFromText(
    text: string,
    speaker: string,
    existingContext: string
  ): Promise<ExtractionResult> {
    if (!this.openaiApiKey) {
      // Fallback: basic keyword extraction without AI
      return this.basicExtraction(text);
    }

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
            content: `You are a transportation operations analyst extracting structured knowledge from a sales discovery conversation.

Speaker: ${speaker} (${speaker === 'customer' ? 'the prospect' : speaker === 'rep' ? 'the sales rep' : 'unknown speaker'})

Already known about this account: ${existingContext || 'Nothing yet — this is early discovery.'}

Extract ALL relevant entities and relationships from the transcript. Return a JSON object:
{
  "entities": [
    {
      "nodeType": "fact|contact|process|system|pain_point|objective|constraint|metric|asset|vendor",
      "label": "short descriptive label",
      "properties": { key-value pairs with specifics },
      "confidence": 0.0-1.0 (how certain is this based on what was said),
      "evidenceText": "exact quote or close paraphrase that supports this"
    }
  ],
  "relationships": [
    {
      "sourceLabel": "label of source entity",
      "targetLabel": "label of target entity",
      "edgeType": "causes|depends_on|uses|impacts|owns|reports_to|measures|constrains",
      "confidence": 0.0-1.0
    }
  ],
  "confidenceUpdates": [
    {
      "category": "company_operations|fleet_network|technology_data|financial_drivers|buying_process",
      "delta": 5-20 (how much confidence increased for this category),
      "reason": "why this text increases our understanding"
    }
  ]
}

Rules:
- Only extract what is EXPLICITLY stated or strongly implied
- Set confidence based on how direct and specific the statement is
- "About 200 trucks" → confidence 0.8 (approximate)
- "We have exactly 237 vehicles" → confidence 0.95 (specific)
- "I think we might..." → confidence 0.5 (uncertain)
- Do NOT infer things that weren't said
- Do NOT extract from the rep's questions — only from the customer's answers
- If nothing extractable, return empty arrays
- Return ONLY valid JSON`
          }, {
            role: 'user',
            content: text
          }],
          max_tokens: 800,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        console.error('[DiscoveryGraph] OpenAI error:', response.status);
        return this.basicExtraction(text);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '{}';

      try {
        const parsed = JSON.parse(content);
        return {
          entities: parsed.entities || [],
          relationships: parsed.relationships || [],
          confidenceUpdates: parsed.confidenceUpdates || [],
        };
      } catch {
        return this.basicExtraction(text);
      }
    } catch (err) {
      console.error('[DiscoveryGraph] Extraction failed:', err);
      return this.basicExtraction(text);
    }
  }

  /**
   * Basic keyword-based extraction when AI is unavailable.
   * Simple pattern matching for common transportation entities.
   */
  private basicExtraction(text: string): ExtractionResult {
    const entities: ExtractedEntity[] = [];
    const lower = text.toLowerCase();

    // Detect fleet mentions
    const fleetMatch = text.match(/(\d+)\s*(trucks?|vehicles?|tractors?|trailers?)/i);
    if (fleetMatch) {
      entities.push({
        nodeType: 'asset',
        label: `Fleet: ${fleetMatch[1]} ${fleetMatch[2]}`,
        properties: { count: parseInt(fleetMatch[1]), type: fleetMatch[2].toLowerCase() },
        confidence: 0.8,
        evidenceText: fleetMatch[0],
      });
    }

    // Detect system mentions
    const systems = ['SAP', 'Oracle', 'Blue Yonder', 'Manhattan', 'MercuryGate', 'Descartes',
                     'Samsara', 'Geotab', 'Omnitracs', 'FourKites', 'project44'];
    for (const sys of systems) {
      if (lower.includes(sys.toLowerCase())) {
        entities.push({
          nodeType: 'system',
          label: sys,
          properties: { vendor: sys },
          confidence: 0.85,
          evidenceText: text.substring(Math.max(0, lower.indexOf(sys.toLowerCase()) - 20), lower.indexOf(sys.toLowerCase()) + sys.length + 20),
        });
      }
    }

    // Detect process mentions
    if (lower.includes('manual') && (lower.includes('plan') || lower.includes('route') || lower.includes('dispatch'))) {
      entities.push({
        nodeType: 'process',
        label: 'Manual Planning/Dispatch',
        properties: { method: 'manual', automationLevel: 'none' },
        confidence: 0.75,
        evidenceText: text,
      });
    }

    // Detect pain point mentions
    const painKeywords = ['problem', 'challenge', 'struggle', 'issue', 'pain', 'frustrat', 'difficult', 'complaint'];
    if (painKeywords.some(kw => lower.includes(kw))) {
      entities.push({
        nodeType: 'pain_point',
        label: text.substring(0, 80),
        properties: { rawText: text },
        confidence: 0.6,
        evidenceText: text,
      });
    }

    return { entities, relationships: [], confidenceUpdates: [] };
  }

  /**
   * Insert or update a node in the graph.
   * If a node with the same label already exists for this account, update its confidence.
   */
  private async upsertNode(
    accountId: string,
    sessionId: string,
    entity: ExtractedEntity
  ): Promise<string> {
    // Check if this entity already exists
    const existing = await this.findNodeByLabel(accountId, entity.label);

    if (existing) {
      // Update confidence (increase if new evidence confirms)
      await db.update(schema.discoveryGraphNodes)
        .set({
          confidence: Math.min(1.0, entity.confidence * 1.1), // Slight boost for re-confirmation
          updatedAt: new Date(),
        })
        .where(eq(schema.discoveryGraphNodes.id, existing));
      return existing;
    }

    // Create new node
    const [node] = await db.insert(schema.discoveryGraphNodes).values({
      accountId,
      sessionId,
      nodeType: entity.nodeType,
      label: entity.label,
      properties: entity.properties,
      confidence: entity.confidence,
      evidenceText: entity.evidenceText,
      evidenceSource: 'transcript',
    }).returning();

    return node.id;
  }

  /**
   * Find a node by its label within an account.
   */
  private async findNodeByLabel(accountId: string, label: string): Promise<string | null> {
    const [node] = await db.select({ id: schema.discoveryGraphNodes.id })
      .from(schema.discoveryGraphNodes)
      .where(
        and(
          eq(schema.discoveryGraphNodes.accountId, accountId),
          eq(schema.discoveryGraphNodes.label, label)
        )
      )
      .limit(1);

    return node?.id || null;
  }

  /**
   * Create a relationship edge between two nodes.
   */
  private async createEdge(
    accountId: string,
    sessionId: string,
    sourceNodeId: string,
    targetNodeId: string,
    edgeType: string,
    confidence: number
  ): Promise<void> {
    await db.insert(schema.discoveryGraphEdges).values({
      accountId,
      sessionId,
      sourceNodeId,
      targetNodeId,
      edgeType,
      confidence,
    });
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _graphService: DiscoveryGraphService | null = null;

export function getDiscoveryGraphService(): DiscoveryGraphService {
  if (!_graphService) {
    _graphService = new DiscoveryGraphService();
  }
  return _graphService;
}
