# PTV Discovery Intelligence Platform — Complete Architecture Design

## Document Classification: Strategic Platform Architecture
## Version: 1.0
## Status: Authoritative Design Reference
## Audience: Principal Engineers, Platform Architects, Product Leadership, Executive Team

---

## Table of Contents

1. [Product Vision](#section-1-product-vision)
2. [Intelligence Architecture](#section-2-intelligence-architecture)
3. [Transportation Ontology](#section-3-transportation-ontology)
4. [Account Intelligence Model](#section-4-account-intelligence-model)
5. [AI Reasoning Model](#section-5-ai-reasoning-model)
6. [User Experience Philosophy](#section-6-user-experience-philosophy)
7. [Enterprise Platform Architecture](#section-7-enterprise-platform-architecture)
8. [Competitive Moat](#section-8-competitive-moat)
9. [Product Roadmap](#section-9-product-roadmap-capability-based)
10. [Self-Critique and Redesign](#section-10-self-critique-and-redesign)

---

## SECTION 1: PRODUCT VISION

### 1.1 Category Definition

The PTV Discovery Intelligence Platform (PDIP) defines a new category: **AI Transportation Consulting Intelligence**. This is not a meeting recorder, not a CRM plugin, not a conversation analytics tool, and not a generic AI copilot. It is the world's first platform that transforms enterprise sales representatives into senior transportation consultants through real-time domain-specific AI reasoning.

The category sits at the intersection of three existing markets — none of which adequately serve the need:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CATEGORY MAP                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Conversation Intelligence          Revenue Intelligence         │
│   (Gong, Chorus, Fireflies)          (Clari, 6sense)            │
│        ↓                                    ↓                    │
│   Records what happened              Predicts deal outcomes      │
│   Generic coaching                   Statistical scoring         │
│   No domain expertise                No operational depth        │
│                                                                   │
│              ┌──────────────────────────┐                        │
│              │  PTV DISCOVERY           │                        │
│              │  INTELLIGENCE PLATFORM   │                        │
│              │                          │                        │
│              │  • Reasons about WHY     │                        │
│              │  • Domain expertise       │                        │
│              │  • Generates business    │                        │
│              │    cases from evidence   │                        │
│              │  • Compound learning     │                        │
│              └──────────────────────────┘                        │
│                         ↑                                        │
│   Management Consulting          Enterprise AI Copilots          │
│   (McKinsey, Accenture)          (Salesforce Einstein, Copilot) │
│        ↓                                    ↓                    │
│   Deep domain expertise           Broad but shallow              │
│   $500K+ engagements             Generic assistance              │
│   Not scalable to every rep      No compound learning            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Vision Statement

**Make every PTV sales representative as effective as a 20-year transportation consulting veteran in their first customer meeting.**

This is not about making calls more efficient. It is about transforming the quality of every customer engagement from a product pitch into a consulting-grade discovery that uncovers millions in operational value and positions PTV as the indispensable partner.

### 1.3 The Unfair Advantage

PTV possesses five assets no competitor can replicate:

**1. Three Decades of Transportation Domain Expertise**
PTV has optimized transportation networks for thousands of companies across every segment. This knowledge — how routes fail, where costs hide, what optimization actually delivers — is encoded into the platform's reasoning. No conversation intelligence vendor can manufacture 30 years of implementation history.

**2. Validated Benchmark Data from Real Implementations**
Every PTV customer engagement generates measurable before/after data. Aggregated and anonymized, this creates the world's most credible transportation operations benchmark database. When the platform says "companies like yours achieve 18% cost reduction," it is sourced from actual results, not analyst estimates.

**3. Product-to-Problem Mapping Intelligence**
PTV knows exactly which product capabilities solve which operational problems because it has deployed them thousands of times. The platform doesn't recommend generically — it maps specific diagnosed inefficiencies to specific product modules with specific expected outcomes based on historical evidence.

**4. Cross-Customer Pattern Recognition**
After processing thousands of discovery sessions, the platform recognizes patterns: "3PLs with 500-2000 vehicles running Blue Yonder TMS without route optimization have a 94% probability of achieving 15%+ cost reduction." This compound intelligence is impossible to replicate without PTV's customer base.

**5. Implementation Feedback Loop**
The platform connects discovery promises to implementation reality. When business cases predict 18% cost reduction and customers achieve 22%, benchmarks recalibrate. This self-correcting data flywheel makes every prediction more accurate over time.

### 1.4 Why Customers Choose PDIP Over Alternatives

| Competitor | What They Do | What PDIP Does Differently | Why Customers Switch |
|---|---|---|---|
| **Gong** | Records calls, identifies talk patterns, generic coaching ("talk less, listen more") | Reasons about transportation operations, generates domain-specific hypotheses, builds quantified business cases from evidence | Gong tells you HOW to sell; PDIP tells you WHAT to ask, WHY it matters, and builds the $4.7M business case automatically |
| **Clari** | Revenue forecasting from CRM signals and activity data | Discovery quality intelligence that creates better outcomes, not just predicts them | Clari predicts deal outcomes; PDIP improves them by making every rep a transportation expert |
| **Salesforce Einstein** | Broad CRM AI — lead scoring, next best action, generic recommendations | Deep transportation-specific reasoning with compound account intelligence | Einstein is a mile wide, inch deep; PDIP is the world's deepest transportation discovery intelligence |
| **Microsoft Copilot** | Meeting transcripts + M365 summarization | Multi-session knowledge graph with domain-specific reasoning and financial modeling | Copilot knows what was SAID; PDIP knows what it MEANS for transportation operations |
| **Chorus/ZoomInfo** | Deal execution tracking, conversation topics, action items | Hypothesis-driven consultative reasoning with operational diagnosis and business case generation | Chorus captures what happened; PDIP drives what should happen next |
| **Avoma** | Meeting lifecycle management with generic coaching | End-to-end consulting engagement platform with transportation expertise | Avoma helps you run meetings; PDIP helps you win $1M+ transportation technology deals |
| **Fireflies.ai** | Transcription with keyword search | Living knowledge graph with causal inference, hypothesis testing, financial modeling | Fireflies is a note-taking tool; PDIP is an AI transportation consultant |

### 1.5 Long-Term Moat Strategy

The platform's moat deepens along four dimensions simultaneously:

```
Year 1: Domain Knowledge Moat
  └── Proprietary transportation ontology + benchmark data
  └── Competitors cannot build without 30 years of implementations

Year 2: Data Compound Moat  
  └── Thousands of discovery sessions creating pattern intelligence
  └── Cross-customer insights that improve with every engagement
  └── Validated predictions from implementation feedback loops

Year 3: Network Effect Moat
  └── Every customer's anonymized patterns improve intelligence for all
  └── Industry vertical packs built from accumulated expertise
  └── Benchmark database grows more credible with every deployment

Year 5: Platform Ecosystem Moat
  └── Partner integrations built on PDIP APIs
  └── White-label deployments by consulting firms
  └── Industry standard for transportation discovery intelligence
  └── Switching cost: entire account intelligence history is non-portable
```

### 1.6 Commercial Model

**Tier 1: Discovery Coach** ($149/user/month)
- Core PDIF phase engine
- Real-time transcription and question suggestions
- Basic confidence scoring (8 categories)
- Session summaries and CRM export
- 20 sessions/month

**Tier 2: Consultant Intelligence** ($349/user/month)
- Full 17-category confidence engine
- Hypothesis engine with validation tracking
- Business case builder with ROI calculator
- Industry benchmark comparisons
- Transportation maturity assessment
- Manager coaching dashboard
- Unlimited sessions

**Tier 3: Enterprise Platform** ($599/user/month, 50+ seats minimum)
- Customer data ingestion and instant analysis
- Cross-account pattern intelligence
- Pipeline analytics and forecasting
- Custom industry vertical packs
- SSO/SAML/SCIM
- Dedicated instance option
- API access for custom integrations
- White-glove onboarding

**Tier 4: Strategic Partner** (Custom pricing)
- White-label capability
- Custom ontology extensions
- Dedicated AI model fine-tuning
- Implementation feedback loop integration
- Executive advisory access
- Multi-language support

### 1.7 Success Metrics That Define Category Leadership

| Metric | Year 1 Target | Year 3 Target | Category-Defining |
|--------|---------------|---------------|-------------------|
| Discovery Quality Score improvement | +40% vs. no tool | +70% vs. no tool | No competitor measures this |
| Time from first meeting to qualified opportunity | -30% | -50% | Demonstrates consulting quality |
| Average deal size for users vs. non-users | +25% | +60% | Proves business case value |
| Win rate for users vs. non-users | +15% | +35% | Ultimate proof of value |
| Business case accuracy (predicted vs. actual ROI) | ±30% | ±10% | Self-correcting flywheel |
| Customer NPS for discovery experience | 60+ | 80+ | Customers value the process |
| Rep adoption (weekly active usage) | 60% | 90% | Tool becomes indispensable |
| Cross-sell discovery from existing accounts | +20% | +50% | Compound intelligence proves value |

---

## SECTION 2: INTELLIGENCE ARCHITECTURE

### 2.1 Architecture Overview

The Intelligence Architecture is a modular, event-driven system of eleven specialized engines that collaborate to deliver consultant-grade reasoning. Each engine has a defined responsibility, communicates through a shared event bus, and contributes to a unified knowledge state.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INTELLIGENCE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐          │
│  │ TRANSCRIPT   │───▶│  ENTITY          │───▶│  DISCOVERY        │          │
│  │ PROCESSOR    │    │  EXTRACTOR       │    │  INTELLIGENCE     │          │
│  └──────────────┘    └──────────────────┘    │  GRAPH            │          │
│         │                                     └─────────┬─────────┘          │
│         │                                               │                    │
│         ▼                                               ▼                    │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐          │
│  │ PERSONA      │◀──▶│  HYPOTHESIS      │◀──▶│  CONSULTANT       │          │
│  │ INTELLIGENCE │    │  ENGINE          │    │  BRAIN            │          │
│  └──────────────┘    └──────────────────┘    └───────────────────┘          │
│         │                     │                         │                    │
│         ▼                     ▼                         ▼                    │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐          │
│  │ COMPETITIVE  │    │  DISCOVERY       │    │  COACHING         │          │
│  │ INTELLIGENCE │    │  CONFIDENCE      │    │  ENGINE           │          │
│  └──────────────┘    │  ENGINE          │    └───────────────────┘          │
│         │             └──────────────────┘              │                    │
│         ▼                     │                         ▼                    │
│  ┌──────────────┐             ▼                ┌───────────────────┐         │
│  │ INDUSTRY     │    ┌──────────────────┐     │  ROI ENGINE       │         │
│  │ BENCHMARK    │───▶│  BUSINESS CASE   │◀────│                   │         │
│  │ ENGINE       │    │  ENGINE          │     └───────────────────┘         │
│  └──────────────┘    └──────────────────┘                                   │
│                                                                               │
│  ═══════════════════════════════════════════════════════════════════          │
│                    SHARED EVENT BUS (Redis Streams)                           │
│  ═══════════════════════════════════════════════════════════════════          │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────┐           │
│  │              TRANSPORTATION KNOWLEDGE ENGINE                    │           │
│  │  (Vector Store + Domain Ontology + Benchmark Data)            │           │
│  └───────────────────────────────────────────────────────────────┘           │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Event-Driven Communication Model

All engines communicate through a shared event bus implemented on Redis Streams (production) with Kafka upgrade path for scale. This architecture enables:

- **Loose coupling**: Engines evolve independently
- **Temporal ordering**: Full audit trail of how knowledge evolved
- **Replay capability**: Reprocess events when algorithms improve
- **Selective subscription**: Each engine subscribes only to relevant events

```
EVENT FLOW — Real-Time Session Processing:

[Microphone] → TranscriptSegmentReceived
    → Entity Extractor: EntityExtracted, FactIdentified
        → Discovery Graph: GraphNodeCreated, GraphEdgeCreated
            → Hypothesis Engine: HypothesisGenerated, HypothesisUpdated
                → Confidence Engine: ConfidenceRecalculated
                    → Coaching Engine: QuestionSuggestionsRefreshed
                    → Business Case Engine: BusinessCaseUpdated
            → Consultant Brain: ExplorationPriorityChanged
                → Coaching Engine: QuestionSuggestionsRefreshed

EVENT FLOW — Background Intelligence:

[Periodic/5min] → CrossAccountAnalysis
    → Industry Benchmark: BenchmarkComparisonGenerated
    → Competitive Intelligence: CompetitivePositionUpdated
    → ROI Engine: ROIModelRefined

EVENT FLOW — Post-Session:

[SessionEnded] → SessionSummaryRequested
    → Business Case Engine: BusinessCaseFinalized
    → Coaching Engine: PostSessionFeedbackGenerated
    → Consultant Brain: NextSessionStrategyCreated
```

### 2.3 Engine Definitions

#### 2.3.1 Transportation Knowledge Engine

**Purpose**: The foundational knowledge layer that provides all other engines with transportation domain expertise, terminology, benchmarks, and operational standards.

**Architecture**: RAG (Retrieval-Augmented Generation) system combining vector embeddings with structured knowledge.

**Components**:
```
┌─────────────────────────────────────────────────────┐
│         TRANSPORTATION KNOWLEDGE ENGINE              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────┐  ┌────────────────────┐    │
│  │  Vector Store       │  │  Structured        │    │
│  │  (pgvector)         │  │  Knowledge Base    │    │
│  │                     │  │                     │    │
│  │  • Domain docs      │  │  • Ontology         │    │
│  │  • Case studies     │  │  • Benchmarks       │    │
│  │  • Best practices   │  │  • Product catalog  │    │
│  │  • Industry guides  │  │  • Competitor data  │    │
│  │  • Regulations      │  │  • Standards        │    │
│  └────────────────────┘  └────────────────────┘    │
│           │                        │                 │
│           ▼                        ▼                 │
│  ┌─────────────────────────────────────────────┐   │
│  │     Hybrid Retrieval Engine                   │   │
│  │     (Semantic + Keyword + Graph-based)       │   │
│  └─────────────────────────────────────────────┘   │
│           │                                         │
│           ▼                                         │
│  ┌─────────────────────────────────────────────┐   │
│  │     Context Assembly & Ranking               │   │
│  │     (Relevance scoring, deduplication,       │   │
│  │      freshness weighting)                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Knowledge Categories**:
- Transportation operations (planning, routing, dispatch, fleet management)
- Industry vertical specifics (3PL, retail, manufacturing, building supply, food/beverage, healthcare, field services)
- Regulatory requirements (ELD, HOS, FMCSA, EU transport directives, cabotage, hazmat)
- Technology landscape (TMS vendors, telematics, visibility platforms, ERP systems)
- PTV product capabilities (each module's problems solved, typical results, implementation requirements)
- Financial models (cost-per-mile, cost-per-stop, fuel modeling, labor costs by region)
- Operational benchmarks (stops/hour, miles/gallon, utilization rates, on-time percentages)

**Embedding Strategy**:
- Model: OpenAI text-embedding-3-large (3072 dimensions) for production
- Chunking: 512 tokens with 50-token overlap, respecting semantic boundaries
- Metadata: source, category, industry, confidence, last_validated, version
- Index: HNSW with cosine similarity via pgvector
- Hybrid search: BM25 keyword matching + semantic similarity with reciprocal rank fusion

**Knowledge Update Protocol**:
- Automated ingestion of new PTV documentation monthly
- Benchmark data refresh quarterly with statistical validation
- Competitive intelligence update weekly from public sources
- Expert review gate for new domain knowledge additions
- Version control for all knowledge chunks with rollback capability

**Events Produced**: `KnowledgeRetrieved`, `BenchmarkProvided`, `TerminologyResolved`, `ProductCapabilityMatched`

**Events Consumed**: `DomainQueryRequested`, `BenchmarkComparisonNeeded`, `TerminologyLookupRequested`

---

#### 2.3.2 Discovery Intelligence Graph

**Purpose**: A living, temporal knowledge graph per account that accumulates everything learned across all sessions. The single source of truth for what is known, unknown, contradicted, and hypothesized about a customer's transportation operation.

**Architecture**: Property graph implemented on PostgreSQL with JSON/graph extensions (initial), with migration path to Neo4j for enterprise scale.

**Node Types**:
```typescript
interface GraphNode {
  id: string;
  type: NodeType; // Fact | Contact | Process | System | PainPoint | Objective | Constraint | Hypothesis | Decision
  label: string;
  properties: Record<string, any>;
  confidence: number; // 0.0 - 1.0
  source: EvidenceSource; // transcript_segment_id, document_id, inference_id
  validFrom: DateTime;
  validUntil: DateTime | null; // null = still current
  createdInSession: string;
  lastUpdatedSession: string;
  version: number;
}

enum NodeType {
  FACT = 'fact',                    // Verified piece of information
  CONTACT = 'contact',              // Person identified
  PROCESS = 'process',              // Business process described
  SYSTEM = 'system',                // Technology system mentioned
  PAIN_POINT = 'pain_point',        // Problem or challenge identified
  OBJECTIVE = 'objective',          // Goal or target stated
  CONSTRAINT = 'constraint',        // Limitation or boundary
  HYPOTHESIS = 'hypothesis',        // Inferred but not confirmed
  DECISION = 'decision',            // Decision made or pending
  METRIC = 'metric',                // KPI or measurement
  RELATIONSHIP = 'relationship',    // Org relationship between people
  ASSET = 'asset',                  // Physical asset (vehicles, facilities)
  ROUTE = 'route',                  // Transportation lane or route
  VENDOR = 'vendor',                // Third-party vendor/partner
}
```

**Edge Types**:
```typescript
interface GraphEdge {
  id: string;
  type: EdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  properties: Record<string, any>;
  confidence: number;
  evidence: EvidenceSource[];
  createdInSession: string;
  weight: number; // relationship strength
}

enum EdgeType {
  CAUSES = 'causes',                    // A causes B
  DEPENDS_ON = 'depends_on',            // A requires B
  CONTRADICTS = 'contradicts',          // A conflicts with B
  SUPPORTS = 'supports',               // A validates B
  REPORTS_TO = 'reports_to',           // Person A reports to Person B
  OWNS = 'owns',                       // Person owns process/decision
  USES = 'uses',                       // Process uses system
  PRODUCES = 'produces',               // Process produces metric
  IMPACTS = 'impacts',                 // Pain point impacts objective
  SOLVES = 'solves',                   // Solution addresses pain point
  MEASURES = 'measures',               // Metric measures objective
  CONSTRAINS = 'constrains',           // Constraint limits process
  PRECEDES = 'precedes',               // Temporal: A happens before B
  CORRELATES = 'correlates',           // Statistical relationship
  REPLACES = 'replaces',               // New info supersedes old
}
```

**Graph Operations**:
- `addNode(node)`: Creates new knowledge with evidence chain
- `addEdge(edge)`: Creates relationship between nodes
- `updateConfidence(nodeId, newEvidence)`: Recalculates confidence based on accumulated evidence
- `invalidateNode(nodeId, reason)`: Marks knowledge as no longer current (temporal)
- `resolveContradiction(nodeA, nodeB, resolution)`: Handles conflicting information
- `querySubgraph(filter)`: Retrieves relevant portion of graph for AI context
- `getUnknowns(category)`: Returns gaps in knowledge for a category
- `getEvolutionTimeline(nodeId)`: Shows how a fact changed over time

**Temporal Knowledge Management**:
Every fact in the graph has temporal properties. When new information contradicts existing knowledge, the system does not delete — it creates a temporal boundary:
```
Example: Fleet size changed
  Node: fleet_size = 200 vehicles
    validFrom: 2024-01-15 (Session 1)
    validUntil: 2024-06-22 (Session 4)
  
  Node: fleet_size = 245 vehicles  
    validFrom: 2024-06-22 (Session 4)
    validUntil: null (current)
    
  Edge: fleet_size_245 REPLACES fleet_size_200
    properties: { reason: "customer mentioned expansion", growth_rate: "22.5%" }
```

**Events Produced**: `GraphNodeCreated`, `GraphEdgeCreated`, `GraphNodeUpdated`, `ContradictionDetected`, `KnowledgeGapIdentified`, `TemporalBoundaryCreated`

**Events Consumed**: `EntityExtracted`, `FactIdentified`, `HypothesisValidated`, `HypothesisInvalidated`, `SessionEnded`

---

#### 2.3.3 Hypothesis Engine

**Purpose**: Generates, tracks, and validates business hypotheses from partial information. This is the engine that makes the platform reason like a consultant — forming educated assumptions and systematically validating them through conversation.

**Hypothesis Lifecycle**:
```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ GENERATED│───▶│ ACTIVE   │───▶│ TESTING  │───▶│ VALIDATED│
│          │    │          │    │          │    │          │
│ Initial  │    │ Awaiting │    │ Evidence │    │ Confirmed│
│ inference│    │ evidence │    │ being    │    │ with high│
│ from data│    │          │    │ evaluated│    │ confidence│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                      │                               │
                      ▼                               ▼
                ┌──────────┐                   ┌──────────┐
                │ REVISED  │                   │INVALIDATED│
                │          │                   │          │
                │ Modified │                   │ Disproven│
                │ by new   │                   │ by       │
                │ evidence │                   │ evidence │
                └──────────┘                   └──────────┘
```

**Hypothesis Structure**:
```typescript
interface Hypothesis {
  id: string;
  statement: string;                    // Human-readable hypothesis
  category: HypothesisCategory;         // operational, financial, technical, organizational
  triggerEvidence: EvidenceSource[];     // What generated this hypothesis
  supportingEvidence: EvidenceSource[];  // Evidence that supports it
  contradictingEvidence: EvidenceSource[];  // Evidence that weakens it
  confidence: number;                   // 0.0 - 1.0, calculated from evidence balance
  financialImpact: {                    // Estimated $ impact if true
    low: number;
    mid: number;
    high: number;
    methodology: string;
  };
  validationQuestions: string[];         // Questions that would confirm/deny
  relatedHypotheses: string[];          // Other hypotheses that connect
  generatedFrom: 'pattern' | 'inference' | 'benchmark_gap' | 'cross_account';
  status: HypothesisStatus;
  pdifPhase: PDIFPhase;                 // Which phase is this most relevant to
}

// Example Hypothesis:
{
  id: "hyp_fleet_utilization_001",
  statement: "With 200 vehicles and no route optimization, this fleet is likely operating at 55-65% utilization, resulting in 35-45 excess vehicles costing $2.1M-$2.7M annually in unnecessary capital and operating costs.",
  category: "financial",
  triggerEvidence: [
    { type: "transcript", sessionId: "s1", text: "We have about 200 trucks" },
    { type: "transcript", sessionId: "s1", text: "We plan routes manually each morning" }
  ],
  supportingEvidence: [],
  contradictingEvidence: [],
  confidence: 0.45, // Generated from pattern, not yet validated
  financialImpact: { low: 1800000, mid: 2400000, high: 2700000, methodology: "benchmark_based" },
  validationQuestions: [
    "What's your current vehicle utilization rate?",
    "How many routes do you typically run versus vehicles available?",
    "Do you track empty miles or deadhead percentage?"
  ],
  relatedHypotheses: ["hyp_fuel_waste_001", "hyp_driver_overtime_001"],
  generatedFrom: "pattern",
  status: "active",
  pdifPhase: "DIAGNOSE"
}
```

**Hypothesis Generation Triggers**:
1. **Pattern-based**: Known industry patterns applied to discovered facts (e.g., fleet size + no optimization → utilization gap)
2. **Inference-based**: Logical deduction from graph relationships (e.g., manual dispatch + 200 vehicles → likely overtime issues)
3. **Benchmark gap**: Detected deviation from industry benchmarks (e.g., reported cost-per-mile is 40% above average)
4. **Cross-account**: Patterns observed in similar accounts applied to current account
5. **Absence-based**: Critical information not mentioned that usually exists (e.g., no mention of telematics in a 200+ vehicle fleet)

**Confidence Calculation**:
```
confidence = base_confidence × evidence_multiplier × recency_factor

where:
  base_confidence = pattern_reliability (how often this pattern holds across known cases)
  evidence_multiplier = (supporting_evidence_weight - contradicting_evidence_weight) / total_evidence_expected
  recency_factor = decay function based on time since last evidence update
```

**Events Produced**: `HypothesisGenerated`, `HypothesisUpdated`, `HypothesisValidated`, `HypothesisInvalidated`, `ValidationQuestionNeeded`

**Events Consumed**: `GraphNodeCreated`, `GraphEdgeCreated`, `FactIdentified`, `ContradictionDetected`, `BenchmarkComparisonGenerated`

---

#### 2.3.4 Consultant Brain

**Purpose**: The strategic reasoning layer that decides what to explore next. It acts as a senior consulting partner who watches the conversation unfold and determines the highest-value next question, topic shift, or insight to surface — considering business impact, conversational flow, and relationship dynamics.

**Decision Framework**:
```
┌─────────────────────────────────────────────────────────────┐
│                    CONSULTANT BRAIN                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  INPUT SIGNALS:                                              │
│  ├── Current Discovery Graph state (what's known)           │
│  ├── Knowledge gaps (what's unknown)                        │
│  ├── Active hypotheses (what needs validation)              │
│  ├── Current PDIF phase (what's contextually appropriate)   │
│  ├── Conversational thread (what was just discussed)        │
│  ├── Buyer persona (how to frame questions)                 │
│  ├── Time remaining in session (prioritize accordingly)     │
│  └── Previous question effectiveness (what worked before)   │
│                                                              │
│  REASONING PROCESS:                                          │
│  1. Assess: What is the highest-value unknown right now?    │
│  2. Prioritize: Which gap has the greatest business impact? │
│  3. Contextualize: How does this fit the current thread?    │
│  4. Frame: How should this be phrased for this persona?     │
│  5. Sequence: What's the natural follow-on if they answer?  │
│                                                              │
│  OUTPUT:                                                     │
│  ├── Ranked exploration priorities                          │
│  ├── Question strategy (why this question matters)          │
│  ├── Expected outcomes (what answers would mean)            │
│  └── Contingency paths (if they deflect or don't know)     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Priority Scoring Algorithm**:
```typescript
interface ExplorationPriority {
  topic: string;
  score: number;  // 0-100
  factors: {
    businessImpact: number;        // Weight: 0.30 — How much $ value could this reveal?
    informationGain: number;       // Weight: 0.25 — How much would this reduce uncertainty?
    conversationalFit: number;     // Weight: 0.20 — How naturally does this follow?
    hypothesisValidation: number;  // Weight: 0.15 — Does this test an active hypothesis?
    phaseAlignment: number;        // Weight: 0.10 — Is this appropriate for current phase?
  };
  reasoning: string;  // Natural language explanation of why
}

// Example priority calculation:
{
  topic: "Fleet utilization rate",
  score: 87,
  factors: {
    businessImpact: 95,        // Could reveal $2M+ opportunity
    informationGain: 90,       // Currently unknown, high uncertainty
    conversationalFit: 75,     // They just mentioned vehicle count
    hypothesisValidation: 95,  // Validates top hypothesis
    phaseAlignment: 80,        // Appropriate for DIAGNOSE phase
  },
  reasoning: "Customer mentioned 200 vehicles with manual planning. Utilization rate is the single highest-value unknown — likely reveals excess fleet cost. Natural follow-on to vehicle discussion."
}
```

**Behavioral Principles**:
1. **Depth over breadth**: When a productive thread is active, keep exploring it rather than jumping topics
2. **Executive credibility**: Prioritize questions that demonstrate industry expertise
3. **Financial orientation**: Always steer toward quantifiable impact
4. **Persona awareness**: Adjust language and focus based on who is in the meeting
5. **Time sensitivity**: As session progresses, shift from exploration to validation and summary

**Events Produced**: `ExplorationPriorityChanged`, `TopicShiftRecommended`, `DepthExplorationAdvised`, `PhaseTransitionSuggested`

**Events Consumed**: `GraphNodeCreated`, `HypothesisGenerated`, `ConfidenceRecalculated`, `TranscriptSegmentReceived`, `SessionTimeUpdated`

---

#### 2.3.5 Discovery Confidence Engine

**Purpose**: Measures how well the salesperson truly understands the customer's business — not methodology completion, but genuine comprehension depth. Provides the primary health indicator for discovery quality.

**Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│              DISCOVERY CONFIDENCE ENGINE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────┐            │
│  │  CATEGORY EVALUATORS (17 independent)        │            │
│  │                                              │            │
│  │  Each evaluator:                             │            │
│  │  ├── Defines required knowledge elements     │            │
│  │  ├── Weighs evidence quality                 │            │
│  │  ├── Detects gaps and unknowns              │            │
│  │  ├── Generates improvement questions         │            │
│  │  └── Calculates confidence score            │            │
│  └─────────────────────────────────────────────┘            │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────┐            │
│  │  EVIDENCE QUALITY ASSESSOR                   │            │
│  │                                              │            │
│  │  Scores evidence by:                         │            │
│  │  ├── Directness (stated vs. inferred)       │            │
│  │  ├── Source authority (CEO vs. unknown)      │            │
│  │  ├── Specificity (exact number vs. "about") │            │
│  │  ├── Recency (this session vs. 6 months ago)│            │
│  │  └── Corroboration (confirmed by multiple)  │            │
│  └─────────────────────────────────────────────┘            │
│                        │                                     │
│                        ▼                                     │
│  ┌─────────────────────────────────────────────┐            │
│  │  AGGREGATE CONFIDENCE CALCULATOR             │            │
│  │                                              │            │
│  │  ├── Weighted rollup across categories      │            │
│  │  ├── Phase-appropriate weighting            │            │
│  │  ├── Deal-stage normalization               │            │
│  │  └── Trend analysis (improving/declining)   │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**17 Confidence Categories with Scoring Criteria**:

| # | Category | Required Knowledge Elements | Full Confidence Requires |
|---|----------|----------------------------|--------------------------|
| 1 | Company Strategy | Mission, growth plans, market position, M&A activity | Multiple executive-level confirmations of direction |
| 2 | Business Objectives | Revenue targets, cost reduction goals, service level commitments | Specific numbers with timelines from decision-makers |
| 3 | Transportation Operations | Daily operations flow, planning process, execution model | End-to-end understanding of how freight moves |
| 4 | Fleet & Network Design | Vehicle types, counts, routes, facilities, geography | Complete network picture with asset details |
| 5 | Planning & Dispatch | How work is planned, scheduled, assigned to drivers/vehicles | Process understanding with pain points identified |
| 6 | Routing & Optimization | Current routing approach, optimization tools, manual vs. automated | Clear picture of optimization maturity and gaps |
| 7 | Technology Ecosystem | TMS, ERP, WMS, telematics, visibility tools, integrations | Full technology stack map with integration points |
| 8 | Data Quality | Data sources, accuracy, completeness, real-time vs. batch | Understanding of data foundation for optimization |
| 9 | Financial Drivers | Cost structure, budget pressures, financial decision criteria | Cost-per-mile/stop, budget authority, ROI expectations |
| 10 | KPIs & Success Metrics | What they measure, targets, current performance | Specific KPIs with current vs. target values |
| 11 | Executive Priorities | What keeps executives awake, board-level initiatives | Direct executive statements about priorities |
| 12 | Buying Process | Decision process, timeline, committee, criteria | Complete buying process map with named individuals |
| 13 | Economic Buyer | Who controls budget, their priorities, their success metrics | Identified individual with understood motivations |
| 14 | Competitive Position | Incumbent vendors, alternatives considered, selection criteria | Full competitive landscape with evaluation status |
| 15 | Implementation Readiness | IT capacity, change tolerance, project history, resources | Realistic assessment of deployment feasibility |
| 16 | Business Case Strength | Quantified ROI, payback period, risk-adjusted returns | Defensible numbers traceable to validated pain points |
| 17 | Overall Discovery Completeness | Aggregate across all categories weighted by phase | Comprehensive understanding for current stage |

**Scoring Methodology**:
- Confidence only increases when EVIDENCE exists — not when a question is asked
- Evidence must be SUBSTANTIVE — "I don't know" does not increase confidence (but is recorded as a fact)
- Conflicting evidence reduces confidence until resolved
- Older evidence decays slowly (0.95^months since evidence)
- Executive-level sources carry 1.5x weight
- Corroborated facts (confirmed by multiple sources) carry 2x weight

**Events Produced**: `ConfidenceRecalculated`, `ConfidenceThresholdReached`, `CriticalGapIdentified`, `PhaseReadinessAchieved`

**Events Consumed**: `GraphNodeCreated`, `GraphEdgeCreated`, `EvidenceQualityAssessed`, `TemporalBoundaryCreated`

---

#### 2.3.6 Business Case Engine

**Purpose**: Continuously constructs a living business case from accumulated evidence, mapping operational inefficiencies to quantified financial impact to PTV solution alignment to expected ROI.

**Business Case Structure**:
```typescript
interface BusinessCase {
  id: string;
  accountId: string;
  version: number;
  lastUpdated: DateTime;
  
  executiveSummary: {
    headline: string;           // "Opportunity to reduce transportation costs by $4.7M annually"
    currentState: string;       // Summary of operational challenges
    futureState: string;        // Vision of optimized operations
    investmentRequired: Range;  // Implementation cost estimate
    expectedReturn: Range;      // Annual savings/revenue impact
    paybackPeriod: Range;       // Months to recover investment
    confidence: number;         // How well-supported is this case
  };
  
  painPoints: {
    id: string;
    description: string;
    category: string;
    evidence: EvidenceSource[];
    financialImpact: {
      annualCost: Range;
      methodology: string;      // How was this calculated
      assumptions: string[];    // What assumptions underlie the number
      benchmarkSource: string;  // Where does the comparison come from
    };
    ptvSolution: {
      product: string;
      capability: string;
      expectedImprovement: Range;
      similarCustomerResults: string[];
    };
  }[];
  
  totalOpportunity: {
    conservativeAnnual: number;
    likelyAnnual: number;
    optimisticAnnual: number;
    fiveYearNPV: number;
    assumptions: string[];
  };
  
  risks: {
    description: string;
    likelihood: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  }[];
  
  competitiveAdvantage: string[];  // Why PTV vs. alternatives
  implementationTimeline: Phase[];
  successMetrics: Metric[];
}
```

**Business Case Evolution**:
The business case is never "generated" in a single shot — it evolves continuously:
- After DISCOVER: High-level opportunity sizing based on company profile + industry benchmarks
- After DIAGNOSE: Specific pain point quantification with evidence-backed numbers
- After DESIGN: Solution-aligned business case with PTV-specific ROI projections
- After DEMONSTRATE: Validated business case with customer-agreed assumptions
- After DELIVER: Final business case with implementation plan and success metrics

**Financial Modeling Approaches**:
1. **Top-down**: Industry benchmark × company size → estimated opportunity
2. **Bottom-up**: Specific inefficiencies × unit cost × frequency → precise cost
3. **Comparative**: Similar customer before/after results → projected improvement
4. **Hybrid**: Multiple approaches triangulated for credibility

**Events Produced**: `BusinessCaseUpdated`, `ROICalculated`, `PainPointQuantified`, `SolutionMapped`

**Events Consumed**: `GraphNodeCreated`, `HypothesisValidated`, `BenchmarkComparisonGenerated`, `ConfidenceRecalculated`

---

#### 2.3.7 Industry Benchmark Engine

**Purpose**: Maintains and serves reference data for transportation operations by industry vertical, company size, geography, and operational model. Enables "You're at X; best-in-class is Y; the gap represents $Z annually" framing that establishes consultant credibility.

**Benchmark Data Model**:
```typescript
interface Benchmark {
  id: string;
  metric: string;              // e.g., "cost_per_mile", "stops_per_hour", "on_time_percentage"
  value: number;
  unit: string;
  percentile: number;          // What percentile does this represent?
  
  segmentation: {
    industry: string;          // e.g., "3PL", "retail", "building_supply"
    companySize: string;       // e.g., "100-500 vehicles", "500-2000 vehicles"
    geography: string;         // e.g., "North America", "Western Europe"
    operationType: string;     // e.g., "LTL", "TL", "last_mile", "dedicated"
    optimizationMaturity: string; // e.g., "manual", "basic_tms", "optimized", "advanced"
  };
  
  statistics: {
    mean: number;
    median: number;
    p25: number;               // Bottom quartile
    p75: number;               // Top quartile
    p90: number;               // Best-in-class threshold
    sampleSize: number;
    confidenceInterval: number;
    lastUpdated: DateTime;
  };
  
  source: 'ptv_customer_data' | 'industry_report' | 'government_data' | 'derived';
  methodology: string;         // How was this benchmark calculated?
  validUntil: DateTime;        // When does this need refreshing?
}
```

**Key Benchmark Categories**:

| Category | Metrics | Typical Ranges |
|----------|---------|----------------|
| Cost Efficiency | Cost per mile, cost per stop, cost per pound, cost per pallet | $1.50-$3.50/mile, $15-$45/stop |
| Fleet Utilization | Loaded miles %, vehicle utilization %, capacity utilization % | 55-92% loaded, 60-95% utilized |
| Service Quality | On-time %, damage rate, customer complaints per 1000 | 85-99% OTD, 0.1-2.0% damage |
| Driver Performance | Stops/hour, miles/gallon, HOS utilization % | 2.5-8.0 stops/hr, 5.5-8.5 mpg |
| Planning Efficiency | Routes/planner, plan-to-execute variance, route adherence % | 15-100 routes/planner, 85-98% adherence |
| Operational Speed | Order-to-dispatch time, dock dwell time, turnaround time | 15min-4hr dispatch, 30min-3hr dwell |

**Benchmark Credibility Framework**:
- Level 1 (Gold): Derived from actual PTV customer data, statistically significant sample (n>30)
- Level 2 (Silver): Industry reports from recognized sources (ATA, ATRI, Gartner, cited studies)
- Level 3 (Bronze): Government data (BLS, DOT, FMCSA) — authoritative but less specific
- Level 4 (Directional): Derived from limited samples or expert estimates — clearly labeled

**Events Produced**: `BenchmarkComparisonGenerated`, `BenchmarkGapIdentified`, `IndustryContextProvided`

**Events Consumed**: `DomainQueryRequested`, `MetricDiscovered`, `IndustrySegmentIdentified`

---

#### 2.3.8 Persona Intelligence Engine

**Purpose**: Understands who the salesperson is talking to and adapts all outputs accordingly. Different stakeholders care about different things, speak different languages, and have different decision authority.

**Persona Model**:
```typescript
interface Persona {
  id: string;
  contactId: string;
  
  role: {
    title: string;
    function: 'operations' | 'technology' | 'finance' | 'executive' | 'procurement';
    level: 'individual_contributor' | 'manager' | 'director' | 'vp' | 'c_level';
    decisionAuthority: 'influencer' | 'recommender' | 'decision_maker' | 'economic_buyer' | 'blocker';
  };
  
  communicationPreferences: {
    language: 'technical' | 'business' | 'financial' | 'operational';
    detailLevel: 'high_level' | 'detailed' | 'data_driven';
    motivators: string[];       // What drives their decisions?
    concerns: string[];         // What worries them?
    successMetrics: string[];   // How is their performance measured?
  };
  
  interactionHistory: {
    sessionsAttended: number;
    topicsDiscussed: string[];
    questionsAsked: string[];
    commitmentsMade: string[];
    objectionsRaised: string[];
    sentimentTrend: number[];   // Per-session sentiment scores
  };
  
  buyingRole: {
    meddiccRole: 'economic_buyer' | 'champion' | 'coach' | 'technical_buyer' | 'user_buyer';
    influence: number;          // 0-100
    engagement: number;         // 0-100 based on interaction frequency/depth
    alignment: number;          // 0-100 alignment with PTV solution
    risk: string[];             // Identified risks with this stakeholder
  };
}
```

**Persona-Adaptive Behaviors**:

| Persona Type | Question Style | Value Language | Risk Sensitivity | Depth Level |
|---|---|---|---|---|
| VP Operations | Operational efficiency, team productivity | Cost reduction, service improvement | Change management, implementation risk | Strategic with operational examples |
| CIO/CTO | Integration, architecture, security, scalability | TCO, technical debt reduction, future-proofing | Vendor lock-in, security, maintenance burden | Deep technical with business justification |
| CFO | ROI, payback, capital vs. operating expense | Hard dollar savings, revenue impact | Financial risk, hidden costs, overrun probability | Financial metrics with clear assumptions |
| VP Logistics | Network design, carrier management, visibility | Efficiency gains, service level improvement | Operational disruption during transition | Detailed operational with KPI focus |
| Procurement | Contract terms, competitive pricing, vendor stability | Competitive analysis, negotiation leverage | Vendor viability, support quality | Commercial with references |
| End User (Dispatcher/Planner) | Daily workflow, ease of use, time savings | Personal productivity, reduced frustration | Learning curve, reliability | Highly practical, workflow-focused |

**Events Produced**: `PersonaIdentified`, `PersonaUpdated`, `CommunicationStyleDetermined`, `StakeholderMapUpdated`

**Events Consumed**: `ContactIdentified`, `TranscriptSegmentReceived`, `SpeakerDiarized`

---

#### 2.3.9 Competitive Intelligence Engine

**Purpose**: Maintains real-time understanding of the competitive landscape for each account and surfaces positioning guidance, battle-tested objection handlers, and competitive differentiators relevant to the specific competitive situation.

**Competitive Intelligence Model**:
```typescript
interface CompetitivePosition {
  accountId: string;
  
  incumbentSystems: {
    vendor: string;              // e.g., "Blue Yonder", "Oracle TMS", "MercuryGate"
    product: string;
    deployedSince: string;
    satisfactionLevel: 'happy' | 'neutral' | 'frustrated' | 'actively_looking';
    knownLimitations: string[];
    contractStatus: string;     // "Locked until 2025", "Month-to-month", "Evaluating alternatives"
    investmentMade: string;     // Sunk cost consideration
    integrations: string[];     // What else connects to it
  }[];
  
  activeCompetitors: {
    vendor: string;
    product: string;
    evaluationStatus: 'shortlisted' | 'in_demo' | 'in_poc' | 'preferred' | 'eliminated';
    perceivedStrengths: string[];
    knownWeaknesses: string[];
    championInsideCustomer: string;
    pricingIntel: string;
    differentiators: string[];  // What they claim vs. reality
  }[];
  
  ptvPositioning: {
    uniqueStrengths: string[];          // Where PTV genuinely wins
    vulnerabilities: string[];          // Where PTV is weaker
    trapQuestions: string[];            // Questions that expose competitor weaknesses
    landmines: string[];               // Topics to avoid (competitor strength areas)
    proofPoints: {                      // Evidence of PTV superiority
      claim: string;
      evidence: string;
      customerReference: string;
    }[];
  };
}
```

**Competitive Battle Card Integration**:
The engine maintains structured battle cards per competitor and surfaces relevant positioning based on what's been discovered about the account's competitive landscape:

- **Real-time alerts**: When a competitor is mentioned in conversation, surface relevant differentiators
- **Trap-setting questions**: Suggest questions that naturally expose competitor weaknesses without badmouthing
- **Win themes**: Based on which competitor is involved, emphasize specific PTV strengths
- **Risk mitigation**: When PTV is weak in an area the customer cares about, suggest reframing approaches

**Events Produced**: `CompetitivePositionUpdated`, `CompetitorMentionDetected`, `DifferentiatorSurfaced`, `CompetitiveTrapSuggested`

**Events Consumed**: `EntityExtracted` (vendor names), `TranscriptSegmentReceived`, `TechnologyStackIdentified`

---

#### 2.3.10 Coaching Engine

**Purpose**: Translates all intelligence from other engines into actionable, contextual guidance for the salesperson. This is the user-facing output engine that converts complex multi-engine analysis into simple, glanceable recommendations.

**Coaching Modes**:

```
┌─────────────────────────────────────────────────────────────┐
│                    COACHING ENGINE                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  MODE 1: PRE-SESSION PREPARATION                            │
│  ├── Account intelligence briefing (2-minute read)          │
│  ├── Key hypotheses to validate                             │
│  ├── Recommended conversation strategy                      │
│  ├── Persona-specific talking points                        │
│  └── Competitive positioning reminders                      │
│                                                              │
│  MODE 2: LIVE SESSION COACHING                              │
│  ├── 2-3 contextual question suggestions (always visible)   │
│  ├── Real-time confidence score updates                     │
│  ├── Hypothesis validation alerts                           │
│  ├── Competitive intelligence triggers                      │
│  ├── Bookmark-worthy moment detection                       │
│  └── Phase transition recommendations                       │
│                                                              │
│  MODE 3: POST-SESSION DEBRIEF                               │
│  ├── Session quality scorecard                              │
│  ├── Key discoveries and confirmations                      │
│  ├── Updated business case                                  │
│  ├── Gaps identified for next session                       │
│  ├── Recommended follow-up actions                          │
│  ├── CRM update suggestions                                │
│  └── Next session strategy                                  │
│                                                              │
│  MODE 4: MANAGER COACHING                                   │
│  ├── Rep performance patterns                               │
│  ├── Discovery quality trends                               │
│  ├── Coaching opportunity identification                    │
│  ├── Best practice propagation                              │
│  └── Deal risk alerts from discovery quality                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Question Suggestion Algorithm**:
```
For each coaching cycle (every 8-10 seconds of new speech):

1. Retrieve current graph state, active hypotheses, confidence gaps
2. Get Consultant Brain priorities (ranked exploration topics)
3. Filter for conversational fit (does this follow what was just discussed?)
4. Apply persona adaptation (language, detail level, motivation alignment)
5. Apply phase constraints (only phase-appropriate questions)
6. Rank by composite score: business_value × conversational_fit × novelty
7. Select top 2-3 suggestions
8. Format as natural consultant language (not checklist items)
9. Include brief "why this matters" context for the rep
```

**Question Quality Principles**:
- Sound like a senior consultant asking, never like a checklist being filled
- Flow naturally from the current conversation topic
- Demonstrate industry expertise in the framing
- Lead to financially quantifiable answers when possible
- Create "aha moments" for the customer (questions they haven't been asked before)

**Events Produced**: `QuestionSuggestionsRefreshed`, `CoachingInsightGenerated`, `SessionStrategyCreated`, `PostSessionFeedbackGenerated`

**Events Consumed**: `ExplorationPriorityChanged`, `ConfidenceRecalculated`, `CompetitivePositionUpdated`, `PersonaUpdated`, `TranscriptSegmentReceived`

---

#### 2.3.11 ROI Engine

**Purpose**: Dedicated financial modeling engine that calculates, validates, and presents return-on-investment projections with full transparency on assumptions, methodology, and confidence levels.

**ROI Calculation Models**:

```typescript
interface ROIModel {
  accountId: string;
  version: number;
  
  costReductionOpportunities: {
    category: string;           // e.g., "fuel", "labor", "fleet_capital", "penalties"
    currentAnnualCost: Range;
    estimatedReduction: Range;  // Percentage improvement
    annualSavings: Range;       // Dollar savings
    methodology: 'measured' | 'benchmarked' | 'estimated';
    confidence: number;
    assumptions: string[];
    evidenceSources: EvidenceSource[];
  }[];
  
  revenueOpportunities: {
    category: string;           // e.g., "capacity_released", "service_improvement", "new_capabilities"
    estimatedAnnualRevenue: Range;
    probability: number;
    timeToRealize: number;      // Months
  }[];
  
  investmentRequired: {
    softwareLicensing: Range;
    implementation: Range;
    training: Range;
    integration: Range;
    dataPreparation: Range;
    changeManagement: Range;
    ongoing: Range;             // Annual recurring
  };
  
  financialSummary: {
    totalAnnualBenefit: Range;
    totalInvestmentYear1: Range;
    netPresentValue5Year: Range;
    paybackPeriodMonths: Range;
    internalRateOfReturn: Range;
    riskAdjustedROI: Range;
  };
  
  sensitivityAnalysis: {
    variable: string;
    baseCase: number;
    worstCase: number;
    bestCase: number;
    impactOnROI: number;
  }[];
}
```

**ROI Credibility Scoring**:
Each financial claim in the business case receives a credibility score:
- **5/5 (Measured)**: Based on actual customer data uploaded and analyzed
- **4/5 (Validated)**: Customer confirmed the number in conversation
- **3/5 (Benchmarked)**: Derived from industry benchmarks with matching segmentation
- **2/5 (Estimated)**: Inferred from partial data and industry patterns
- **1/5 (Directional)**: Rough estimate based on company size and type only

**Events Produced**: `ROIModelUpdated`, `FinancialImpactQuantified`, `PaybackCalculated`, `SensitivityAnalyzed`

**Events Consumed**: `PainPointQuantified`, `BenchmarkComparisonGenerated`, `HypothesisValidated`, `CustomerDataIngested`

---

### 2.4 Inter-Engine Communication Patterns

**Pattern 1: Cascade Processing (Real-Time)**
```
Transcript → Entity Extraction → Graph Update → Hypothesis Check → Confidence Recalc → Coaching Refresh
Latency budget: 8-10 seconds total from speech to updated suggestions
```

**Pattern 2: Enrichment Processing (Near-Real-Time)**
```
New Graph Node → Benchmark Lookup → ROI Recalculation → Business Case Update
Latency budget: 30-60 seconds (runs in background)
```

**Pattern 3: Strategic Processing (Background)**
```
Session End → Cross-Account Pattern Match → Next Session Strategy → Manager Insights
Latency budget: 5-15 minutes (acceptable for post-session)
```

**Pattern 4: Feedback Loop (Async)**
```
Implementation Results → Benchmark Recalibration → Model Accuracy Update
Latency budget: Days/weeks (batch processing)
```

### 2.5 AI Model Selection per Engine

| Engine | Primary Model | Fallback Model | Reasoning |
|--------|---------------|----------------|-----------|
| Entity Extraction | GPT-4o-mini with function calling | Claude 3.5 Haiku | Speed critical, structured output needed |
| Graph Updates | GPT-4o with structured outputs | Claude 3.5 Sonnet | Accuracy critical for knowledge representation |
| Hypothesis Generation | Claude 3.5 Sonnet | GPT-4o | Complex reasoning, nuanced inference |
| Consultant Brain | GPT-4o | Claude 3.5 Sonnet | Strategic reasoning, priority balancing |
| Confidence Scoring | Fine-tuned classifier + GPT-4o-mini | GPT-4o-mini (zero-shot) | Speed + consistency; fine-tuning reduces cost |
| Business Case | GPT-4o | Claude 3.5 Sonnet | Quality writing + financial accuracy |
| Benchmark Lookup | Deterministic + GPT-4o-mini | Rule-based only | Mostly retrieval; AI for interpretation |
| Persona Detection | GPT-4o-mini | Fine-tuned classifier | Pattern recognition from conversation |
| Competitive Intel | GPT-4o-mini | Claude 3.5 Haiku | Keyword + pattern matching |
| Coaching | GPT-4o | Claude 3.5 Sonnet | Natural language quality critical |
| ROI Calculations | Deterministic + GPT-4o-mini | Rule-based only | Calculations are deterministic; AI for assumptions |

### 2.6 Cost Control Architecture

**Tiered Processing Model**:
```
Tier 1 — Real-time (<2s): $0.002-0.005 per inference
  Uses: GPT-4o-mini, fine-tuned classifiers, cached responses
  For: Entity extraction, classification, confidence scoring
  
Tier 2 — Near-time (<10s): $0.01-0.03 per inference  
  Uses: GPT-4o, Claude Sonnet
  For: Graph updates, question generation, hypothesis evaluation
  
Tier 3 — Background (<60s): $0.03-0.10 per inference
  Uses: GPT-4o (full context), Claude Sonnet (extended)
  For: Business case generation, strategic analysis, cross-account patterns
```

**Cost Ceiling Architecture**:
- Per-session AI cost cap: $5.00 (Tier 2), $15.00 (Tier 3)
- Graceful degradation: When budget approaching, reduce Tier 3 to Tier 2 processing
- Caching: Identical graph states produce cached results (saves 40-60% of calls)
- Batching: Accumulate small updates and process in batch every 30s for non-urgent operations
- Pre-computation: Anticipate likely questions and pre-generate suggestions during pauses

---

## SECTION 3: TRANSPORTATION ONTOLOGY

### 3.1 Ontology Overview

The Transportation Ontology is a formal, machine-readable model of how transportation operations function. It defines the entities, relationships, and rules that the platform uses to reason about a customer's business. This is PTV's deepest intellectual property — the distillation of 30 years of transportation consulting into a structured model that enables AI reasoning.

The ontology serves four purposes:
1. **Graph structure**: Defines what nodes and edges exist in the Discovery Intelligence Graph
2. **Reasoning rules**: Enables the Hypothesis Engine to make valid inferences
3. **Benchmark alignment**: Maps to benchmark categories for quantitative comparison
4. **Completeness checking**: Enables the Confidence Engine to know what's unknown

### 3.2 Business Entities

```yaml
BusinessEntity:
  Company:
    properties:
      name: string
      industry: IndustrySegment
      subIndustry: string
      annualRevenue: Range
      employeeCount: Range
      headquartersLocation: GeoLocation
      operatingRegions: GeoLocation[]
      foundedYear: number
      publicPrivate: 'public' | 'private' | 'pe_backed'
      parentCompany: Company | null
      subsidiaries: Company[]
      strategicDirection: string
      growthRate: percentage
      recentEvents: Event[]  # M&A, expansions, restructuring

  BusinessUnit:
    properties:
      name: string
      parentCompany: Company
      function: 'transportation' | 'logistics' | 'supply_chain' | 'distribution' | 'field_services'
      headCount: Range
      budget: Range
      kpis: KPI[]
      reportingStructure: OrgNode

  Contact:
    properties:
      name: string
      title: string
      department: string
      level: OrgLevel
      decisionAuthority: DecisionRole
      communicationStyle: CommunicationStyle
      motivations: string[]
      concerns: string[]
      successMetrics: string[]
      relationshipStrength: number  # 0-100
      lastInteraction: DateTime
      engagementScore: number

  BuyingCommittee:
    properties:
      members: Contact[]
      economicBuyer: Contact
      champion: Contact | null
      technicalBuyer: Contact | null
      coach: Contact | null
      blockers: Contact[]
      decisionProcess: DecisionProcess
      timeline: Timeline
      budget: BudgetInfo
      criteria: DecisionCriteria[]

  StrategicInitiative:
    properties:
      name: string
      sponsor: Contact
      objectives: string[]
      timeline: Timeline
      budget: Range
      status: 'planned' | 'active' | 'stalled' | 'completed'
      relevanceToPTV: number  # 0-100
      transportationImplications: string[]
```

### 3.3 Operational Entities

```yaml
OperationalEntity:
  TransportationNetwork:
    properties:
      type: NetworkType  # hub_spoke | point_to_point | hybrid | milk_run | zone_based
      facilities: Facility[]
      lanes: Lane[]
      geography: GeographicScope
      totalMilesDaily: Range
      totalStopsDaily: Range
      peakSeason: Season[]
      growthTrend: Trend

  Facility:
    properties:
      name: string
      type: FacilityType  # distribution_center | warehouse | cross_dock | terminal | customer_location | yard
      location: GeoLocation
      capacity: CapacityMetrics
      throughput: ThroughputMetrics
      operatingHours: Schedule
      dockDoors: number
      yardCapacity: number
      automationLevel: MaturityLevel
      systems: System[]

  Fleet:
    properties:
      totalVehicles: number
      vehicleTypes: VehicleType[]
      ownership: OwnershipMix  # owned | leased | dedicated | common_carrier | broker
      averageAge: number
      replacementCycle: number
      utilization: UtilizationMetrics
      maintenanceModel: 'in_house' | 'outsourced' | 'hybrid'
      telematics: TelematicsInfo | null
      eldCompliance: boolean
      fuelType: FuelMix
      emissionsTracking: boolean

  VehicleType:
    properties:
      category: VehicleCategory  # tractor | straight_truck | van | refrigerated | flatbed | tanker | specialized
      count: number
      capacity: CapacitySpec  # weight, cube, pallets, cases
      restrictions: string[]  # hazmat, oversize, temperature
      costPerMile: Range
      fuelEfficiency: Range
      typicalRoutes: RoutePattern[]

  Driver:
    properties:
      totalDrivers: number
      driverTypes: DriverType[]  # company | owner_operator | temp | agency
      unionStatus: 'union' | 'non_union' | 'mixed'
      turnoverRate: percentage
      averageTenure: number  # years
      shortage: number  # open positions
      compensationModel: CompensationModel
      hosCompliance: ComplianceLevel
      trainingProgram: TrainingInfo
      safetyRecord: SafetyMetrics

  Route:
    properties:
      id: string
      type: RouteType  # dedicated | dynamic | scheduled | on_demand
      origin: Facility
      destination: Facility | CustomerLocation
      stops: number
      totalMiles: number
      totalTime: Duration
      frequency: Frequency  # daily | weekly | on_demand
      loadType: LoadType  # FTL | LTL | parcel | mixed
      specialRequirements: string[]  # temperature | hazmat | time_window | appointment
      profitability: ProfitabilityMetrics
      currentOptimization: OptimizationLevel

  PlanningProcess:
    properties:
      type: PlanningType  # static | dynamic | hybrid
      horizon: Duration  # how far ahead do they plan
      frequency: Frequency  # how often do they replan
      method: PlanningMethod  # manual | spreadsheet | basic_tms | optimized | ai_driven
      responsibleRole: string
      inputSources: DataSource[]
      constraints: PlanningConstraint[]
      qualityMetrics: PlanningKPI[]
      averageTimeToComplete: Duration
      planAdherenceRate: percentage
      exceptionRate: percentage

  DispatchProcess:
    properties:
      method: DispatchMethod  # manual | semi_automated | fully_automated
      communicationMethod: CommMethod  # phone | mobile_app | edt | paper
      realTimeVisibility: boolean
      exceptionHandling: ExceptionProcess
      customerNotification: NotificationCapability
      driverCommunication: CommMethod
      averageOrdersPerDay: number
      peakCapacity: number
      bottlenecks: string[]

  DeliveryOperation:
    properties:
      deliveryTypes: DeliveryType[]  # residential | commercial | jobsite | dock | curbside
      appointmentRequired: boolean
      timeWindowComplexity: TimeWindowProfile
      proofOfDelivery: PODMethod
      returnHandling: ReturnProcess
      accessorials: AccessorialProfile
      customerExperience: CXMetrics
      lastMileModel: LastMileModel

  CarrierManagement:
    properties:
      totalCarriers: number
      carrierMix: CarrierMix  # asset | broker | dedicated | spot
      procurementProcess: ProcurementProcess  # annual_bid | spot_market | contract | hybrid
      tenderAcceptanceRate: percentage
      carrierScorecard: boolean
      rateStructure: RateStructure
      paymentTerms: string
      carrierRelationships: RelationshipQuality
      digitizationLevel: MaturityLevel

  ComplianceFramework:
    properties:
      regulations: Regulation[]  # ELD | HOS | FMCSA | DOT | EU_directives | cabotage
      hazmatCertifications: string[]
      temperatureMonitoring: boolean
      chainOfCustody: boolean
      auditFrequency: Frequency
      violationHistory: ViolationRecord[]
      complianceCost: Range
      automationLevel: MaturityLevel
```

### 3.4 Technology Entities

```yaml
TechnologyEntity:
  TechnologyStack:
    properties:
      erp: ERPSystem
      tms: TMSSystem | null
      wms: WMSSystem | null
      routeOptimization: OptimizationSystem | null
      telematics: TelematicsSystem | null
      visibility: VisibilityPlatform | null
      yardManagement: YMSSystem | null
      appointmentScheduling: AppointmentSystem | null
      driverMobile: MobileApp | null
      analytics: AnalyticsPlatform | null
      integrationMiddleware: IntegrationLayer | null
      customApplications: CustomApp[]

  ERPSystem:
    properties:
      vendor: string  # SAP | Oracle | Microsoft_Dynamics | NetSuite | Infor | Other
      version: string
      modules: string[]
      deploymentModel: 'on_premise' | 'cloud' | 'hybrid'
      transportationModule: boolean
      integrationMethod: IntegrationMethod  # API | EDI | file_based | middleware | direct_db
      dataQuality: DataQualityScore
      masterDataManagement: MDMCapability

  TMSSystem:
    properties:
      vendor: string  # Blue_Yonder | Manhattan | Oracle_TMS | MercuryGate | Descartes | SAP_TM | Other | None
      version: string
      capabilities: TMSCapability[]
      limitations: string[]
      userSatisfaction: SatisfactionLevel
      contractStatus: ContractInfo
      implementationDate: Date
      customizations: CustomizationLevel
      optimizationCapability: OptimizationLevel
      integrations: Integration[]
      annualCost: Range
      
  OptimizationSystem:
    properties:
      vendor: string  # PTV | Descartes | ORTEC | Trimble | Paragon | None | Custom
      type: OptimizationType  # route_optimization | load_optimization | network_design | scheduling
      algorithm: AlgorithmType  # heuristic | metaheuristic | exact | ml_based | rule_based
      inputData: DataRequirement[]
      outputQuality: QualityMetrics
      runFrequency: Frequency
      userAdoption: AdoptionLevel
      resultsAccuracy: percentage
      implementationMaturity: MaturityLevel

  TelematicsSystem:
    properties:
      vendor: string  # Samsara | Geotab | Omnitracs | Trimble | Platform_Science | Other | None
      vehicleCoverage: percentage
      dataPoints: DataPoint[]  # GPS | speed | fuel | temperature | driver_behavior | diagnostics
      refreshRate: Duration
      dataRetention: Duration
      integrationWith: System[]
      businessValue: ValueAssessment
      driverAcceptance: AcceptanceLevel

  DataInfrastructure:
    properties:
      dataWarehouse: boolean
      realTimeCapability: boolean
      dataQualityProcess: boolean
      masterDataGovernance: boolean
      integrationArchitecture: ArchitecturePattern  # point_to_point | hub_spoke | event_driven | api_gateway
      apiMaturity: MaturityLevel
      ediCapability: EDIProfile
      cloudReadiness: CloudReadiness
      dataLake: boolean
      analyticsMaturity: AnalyticsMaturity
```

### 3.5 Transportation Relationships

The ontology defines standard relationships between entities that enable the Hypothesis Engine to reason about transportation operations:

```yaml
TransportationRelationships:

  # Causal Relationships (enable hypothesis generation)
  CausalPatterns:
    - trigger: "manual_planning AND fleet_size > 50"
      effect: "route_inefficiency > 20%"
      confidence: 0.85
      evidence_type: "benchmark"
      
    - trigger: "no_route_optimization AND delivery_count > 100_daily"
      effect: "excess_fleet_vehicles > 15%"
      confidence: 0.80
      evidence_type: "customer_data"
      
    - trigger: "no_telematics AND fleet_size > 100"
      effect: "fuel_waste > 12%"
      confidence: 0.75
      evidence_type: "benchmark"
      
    - trigger: "manual_dispatch AND order_volume > 200_daily"
      effect: "driver_overtime > 8%"
      confidence: 0.70
      evidence_type: "pattern"
      
    - trigger: "no_appointment_scheduling AND dock_utilization_unknown"
      effect: "dwell_time > 90_minutes"
      confidence: 0.65
      evidence_type: "industry_average"
      
    - trigger: "paper_based_pod AND delivery_count > 500_daily"
      effect: "proof_of_delivery_disputes > 3%"
      confidence: 0.80
      evidence_type: "customer_data"
      
    - trigger: "static_routing AND seasonal_volume_variance > 30%"
      effect: "peak_season_cost_overrun > 25%"
      confidence: 0.70
      evidence_type: "pattern"

  # Dependency Relationships (inform implementation planning)
  DependencyPatterns:
    - prerequisite: "clean_master_data"
      enables: "route_optimization"
      criticality: "blocking"
      
    - prerequisite: "gps_tracking"
      enables: "real_time_visibility"
      criticality: "blocking"
      
    - prerequisite: "erp_integration"
      enables: "automated_order_flow"
      criticality: "blocking"
      
    - prerequisite: "driver_mobile_app"
      enables: "electronic_pod"
      criticality: "enabling"
      
    - prerequisite: "telematics"
      enables: "predictive_maintenance"
      criticality: "enabling"
      
    - prerequisite: "historical_data_12_months"
      enables: "demand_forecasting"
      criticality: "blocking"

  # Impact Relationships (drive financial modeling)
  ImpactPatterns:
    - source: "route_optimization"
      target: "miles_driven"
      impact_type: "reduction"
      typical_range: "10-25%"
      factors: ["geographic_density", "time_window_flexibility", "vehicle_mix"]
      
    - source: "dynamic_dispatch"
      target: "driver_utilization"
      impact_type: "increase"
      typical_range: "15-30%"
      factors: ["order_volatility", "service_area_size", "driver_count"]
      
    - source: "load_optimization"
      target: "vehicle_count_needed"
      impact_type: "reduction"
      typical_range: "8-20%"
      factors: ["current_fill_rate", "order_consolidation_opportunity", "weight_vs_cube"]
      
    - source: "visibility_platform"
      target: "customer_service_calls"
      impact_type: "reduction"
      typical_range: "30-60%"
      factors: ["current_call_volume", "proactive_notification", "self_service_tracking"]
```

### 3.6 Financial Relationships

```yaml
FinancialRelationships:

  CostStructure:
    transportation_cost:
      components:
        - driver_labor: "35-45% of total"
        - fuel: "25-35% of total"
        - vehicle_capital: "10-20% of total"
        - maintenance: "5-10% of total"
        - insurance: "3-8% of total"
        - tolls_permits: "2-5% of total"
        - administration: "3-7% of total"
      
    cost_per_mile:
      formula: "total_cost / total_miles"
      typical_ranges:
        truckload: "$1.50 - $2.50"
        ltl: "$2.00 - $4.00"
        last_mile: "$3.00 - $8.00"
        dedicated: "$1.80 - $3.00"
      
    cost_per_stop:
      formula: "total_cost / total_stops"
      typical_ranges:
        commercial_delivery: "$15 - $35"
        residential_delivery: "$8 - $25"
        building_supply_jobsite: "$45 - $120"
        food_service: "$20 - $50"

  WasteCategories:
    fuel_waste:
      causes: ["idle_time", "suboptimal_routing", "driver_behavior", "vehicle_condition"]
      calculation: "actual_fuel - optimal_fuel_for_distance"
      typical_waste: "8-25% above optimal"
      dollar_impact: "fleet_size × avg_annual_fuel × waste_percentage"
      
    empty_miles:
      causes: ["poor_backhaul", "imbalanced_network", "no_consolidation", "scheduling_gaps"]
      calculation: "deadhead_miles / total_miles"
      typical_rate: "15-40% of total miles"
      dollar_impact: "empty_miles × cost_per_mile"
      
    excess_vehicles:
      causes: ["low_utilization", "peak_provisioning", "no_optimization", "route_inefficiency"]
      calculation: "current_fleet - optimized_fleet_need"
      typical_excess: "10-30% of fleet"
      dollar_impact: "excess_vehicles × (lease_cost + insurance + maintenance) annually"
      
    overtime_labor:
      causes: ["poor_planning", "late_starts", "route_imbalance", "exceptions", "dock_delays"]
      calculation: "overtime_hours × overtime_rate - optimal_overtime"
      typical_excess: "5-15% of labor cost"
      dollar_impact: "excess_overtime_hours × (hourly_rate × 1.5)"
      
    failed_deliveries:
      causes: ["wrong_time_window", "access_issues", "missing_info", "capacity_overflow"]
      calculation: "failed_attempts × (redelivery_cost + customer_impact)"
      typical_rate: "2-8% of deliveries"
      dollar_impact: "failed_deliveries × avg_redelivery_cost × annual_delivery_volume"
      
    detention_demurrage:
      causes: ["dock_scheduling", "load_readiness", "paperwork_delays", "yard_congestion"]
      calculation: "hours_detained × detention_rate"
      typical_cost: "$50-$150 per hour per truck"
      dollar_impact: "annual_detention_hours × hourly_rate"

  ROI_Formulas:
    simple_payback:
      formula: "total_investment / annual_savings"
      presentation: "X months to recover investment"
      
    net_present_value:
      formula: "Σ(annual_benefit / (1 + discount_rate)^year) - initial_investment"
      discount_rate: "8-12% typical for transportation"
      horizon: "5 years standard"
      
    internal_rate_of_return:
      formula: "discount_rate where NPV = 0"
      minimum_acceptable: "25%+ for transportation technology"
```

### 3.7 Buying Relationships

```yaml
BuyingRelationships:

  DecisionProcess:
    stages:
      - awareness: "Problem recognized but not prioritized"
      - exploration: "Actively researching solutions"
      - evaluation: "Comparing specific vendors"
      - selection: "Final vendor decision"
      - negotiation: "Contract and pricing"
      - approval: "Executive sign-off"
      - procurement: "Formal purchasing process"
    
    typical_timeline:
      small_deal: "2-4 months ($50K-$200K)"
      medium_deal: "4-8 months ($200K-$500K)"
      large_deal: "6-18 months ($500K-$2M+)"
    
  StakeholderInfluence:
    economic_buyer:
      role: "Controls budget allocation"
      typical_titles: ["VP Supply Chain", "CFO", "COO", "SVP Operations"]
      motivations: ["ROI", "competitive_advantage", "risk_reduction", "board_pressure"]
      engagement_required: "Must be engaged by DESIGN phase"
      
    technical_buyer:
      role: "Evaluates technical fit and integration"
      typical_titles: ["CIO", "IT Director", "Enterprise Architect", "VP Technology"]
      motivations: ["integration_simplicity", "vendor_stability", "technical_debt_reduction"]
      engagement_required: "Must be engaged by DIAGNOSE phase for technology assessment"
      
    user_buyer:
      role: "Will use the system daily"
      typical_titles: ["Transportation Manager", "Dispatch Supervisor", "Fleet Manager", "Route Planner"]
      motivations: ["ease_of_use", "time_savings", "fewer_problems", "better_tools"]
      engagement_required: "Critical for requirements validation in DESIGN phase"
      
    champion:
      role: "Internal advocate who sells on your behalf"
      characteristics: ["access_to_power", "personal_win", "credibility_internally", "willingness_to_coach"]
      development_strategy: "Arm with business case, ROI data, peer references"

  BudgetDynamics:
    funding_sources:
      - capital_budget: "New system purchases, infrastructure"
      - operating_budget: "SaaS subscriptions, ongoing services"
      - project_budget: "Specific initiatives with allocated funds"
      - contingency: "Unplanned but justified by business case"
    
    approval_thresholds:
      manager: "$0 - $50K"
      director: "$50K - $200K"
      vp: "$200K - $500K"
      c_level: "$500K - $2M"
      board: "$2M+"
```

### 3.8 Implementation Relationships

```yaml
ImplementationRelationships:

  MaturityModel:
    level_1_reactive:
      characteristics: ["paper_based", "phone_dispatch", "no_optimization", "no_visibility"]
      typical_systems: ["spreadsheets", "basic_accounting", "phone"]
      optimization_opportunity: "40-60% cost reduction possible"
      implementation_complexity: "high — significant change management"
      time_to_value: "6-12 months for full optimization"
      
    level_2_basic_technology:
      characteristics: ["basic_tms", "gps_tracking", "some_automation", "limited_optimization"]
      typical_systems: ["entry_level_tms", "basic_telematics", "erp_transportation_module"]
      optimization_opportunity: "20-35% additional improvement"
      implementation_complexity: "medium — technology upgrade path"
      time_to_value: "3-6 months"
      
    level_3_optimized:
      characteristics: ["advanced_tms", "route_optimization", "real_time_visibility", "kpi_driven"]
      typical_systems: ["advanced_tms", "optimization_engine", "visibility_platform", "analytics"]
      optimization_opportunity: "10-20% additional improvement"
      implementation_complexity: "lower — enhancement to existing"
      time_to_value: "1-3 months for incremental gains"
      
    level_4_predictive:
      characteristics: ["ml_forecasting", "dynamic_optimization", "predictive_analytics", "autonomous_planning"]
      typical_systems: ["ai_powered_tms", "demand_forecasting", "predictive_maintenance", "digital_twin"]
      optimization_opportunity: "5-15% additional improvement"
      implementation_complexity: "high — data and model sophistication required"
      time_to_value: "3-6 months for model training and validation"
      
    level_5_autonomous:
      characteristics: ["self_healing_supply_chain", "continuous_optimization", "exception_prevention", "autonomous_vehicles"]
      typical_systems: ["fully_autonomous_planning", "real_time_optimization", "ai_exception_handling"]
      optimization_opportunity: "Marginal gains, focus on resilience"
      implementation_complexity: "very_high — frontier technology"
      time_to_value: "12+ months"

  ImplementationPhasing:
    phase_1_foundation:
      duration: "4-8 weeks"
      activities: ["data_preparation", "master_data_setup", "integration_configuration", "user_training"]
      prerequisites: ["clean_address_data", "vehicle_specifications", "order_history"]
      success_criteria: ["system_connected", "data_flowing", "users_trained"]
      
    phase_2_pilot:
      duration: "4-6 weeks"
      activities: ["limited_deployment", "parallel_run", "kpi_baseline", "process_refinement"]
      prerequisites: ["phase_1_complete", "pilot_scope_defined", "success_criteria_agreed"]
      success_criteria: ["measurable_improvement", "user_adoption > 80%", "no_critical_issues"]
      
    phase_3_rollout:
      duration: "4-12 weeks"
      activities: ["full_deployment", "advanced_features", "optimization_tuning", "change_management"]
      prerequisites: ["pilot_success", "executive_approval", "full_training_plan"]
      success_criteria: ["full_adoption", "kpi_targets_met", "roi_tracking_active"]
      
    phase_4_optimization:
      duration: "ongoing"
      activities: ["continuous_improvement", "new_use_cases", "advanced_analytics", "expansion"]
      prerequisites: ["stable_operations", "data_maturity", "organizational_readiness"]
      success_criteria: ["year_over_year_improvement", "expanded_scope", "strategic_value"]

  RiskAssessment:
    implementation_risks:
      - risk: "data_quality_insufficient"
        likelihood: "high"
        impact: "optimization_results_poor"
        mitigation: "data_audit_before_start"
        detection: "data_profiling_in_discovery"
        
      - risk: "user_adoption_resistance"
        likelihood: "medium"
        impact: "system_underutilized"
        mitigation: "change_management_plan"
        detection: "organizational_readiness_assessment"
        
      - risk: "integration_complexity_underestimated"
        likelihood: "high"
        impact: "timeline_overrun"
        mitigation: "integration_assessment_in_design_phase"
        detection: "technology_stack_analysis"
        
      - risk: "scope_creep"
        likelihood: "high"
        impact: "budget_and_timeline_overrun"
        mitigation: "clear_scope_boundaries_documented"
        detection: "requirements_volatility_tracking"
        
      - risk: "champion_leaves_organization"
        likelihood: "medium"
        impact: "project_loses_sponsorship"
        mitigation: "multi_threaded_engagement"
        detection: "stakeholder_monitoring"
```

### 3.9 Ontology Application Example

**Scenario**: Customer mentions "We have about 200 trucks and plan routes manually each morning"

```
ENTITY EXTRACTION:
  → Fleet.totalVehicles = 200 (confidence: 0.9, qualifier: "about")
  → Fleet.vehicleTypes = [{ category: "truck", count: 200 }]
  → PlanningProcess.method = "manual" (confidence: 0.95)
  → PlanningProcess.frequency = "daily" (confidence: 0.95)
  → PlanningProcess.horizon = "same_day" (confidence: 0.80)

ONTOLOGY-DRIVEN INFERENCES:
  CausalPattern: "manual_planning AND fleet_size > 50" → "route_inefficiency > 20%"
    → HYPOTHESIS: Routes are 20-30% longer than optimal
    → Financial Impact: 200 trucks × 150 miles/day × 20% waste × $2.50/mile × 250 days = $3.75M waste
    
  CausalPattern: "no_route_optimization AND fleet > 100" → "excess_fleet_vehicles > 15%"  
    → HYPOTHESIS: 30-40 vehicles are unnecessary with optimized routing
    → Financial Impact: 35 trucks × $80K/year (lease + operating) = $2.8M excess fleet cost
    
  DependencyPattern: "manual_planning" → "no_real_time_optimization"
    → INFERENCE: They cannot dynamically re-route during the day
    → HYPOTHESIS: Exception handling is reactive and expensive
    
  MaturityModel: manual_planning → Level 1 (Reactive)
    → INFERENCE: Massive optimization opportunity exists
    → BENCHMARK: Level 1 → Level 3 typically yields 25-40% cost reduction

GRAPH UPDATES:
  Node: Fleet (type: ASSET, confidence: 0.9)
  Node: ManualPlanning (type: PROCESS, confidence: 0.95)
  Node: RouteInefficiency (type: HYPOTHESIS, confidence: 0.65)
  Node: ExcessFleet (type: HYPOTHESIS, confidence: 0.60)
  Edge: ManualPlanning → CAUSES → RouteInefficiency
  Edge: RouteInefficiency → IMPACTS → ExcessFleet
  Edge: Fleet → USES → ManualPlanning

COACHING OUTPUT:
  Priority question: "How many routes do you typically run versus vehicles available?"
  Reasoning: Validates excess fleet hypothesis worth $2.8M
  Follow-up: "What happens when a driver calls in sick or a truck breaks down?"
  Reasoning: Tests exception handling — likely reveals additional pain
```

---

## SECTION 4: ACCOUNT INTELLIGENCE MODEL

### 4.1 Compound Knowledge Architecture

The Account Intelligence Model ensures that intelligence accumulates across all interactions, never degrades, and becomes exponentially more valuable over time. The fundamental principle: **nothing is ever rediscovered**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPOUND KNOWLEDGE LIFECYCLE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SESSION 1              SESSION 2              SESSION 3                 │
│  ┌─────────┐           ┌─────────┐           ┌─────────┐              │
│  │ DISCOVER │           │ DIAGNOSE│           │ DESIGN  │              │
│  │          │           │          │           │          │              │
│  │ 47 nodes │           │ 89 nodes │           │ 134 nodes│              │
│  │ 23 edges │           │ 67 edges │           │ 112 edges│              │
│  │ 5 hyps   │           │ 12 hyps  │           │ 8 hyps  │              │
│  │ 32% conf │           │ 58% conf │           │ 79% conf│              │
│  └─────────┘           └─────────┘           └─────────┘              │
│       │                      │                      │                   │
│       ▼                      ▼                      ▼                   │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │              ACCOUNT KNOWLEDGE GRAPH                           │      │
│  │                                                                │      │
│  │  • Every fact ever learned, with temporal boundaries           │      │
│  │  • Every relationship mapped                                   │      │
│  │  • Every hypothesis tracked (validated/invalidated)            │      │
│  │  • Every stakeholder mapped with interaction history           │      │
│  │  • Every pain point quantified with evidence chain            │      │
│  │  • Complete audit trail of how understanding evolved           │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                               │                                         │
│                               ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │              ACCOUNT INTELLIGENCE DERIVATIVES                   │      │
│  │                                                                │      │
│  │  • Living business case (auto-updating)                       │      │
│  │  • Stakeholder influence map                                   │      │
│  │  • Technology landscape assessment                            │      │
│  │  • Risk register                                               │      │
│  │  • Opportunity sizing (continuously refined)                  │      │
│  │  • Competitive position assessment                            │      │
│  │  • Implementation readiness score                             │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Knowledge Accumulation Rules

**Rule 1: Additive Only**
New sessions ADD to the graph — they never wipe previous state. Even corrections are additive (old fact gets `validUntil` timestamp, new fact gets `validFrom`).

**Rule 2: Evidence Stacking**
When the same fact is confirmed by multiple sources or sessions, its confidence increases. A fact mentioned by the VP of Operations carries more weight than one mentioned by an unknown participant. A fact confirmed in three separate sessions is near-certain.

**Rule 3: Contradiction Preservation**
When new information contradicts existing knowledge, BOTH are preserved with a `CONTRADICTS` edge. The system flags the contradiction for resolution rather than silently overwriting.

**Rule 4: Inference Attribution**
Every inference, hypothesis, and score is traceable to specific evidence. Nothing exists in the graph without a source chain. This enables:
- Audit trails for compliance
- Debugging when AI reasoning seems wrong
- Evidence-based presentations to customers
- Confidence recalculation when evidence changes

**Rule 5: Context Inheritance**
New sessions inherit full context from previous sessions. The rep never starts from zero. Before session 3, the system knows everything from sessions 1 and 2, including:
- Open questions from previous sessions
- Hypotheses that need validation
- Promises made by both sides
- Action items and their status
- Knowledge gaps prioritized for this session

### 4.3 Pre-Session Intelligence Assembly

Before every scheduled session, the system assembles a contextual briefing:

```typescript
interface PreSessionBriefing {
  accountId: string;
  sessionNumber: number;
  
  // 30-second quick view
  quickView: {
    headline: string;           // "3rd meeting with ACME Logistics. Focus: validate fleet utilization hypothesis ($2.8M opportunity)"
    keyFacts: string[];         // Top 5 most important known facts
    openHypotheses: Hypothesis[];  // Top 3 hypotheses to validate this session
    lastSessionSummary: string;    // 2-sentence recap
    attendees: PersonaBriefing[];  // Who's in this meeting and what they care about
  };
  
  // 2-minute detailed brief
  detailedBrief: {
    knowledgeState: ConfidenceCategory[];   // Where are we strong/weak
    businessCaseStatus: BusinessCaseSummary; // Current opportunity sizing
    suggestedStrategy: SessionStrategy;      // Recommended approach
    questionsToAsk: PrioritizedQuestion[];   // Top 10 questions for this session
    topicsToAvoid: string[];                 // Sensitive areas identified previously
    competitiveContext: CompetitiveSummary;   // Current competitive situation
    actionItemsFromLast: ActionItem[];       // What was promised last time
  };
  
  // External enrichment (auto-gathered)
  externalContext: {
    recentNews: NewsItem[];                  // Company news since last session
    financialUpdates: FinancialUpdate[];     // Earnings, funding, etc.
    industryDevelopments: IndustryNews[];    // Relevant industry changes
    linkedInChanges: ContactUpdate[];        // Job changes, new hires
    competitorMoves: CompetitorNews[];       // Competitor announcements
  };
}
```

### 4.4 Temporal Knowledge Management

Transportation operations change over time. The platform must track these changes and reason about them:

**Types of Temporal Change**:

| Change Type | Example | Detection Method | Impact |
|---|---|---|---|
| Gradual drift | Fleet growing from 200 to 245 vehicles | Explicit mention in session | Recalculate all fleet-size-dependent hypotheses |
| Step change | New CTO hired, strategy shift | News enrichment or session mention | Re-evaluate technology decisions |
| Seasonal variation | Volume doubles during holiday | Industry knowledge + explicit mention | Adjust benchmarks seasonally |
| Contract events | TMS contract expires Q4 2025 | Captured in graph as time-bounded fact | Trigger urgency in deal timeline |
| Organizational change | Merger, restructuring, layoffs | News enrichment or session mention | Re-assess stakeholder map and priorities |

**Temporal Query Examples**:
```
// What was their fleet size 6 months ago vs. now?
graph.queryTemporal('fleet.totalVehicles', { 
  at: sixMonthsAgo,
  compare: now 
});
// Result: { then: 200, now: 245, growth: "22.5%", trend: "expanding" }

// Has their planning process changed since we first learned about it?
graph.queryEvolution('planning_process', { 
  since: firstSession 
});
// Result: { original: "manual", current: "manual", changed: false, sessions_confirmed: 3 }

// When does their current TMS contract expire?
graph.queryTimeBounded('tms_contract', { 
  field: 'validUntil' 
});
// Result: { vendor: "Blue Yonder", validUntil: "2025-10-31", urgency: "high" }
```

### 4.5 Cross-Account Pattern Recognition

The platform's most powerful long-term asset: recognizing patterns across all customer accounts to improve intelligence for each individual account.

**Pattern Types**:

```typescript
interface CrossAccountPattern {
  id: string;
  patternType: 'diagnostic' | 'predictive' | 'prescriptive' | 'benchmark';
  
  // What conditions define this pattern?
  conditions: {
    industry: string[];
    companySize: Range;
    currentTechnology: string[];
    operationalMaturity: MaturityLevel;
    geography: string[];
  };
  
  // What has been observed when these conditions exist?
  observations: {
    finding: string;
    frequency: number;           // How often is this true? (percentage)
    sampleSize: number;          // How many accounts showed this?
    confidence: number;          // Statistical confidence
    financialImpact: Range;      // Typical dollar impact
  };
  
  // How should this inform new account discovery?
  implications: {
    hypothesesToGenerate: string[];
    questionsToAsk: string[];
    benchmarksToReference: string[];
    solutionsToRecommend: string[];
  };
}

// Example Pattern:
{
  id: "pat_3pl_byjt_no_opt",
  patternType: "predictive",
  conditions: {
    industry: ["3PL"],
    companySize: { min: 500, max: 2000, unit: "vehicles" },
    currentTechnology: ["Blue Yonder TMS"],
    operationalMaturity: "level_2",
    geography: ["North America"]
  },
  observations: {
    finding: "Fleet utilization below 70% with 15%+ cost reduction achievable via route optimization",
    frequency: 94,               // 94% of matching accounts showed this
    sampleSize: 47,              // Based on 47 similar accounts
    confidence: 0.92,
    financialImpact: { low: 800000, high: 3200000, median: 1800000 }
  },
  implications: {
    hypothesesToGenerate: [
      "Fleet utilization is 60-70% due to suboptimal routing",
      "15-20% of vehicles could be eliminated with optimization",
      "Driver overtime exceeds 8% due to route imbalance"
    ],
    questionsToAsk: [
      "What's your average vehicle utilization rate?",
      "How do you handle route imbalances between regions?",
      "What percentage of your fleet sits idle on an average day?"
    ],
    benchmarksToReference: [
      "3PLs your size with optimization achieve 85%+ utilization",
      "Typical cost-per-mile reduction is $0.35-$0.55 with optimization"
    ],
    solutionsToRecommend: ["PTV Route Optimizer", "PTV Fleet Analytics"]
  }
}
```

**Privacy and Anonymization**:
- Patterns are derived from aggregated, anonymized data
- No individual customer data is visible to other customers
- Minimum sample size (n=10) required before pattern is activated
- Statistical significance testing before pattern is used
- Customer opt-out option for contributing to pattern database
- Separate consent for pattern contribution vs. pattern consumption

### 4.6 Knowledge Decay and Freshness

Not all knowledge is equally current. The system applies freshness weighting:

```
Freshness Score = base_confidence × decay_function(age) × confirmation_bonus

where:
  decay_function = 0.98^(months_since_last_confirmation)  // Slow decay
  confirmation_bonus = 1.0 + (0.1 × number_of_confirmations)  // Caps at 2.0

Example:
  Fact: "Fleet size is 200 trucks"
  Confirmed: 3 sessions ago (2 months)
  Confirmations: 3 different sessions
  
  Freshness = 0.9 × 0.98^2 × min(1.0 + 0.1×3, 2.0)
            = 0.9 × 0.96 × 1.3
            = 1.12 (effectively still very confident)
            
  vs.
  
  Fact: "They use MercuryGate TMS"
  Mentioned: Once, 8 months ago
  Never confirmed again
  
  Freshness = 0.85 × 0.98^8 × 1.1
            = 0.85 × 0.85 × 1.1
            = 0.79 (declining confidence, worth re-confirming)
```

### 4.7 Account Intelligence Lifecycle

```
PRE-ENGAGEMENT (Account Created)
  │
  ├── External enrichment: Company info, news, financials
  ├── Industry pattern application: What typically exists for this type
  ├── Hypothesis generation: Initial hypotheses from profile alone
  └── Preparation: First session strategy generated
  
ACTIVE ENGAGEMENT (Sessions in Progress)
  │
  ├── Knowledge accumulates session over session
  ├── Hypotheses validated/invalidated with evidence
  ├── Business case strengthens with quantified pain
  ├── Stakeholder map deepens with each interaction
  └── Competitive position clarifies over time
  
POST-ENGAGEMENT (Deal Won/Lost)
  │
  ├── Win: Knowledge transfers to implementation team
  ├── Win: Implementation results feed back to benchmarks
  ├── Loss: Win/loss analysis enriches competitive intelligence
  ├── Loss: Pattern identification for similar future accounts
  └── Both: Cross-account patterns updated with this outcome
  
RE-ENGAGEMENT (Customer Success / Upsell)
  │
  ├── All previous knowledge immediately available
  ├── Implementation results inform new discovery
  ├── Expansion opportunities pre-identified from graph
  ├── New stakeholders mapped in context of existing relationships
  └── ROI realization tracked against original business case
```

---

## SECTION 5: AI REASONING MODEL

### 5.1 Reasoning Philosophy

The platform's AI does not simply pattern-match or retrieve information — it **reasons**. This means it forms beliefs about the world, updates those beliefs based on evidence, generates predictions about what will be discovered, and explains its reasoning chain transparently.

The reasoning model draws from three AI paradigms:
1. **Bayesian Reasoning**: Updating beliefs probabilistically as evidence arrives
2. **Abductive Reasoning**: Inferring the most likely explanation from observed facts
3. **Dialectical Reasoning**: Resolving contradictions through synthesis

### 5.2 How the AI Forms Hypotheses

Hypothesis formation follows a structured process that mirrors expert consulting reasoning:

```
STEP 1: OBSERVATION
  Input: New fact extracted from transcript or document
  Example: "Customer has 200 trucks and plans routes manually each morning"
  
STEP 2: PATTERN MATCHING
  Process: Compare observation against known causal patterns in ontology
  Match: "manual_planning AND fleet_size > 50 → route_inefficiency > 20%"
  Match: "no_optimization AND fleet > 100 → excess_vehicles > 15%"
  
STEP 3: CONTEXTUAL ENRICHMENT
  Process: Consider what else is known about this account
  Context: Industry = building supply, geography = southeast US, delivery = jobsite
  Enrichment: Building supply has high route variability due to construction scheduling
  
STEP 4: HYPOTHESIS FORMULATION
  Process: Generate specific, testable hypothesis with confidence
  Output: "This fleet likely has 55-65% utilization due to manual planning 
           combined with construction delivery variability. This represents 
           35-45 excess vehicles at $80K/year each = $2.8M-$3.6M annual waste."
  Confidence: 0.45 (strong pattern match, but no validation yet)
  
STEP 5: VALIDATION STRATEGY
  Process: Determine what evidence would confirm or deny
  Confirm signals: "Utilization below 70%", "vehicles sitting idle regularly", "overtime despite full fleet"
  Deny signals: "Already optimized routing", "high utilization reported", "fleet recently right-sized"
  Recommended questions: Ranked list targeting highest-information-gain answers

STEP 6: CONFIDENCE UPDATE (when new evidence arrives)
  New evidence: "We usually have 30-40 trucks sitting in the yard by 2pm"
  Update: 40 idle trucks / 200 total = 80% confirmation of excess fleet hypothesis
  New confidence: 0.45 → 0.78 (strong supporting evidence from authoritative source)
  Financial refinement: 40 excess trucks × $80K/year = $3.2M (narrowing the range)
```

### 5.3 Evidence Validation Framework

Not all evidence is equal. The AI applies a structured evaluation:

```typescript
interface EvidenceEvaluation {
  // Source quality
  sourceAuthority: number;        // CEO = 0.95, Unknown participant = 0.50
  sourceExpertise: number;        // Subject matter expert = 0.90, Tangential role = 0.60
  sourceMotivation: number;       // Neutral/honest = 0.90, Sales pitch = 0.50
  
  // Statement quality
  specificity: number;            // "Exactly 237 trucks" = 0.95, "About 200" = 0.80, "A lot" = 0.40
  verifiability: number;          // Measurable fact = 0.90, Opinion = 0.50, Aspiration = 0.40
  consistency: number;            // Aligns with other evidence = 0.90, Contradicts = 0.30
  
  // Context quality
  voluntariness: number;          // Volunteered freely = 0.90, Extracted under pressure = 0.70
  recency: number;                // Current state = 0.95, "Last year we..." = 0.70
  firsthand: number;              // Direct experience = 0.90, Hearsay = 0.60
  
  // Composite evidence weight
  weight: number;                 // Multiplicative combination of above factors
}

// Example: VP Operations says "We run about 200 trucks across 4 DCs"
{
  sourceAuthority: 0.90,          // VP level
  sourceExpertise: 0.95,          // Operations is their domain
  sourceMotivation: 0.85,         // No reason to mislead about this
  specificity: 0.80,              // "About" qualifier reduces specificity
  verifiability: 0.90,            // Truck count is measurable
  consistency: 1.00,              // No contradicting evidence yet
  voluntariness: 0.90,            // Shared openly in context
  recency: 0.95,                  // Clearly current state
  firsthand: 0.95,                // Their operation
  weight: 0.87                    // High-quality evidence
}
```

### 5.4 Handling Conflicting Information

Contradictions are inevitable in multi-session, multi-stakeholder discovery. The AI handles them through a resolution framework:

```
CONFLICT DETECTION:
  Trigger: New evidence contradicts existing graph node
  
  Example: 
    Existing: VP Ops said "We have 200 trucks" (Session 1, confidence 0.87)
    New: Fleet Manager said "We actually have 237 trucks including the leased ones" (Session 3, confidence 0.92)

CONFLICT CLASSIFICATION:
  Type 1: REFINEMENT — New info is more precise (200 → 237 with leased)
    Resolution: Accept new as refinement, mark old as partially correct
    
  Type 2: TEMPORAL — Things changed since last mentioned
    Resolution: Create temporal boundary, both are correct at different times
    
  Type 3: PERSPECTIVE — Different people have different views of same reality
    Resolution: Track both, note the difference, flag for clarification
    
  Type 4: ERROR — Someone was wrong or misspoke
    Resolution: Keep both with contradiction edge, reduce confidence on less-credible source
    
  Type 5: SEMANTIC — Same concept, different terminology or scope
    Resolution: Reconcile by identifying the scoping difference

CONFLICT RESOLUTION PROCESS:
  1. Detect: New evidence contradicts existing node
  2. Classify: Determine conflict type using contextual analysis
  3. Preserve: Both pieces of evidence stay in graph
  4. Relate: Create CONTRADICTS edge between conflicting nodes
  5. Adjust: Recalculate confidence on both nodes
  6. Flag: Add to "needs clarification" list for next session
  7. Impact: Reassess any hypotheses that depended on the conflicting fact

CONFIDENCE ADJUSTMENT ON CONFLICT:
  original_confidence = original_confidence × 0.7  // Reduced but not eliminated
  new_evidence_confidence = calculated normally
  resolution_needed = true  // Flagged for human resolution
```

### 5.5 Confidence Change Dynamics

Confidence is not a simple counter. It models genuine epistemic state:

```
CONFIDENCE INCREASES WHEN:
  ├── Direct evidence supports the hypothesis
  │     Example: They confirm fleet utilization is 62% → hypothesis confidence jumps
  │     Mechanism: Bayesian update with high-weight evidence
  │
  ├── Multiple independent sources corroborate
  │     Example: VP Ops AND Fleet Manager AND financial data all indicate excess fleet
  │     Mechanism: Confidence compounds with independent confirmation
  │
  ├── Absence of expected contradictions
  │     Example: Asked about optimization, they confirm "purely manual"
  │     Mechanism: Negative evidence (ruled out alternatives) increases remaining hypothesis
  │
  └── Cross-account pattern consistency
        Example: 94% of similar companies show this pattern
        Mechanism: Prior probability adjustment based on base rate

CONFIDENCE DECREASES WHEN:
  ├── Direct evidence contradicts
  │     Example: They say "Actually we just implemented ORTEC last quarter"
  │     Mechanism: Strong contradicting evidence reduces hypothesis significantly
  │
  ├── Context changes invalidate assumptions
  │     Example: Company was acquired — new parent already has PTV
  │     Mechanism: Foundational assumption change cascades through hypotheses
  │
  ├── Time decay without confirmation
  │     Example: Hypothesis generated 6 months ago, never addressed again
  │     Mechanism: Slow decay function applies to unconfirmed hypotheses
  │
  └── Alternative explanations become more likely
        Example: Low utilization could be due to seasonal downturn, not structural problem
        Mechanism: Competing hypothesis reduces confidence in original

CONFIDENCE REMAINS STABLE WHEN:
  ├── No new evidence either way
  ├── Evidence is ambiguous or low-weight
  └── Confirmed facts with no new contradictions
```

### 5.6 How Recommendations Evolve

Recommendations are not static outputs — they evolve as understanding deepens:

```
RECOMMENDATION MATURITY LEVELS:

Level 1: DIRECTIONAL (0-30% confidence)
  Based on: Industry + company size + basic profile
  Example: "Companies like this typically benefit from route optimization"
  Appropriate for: Internal planning, initial hypothesis formation
  NOT for: Customer-facing presentations

Level 2: HYPOTHESIS-BACKED (30-60% confidence)
  Based on: Initial discovery + ontology-driven inference
  Example: "Based on manual planning for 200 trucks, route optimization likely saves 15-25%"
  Appropriate for: Discovery conversation framing, exploration direction
  NOT for: Formal business cases

Level 3: EVIDENCE-SUPPORTED (60-80% confidence)
  Based on: Validated hypotheses + quantified pain points
  Example: "With confirmed 62% fleet utilization, PTV Route Optimizer typically improves to 82-88%, eliminating 30-40 vehicles"
  Appropriate for: Preliminary business case, demo planning, solution scoping
  
Level 4: VALIDATED (80-95% confidence)
  Based on: Multi-source confirmation + financial validation + stakeholder agreement
  Example: "Eliminating 35 excess vehicles saves $2.8M annually. Customer agrees with assumptions. Implementation requires 12-week pilot."
  Appropriate for: Executive business case, formal proposal, deal justification

Level 5: PROVEN (95%+ confidence)
  Based on: Customer data analysis + agreed metrics + implementation planning complete
  Example: "Analysis of customer's actual route data confirms 38 excess vehicles. Detailed implementation plan agreed. Payback in 4.2 months."
  Appropriate for: Final proposal, contract negotiation, executive sign-off
```

### 5.7 Chain-of-Thought Architecture

Every AI reasoning operation produces an explicit chain of thought that is stored for transparency, debugging, and improvement:

```typescript
interface ReasoningChain {
  id: string;
  timestamp: DateTime;
  trigger: string;              // What initiated this reasoning
  engine: string;               // Which engine performed it
  
  steps: {
    stepNumber: number;
    operation: string;          // "observe" | "retrieve" | "infer" | "compare" | "evaluate" | "conclude"
    input: any;                // What was considered
    reasoning: string;          // Natural language explanation
    output: any;               // What was produced
    confidence: number;         // How confident is this step
    alternatives: string[];    // What else was considered and rejected
  }[];
  
  conclusion: {
    output: any;
    confidence: number;
    reasoning: string;
    uncertainties: string[];    // What could change this conclusion
    nextSteps: string[];        // What would increase confidence
  };
}

// Example Chain of Thought:
{
  id: "cot_q_suggestion_001",
  trigger: "Customer mentioned '200 trucks' — refresh question suggestions",
  engine: "ConsultantBrain + CoachingEngine",
  steps: [
    {
      stepNumber: 1,
      operation: "observe",
      input: "200 trucks, manual planning, building supply industry",
      reasoning: "Key facts: significant fleet, no optimization, high-variability industry",
      output: { fleetSize: 200, optimizationLevel: "manual", industry: "building_supply" },
      confidence: 0.90,
      alternatives: []
    },
    {
      stepNumber: 2,
      operation: "retrieve",
      input: "Ontology patterns for manual planning + large fleet",
      reasoning: "Looking for causal patterns that match current observations",
      output: ["route_inefficiency > 20%", "excess_vehicles > 15%", "driver_overtime > 8%"],
      confidence: 0.85,
      alternatives: ["Could also indicate capacity constraint if they're understaffed"]
    },
    {
      stepNumber: 3,
      operation: "infer",
      input: "Building supply + manual + 200 trucks",
      reasoning: "Building supply has high daily variability due to job-site scheduling. Manual planning for 200 trucks likely means significant idle capacity and overtime simultaneously — the classic 'feast or famine' routing problem.",
      output: { primaryHypothesis: "fleet_utilization_gap", financialEstimate: "$2.4M-$3.6M" },
      confidence: 0.65,
      alternatives: ["Could be well-managed with experienced planners", "Might have seasonal justification"]
    },
    {
      stepNumber: 4,
      operation: "evaluate",
      input: "Which question would provide highest information gain?",
      reasoning: "Fleet utilization question validates the $2.8M hypothesis. Alternative: asking about overtime validates a different hypothesis worth $800K. Utilization has 3.5x higher value-per-answer. Also fits current conversational thread (just discussed trucks).",
      output: { topQuestion: "utilization_rate", score: 87, alternativeQuestion: "overtime_percentage", altScore: 62 },
      confidence: 0.80,
      alternatives: ["Could ask about technology instead, but lower immediate value"]
    },
    {
      stepNumber: 5,
      operation: "conclude",
      input: "Generate natural consultant-style question",
      reasoning: "Frame as consultant curiosity, not interrogation. Include implied industry knowledge.",
      output: "With 200 trucks, I'd be curious about your daily utilization — how many typically run full routes versus sitting in the yard?",
      confidence: 0.85,
      alternatives: [
        "What's your fleet utilization percentage? (too direct/clinical)",
        "Do all your trucks run every day? (too simplistic for the role)"
      ]
    }
  ],
  conclusion: {
    output: "With 200 trucks, I'd be curious about your daily utilization — how many typically run full routes versus sitting in the yard?",
    confidence: 0.85,
    reasoning: "This question validates the highest-value hypothesis while flowing naturally from the fleet discussion and demonstrating industry expertise.",
    uncertainties: ["Customer may not know utilization off the top of their head", "Could reveal they already track this well"],
    nextSteps: ["If confirms low utilization → quantify excess fleet cost", "If denies → explore where waste appears instead"]
  }
}
```

### 5.8 Multi-Step Reasoning Patterns

Complex reasoning tasks require multi-step processing. The platform implements several reasoning patterns:

**Pattern 1: Diagnostic Cascade**
```
Observed symptom → Possible root causes → Evidence needed per cause → Most likely diagnosis

Example:
  Symptom: "Our customers complain about missed delivery windows"
  Possible causes:
    1. Route planning doesn't account for time windows properly (30% likely)
    2. Too many stops per route causing cascading delays (25% likely)
    3. Inaccurate travel time estimates (20% likely)
    4. Driver behavior issues (15% likely)
    5. External factors (traffic, weather) not managed (10% likely)
  
  Evidence needed:
    1. "How do you handle time windows in your planning process?"
    2. "What's your average stops per route?"
    3. "How do you estimate drive times?"
    4. "Do you track route adherence in real-time?"
    5. "How do you handle same-day disruptions?"
  
  Prioritize by: P(cause) × financial_impact × ease_of_validation
```

**Pattern 2: Financial Triangulation**
```
Multiple estimation methods → Cross-validate → Confidence-weighted average

Example:
  Method 1 (Top-down): Industry benchmark × fleet size = $2.4M estimated waste
  Method 2 (Bottom-up): Idle trucks × cost per truck = $2.8M specific waste
  Method 3 (Comparative): Similar customer achieved 18% reduction on $15M spend = $2.7M
  
  Triangulated estimate: $2.6M (confidence: 0.75, range: $2.0M - $3.2M)
  Weighted by: method_reliability × evidence_quality × specificity_to_customer
```

**Pattern 3: Stakeholder Synthesis**
```
Multiple perspectives → Common ground → True situation

Example:
  VP Ops says: "Our routing is fine, the problem is driver shortage"
  Fleet Manager says: "We have enough drivers but routes are too long"
  Finance says: "Transportation costs are 8% above budget"
  
  AI synthesis:
    - Routes may be suboptimal (Fleet Manager + Finance alignment)
    - Driver shortage may be CAUSED by route inefficiency (long routes → driver dissatisfaction → turnover)
    - VP Ops may be deflecting from operations accountability
    - True root cause likely: inefficient routing → longer days → driver turnover → apparent shortage
    
  Hypothesis: "Driver shortage is a symptom of routing inefficiency, not an independent problem"
  Validation: "What's your driver turnover rate? What do exit interviews say about route length?"
```

**Pattern 4: Competitive Positioning Reasoning**
```
Customer needs + Competitor strengths + PTV strengths → Optimal positioning

Example:
  Customer needs: Real-time route optimization, TMS integration, multi-stop delivery
  Competitor (Descartes): Strong in compliance, good TMS, weaker in optimization algorithm
  PTV: Superior optimization algorithm, strong strategic planning, different integration approach
  
  AI reasoning:
    - Emphasize optimization quality (PTV advantage, customer priority)
    - Acknowledge integration differently (don't compete on TMS breadth)
    - Question to ask: "When you think about route quality vs. compliance features, which drives more daily cost for you?"
    - Trap question: "How many constraints does your current system actually optimize simultaneously?"
    - Strategy: Position as optimization specialist vs. generalist
```

---

## SECTION 6: USER EXPERIENCE PHILOSOPHY

### 6.1 Design Principle: The Invisible Consultant

The ultimate measure of UX success: **the salesperson feels like they have an experienced transportation consultant sitting beside them**, not like they are using software.

This means:
- The interface never demands attention — it offers it when needed
- Information appears at the moment it becomes relevant, not before
- The rep controls the conversation — the tool follows, never leads
- Complexity exists but is hidden behind simplicity
- The tool makes the rep look brilliant, not the tool look brilliant

### 6.2 Core UX Principles

**Principle 1: Cognitive Load Reduction**
Every screen must answer: "What's the ONE thing the rep needs right now?" If the answer is "many things," the design has failed. During a live conversation, the rep has approximately 0.5 seconds of attention to give the screen between listening and speaking. Everything must be designed for that 0.5-second glance.

**Principle 2: Progressive Disclosure**
- Layer 0 (Glanceable): 2-3 suggested questions, overall confidence score, current phase indicator
- Layer 1 (One tap): Question reasoning, confidence breakdown, key facts sidebar
- Layer 2 (Intentional exploration): Full graph visualization, detailed analysis, business case builder
- Layer 3 (Deep dive): Historical sessions, complete evidence chains, export/reporting

**Principle 3: Conversational Rhythm Respect**
The UI never interrupts. It updates silently. When the rep has a natural pause (listening to the customer speak), that is when new suggestions appear with a subtle visual indicator. No flashing, no alerts, no notifications during active speech.

**Principle 4: Consultant Language, Not Software Language**
- Not "Confidence Score: 67%" → "You have a good understanding of their operations. Key gap: financial drivers."
- Not "3 questions remaining in DIAGNOSE phase" → "Two topics worth exploring: overtime costs and delivery window compliance."
- Not "Entity extracted: fleet_size = 200" → Silently update the knowledge display

**Principle 5: Earned Complexity**
New users see the simplest possible interface. As they demonstrate proficiency (measured by usage patterns), more advanced features become visible. A first-time user sees: question suggestions + confidence indicator. A power user sees: hypothesis panel + competitive alerts + business case real-time updates.

### 6.3 Pre-Session Experience

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PRE-SESSION SCREEN                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────┐           │
│  │  ACME LOGISTICS — Session 3 Preparation               │           │
│  │                                                        │           │
│  │  📋 QUICK BRIEF (30 seconds)                          │           │
│  │  ─────────────────────────────────                    │           │
│  │  "3PL with 200 trucks, manual planning, building      │           │
│  │   supply focus. Last session confirmed low fleet      │           │
│  │   utilization. Key opportunity: $2.8M fleet waste."   │           │
│  │                                                        │           │
│  │  👥 ATTENDEES TODAY                                   │           │
│  │  ├── John Smith, VP Operations (Economic Buyer)       │           │
│  │  │   Cares about: cost reduction, driver retention    │           │
│  │  └── Sarah Chen, Fleet Manager (User Buyer)           │           │
│  │       Cares about: daily efficiency, tool usability   │           │
│  │                                                        │           │
│  │  🎯 TOP 3 OBJECTIVES FOR THIS SESSION                │           │
│  │  1. Validate overtime hypothesis ($800K potential)    │           │
│  │  2. Understand current technology stack (TMS/ERP)     │           │
│  │  3. Identify decision timeline and buying process     │           │
│  │                                                        │           │
│  │  ⚡ OPENING QUESTIONS                                 │           │
│  │  • "Last time you mentioned 30-40 trucks sitting      │           │
│  │     idle by 2pm — has anything changed since then?"   │           │
│  │  • "Who else is involved in evaluating technology     │           │
│  │     changes for your fleet operations?"               │           │
│  │                                                        │           │
│  │  📰 SINCE LAST SESSION                               │           │
│  │  • ACME announced Q3 earnings: revenue +12% YoY      │           │
│  │  • Hired new CIO (potential stakeholder)              │           │
│  │                                                        │           │
│  │  [Start Session →]                                    │           │
│  └──────────────────────────────────────────────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Design Rationale**:
- Consumable in 30-60 seconds before walking into meeting
- Persona reminders prevent wrong-tone mistakes
- Objectives focus the session without being rigid
- Opening questions eliminate the "blank slate" problem
- External context prevents embarrassing knowledge gaps

### 6.4 In-Session Experience

```
┌─────────────────────────────────────────────────────────────────────┐
│  LIVE SESSION — ACME Logistics (Session 3)    [●REC] 23:47          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────┐  ┌──────────────────────┐ │
│  │                                      │  │  SUGGESTED QUESTIONS  │ │
│  │         PRIMARY VIEW                 │  │                      │ │
│  │                                      │  │  💡 "What does your  │ │
│  │    PDIF Phase: DIAGNOSE              │  │  average driver's    │ │
│  │                                      │  │  day look like from  │ │
│  │    ████████████░░░ 72%              │  │  start to finish?"   │ │
│  │    Overall Confidence                │  │  → Validates overtime│ │
│  │                                      │  │    hypothesis        │ │
│  │    Key Insight:                      │  │                      │ │
│  │    "Fleet utilization confirmed      │  │  💡 "How do you     │ │
│  │     at 62% — 38 excess vehicles"    │  │  handle it when a   │ │
│  │                                      │  │  job-site delivery   │ │
│  │                                      │  │  gets rescheduled    │ │
│  │    ┌────────────────────────┐       │  │  same-day?"         │ │
│  │    │ ⬆ Hypothesis Validated │       │  │  → Tests exception  │ │
│  │    │ Fleet waste: $2.8M/yr  │       │  │    handling maturity │ │
│  │    └────────────────────────┘       │  │                      │ │
│  │                                      │  │  💡 "What systems   │ │
│  │                                      │  │  does your planning │ │
│  │                                      │  │  team use today?"   │ │
│  │                                      │  │  → Maps tech stack  │ │
│  │                                      │  │                      │ │
│  └─────────────────────────────────────┘  └──────────────────────┘ │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ 📊 CONFIDENCE: Strategy 45% | Ops 78% | Tech 23% | Financial 61%││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**In-Session Design Principles**:

1. **Peripheral Vision Design**: Question suggestions use large, readable text that can be absorbed with peripheral vision. No small print, no dense tables, no scrolling required.

2. **Silent Updates**: When confidence scores change or hypotheses are validated, the UI updates smoothly without any attention-grabbing animation. Changes are noticeable when you look, invisible when you don't.

3. **Touch-Ready**: Every interactive element is large enough to tap accurately while attention is elsewhere. No precision clicking required.

4. **Minimal Cognitive Switching**: The suggested questions panel stays in the same position always. The rep builds muscle memory for "glance right for next question." No moving elements.

5. **Context in Suggestions**: Each question shows a one-line "why" underneath. This helps the rep understand the value of asking it, enabling better conversational judgment about timing.

6. **Bookmark Capture**: Single tap to bookmark the current moment. No note-typing required during conversation. The system captures the timestamp and context automatically.

7. **Emergency Assist**: If the rep feels lost, a single gesture reveals a "conversation rescue" panel with re-orienting questions and current status summary.

### 6.5 Post-Session Experience

```
┌─────────────────────────────────────────────────────────────────────┐
│  POST-SESSION DEBRIEF — ACME Logistics, Session 3                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SESSION SCORECARD                                                   │
│  ─────────────────                                                  │
│  Discovery Quality: ████████████░░ 82% (+14% from last session)     │
│  Business Case Progress: ███████████░░░ 71% (2 new pain points)     │
│  Stakeholder Engagement: ██████████░░░░ 67% (VP highly engaged)     │
│                                                                      │
│  🏆 KEY WINS THIS SESSION                                           │
│  ├── ✅ Confirmed fleet utilization at 62% (hypothesis validated)    │
│  ├── ✅ Quantified overtime: $780K/year (new pain point)            │
│  ├── ✅ Identified Blue Yonder TMS as incumbent (competitive intel) │
│  └── ✅ VP Operations expressed urgency for Q1 2025 decision        │
│                                                                      │
│  📋 UPDATED BUSINESS CASE                                           │
│  ├── Fleet waste: $2.8M/year (VALIDATED ✓)                         │
│  ├── Overtime excess: $780K/year (NEW, needs confirmation)          │
│  ├── Manual planning labor: $340K/year (ESTIMATED)                  │
│  ├── Total identified opportunity: $3.92M/year                      │
│  └── [View full business case →]                                    │
│                                                                      │
│  🔍 GAPS TO CLOSE NEXT SESSION                                      │
│  ├── Technology budget and approval process (0% confidence)         │
│  ├── Decision timeline specifics (22% confidence)                   │
│  ├── Other stakeholders in buying committee (15% confidence)        │
│  └── Current TMS contract terms and renewal date (0% confidence)    │
│                                                                      │
│  📧 GENERATED OUTPUTS                                               │
│  ├── [Follow-up email draft] — Thank you + key takeaways            │
│  ├── [CRM update] — Opportunity fields, next steps, contacts        │
│  ├── [Internal brief] — For manager/SE team alignment               │
│  └── [Next session plan] — Strategy for session 4                   │
│                                                                      │
│  ⚡ RECOMMENDED ACTIONS                                              │
│  ├── Schedule demo with SE team (Fleet Manager expressed interest)  │
│  ├── Send ROI summary to VP Operations (requested by end of week)   │
│  ├── Research Blue Yonder contract situation (ask about renewal)    │
│  └── Engage CIO (new hire, technology decisions consolidating)       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Post-Session Design Principles**:
- This is where the rep has TIME. They can spend 5-10 minutes reviewing.
- Focus on progress celebration (what was accomplished) and clear next steps
- Auto-generated outputs reduce post-meeting admin to near-zero
- Business case progress creates momentum and motivation
- Gap identification prevents the "what should I do next" paralysis

### 6.6 Multi-Device Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DEVICE-OPTIMIZED EXPERIENCES                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  DESKTOP (Primary — Office, Video Calls)                            │
│  ├── Full-featured experience with all panels                       │
│  ├── Side-by-side view during video calls                          │
│  ├── Detailed graph visualization available                         │
│  ├── Multi-window support (coaching + CRM + meeting)               │
│  └── Keyboard shortcuts for power users                             │
│                                                                      │
│  LAPTOP (Field Sales — Customer Meetings In-Person)                 │
│  ├── Compact mode: Suggestions panel only                           │
│  ├── Positioned at screen edge, minimal footprint                  │
│  ├── Large touch targets for tap-and-glance                        │
│  ├── Dark mode for reduced visibility to customer                  │
│  └── Offline-capable with sync when connected                      │
│                                                                      │
│  TABLET (Face-to-Face — Meeting Rooms)                              │
│  ├── Optimized for laying flat on table beside notepad             │
│  ├── Suggestion cards as large swipeable elements                  │
│  ├── Haptic feedback for new suggestions (vibration)               │
│  ├── Shareable screen mode (show customer specific insights)       │
│  └── Offline-first with background sync                            │
│                                                                      │
│  MOBILE (Pre/Post Meeting — On the Go)                              │
│  ├── 30-second meeting prep (quick brief only)                     │
│  ├── Post-meeting voice notes that feed into graph                 │
│  ├── Push notifications for follow-up reminders                    │
│  ├── Quick account lookup and confidence view                      │
│  ├── Action item management                                        │
│  └── NOT designed for live session coaching (screen too small)      │
│                                                                      │
│  WATCH (Ambient Intelligence — Future)                              │
│  ├── Haptic tap when high-value question opportunity arises        │
│  ├── Glanceable confidence score                                   │
│  ├── Voice-activated bookmark ("Hey PDIP, bookmark this")          │
│  └── Minimal interaction, maximum ambient awareness                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.7 Information Hierarchy

Every screen follows a strict information hierarchy:

```
LEVEL 1 — AMBIENT (Always Visible, Zero Attention Required)
  • Current PDIF phase indicator (color/icon)
  • Overall confidence score (single number/bar)
  • Recording status (subtle indicator)
  • Session timer

LEVEL 2 — GLANCEABLE (0.5 Second Attention Budget)
  • 2-3 question suggestions (large text)
  • Most recent insight/confirmation
  • Phase progress indicator

LEVEL 3 — INTENTIONAL (5-10 Second Attention Budget)
  • Question reasoning ("why this matters")
  • Confidence breakdown by category (mini-bars)
  • Competitive alert (when relevant)
  • Hypothesis status change

LEVEL 4 — DEEP (Post-Conversation or Pause)
  • Full evidence chain for any fact
  • Complete business case with methodology
  • Graph visualization of relationships
  • Historical session comparison
  • Detailed analytics and patterns
```

### 6.8 Accessibility and Inclusivity

- WCAG 2.1 AA compliance minimum, AAA for text elements
- Screen reader support for post-session review screens
- High contrast mode for bright-light environments (car, warehouse)
- Color-blind safe palette (confidence communicated via shape + shade, not color alone)
- Keyboard navigation for all features (desktop)
- Voice input option for post-session notes
- Configurable text size (especially for in-session glanceable elements)
- Multi-language support: English, German, French, Spanish (Year 2)

### 6.9 Offline-First Architecture

Transportation reps frequently meet in warehouses, yards, and remote locations with poor connectivity:

```
OFFLINE CAPABILITIES:
  ├── Full pre-session briefing cached locally before meeting
  ├── Question suggestions pre-generated (top 20 per phase transition)
  ├── Transcription runs locally (Web Speech API or local Whisper model)
  ├── Knowledge captured locally, syncs when connected
  ├── Confidence scores estimated locally from cached model
  └── Full post-session review available offline if session completed offline

SYNC STRATEGY:
  ├── Optimistic writes: Changes save locally first, sync background
  ├── Conflict resolution: Last-write-wins for simple fields, merge for graph
  ├── Progressive sync: Critical data first (transcript), enrichments second
  ├── Bandwidth-aware: Reduce AI processing on metered connections
  └── Status indicator: Clear "offline" / "syncing" / "connected" state
```

---

## SECTION 7: ENTERPRISE PLATFORM ARCHITECTURE

### 7.1 Architecture Overview

The platform is designed as a modular, cloud-native architecture that separates concerns cleanly and scales independently per dimension (users, sessions, AI throughput, data volume).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENTERPRISE PLATFORM ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  PRESENTATION LAYER                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ Web App │  │ Desktop │  │ Mobile  │  │ Tablet  │  │ Partner │         │
│  │ (React) │  │(Electron│  │ (React  │  │  (PWA)  │  │  Portal │         │
│  │         │  │  /Tauri)│  │ Native) │  │         │  │         │         │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘         │
│       │             │             │             │             │              │
│  ═════╪═════════════╪═════════════╪═════════════╪═════════════╪══════════    │
│                          API GATEWAY LAYER                                    │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │  Kong / AWS API Gateway                                           │       │
│  │  ├── Rate limiting       ├── Authentication     ├── Versioning   │       │
│  │  ├── Request routing     ├── Load balancing     ├── Monitoring   │       │
│  │  └── API key management  └── SSL termination    └── CORS         │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                    │                                          │
│  ┌─────────────────────────────────┼────────────────────────────────┐       │
│  │              SERVICE LAYER       │                                 │       │
│  │                                  │                                 │       │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │       │
│  │  │ Session  │  │ Account  │  │ User     │  │Analytics │        │       │
│  │  │ Service  │  │ Service  │  │ Service  │  │ Service  │        │       │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │       │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │       │
│  │  │Integration│  │ Export   │  │ Coaching │  │Benchmark │        │       │
│  │  │ Service  │  │ Service  │  │ Service  │  │ Service  │        │       │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                    │                                          │
│  ┌─────────────────────────────────┼────────────────────────────────┐       │
│  │         INTELLIGENCE LAYER       │                                 │       │
│  │                                  │                                 │       │
│  │  ┌──────────────────────────────────────────────────────────┐    │       │
│  │  │  AI Orchestrator (manages model calls, budgets, routing)  │    │       │
│  │  └──────────────────────────────────────────────────────────┘    │       │
│  │       │          │          │          │          │               │       │
│  │  ┌────┴───┐ ┌────┴───┐ ┌────┴───┐ ┌────┴───┐ ┌────┴───┐       │       │
│  │  │ OpenAI │ │ Claude │ │ Fine-  │ │ Local  │ │Embedding│       │       │
│  │  │ Models │ │ Models │ │ Tuned  │ │ Models │ │ Models  │       │       │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                    │                                          │
│  ┌─────────────────────────────────┼────────────────────────────────┐       │
│  │            DATA LAYER            │                                 │       │
│  │                                  │                                 │       │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │       │
│  │  │PostgreSQL│  │ pgvector │  │  Redis   │  │   S3     │        │       │
│  │  │ (Primary)│  │ (Vectors)│  │ (Cache + │  │ (Files + │        │       │
│  │  │          │  │          │  │  Events) │  │  Exports)│        │       │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │       │
│  │                                                                   │       │
│  │  ┌──────────────────────────────────────────────────────────┐    │       │
│  │  │  Event Store (append-only log of all knowledge events)     │    │       │
│  │  └──────────────────────────────────────────────────────────┘    │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Multi-Tenancy Model

**Architecture**: Shared infrastructure with logical tenant isolation (Tier 2/3), dedicated instances for Enterprise Plus customers (Tier 4).

```typescript
interface TenantConfiguration {
  tenantId: string;
  organizationName: string;
  tier: 'coach' | 'consultant' | 'enterprise' | 'strategic_partner';
  
  isolation: {
    model: 'shared_schema' | 'schema_per_tenant' | 'database_per_tenant' | 'dedicated_instance';
    dataResidency: Region;              // EU, US, APAC
    encryptionKeyManagement: 'platform' | 'customer_managed' | 'byok';
    networkIsolation: boolean;          // VPC peering for dedicated
  };
  
  configuration: {
    pdifPhases: PDIFPhase[];            // Can customize phase names/sequence
    confidenceCategories: Category[];    // Can add custom categories
    industryVerticals: string[];         // Which verticals are enabled
    integrations: IntegrationConfig[];   // CRM, meeting tools, etc.
    customOntologyExtensions: OntologyExtension[];
    branding: BrandingConfig;           // White-label options
    aiModelPreferences: ModelPreferences;
    dataRetentionPolicy: RetentionPolicy;
  };
  
  limits: {
    maxUsers: number;
    maxConcurrentSessions: number;
    maxAICallsPerMonth: number;
    maxStorageGB: number;
    maxAccountsPerUser: number;
  };
}
```

**Tenant Data Isolation**:
- Row-Level Security (RLS) enforced at database level
- All queries automatically filtered by tenant_id
- Cross-tenant data access is architecturally impossible (not just unauthorized)
- Audit logs track all data access per tenant
- Tenant admin can export all tenant data (GDPR portability)
- Tenant admin can request full deletion (GDPR erasure)

### 7.3 Global Deployment Architecture

```
REGION DEPLOYMENT MODEL:

  Primary: EU-West (Frankfurt)
    ├── Full platform deployment
    ├── All EU customer data (GDPR compliance)
    ├── PTV HQ proximity
    └── Primary AI inference endpoints

  Secondary: US-East (Virginia)
    ├── Full platform deployment
    ├── All NA customer data
    ├── North American latency optimization
    └── Secondary AI inference endpoints

  Tertiary: APAC (Singapore) — Year 3
    ├── Full platform deployment
    ├── APAC customer data
    ├── Asia-Pacific latency optimization
    └── Tertiary AI inference endpoints

  Cross-Region:
    ├── Knowledge Engine synchronized globally (read replicas)
    ├── Benchmark data replicated across all regions
    ├── Customer data NEVER leaves designated region
    ├── AI models deployed per region
    └── CDN for static assets (CloudFront/Cloudflare)
```

### 7.4 CRM Integrations

**Salesforce Integration** (Primary):
```typescript
interface SalesforceIntegration {
  authentication: 'oauth2_jwt_bearer';  // Server-to-server
  syncMode: 'bidirectional';
  
  inbound: {  // Salesforce → PDIP
    accountData: ['name', 'industry', 'employee_count', 'revenue', 'website'];
    contactData: ['name', 'title', 'email', 'phone', 'role'];
    opportunityData: ['stage', 'amount', 'close_date', 'competitors'];
    activityData: ['meetings_scheduled', 'emails', 'calls'];
    customFields: 'configurable_mapping';
  };
  
  outbound: {  // PDIP → Salesforce
    accountUpdates: ['discovery_confidence', 'maturity_score', 'opportunity_size'];
    contactUpdates: ['engagement_score', 'buying_role', 'influence_level'];
    opportunityUpdates: ['pdif_phase', 'business_case_value', 'confidence_score'];
    activityCreation: ['session_summaries', 'action_items', 'next_steps'];
    customObjects: ['discovery_insights', 'hypotheses', 'pain_points'];
    attachments: ['business_case_pdf', 'session_report'];
  };
  
  syncFrequency: {
    realTime: ['opportunity_updates', 'contact_updates'];  // Webhook-driven
    scheduled: ['account_enrichment', 'activity_sync'];     // Every 15 minutes
    onDemand: ['full_sync', 'historical_import'];           // Manual trigger
  };
  
  conflictResolution: {
    strategy: 'most_recent_wins';
    exceptions: ['manual_override_fields'];
    auditTrail: true;
  };
}
```

**Microsoft Dynamics 365 Integration**:
```typescript
interface DynamicsIntegration {
  authentication: 'azure_ad_oauth2';
  connection: 'dataverse_web_api';
  
  entityMapping: {
    'account' → 'pdip_account',
    'contact' → 'pdip_contact',
    'opportunity' → 'pdip_opportunity',
    'appointment' → 'pdip_session',
    'annotation' → 'pdip_insight'
  };
  
  customEntities: {
    'pdip_discovery_score': { fields: ['confidence', 'phase', 'opportunity_value'] },
    'pdip_hypothesis': { fields: ['statement', 'confidence', 'financial_impact'] },
    'pdip_business_case': { fields: ['total_opportunity', 'pain_points', 'roi'] }
  };
}
```

**HubSpot Integration**:
```typescript
interface HubSpotIntegration {
  authentication: 'oauth2_private_app';
  apiVersion: 'v3';
  
  syncEntities: ['companies', 'contacts', 'deals', 'engagements', 'notes'];
  customProperties: {
    company: ['pdif_phase', 'discovery_confidence', 'maturity_score'],
    deal: ['business_case_value', 'hypothesis_count', 'confidence_score'],
    contact: ['buying_role', 'engagement_score', 'persona_type']
  };
  
  workflows: {
    triggers: ['deal_stage_change', 'meeting_completed', 'confidence_threshold'],
    actions: ['update_deal_score', 'create_task', 'send_notification']
  };
}
```

### 7.5 Meeting Platform Integrations

**Microsoft Teams**:
```typescript
interface TeamsIntegration {
  type: 'teams_app' | 'meeting_extension' | 'bot';
  
  capabilities: {
    joinMeeting: true;               // PDIP joins as bot participant
    realTimeTranscription: true;     // Uses Teams native transcription
    speakerIdentification: true;     // Leverages Teams speaker recognition
    sidePanelApp: true;              // Coaching panel within Teams window
    postMeetingApp: true;            // Debrief within Teams
    adaptiveCards: true;             // Rich notifications in Teams
  };
  
  dataFlow: {
    transcription: 'teams_cognitive_services → pdip_transcript_processor';
    audioStream: 'not_required';     // Use Teams transcription, not raw audio
    attendance: 'teams_graph_api → pdip_session_metadata';
    recording: 'teams_recording → pdip_optional_import';
  };
  
  permissions: ['Calendars.Read', 'OnlineMeetings.Read', 'Chat.ReadWrite'];
}
```

**Zoom**:
```typescript
interface ZoomIntegration {
  type: 'zoom_app' | 'meeting_sdk';
  
  capabilities: {
    joinMeeting: true;               // PDIP bot joins meeting
    realTimeTranscription: true;     // Zoom native + enhanced STT
    speakerIdentification: true;     // Zoom speaker attribution
    inMeetingApp: true;              // Side panel within Zoom
    postMeetingWebhook: true;        // Auto-import after meeting ends
    recordingImport: true;           // Import from Zoom cloud recordings
  };
  
  dataFlow: {
    transcription: 'zoom_transcription_api → pdip_transcript_processor';
    events: 'zoom_webhooks → pdip_session_lifecycle';
    recordings: 'zoom_cloud → pdip_async_import';
  };
}
```

**WebEx**:
```typescript
interface WebExIntegration {
  type: 'webex_embedded_app';
  
  capabilities: {
    meetingPanel: true;              // Embedded within WebEx
    transcription: true;            // WebEx native transcription
    speakerAttribution: true;       // WebEx participant mapping
    postMeetingImport: true;        // Import from WebEx recordings
  };
}
```

### 7.6 API-First Design

Every platform capability is accessible through a versioned REST API:

```yaml
API Architecture:
  base_url: https://api.ptv-discovery.com/v1
  authentication: OAuth2 Bearer Token + API Key
  format: JSON
  pagination: Cursor-based
  rate_limiting: Token bucket (tier-dependent)
  versioning: URL path (/v1/, /v2/)
  
Core Endpoints:
  /accounts:
    GET    /accounts                    # List accounts
    POST   /accounts                    # Create account
    GET    /accounts/{id}               # Get account details
    GET    /accounts/{id}/graph         # Get discovery graph
    GET    /accounts/{id}/business-case # Get current business case
    GET    /accounts/{id}/confidence    # Get confidence scores
    GET    /accounts/{id}/hypotheses    # Get active hypotheses
    
  /sessions:
    POST   /sessions                    # Start new session
    GET    /sessions/{id}               # Get session details
    POST   /sessions/{id}/transcript    # Add transcript segment
    GET    /sessions/{id}/insights      # Get session insights
    GET    /sessions/{id}/suggestions   # Get current suggestions
    POST   /sessions/{id}/bookmark      # Bookmark a moment
    POST   /sessions/{id}/end           # End session
    
  /intelligence:
    GET    /intelligence/benchmarks     # Query benchmark data
    POST   /intelligence/analyze        # Analyze uploaded data
    GET    /intelligence/patterns       # Cross-account patterns
    POST   /intelligence/hypothesize    # Generate hypotheses from data
    
  /exports:
    POST   /exports/business-case       # Generate business case document
    POST   /exports/crm-update          # Push to CRM
    POST   /exports/session-report      # Generate session report
    POST   /exports/executive-summary   # Generate executive summary
    
  /admin:
    GET    /admin/users                 # User management
    GET    /admin/analytics             # Platform analytics
    POST   /admin/configuration         # Update tenant configuration
    GET    /admin/audit-log             # Access audit trail

Webhook Events:
  session.started
  session.ended
  confidence.threshold_reached
  hypothesis.validated
  business_case.updated
  action_item.created
  phase.transitioned
  competitive.alert
```

### 7.7 AI Model Abstraction Layer

The platform is never locked to a single AI provider. The Model Abstraction Layer enables provider switching, A/B testing, cost optimization, and failover:

```typescript
interface AIModelAbstraction {
  // Model Router — decides which model handles each request
  router: {
    route(request: AIRequest): ModelEndpoint;
    
    routingStrategies: {
      costOptimized: 'Use cheapest model that meets quality threshold';
      qualityOptimized: 'Use best model regardless of cost';
      latencyOptimized: 'Use fastest model that meets minimum quality';
      balanced: 'Weighted score of cost × quality × latency';
    };
    
    fallbackChain: ModelEndpoint[];  // If primary fails, try next
    circuitBreaker: CircuitBreakerConfig;  // Stop calling failing providers
  };
  
  // Provider Adapters — normalize different provider APIs
  providers: {
    openai: OpenAIAdapter;       // GPT-4o, GPT-4o-mini
    anthropic: AnthropicAdapter; // Claude Sonnet, Haiku
    azure: AzureOpenAIAdapter;   // Same models, different endpoint (for EU data residency)
    local: LocalModelAdapter;    // Ollama/vLLM for fine-tuned models
    custom: CustomModelAdapter;  // Customer-provided models (enterprise tier)
  };
  
  // Prompt Management — versioned, tested, A/B testable
  promptManager: {
    getPrompt(taskType: string, version?: string): PromptTemplate;
    evaluatePrompt(promptId: string, testCases: TestCase[]): QualityScore;
    abTest(promptA: string, promptB: string, allocation: number): ABTestConfig;
    rollback(promptId: string, toVersion: string): void;
  };
  
  // Cost & Usage Tracking
  costManager: {
    trackUsage(tenantId: string, tokens: TokenUsage): void;
    getBudgetRemaining(tenantId: string): Budget;
    enforceLimit(tenantId: string): boolean;
    reportCosts(period: DateRange): CostReport;
  };
  
  // Quality Evaluation
  qualityMonitor: {
    evaluateOutput(output: AIOutput, criteria: QualityCriteria): QualityScore;
    detectHallucination(output: string, context: string): boolean;
    measureLatency(request: AIRequest, response: AIResponse): Duration;
    trackAccuracy(prediction: any, groundTruth: any): AccuracyMetrics;
  };
}
```

### 7.8 Plugin Architecture

The platform supports extensibility through a typed plugin system:

```typescript
interface PluginArchitecture {
  // Plugin types
  types: {
    industryVerticalPack: {
      // Extends transportation ontology with industry-specific entities
      ontologyExtensions: OntologyNode[];
      benchmarkData: Benchmark[];
      questionTemplates: QuestionTemplate[];
      hypothesisPatterns: HypothesisPattern[];
      scoringWeights: ScoringWeight[];
      terminology: TerminologyMap;
      regulatoryRequirements: Regulation[];
    };
    
    integrationPlugin: {
      // Connects to external systems
      provider: string;
      authentication: AuthConfig;
      syncRules: SyncRule[];
      fieldMapping: FieldMapping[];
      webhookHandlers: WebhookHandler[];
    };
    
    analyticsPlugin: {
      // Custom analytics and reporting
      metrics: MetricDefinition[];
      dashboards: DashboardConfig[];
      alerts: AlertRule[];
      exports: ExportFormat[];
    };
    
    coachingPlugin: {
      // Custom coaching methodologies
      methodology: MethodologyDefinition;
      scoringModel: ScoringModel;
      questionBank: QuestionTemplate[];
      reportingViews: ReportView[];
    };
  };
  
  // Plugin lifecycle
  lifecycle: {
    install(plugin: Plugin): void;
    configure(plugin: Plugin, config: PluginConfig): void;
    enable(plugin: Plugin): void;
    disable(plugin: Plugin): void;
    uninstall(plugin: Plugin): void;
    update(plugin: Plugin, newVersion: PluginVersion): void;
  };
  
  // Plugin sandbox (security isolation)
  sandbox: {
    permissions: Permission[];           // What the plugin can access
    dataScope: DataScope;               // What data is visible
    apiQuota: APIQuota;                 // Rate limits per plugin
    auditLog: boolean;                  // All plugin actions logged
  };
}
```

### 7.9 Industry Vertical Expansion Model

New industry verticals are added as plugin packs:

```
BASE PLATFORM (industry-agnostic)
  └── Core PDIF phase engine
  └── Basic transportation ontology
  └── Generic confidence scoring
  └── Standard question generation

VERTICAL PACKS (loaded per tenant):
  ├── 3PL Pack
  │   ├── Contract profitability analysis
  │   ├── Shipper mix assessment
  │   ├── Asset vs. non-asset modeling
  │   ├── Brokerage margin benchmarks
  │   └── Multi-shipper optimization patterns
  │
  ├── Building Supply Pack
  │   ├── Job-site delivery complexity
  │   ├── Will-call workflow integration
  │   ├── Crane/boom truck operations
  │   ├── Construction scheduling patterns
  │   └── Seasonal construction benchmarks
  │
  ├── Retail/E-commerce Pack
  │   ├── Click-to-door SLA modeling
  │   ├── Returns logistics assessment
  │   ├── Micro-fulfillment analysis
  │   ├── Peak season preparation
  │   └── Last-mile density benchmarks
  │
  ├── Food & Beverage Pack
  │   ├── Shelf-life constraint modeling
  │   ├── Store delivery window management
  │   ├── DSD vs. warehouse distribution
  │   ├── Temperature chain validation
  │   └── Freshness KPI benchmarks
  │
  ├── Healthcare/Pharmaceutical Pack
  │   ├── Chain of custody requirements
  │   ├── Temperature validation protocols
  │   ├── Controlled substance compliance
  │   ├── HIPAA considerations
  │   └── Critical delivery SLA benchmarks
  │
  ├── Field Services Pack
  │   ├── Dynamic technician dispatch
  │   ├── SLA compliance modeling
  │   ├── Parts inventory optimization
  │   ├── Appointment scheduling
  │   └── First-time-fix-rate benchmarks
  │
  └── Manufacturing/Distribution Pack
      ├── Production schedule integration
      ├── Inbound logistics coordination
      ├── Cross-dock optimization
      ├── Supplier management
      └── Just-in-time delivery benchmarks
```

### 7.10 Security Architecture

```
SECURITY ARCHITECTURE:

AUTHENTICATION & AUTHORIZATION:
  ├── SSO/SAML 2.0 (enterprise requirement)
  ├── OIDC (OpenID Connect) for modern auth flows
  ├── MFA enforcement (configurable per tenant)
  ├── SCIM provisioning for user lifecycle
  ├── API key authentication for system integrations
  ├── Service-to-service: mTLS + JWT
  └── Session management: short-lived tokens, rotating refresh tokens

AUTHORIZATION MODEL (RBAC + ABAC hybrid):
  Roles:
    ├── Platform Admin: Full system access, tenant management
    ├── Tenant Admin: Tenant configuration, user management, analytics
    ├── Sales Manager: Team oversight, coaching, analytics, all team accounts
    ├── Sales Rep: Own accounts, sessions, reports
    ├── Sales Engineer: Demo preparation, technical views, shared accounts
    ├── CSM: Post-sale accounts, implementation handoff
    └── Read-Only: View analytics, reports (for executives)
    
  Attribute-Based Controls:
    ├── Territory-based access (rep sees only their territory accounts)
    ├── Deal-stage visibility (certain data hidden until specific phases)
    ├── Sensitivity level (executive conversations restricted access)
    └── Time-based access (temporary access grants for collaborators)

DATA PROTECTION:
  At Rest:
    ├── AES-256 encryption for all stored data
    ├── Field-level encryption for PII (names, emails, phone numbers)
    ├── Transcript encryption with separate key per tenant
    ├── Key management: AWS KMS / Azure Key Vault (per region)
    └── Customer-managed keys (BYOK) for Enterprise tier
    
  In Transit:
    ├── TLS 1.3 for all connections
    ├── Certificate pinning for mobile apps
    ├── mTLS for service-to-service communication
    └── WebSocket connections secured via WSS
    
  In Processing:
    ├── AI provider data processing agreements (DPA)
    ├── No training on customer data (contractual)
    ├── Transcript data never persisted by AI provider
    ├── Temporary context windows cleared after processing
    └── Audit log of all AI processing with data classification

NETWORK SECURITY:
  ├── VPC isolation per environment (dev/staging/production)
  ├── Private subnets for databases and internal services
  ├── WAF (Web Application Firewall) for public endpoints
  ├── DDoS protection (AWS Shield / Cloudflare)
  ├── IP allowlisting option for enterprise tenants
  ├── VPN/PrivateLink for dedicated instance customers
  └── Network segmentation between tenant processing

THREAT MITIGATION:
  ├── Prompt injection defense:
  │   ├── Input sanitization layer before AI processing
  │   ├── Transcript content never treated as instructions
  │   ├── Output validation against expected schema
  │   ├── Anomaly detection for unusual AI outputs
  │   └── Human review triggers for suspicious patterns
  │
  ├── Data exfiltration prevention:
  │   ├── DLP controls on exports and API responses
  │   ├── Watermarking on generated documents
  │   ├── Rate limiting on bulk data access
  │   ├── Anomaly detection on download patterns
  │   └── Geo-fencing on access locations
  │
  ├── Insider threat controls:
  │   ├── Principle of least privilege everywhere
  │   ├── Just-in-time access for support operations
  │   ├── All access logged and auditable
  │   ├── Separation of duties for administrative actions
  │   └── Regular access reviews and certifications
  │
  └── Supply chain security:
      ├── AI provider security assessments
      ├── Dependency scanning (SCA)
      ├── Container image signing
      ├── SBOM (Software Bill of Materials)
      └── Third-party penetration testing annually
```

### 7.11 Compliance Framework

| Standard | Status | Requirements | Timeline |
|----------|--------|--------------|----------|
| **SOC 2 Type II** | Priority 1 | Annual audit, controls evidence, incident response | Within 12 months |
| **GDPR** | Active | DPA, consent management, data portability, right to erasure, DPIA | Day 1 requirement |
| **ISO 27001** | Priority 2 | ISMS, risk assessment, continuous improvement | Within 18 months |
| **CCPA** | Priority 2 | California privacy rights, opt-out mechanisms | Within 12 months |
| **EU AI Act** | Priority 2 | Transparency, explainability, human oversight | Within 18 months |
| **HIPAA** | Conditional | Required only for healthcare logistics vertical | Vertical-dependent |

**Audit Trail Requirements**:
```typescript
interface AuditEvent {
  timestamp: DateTime;
  tenantId: string;
  userId: string;
  action: string;              // 'read' | 'create' | 'update' | 'delete' | 'export' | 'ai_process'
  resource: string;            // What was accessed
  resourceId: string;
  outcome: 'success' | 'failure' | 'denied';
  ipAddress: string;
  userAgent: string;
  geoLocation: string;
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  retentionCategory: string;
}

// Retention: Audit logs retained for 7 years (SOC 2 requirement)
// Immutability: Append-only store, tamper-evident (hash chain)
// Access: Only Platform Admin + Compliance Officer roles
```

### 7.12 Scalability Architecture

**Concurrent Session Handling**:
```
Target: 500+ concurrent sessions across all tenants

Architecture:
  ├── WebSocket connections via load-balanced gateway
  ├── Each session = dedicated worker process
  ├── Worker auto-scaling: 1 worker per 5 concurrent sessions
  ├── AI processing queue with prioritization (premium tenants first)
  ├── Backpressure: If AI queue depth > threshold, reduce processing frequency
  ├── Graceful degradation: If AI unavailable, continue transcription + manual coaching
  └── Connection pooling: PgBouncer for database connections (max 200 per instance)

Capacity Planning:
  ├── 1 session = ~6 AI calls/minute (Tier 1) + 1 AI call/minute (Tier 2)
  ├── 500 sessions = 3,000 Tier 1 calls/min + 500 Tier 2 calls/min
  ├── AI throughput: Distributed across 3+ providers for capacity
  ├── Database: Read replicas for analytics, write primary for sessions
  ├── Event bus: Redis Streams with consumer groups, partitioned by tenant
  └── Storage: ~2MB/session (transcript + graph + metadata) → 1TB/500K sessions
```

**Data Growth Management**:
```
Growth Model:
  Year 1: 10,000 sessions, 20GB active data, 100 accounts/tenant average
  Year 2: 100,000 sessions, 200GB active data, 500 accounts/tenant average
  Year 3: 1,000,000 sessions, 2TB active data, 2000 accounts/tenant average

Strategies:
  ├── Hot/warm/cold storage tiers
  │   ├── Hot: Active sessions, recent accounts (SSD, low latency)
  │   ├── Warm: Historical sessions < 12 months (standard storage)
  │   └── Cold: Archived data > 12 months (S3 Glacier, compressed)
  │
  ├── Graph compaction
  │   ├── After 6 months: Merge low-confidence nodes
  │   ├── After 12 months: Compress evidence chains
  │   └── Keep: All validated facts, active hypotheses, financial data
  │
  ├── Query optimization
  │   ├── Materialized views for dashboard queries
  │   ├── Pre-computed aggregates updated on schedule
  │   ├── Graph query caching (common patterns)
  │   └── Full-text search index (Elasticsearch) for transcript search
  │
  └── Sharding strategy (Year 3+)
      ├── Shard by tenant_id for even distribution
      ├── Large tenants get dedicated shards
      ├── Cross-shard queries for global analytics (batch only)
      └── Shard rebalancing automated
```

---

## SECTION 8: COMPETITIVE MOAT

### 8.1 Moat Philosophy

A moat is not a feature — it is a structural advantage that becomes HARDER for competitors to replicate over time. The PDIP moat is built on four interlocking layers, each reinforcing the others. The key insight: **every customer interaction makes the moat deeper**.

### 8.2 Intellectual Property to Intentionally Build

**IP Asset 1: Transportation Operations Ontology**
- What: A formal, machine-readable model of how transportation operations work across all industry verticals
- Why it's defensible: Requires decades of domain expertise to build correctly. Generic AI companies lack the operational knowledge to create valid causal relationships, financial models, and dependency chains
- Investment required: 6-12 months of expert knowledge engineering + continuous refinement
- Protection: Trade secret (not patentable, but impossible to reverse-engineer from outside)
- Compounding: Every new vertical pack adds to the ontology; every customer engagement validates/refines it

**IP Asset 2: Hypothesis Pattern Library**
- What: A database of validated cause-and-effect patterns specific to transportation operations
- Example: "manual_planning + fleet > 100 → route_inefficiency > 20% (validated in 94% of cases)"
- Why it's defensible: Only buildable from actual customer implementation data over years
- Compounding: Every hypothesis validated/invalidated strengthens the library

**IP Asset 3: PDIF Methodology Engine**
- What: The five-phase discovery methodology with phase transition logic, confidence scoring algorithms, and coaching intelligence
- Why it's defensible: Proprietary methodology tested against real sales outcomes
- Protection: Copyright + trade secret + deep product integration
- Compounding: Win/loss analysis refines which discovery patterns predict success

**IP Asset 4: Question Intelligence Models**
- What: Fine-tuned AI models that generate consultant-quality questions specific to transportation discovery
- Why it's defensible: Training data from thousands of successful discovery sessions
- Protection: Fine-tuned model weights are proprietary
- Compounding: RLHF from rep acceptance/rejection continuously improves question quality

**IP Asset 5: Financial Impact Models**
- What: Validated models that translate operational inefficiencies into financial impact with credible accuracy
- Why it's defensible: Calibrated against actual implementation results (predicted vs. actual ROI)
- Compounding: Every implementation result makes future predictions more accurate

### 8.3 Assets That Become Proprietary Over Time

```
┌──────────────────────────────────────────────────────────────────────┐
│                    COMPOUNDING ASSET MODEL                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  YEAR 1: KNOWLEDGE ASSETS                                            │
│  ├── Transportation ontology (expert-built, not learnable from data) │
│  ├── Industry vertical packs (deep domain models per segment)        │
│  ├── PTV product mapping intelligence (solution ↔ problem linkage)  │
│  └── Competitive battle cards with real-world positioning data       │
│                                                                       │
│  YEAR 2: DATA ASSETS                                                 │
│  ├── 10,000+ discovery sessions analyzed and pattern-extracted       │
│  ├── Validated benchmarks from actual customer implementations       │
│  ├── Win/loss patterns correlated with discovery quality             │
│  ├── Question effectiveness data (which questions lead to wins)      │
│  └── Rep performance patterns (what top performers do differently)   │
│                                                                       │
│  YEAR 3: INTELLIGENCE ASSETS                                         │
│  ├── Cross-customer pattern library (n=1000+ for statistical sig.)  │
│  ├── Financial prediction models calibrated to ±10% accuracy        │
│  ├── Automatic hypothesis generation with 90%+ relevance rate       │
│  ├── Persona interaction models (how to engage different buyers)    │
│  └── Implementation feedback loop (promised → delivered accuracy)    │
│                                                                       │
│  YEAR 5: PLATFORM ASSETS                                             │
│  ├── Industry standard transportation discovery methodology         │
│  ├── Partner ecosystem built on PDIP APIs                           │
│  ├── Customer switching costs (years of account intelligence)        │
│  ├── Training data moat (impossible to replicate without years)      │
│  └── Network effects (more customers → better for all customers)    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.4 Data That Compounds in Value

**The Data Flywheel**:
```
  More customers use PDIP
       │
       ▼
  More discovery sessions conducted
       │
       ▼
  More patterns extracted (what correlates with what)
       │
       ▼
  Better hypotheses generated for new accounts
       │
       ▼
  Higher discovery quality → higher win rates
       │
       ▼
  More customers adopt PDIP (proven results)
       │
       └──────────── CYCLE REPEATS ────────────────┘
```

**Specific Data Compound Effects**:

| Data Type | Value at 100 Sessions | Value at 10,000 Sessions | Value at 100,000 Sessions |
|---|---|---|---|
| Benchmark accuracy | ±40% (directional) | ±15% (useful) | ±5% (authoritative) |
| Pattern confidence | Anecdotal | Statistically significant | Industry-defining |
| Question effectiveness | Expert judgment | Data-informed | Algorithmically optimal |
| Financial predictions | Estimate ranges | Calibrated models | Near-certain projections |
| Cross-account insights | None | Early patterns | Predictive intelligence |
| Win/loss correlation | Unknown | Emerging signals | Causal understanding |

### 8.5 Intelligence That Cannot Be Copied

**Why Generic AI Cannot Replicate This**:

1. **Gong cannot build the transportation ontology** because they have no domain experts, no customer implementation data, and no way to validate that "manual planning → 20% route inefficiency" is a reliable pattern. They would need 30 years of PTV's operational consulting history.

2. **Microsoft Copilot cannot build cross-session intelligence** because their architecture is per-meeting. They have no account-level knowledge graph, no temporal tracking, no hypothesis validation across months of engagement.

3. **Salesforce Einstein cannot build the reasoning engine** because their data is CRM signals (activity logs, email opens, stage changes) — not deep operational intelligence. They know deal velocity but nothing about fleet utilization or routing efficiency.

4. **ChatGPT/Claude cannot replicate the validated benchmarks** because they have generic training data, not actual before/after measurements from PTV implementations. When PDIP says "18% cost reduction," it is sourced from real data, not LLM-generated estimates.

5. **Consulting firms cannot scale their expertise** because a McKinsey engagement costs $500K+ and serves one client. PDIP delivers comparable insight to unlimited clients simultaneously at $349/month.

### 8.6 Features That Become Exponentially Better with Usage

**Feature 1: Question Suggestion Quality**
- Day 1: Expert-designed questions from ontology (good but generic)
- Month 6: Questions ranked by historical effectiveness (what questions lead to best answers)
- Year 1: Questions personalized by industry, persona, deal stage, and specific account context
- Year 3: Questions that predict what the customer will say and pre-position the optimal follow-up

**Feature 2: Hypothesis Accuracy**
- Day 1: Pattern-based hypotheses with 45-60% accuracy
- Month 6: Evidence-calibrated hypotheses with 65-75% accuracy
- Year 1: Cross-account validated hypotheses with 80-85% accuracy
- Year 3: Predictive hypotheses that identify opportunities before the customer does

**Feature 3: Financial Predictions**
- Day 1: Industry benchmark ranges (±40%)
- Month 6: Segment-specific predictions (±25%)
- Year 1: Implementation-validated predictions (±15%)
- Year 3: Customer-data-calibrated predictions (±5-10%)

**Feature 4: Competitive Intelligence**
- Day 1: Static battle cards from product marketing
- Month 6: Win/loss data reveals which positioning works
- Year 1: Real-time competitive alerts based on conversation signals
- Year 3: Predictive win probability based on competitive situation + discovery quality

**Feature 5: Coaching Quality**
- Day 1: Best-practice based coaching (what good looks like)
- Month 6: Performance-correlated coaching (what top reps actually do)
- Year 1: Personalized coaching (what THIS rep needs to improve)
- Year 3: Predictive coaching (intervene before the mistake happens)

### 8.7 Network Effects and Data Flywheels

**Direct Network Effect**: Not applicable (users don't interact with each other directly)

**Indirect Network Effect**: Every customer's anonymized patterns improve the platform for all customers:
- More 3PL customers → better 3PL benchmarks → more value for next 3PL customer
- More win/loss data → better discovery coaching → higher win rates → more adoption
- More implementation results → more accurate ROI predictions → easier deal justification

**Data Flywheel 1: Discovery → Implementation → Validation**
```
Discovery predicts: "$2M savings from route optimization"
Implementation delivers: "$2.3M actual savings"
Platform learns: Predictions for similar profiles should be 15% higher
Next customer benefits: More accurate prediction → faster decision
```

**Data Flywheel 2: Question → Response → Effectiveness**
```
Platform suggests: "What's your empty mile percentage?"
Rep asks it: Customer provides specific answer
Platform measures: This question led to validated hypothesis 87% of the time
Learning: Prioritize this question higher for similar contexts
Next session benefits: Better questions surface first
```

**Data Flywheel 3: Hypothesis → Validation → Pattern**
```
Platform hypothesizes: "Manual planning for 200+ trucks → 20%+ route waste"
Session validates: Customer confirms 23% route waste
Pattern strengthens: 48th confirmation of this pattern (confidence now 0.94)
Next customer benefits: Higher initial confidence, more specific financial projection
```

### 8.8 Switching Costs (Customer Lock-in)

Once a customer uses PDIP for 6+ months, switching becomes practically impossible:

1. **Account Intelligence History**: Years of accumulated knowledge about hundreds of accounts, with temporal tracking, validated hypotheses, and relationship maps. This data has no standard export format that another tool could ingest meaningfully.

2. **CRM Integration State**: Hundreds of custom fields populated, workflows configured, opportunity data enriched. Ripping this out means rebuilding all CRM automation.

3. **Training Investment**: Reps have learned the PDIF methodology, built muscle memory for the interface, and calibrated their usage patterns. Re-training on a different system costs months of productivity.

4. **Institutional Knowledge**: The platform holds organizational knowledge that transcends any individual rep. When reps leave, their account intelligence stays. No alternative preserves this institutional memory.

5. **Workflow Dependency**: Pre-session prep, in-session coaching, post-session actions, manager reviews, and pipeline analytics all flow through PDIP. Replacing it means redesigning the entire sales workflow.

---

## SECTION 9: PRODUCT ROADMAP (Capability-Based)

### 9.1 Roadmap Philosophy

This roadmap is organized by capabilities, not features. Each version delivers a complete, usable increase in platform intelligence. The principle: **every version ships a product that works end-to-end at its capability level** — no half-built features, no "coming soon" placeholders.

### 9.2 Version 1 — MVP (90 Days)

**Theme**: "An AI that makes you sound like you know transportation"

**Objective**: Deliver enough value in a single session that reps immediately want to use it again. Focus on the "aha moment" — the first time the AI suggests a question the rep wouldn't have thought of.

**Capabilities Delivered**:

```
V1 CAPABILITY MAP:

CORE DISCOVERY ENGINE
├── PDIF Phase Framework
│   ├── 5 phases with manual transition (rep controls when to advance)
│   ├── Phase-appropriate question generation
│   ├── Visual phase indicator with progress estimation
│   └── Basic phase completion criteria (simplified)
│
├── Real-Time Transcription
│   ├── Browser-based speech recognition (Web Speech API)
│   ├── Enhanced STT option via Deepgram/AssemblyAI (configurable)
│   ├── Speaker diarization (basic: rep vs. customer)
│   ├── Continuous transcription without conversation interruption
│   └── Manual transcript correction capability
│
├── Question Suggestion Engine
│   ├── 2-3 contextual questions always visible
│   ├── Phase-aware question selection
│   ├── Transportation domain expertise in question framing
│   ├── "Why this matters" context for each suggestion
│   ├── Refresh every 8-10 seconds of new speech
│   └── Question bank: 500+ domain-specific questions categorized
│
├── Discovery Graph (Simplified)
│   ├── Per-account knowledge storage (PostgreSQL-backed)
│   ├── Entity extraction from transcripts (facts, contacts, systems, pain points)
│   ├── Basic relationship mapping (person → role, system → process)
│   ├── Confidence tracking per fact (evidence-based)
│   ├── Cross-session knowledge persistence
│   └── Knowledge gap identification
│
├── Confidence Scoring (8 Core Categories)
│   ├── Company Understanding
│   ├── Transportation Operations
│   ├── Technology Landscape
│   ├── Financial Impact
│   ├── Pain Points
│   ├── Stakeholders
│   ├── Buying Process
│   └── Overall Discovery Completeness
│
└── Session Management
    ├── Pre-session briefing (previous session summary + suggested approach)
    ├── In-session coaching (questions + confidence + phase indicator)
    ├── Post-session summary (key discoveries + gaps + next steps)
    ├── Session history and playback
    └── Basic CRM export (Salesforce — field updates + activity creation)

SUPPORTING CAPABILITIES
├── Authentication
│   ├── JWT + SSO/SAML support (enterprise-ready from day 1)
│   ├── Role-based access (Rep, Manager, Admin)
│   └── MFA support
│
├── Account Management
│   ├── Account creation with business card OCR (retained)
│   ├── Industry segment detection (retained)
│   ├── Contact management with basic persona mapping
│   └── Multiple sessions per account
│
├── AI Infrastructure
│   ├── Multi-model support (OpenAI + Anthropic)
│   ├── Cost ceiling per session ($5 max for V1)
│   ├── Graceful degradation when AI unavailable
│   ├── Response caching for repeated patterns
│   └── Basic prompt management (versioned, not A/B tested yet)
│
└── Data & Storage
    ├── PostgreSQL with pgvector (Neon or self-hosted)
    ├── Redis for session state and caching
    ├── Encrypted at rest (AES-256)
    ├── Tenant isolation (RLS)
    └── Basic audit logging
```

**V1 Excluded (Explicitly Deferred)**:
- Hypothesis Engine (complex, requires data to be effective)
- Cross-account patterns (insufficient data)
- Business case builder (too early — need more validation)
- Meeting platform integrations (Teams/Zoom bots — high complexity)
- Manager coaching dashboard (need usage data first)
- Offline mode (PWA caching as stretch goal only)
- Mobile app (web-responsive is sufficient for V1)

**V1 Success Metrics**:
- Rep uses tool in 3+ consecutive sessions
- Rep reports questions were relevant/helpful (>60% positive)
- Discovery confidence score improves 20%+ vs. baseline (no tool)
- Post-session output saves >15 minutes of admin work
- 5+ pilot accounts onboarded and actively using

### 9.3 Version 2 — Intelligence (6 Months)

**Theme**: "An AI that thinks like a consultant"

**Objective**: Transform from a smart question generator into a genuine reasoning partner. The platform now forms hypotheses, validates them, and builds financial cases from evidence.

**New Capabilities**:

```
V2 CAPABILITY MAP (additions to V1):

INTELLIGENCE LAYER
├── Hypothesis Engine
│   ├── Automatic hypothesis generation from observed facts
│   ├── Pattern-based inference using transportation ontology
│   ├── Hypothesis lifecycle tracking (generated → active → validated/invalidated)
│   ├── Confidence adjustment as evidence arrives
│   ├── Financial impact estimation per hypothesis
│   ├── Validation question generation (targeted questions to test hypotheses)
│   └── Hypothesis dashboard in post-session review
│
├── Transportation Knowledge Engine (Full)
│   ├── Vector store with 10,000+ domain knowledge chunks
│   ├── RAG-powered contextual retrieval
│   ├── Industry benchmark database (Level 2-3 benchmarks)
│   ├── PTV product capability mapping
│   ├── Competitive technology landscape data
│   └── Regulatory compliance knowledge base
│
├── Business Case Builder (Phase 1)
│   ├── Automatic pain point → financial impact calculation
│   ├── Industry benchmark comparison ("you're at X, best is Y")
│   ├── Conservative/likely/optimistic ranges
│   ├── Evidence chain for every number (traceable to source)
│   ├── Executive summary auto-generation
│   └── ROI calculator integration
│
├── Transportation Maturity Assessment
│   ├── 5-level maturity model evaluation
│   ├── Per-capability maturity scoring
│   ├── Gap analysis (current vs. achievable)
│   ├── Maturity-appropriate recommendation engine
│   └── Visual maturity dashboard
│
└── Full Confidence Engine (17 categories)
    ├── All 17 confidence categories active
    ├── Evidence quality assessment (source authority, specificity, recency)
    ├── Phase-appropriate weighting
    ├── Decay function for aging information
    └── Phase transition recommendations based on confidence thresholds

INTEGRATION LAYER
├── Teams Integration (Basic)
│   ├── Bot joins meeting for transcription
│   ├── Post-meeting summary posted to Teams channel
│   └── Side panel app for coaching during Teams calls
│
├── Zoom Integration (Basic)
│   ├── Meeting recording import
│   ├── Post-meeting analysis from Zoom transcription
│   └── (Live coaching via Zoom Apps marketplace — stretch)
│
├── Salesforce Integration (Advanced)
│   ├── Bidirectional sync (pull account data, push insights)
│   ├── Custom objects for PDIF data (hypotheses, confidence, business case)
│   ├── Opportunity stage alignment with PDIF phases
│   ├── Activity auto-creation from sessions
│   └── Dashboard components for Salesforce
│
└── Data Enrichment
    ├── LinkedIn profile import for stakeholder research
    ├── Company news monitoring (automated pre-session enrichment)
    ├── Financial data import (public companies)
    └── Industry report integration

COACHING LAYER
├── Post-Session Debrief (Enhanced)
│   ├── Session quality scorecard with specific feedback
│   ├── "What you did well" + "What to explore next"
│   ├── Updated business case with session-specific changes
│   ├── Action item generation with suggested owners/dates
│   ├── Follow-up email draft (customizable)
│   └── Next session strategy document
│
├── Manager Coaching Dashboard
│   ├── Team discovery quality overview
│   ├── Individual rep performance trends
│   ├── Deal risk identification from discovery quality
│   ├── Session review capability (manager can review any session)
│   ├── Coaching note attachment to sessions
│   └── Best practice identification (anonymized top-performer patterns)
│
└── Background Methodology Scoring
    ├── MEDDICC auto-calculation from graph
    ├── SPICED alignment scoring
    ├── Challenger positioning assessment
    ├── Manager-visible methodology dashboards
    └── CRM export of methodology scores
```

**V2 Industry Vertical Packs (First 3)**:
- 3PL/Carrier Pack (highest PTV customer concentration)
- Building Supply Pack (existing question bank depth)
- Manufacturing/Distribution Pack (broad applicability)

**V2 Success Metrics**:
- Hypothesis accuracy rate >65% (validated hypotheses were correct)
- Business case generated in <60 seconds after session ends
- Manager adoption: 80%+ of managers review sessions weekly
- Rep satisfaction: NPS >50 for the tool experience
- Measurable win rate improvement in pilot group (target: +10%)
- AI cost per session < $3 average

### 9.4 Version 3 — Enterprise Platform (12 Months)

**Theme**: "The platform that makes your competition irrelevant"

**Objective**: Full enterprise readiness with advanced intelligence features that create decisive competitive advantage.

**New Capabilities**:

```
V3 CAPABILITY MAP (additions to V1+V2):

ADVANCED INTELLIGENCE
├── Cross-Account Pattern Recognition
│   ├── Pattern extraction from accumulated sessions (n>100 per segment)
│   ├── Predictive hypothesis generation ("companies like yours typically...")
│   ├── Statistical confidence on cross-account insights
│   ├── Privacy-preserved anonymized learning
│   ├── Pattern validation feedback loop
│   └── Account similarity scoring (find similar accounts for reference)
│
├── Customer Data Ingestion & Analysis
│   ├── Route file upload and instant analysis (CSV, Excel, EDI)
│   ├── Delivery log analysis (stops, times, distances, exceptions)
│   ├── Fleet inventory analysis (utilization, capacity, age)
│   ├── Real-time analysis during meeting ("look at your own data")
│   ├── Automatic benchmark comparison against customer's actual data
│   ├── Visual reports: heatmaps, utilization charts, cost breakdowns
│   └── One-click presentation generation from analysis
│
├── Competitive Intelligence Engine (Full)
│   ├── Real-time competitor mention detection in conversations
│   ├── Dynamic battle card surfacing based on competitive context
│   ├── Trap-setting question recommendations
│   ├── Win/loss pattern analysis by competitor
│   ├── Competitive positioning recommendations per deal
│   └── Market intelligence feeds integration
│
├── Pipeline Intelligence
│   ├── Discovery quality → deal velocity correlation
│   ├── Risk scoring based on confidence gaps
│   ├── Win probability prediction (AI-powered)
│   ├── Forecast intelligence based on discovery completeness
│   ├── Deal slippage early warning system
│   └── Territory performance analytics
│
└── Advanced NLP & Speech Analytics
    ├── Full speaker diarization (multiple participants identified)
    ├── Sentiment analysis per speaker over time
    ├── Talk-to-listen ratio tracking
    ├── Key moment detection (commitments, objections, buying signals)
    ├── Topic segmentation of conversations
    ├── Engagement scoring per participant
    └── Objection pattern recognition

ENTERPRISE CAPABILITIES
├── Compliance & Security
│   ├── SOC 2 Type II certified
│   ├── GDPR fully compliant with automated data subject requests
│   ├── ISO 27001 preparation underway
│   ├── Customer-managed encryption keys (BYOK)
│   ├── Data residency enforcement (EU data stays in EU)
│   ├── Advanced audit logging with tamper-evident storage
│   └── Penetration test report available to customers
│
├── Administration
│   ├── SCIM provisioning (user lifecycle automation)
│   ├── Granular RBAC with custom roles
│   ├── Territory management and automatic account assignment
│   ├── Usage analytics and adoption monitoring
│   ├── Configuration management (tenant-level customization)
│   └── Bulk operations (user import, account import, data migration)
│
├── Multi-Region Deployment
│   ├── EU region (Frankfurt) — primary
│   ├── NA region (Virginia) — secondary
│   ├── Automatic data routing based on tenant region
│   ├── Cross-region replication for knowledge engine (read-only)
│   └── Region-specific AI model deployment
│
├── Advanced Integrations
│   ├── Microsoft Dynamics 365 (full bidirectional)
│   ├── HubSpot (full bidirectional)
│   ├── WebEx integration (meeting panel + transcription import)
│   ├── Customer data platform (CDP) connectors
│   ├── Webhook-based custom integrations
│   └── API marketplace (self-service integration building)
│
└── Offline Mode (Progressive Web App)
    ├── Full pre-session briefing available offline
    ├── Transcription with local STT model (Whisper)
    ├── Pre-generated question suggestions cached locally
    ├── Offline session data stored locally, syncs when connected
    ├── Conflict resolution on sync
    └── Bandwidth-adaptive mode for poor connectivity

COLLABORATION & MULTI-USER
├── Multi-User Sessions
│   ├── AE + SE in same session with different views
│   ├── SE sees technical details, AE sees business focus
│   ├── Collaborative note-taking within session
│   ├── Post-session shared review workspace
│   └── Handoff annotations between roles
│
├── Deal Rooms
│   ├── Shared workspace per opportunity
│   ├── All session summaries, business cases, action items
│   ├── Internal commentary and strategy notes
│   ├── Customer-facing portal (selected deliverables shared externally)
│   └── Deal timeline visualization
│
└── Customer-Facing Deliverables
    ├── Professional business case documents (PDF/PowerPoint)
    ├── Executive summary with customer branding
    ├── ROI analysis presentations
    ├── Discovery findings report
    └── Shared portal for customer to review and comment
```

**V3 Success Metrics**:
- SOC 2 Type II audit passed
- 500+ concurrent users supported without degradation
- Cross-account patterns generating 25%+ of hypothesis suggestions
- Customer data ingestion feature drives 40% higher business case accuracy
- Pipeline intelligence predicts deal outcomes with 70%+ accuracy
- Enterprise customers retain at 95%+ annual rate
- Platform handles 3+ regions with data residency compliance

### 9.5 Year 2 — Dominance

**Theme**: "The world's largest transportation operations intelligence database"

**Objective**: Achieve market position where the platform's accumulated intelligence is the primary competitive advantage — impossible to replicate regardless of competitor engineering investment.

**New Capabilities**:

```
YEAR 2 CAPABILITY MAP:

PREDICTIVE INTELLIGENCE
├── Deal Outcome Prediction
│   ├── Win probability based on discovery quality + competitive context + stakeholder engagement
│   ├── Close date prediction based on buying process progress
│   ├── Deal value prediction based on identified opportunity + historical patterns
│   ├── Risk factor identification with mitigation recommendations
│   └── Forecast confidence intervals for pipeline reporting
│
├── Prescriptive Intelligence
│   ├── "Do this next" recommendations based on what worked for similar deals
│   ├── Optimal meeting cadence and stakeholder engagement sequence
│   ├── Competitive response playbooks triggered by situation
│   ├── Deal acceleration tactics based on stage and risk profile
│   └── Cross-sell/upsell opportunity detection from existing customer intelligence
│
├── Implementation Intelligence
│   ├── Implementation feedback loop (predicted → actual ROI tracking)
│   ├── Benchmark recalibration from implementation results
│   ├── Success factor identification (what implementation patterns succeed)
│   ├── Risk prediction for implementations based on discovery data
│   └── Handoff quality scoring (discovery → implementation completeness)
│
└── Market Intelligence
    ├── Industry trend detection from aggregated discovery patterns
    ├── Technology adoption tracking across customer base
    ├── Competitive market share estimation from competitive mentions
    ├── Emerging pain point detection (new problems appearing across customers)
    └── Product demand signaling (what capabilities customers are asking for)

PLATFORM EXPANSION
├── Customer Success Integration
│   ├── Pre-sale → post-sale knowledge continuity
│   ├── Implementation tracking against business case promises
│   ├── QBR content generation from implementation data
│   ├── Expansion opportunity identification
│   ├── Churn risk detection from engagement patterns
│   └── ROI realization reporting (did the customer get what was promised?)
│
├── Mobile Companion App (iOS/Android)
│   ├── 30-second meeting prep (key facts, top questions, attendee brief)
│   ├── Push notifications for follow-ups and account updates
│   ├── Voice note capture that feeds into account graph
│   ├── Quick account lookup and confidence view
│   ├── Action item management
│   └── Apple Watch / Android Wear companion (haptic meeting alerts)
│
├── Multi-Language Support
│   ├── German (PTV home market)
│   ├── French (EU expansion)
│   ├── Spanish (Americas + EU)
│   ├── AI reasoning in native language
│   ├── Transcription in native language
│   └── Generated deliverables in native language
│
├── Partner Ecosystem
│   ├── Partner portal for system integrators
│   ├── API access for partner-built integrations
│   ├── White-label capability for resellers
│   ├── Partner certification program
│   ├── Revenue sharing model for referred accounts
│   └── Co-branded deliverables capability
│
└── Advanced Coaching
    ├── AI-simulated practice sessions (rep practices with AI customer persona)
    ├── Personalized skill development plans per rep
    ├── Peer comparison (anonymized) showing improvement opportunities
    ├── Best practice library built from top-performer patterns
    ├── New hire onboarding program with progressive skill building
    └── Certification tracking (internal PDIF proficiency levels)
```

**Year 2 Success Metrics**:
- 100,000+ sessions in the intelligence database
- Benchmark accuracy within ±10% of actual implementation results
- Platform used by 500+ reps across 50+ enterprise customers
- Win rate for platform users 25%+ higher than non-users
- Average deal size 40%+ higher for platform-influenced deals
- Customer retention 95%+ with NPS >70
- Implementation success rate 85%+ for platform-influenced deals

### 9.6 Year 5 — Category Ownership

**Theme**: "Transportation operations intelligence is synonymous with PTV"

**Objective**: Become the undisputed platform for transportation discovery intelligence, with ecosystem effects that make the market position permanent.

**New Capabilities**:

```
YEAR 5 CAPABILITY MAP:

AUTONOMOUS INTELLIGENCE
├── Pre-Meeting Discovery Bot
│   ├── AI agent that conducts preliminary research autonomously
│   ├── Ingests public data (10-K filings, news, LinkedIn, industry reports)
│   ├── Generates preliminary hypotheses before human meeting
│   ├── Prepares meeting strategy recommendation
│   └── Creates account intelligence baseline without any human session
│
├── Real-Time Decision Support
│   ├── In-conversation recommendation engine (next action in <1 second)
│   ├── Dynamic pricing guidance based on discovered value
│   ├── Negotiation intelligence (when to hold, when to concede)
│   ├── Competitive counter-strategy in real-time
│   └── Buying signal detection with probability scoring
│
├── Self-Improving AI
│   ├── Models continuously improve from outcome data (RLHF from wins/losses)
│   ├── Automatic prompt optimization based on quality metrics
│   ├── New pattern discovery without human intervention
│   ├── Anomaly detection (unusual situations) triggers human expert review
│   └── Question effectiveness learning (which questions drive value)
│
└── Transportation Digital Twin
    ├── Build operational model of customer's transportation from discovery data
    ├── Simulate optimization scenarios in real-time
    ├── "What if" analysis during meetings ("If we optimized your routes, here's what changes...")
    ├── Visual network modeling from described operations
    └── Pre-sale proof-of-concept from discovery data alone

ECOSYSTEM & MARKET POSITION
├── Industry Standard
│   ├── PDIF methodology adopted by transportation industry as standard
│   ├── Academic research partnerships validating methodology
│   ├── Conference presentations on discovery intelligence
│   ├── Published benchmarks referenced by industry analysts
│   └── Certification programs for transportation consultants
│
├── Full Platform Ecosystem
│   ├── 50+ integration partners
│   ├── Vertical-specific modules built by partners
│   ├── Custom AI models per large customer
│   ├── API revenue from third-party developers
│   └── Marketplace for community-built extensions
│
├── Expansion to Adjacent Markets
│   ├── Supply Chain Intelligence (beyond transportation)
│   ├── Logistics Consulting Intelligence
│   ├── Manufacturing Operations Intelligence
│   ├── Field Service Intelligence
│   └── (Each new vertical benefits from shared infrastructure)
│
└── Autonomous Discovery
    ├── AI conducts basic discovery calls independently
    ├── Human rep handles relationship and complex situations
    ├── Platform prepares full business case before human engagement
    ├── Reduced need for junior discovery work
    └── Rep focuses on strategic conversations only
```

**Year 5 Success Metrics**:
- 1,000,000+ sessions in intelligence database
- The definitive transportation operations benchmark database (cited by analysts)
- 2,000+ active enterprise customers
- Platform-influenced revenue exceeds $1B for PTV
- Financial predictions accurate within ±5% of implementation results
- Industry analyst recognition as category leader
- Ecosystem generates 20%+ of revenue through partner channels
- Methodology adopted as industry standard for transportation sales

---

## SECTION 10: SELF-CRITIQUE AND REDESIGN

### 10.1 Identified Weaknesses

#### Weakness 1: Cold Start Problem
**Issue**: The platform's most powerful features (cross-account patterns, validated benchmarks, hypothesis accuracy) require significant data accumulation. A new deployment has none of this.

**Severity**: HIGH — Early adopters get the least-intelligent version of the product.

**Root Cause**: Data flywheel effects take time to compound.

**Redesign**:
- Pre-seed the system with PTV's existing consulting knowledge (decades of implementation data, known patterns, expert-validated benchmarks)
- Create "Day 1 Intelligence Packs" that provide immediate value based on industry + company size + known technology
- Establish a "founding customer program" where early adopters get premium support in exchange for implementation data that seeds the flywheel
- Use PTV's internal sales team as the first users — their accumulated knowledge becomes the baseline
- Partner with industry associations (ATA, ATRI) for validated benchmark data from day 1

#### Weakness 2: Transcription Accuracy Dependency
**Issue**: If transcription is inaccurate, every downstream system produces garbage. Web Speech API in noisy environments (warehouses, trade shows, speakerphones) is unreliable.

**Severity**: CRITICAL — Foundation layer failure cascades everywhere.

**Root Cause**: Chose browser-native STT for convenience over robustness.

**Redesign**:
- Primary: Deepgram Nova-2 or AssemblyAI Universal-2 for production transcription (purpose-built for conversation, handles noise, accents, industry terminology)
- Secondary: Azure Speech Services as fallback (enterprise-grade, HIPAA-capable)
- Tertiary: Web Speech API as offline/degraded fallback only
- Custom vocabulary: Add transportation industry terminology (deadhead, drayage, cross-dock, LTL, etc.) to improve domain-specific accuracy
- Confidence scoring per transcript segment — flag low-confidence segments for human correction
- Speaker diarization from the start (who said what is critical for evidence attribution)
- Audio recording option for post-session re-processing if real-time transcription was poor

#### Weakness 3: AI Cost Scaling
**Issue**: At 500 concurrent sessions with 11 AI engines processing every 8-10 seconds, inference costs could reach $50K+/month at GPT-4 pricing.

**Severity**: HIGH — Unit economics could be unsustainable at scale.

**Root Cause**: Architecture calls expensive models too frequently for tasks that don't require frontier reasoning.

**Redesign**:
```
REVISED COST ARCHITECTURE:

Layer 1 — Deterministic (Zero AI Cost)
  ├── Pattern matching against known ontology rules
  ├── Benchmark lookups from structured database
  ├── Confidence score calculation (formula-based)
  ├── Phase transition logic (rule-based)
  └── CRM field mapping (deterministic)
  
  Estimated: 40% of all "AI" operations can be deterministic

Layer 2 — Fine-Tuned Lightweight Models ($0.001/call)
  ├── Entity extraction (fine-tuned GPT-4o-mini or Llama 3)
  ├── Classification (industry, persona, sentiment)
  ├── Fact extraction from transcript segments
  └── Evidence quality scoring
  
  Estimated: 35% of operations

Layer 3 — Frontier Models ($0.01-0.03/call)
  ├── Hypothesis generation (requires reasoning)
  ├── Question formulation (requires natural language quality)
  ├── Business case narrative (requires writing quality)
  └── Complex inference (contradiction resolution, multi-step reasoning)
  
  Estimated: 25% of operations

PROJECTED COST (Revised):
  Per session: $1.50-3.00 (down from $5-15 in naive architecture)
  500 concurrent sessions: $15K-30K/month (manageable)
  Cost reduction path: Fine-tuning reduces Layer 3 calls by 50% within 12 months
```

#### Weakness 4: Adoption Risk — Reps Won't Use It
**Issue**: The most sophisticated AI is worthless if reps don't actually use it during live customer conversations. Split attention is a real cognitive challenge.

**Severity**: CRITICAL — Existential risk to the entire product concept.

**Root Cause**: We assume reps can monitor a screen while conducting a complex business conversation. This assumption may be wrong.

**Redesign**:
- **Audio-first option**: Subtle audio cues (single tone in earpiece) when a high-value question opportunity arises. Rep glances at screen only when prompted.
- **Post-session primary mode**: For reps uncomfortable with live coaching, the platform still captures transcript and provides full post-session analysis. Value is preserved even without live usage.
- **Graduated adoption**: Start with post-session only. Add pre-session prep. Only after comfort, introduce live suggestions. Never force all-at-once.
- **Manager pull**: Managers see discovery quality scores. Reps who use the tool score higher. Natural incentive without mandate.
- **Meeting preparation autopilot**: The MOST used feature may not be live coaching but the 30-second pre-meeting briefing. Design for this as primary use case.
- **Usability testing with eye-tracking**: Before launch, validate with real reps in simulated calls. Measure cognitive load, attention patterns, information absorption.
- **"Consultant in your ear" mode**: AI sends suggestions via brief audio whispers between customer statements (research viability).

#### Weakness 5: Linear Phase Model Assumption
**Issue**: The five PDIF phases assume a linear progression. Real discovery is non-linear — conversations jump between topics, new information forces revisiting earlier phases, and different stakeholders enter at different stages.

**Severity**: MEDIUM — Could create frustration if the system enforces linearity.

**Root Cause**: Consulting methodologies are typically presented linearly for pedagogical clarity, but practiced non-linearly.

**Redesign**:
- Phases are LENSES, not stages. The rep can be in any phase at any time.
- The system tracks progress across all phases simultaneously.
- Phase indicator shows PRIMARY focus but allows any phase's questions/activities.
- "Phase readiness" indicates when enough information exists to comfortably focus on a phase, not that earlier phases are "complete."
- Allow multiple phases active in a single session (start in DISCOVER, shift to DIAGNOSE when opportunity arises, return to DISCOVER).
- The Consultant Brain handles phase-aware prioritization without rigid enforcement.

#### Weakness 6: Knowledge Graph Complexity
**Issue**: Building and maintaining a proper knowledge graph per account is architecturally complex. Graph databases add operational burden. Graph queries are harder to optimize than relational queries.

**Severity**: MEDIUM — Technical risk of over-engineering.

**Root Cause**: Chose graph model for theoretical purity when simpler models might suffice initially.

**Redesign**:
- **Phase 1 (V1)**: Store graph as structured JSON in PostgreSQL. Use JSONB columns with GIN indexes for efficient querying. This handles 95% of use cases with zero additional infrastructure.
- **Phase 2 (V2)**: Add pgvector for semantic search over graph content. Still PostgreSQL — no new infrastructure.
- **Phase 3 (V3)**: Evaluate whether query patterns justify migration to Neo4j/Neptune. Only migrate if JSONB queries become the bottleneck (likely at 1000+ nodes per account).
- **Key insight**: The logical graph model (nodes, edges, properties) is independent of physical storage. Build the abstraction layer clean, swap storage later.

```typescript
// Graph abstraction layer — storage-agnostic
interface GraphStore {
  addNode(node: GraphNode): Promise<string>;
  addEdge(edge: GraphEdge): Promise<string>;
  queryNodes(filter: NodeFilter): Promise<GraphNode[]>;
  queryRelated(nodeId: string, edgeType?: EdgeType): Promise<GraphNode[]>;
  getSubgraph(rootId: string, depth: number): Promise<Subgraph>;
  // Same interface whether backed by PostgreSQL JSONB or Neo4j
}
```

### 10.2 Blind Spots

#### Blind Spot 1: International Sales Context
**Gap**: The architecture assumes English-language, North American transportation operations. PTV is a German company with global customers.

**Implications**:
- Transcription must work in German, French, Spanish, Dutch
- Transportation terminology differs by region (lorry vs. truck, motorway vs. highway)
- Regulations differ dramatically (EU transport directives vs. FMCSA)
- Benchmarks vary by region (European cost structures, distances, regulations)
- Question styles differ culturally (direct vs. indirect, rapport-building differences)

**Mitigation**:
- Design ontology with region-aware terminology from the start
- Use multilingual embedding models (Cohere multilingual or OpenAI ada-002 which handles multilingual)
- Benchmark data segmented by region with appropriate sources
- AI model selection that handles multilingual reasoning (Claude/GPT-4 are natively multilingual)
- Cultural communication preferences built into Persona Intelligence Engine
- V1 in English only (largest market), German in V2 (home market), expansion in Year 2

#### Blind Spot 2: Organizational Politics
**Gap**: The system focuses on operational and financial intelligence but doesn't model organizational politics — which kill more deals than missing ROI.

**Implications**:
- Champion identification is passive (mentioned in passing) not active
- Power dynamics between stakeholders aren't explicitly modeled
- Political risk (internal resistance, budget competition, change fatigue) not assessed
- "No decision" outcome isn't explicitly addressed (most common lost reason)

**Mitigation**:
- Add "Organizational Dynamics" as a first-class concern in the Consultant Brain
- Model stakeholder relationships with influence/alignment scoring
- Track political signals in conversation (hedging language, blame deflection, passive resistance)
- Add "Political Risk" confidence category
- Generate "coalition building" recommendations (who to engage, in what order, with what message)
- Coach reps on multi-threading and power mapping explicitly

#### Blind Spot 3: Customer Perception of Being Analyzed
**Gap**: Enterprise buyers increasingly resist being recorded and analyzed. Privacy consciousness is rising. The platform could create negative perception if not handled carefully.

**Implications**:
- Some buyers will refuse to allow recording (especially first meetings)
- GDPR consent management is complex (opt-in, opt-out, right to deletion)
- "AI is analyzing my words" can feel adversarial rather than helpful
- Competitive disadvantage if prospects learn about the tool and feel manipulated

**Mitigation**:
- **Non-recording mode**: Platform works with manual note-taking input — rep types key points, AI infers and suggests from notes (not transcript)
- **Customer value mode**: Position the tool as delivering VALUE to the customer ("we use AI to ensure we understand your business deeply so we don't waste your time with irrelevant demos")
- **Transparent consent**: Clear, simple consent with explanation of benefits to the customer
- **Customer-facing outputs**: Share generated insights with the customer — they benefit too (business case, operational assessment)
- **Opt-in recording, opt-out by default**: Start without recording, gain trust, then introduce with permission
- **Regional compliance**: Automatic consent mode adjustment by jurisdiction (one-party vs. two-party consent)

### 10.3 Technical Risks

| Risk | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| STT accuracy in noisy environments | High | Critical | Multi-provider strategy, custom vocabulary, correction UX |
| AI hallucination in financial projections | Medium | Critical | Validation layer, source attribution mandatory, human review for claims >$1M |
| Context window overflow for long sessions | High | High | Sliding window with summarization, key-fact prioritization, transcript compression |
| LLM provider outage during live session | Medium | High | Multi-provider fallback, cached suggestions, graceful degradation to offline mode |
| Graph database performance at scale | Low | Medium | Start with PostgreSQL JSONB, migrate only when proven necessary |
| GDPR compliance complexity by region | High | High | Legal review per region, configurable consent flows, data residency from day 1 |
| Fine-tuning data insufficient | Medium | Medium | Start with few-shot prompting, accumulate training data organically, fine-tune at n=1000+ |
| Integration maintenance burden | High | Medium | Standard integration framework, health monitoring, automated testing per integration |

### 10.4 Commercial Risks

| Risk | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| Price sensitivity (enterprise budget cuts) | Medium | High | Demonstrate measurable ROI within 90 days, tie pricing to value delivered |
| Internal adoption resistance at PTV | High | Critical | Executive sponsor, pilot with top performers, publish results transparently |
| Competitive response (Gong adds vertical AI) | Medium | Medium | Speed to market + domain depth they can't replicate quickly |
| Market timing (customers not ready for AI sales tools) | Low | High | Offer non-AI features that deliver standalone value (prep, post-session, CRM) |
| Customer data liability concern | Medium | High | Crystal-clear DPA, no-training guarantees, dedicated instance option, SOC 2 certification |
| Channel conflict (does this replace consultants?) | Medium | Medium | Position as enhancement not replacement, enable partner ecosystem |

### 10.5 AI-Specific Risks

| Risk | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| Prompt injection via customer speech | Medium | Medium | Input sanitization, system prompt hardening, output validation |
| Bias toward PTV products over genuine fit | High | High | Explicit "honesty layer" — flag when competitor might be better fit, long-term trust > short-term sale |
| Benchmark data becomes stale | Medium | Medium | Quarterly refresh cycle, freshness indicators, automated data sourcing |
| AI generates inappropriate financial claims | Medium | High | Every number must have traceable source, confidence indicator, disclaimer language |
| Model drift degrades quality over time | Low | Medium | A/B testing continuous, quality regression monitoring, human evaluation pipeline |
| Customer loses trust after wrong prediction | Medium | High | Always present ranges (not points), show confidence levels, explain methodology |

### 10.6 Adoption Risks

| Risk | Probability | Impact | Mitigation Strategy |
|---|---|---|---|
| Reps find live coaching distracting | High | Critical | Audio-first mode, post-session fallback, graduated adoption, eye-tracking research |
| Managers don't enforce usage | Medium | High | Show pipeline correlation, make invisible without tool (poor discovery = visible risk) |
| Onboarding takes too long | Medium | Medium | Progressive disclosure, start simple, earn complexity, 15-minute onboarding target |
| Reps game the system (fake high confidence) | Low | Medium | Evidence-based scoring prevents gaming, AI detects low-quality input |
| Cultural resistance to AI ("I don't need a machine to tell me how to sell") | High | High | Position as intelligence amplification not replacement, show top performers using it |
| Different regions need different approaches | Medium | Medium | Configurable coaching intensity, regional admins can adjust approach |

### 10.7 Redesigned Weak Areas

**Original Weakness**: Linear phase model
**Redesigned**: PDIF phases are parallel tracks with dynamic prioritization, not sequential gates. The UI shows "primary focus" rather than "current stage." All phases are always available.

**Original Weakness**: Single STT dependency
**Redesigned**: Multi-provider STT with automatic quality detection and failover. Domain-specific vocabulary boost. Non-transcription fallback mode for refused-recording scenarios.

**Original Weakness**: No offline capability
**Redesigned**: Progressive Web App with:
- Local Whisper model for offline transcription (WASM compilation)
- Pre-cached intelligence packs per account
- Optimistic local storage with merge-on-connect
- Bandwidth-adaptive AI processing

**Original Weakness**: Over-reliance on AI for everything
**Redesigned**: Three-tier processing where 40% is deterministic (rules, formulas, lookups), 35% is lightweight ML (classification, extraction), and only 25% requires expensive frontier models. This makes the system faster, cheaper, and more predictable.

**Original Weakness**: No value without recording
**Redesigned**: Manual input modes that still provide full platform value:
- Rep types quick notes → AI expands into structured intelligence
- Post-meeting import from other tools (Zoom recording, Teams transcript)
- Pre-meeting prep from CRM data alone (no session required)
- Account intelligence building from document upload (proposals, emails, call notes)

### 10.8 Final Assessment

**Is this design best-in-class?**

**Strengths of this design**:
1. The domain-specific intelligence layer creates genuine differentiation that generalist tools cannot replicate
2. The event-sourced architecture enables replay, audit, and compound learning
3. The multi-tier AI cost model makes unit economics viable at scale
4. The progressive disclosure UX philosophy respects real-world usage patterns
5. The cross-account pattern recognition creates a data flywheel that strengthens with every customer
6. The plugin architecture enables rapid vertical expansion without core refactoring
7. The offline-first thinking addresses the real-world context of transportation sales
8. The temporal knowledge graph preserves institutional memory that outlasts individual rep tenure

**Remaining concerns**:
1. **Execution risk is massive** — This is a 50-person-year platform described for a small team. Ruthless prioritization is required.
2. **Cold start gap** — Even with pre-seeding, early users get significantly less value. The "early magic" must come from domain expertise embedded in prompts and ontology, not from accumulated data.
3. **Market validation insufficient** — The architecture assumes reps will use live coaching. This assumption has not been validated with real users in real meetings. Must validate before heavy investment.
4. **PTV internal readiness** — The team's current capabilities (based on the existing codebase) suggest significant hiring or reskilling is needed for ML engineering, graph databases, real-time systems, and enterprise security.

**Verdict**: This design represents a **best-in-class architectural vision** for AI-powered transportation consulting intelligence. The category definition is sound, the technical architecture is defensible, and the moat strategy is genuine. The primary risk is not design quality but execution capacity — building this requires a committed, well-resourced team with a multi-year horizon.

The recommended approach: **Build V1 in 90 days with relentless focus on the "first aha moment"** — the instant a rep hears a question suggestion they wouldn't have thought of and sees it open up a $1M+ conversation. If that moment reliably occurs, the rest of the roadmap earns its investment.

---

## APPENDIX A: Key Design Decisions Summary

| Decision | Choice | Rationale | Revisit Trigger |
|---|---|---|---|
| Graph storage | PostgreSQL JSONB (V1-V2), evaluate Neo4j (V3) | Minimize infrastructure complexity early | Query performance degrades at scale |
| Primary STT | Deepgram Nova-2 | Best noise handling + conversation mode + cost | Accuracy below 90% in testing |
| AI orchestration | Redis Streams | Simple, fast, good enough for V1-V2 | Event volume exceeds Redis capacity |
| Embedding model | OpenAI text-embedding-3-large | Quality + compatibility + ecosystem | Cost at scale, or quality degradation |
| Primary LLM | GPT-4o (reasoning) + GPT-4o-mini (classification) | Best balance of quality and cost | Significant quality gap vs. alternatives |
| Frontend | React + TypeScript (existing) | Team familiarity, ecosystem | N/A — proven technology |
| Mobile | PWA first, native later | Reduce development burden, test demand | PWA limitations block key features |
| Auth | SSO/SAML + JWT | Enterprise requirement from day 1 | N/A — non-negotiable |
| Hosting | AWS (primary), Azure (secondary) | Broadest service availability, PTV alignment | N/A |
| Compliance | SOC 2 first, ISO 27001 second | SOC 2 is the most common procurement gate | Market feedback changes priority |

## APPENDIX B: Glossary

| Term | Definition |
|---|---|
| PDIF | PTV Discovery Intelligence Framework — the five-phase methodology |
| PDIP | PTV Discovery Intelligence Platform — the software platform |
| Discovery Graph | Living knowledge graph per account accumulating intelligence |
| Hypothesis Engine | AI system that generates and tracks business hypotheses |
| Consultant Brain | Reasoning engine that decides what to explore next |
| Confidence Engine | Evidence-based scoring of discovery completeness |
| Ontology | Formal model of transportation operations domain knowledge |
| Cross-Account Pattern | Intelligence derived from analyzing multiple customer accounts |
| Data Flywheel | Self-reinforcing cycle where more usage → better intelligence → more usage |
| Phase Lens | Non-linear approach to PDIF phases — parallel focus not sequential gates |
| Glanceable | Information designed to be absorbed in <0.5 seconds during conversation |
| Evidence Chain | Traceable path from any conclusion back to original source data |

## APPENDIX C: Reference Architecture Diagrams

### C.1 Session Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        SESSION LIFECYCLE                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  SCHEDULED         PRE-SESSION        ACTIVE SESSION        POST-SESSION │
│  ─────────        ───────────         ──────────────        ──────────── │
│                                                                           │
│  • Calendar       • Briefing          • Transcription       • Summary    │
│    sync             generated         • Real-time AI        • Scorecard  │
│  • External       • Hypotheses        • Question gen        • Business   │
│    enrichment       queued            • Graph updates         case update│
│  • Attendee       • Strategy          • Hypothesis          • CRM push   │
│    lookup           prepared            validation          • Next plan   │
│                   • Questions         • Confidence          • Manager    │
│                     pre-cached          tracking              alert      │
│                                       • Bookmarks                        │
│                                       • Phase tracking                   │
│                                                                           │
│  Timeline: -24hr     -30min          0 — 60min              +0 — +5min  │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### C.2 Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW — SINGLE SESSION                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  [Microphone]                                                             │
│       │                                                                   │
│       ▼                                                                   │
│  [STT Provider] ──────────── text segments ──────────▶ [Transcript Store]│
│       │                                                                   │
│       ▼                                                                   │
│  [Entity Extractor] ──── entities, facts ───────────▶ [Discovery Graph] │
│       │                                                                   │
│       ├──▶ [Hypothesis Engine] ── hypotheses ───────▶ [Hypothesis Store]│
│       │         │                                                         │
│       │         ▼                                                         │
│       │    [Confidence Engine] ── scores ───────────▶ [Confidence Store]│
│       │         │                                                         │
│       │         ▼                                                         │
│       └──▶ [Consultant Brain] ── priorities ────────▶ [Coaching Engine] │
│                                                             │             │
│                                                             ▼             │
│                                                    [Question Suggestions]│
│                                                             │             │
│                                                             ▼             │
│                                                    [User Interface]       │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

*End of Document*

*This architecture design document serves as the authoritative reference for the PTV Discovery Intelligence Platform. It should be treated as a living document, updated as implementation decisions are validated and market feedback is incorporated.*

*Document authored with perspectives from: Chief Product Officer, Chief Technology Officer, Principal AI Architect, Principal Software Architect, Transportation Operations Executive, McKinsey Digital Partner, and Enterprise SaaS Founder.*
