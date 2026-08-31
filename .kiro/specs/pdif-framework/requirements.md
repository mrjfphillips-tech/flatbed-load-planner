# PTV Discovery Intelligence Framework (PDIF) — Requirements

## Overview

The PTV Discovery Coach is an AI consulting platform that transforms enterprise sales reps into senior transportation consultants. It is built around the PTV Discovery Intelligence Framework (PDIF) — a proprietary five-phase methodology that guides conversations from business understanding to measurable business transformation.

MEDDICC, SPICED, Challenger, BANT, Value Selling, and Solution Selling are calculated automatically in the background but never drive the user experience. The salesperson should feel like they are conducting a transportation consulting engagement, not completing a qualification checklist.

---

## Foundational Architecture: Discovery Intelligence Layer

All features reason from a shared intelligence layer — six interconnected services that form the AI consulting brain:

### 1. Transportation Knowledge Engine
- Stores structured knowledge about transportation operations, industry norms, PTV product capabilities, and competitive landscape
- Provides contextual terminology, benchmarks, and operational standards per industry segment
- Feeds all question generation, coaching, and scoring with domain expertise

### 2. Discovery Graph
- A living knowledge graph per account that accumulates everything learned across all sessions
- Nodes: facts, contacts, processes, systems, pain points, objectives, constraints
- Edges: causal relationships, dependencies, contradictions, confidence levels
- Grows with every conversation — never loses information

### 3. Hypothesis Engine
- Generates business hypotheses from partial information ("If they have 200 vehicles with no route optimization, they're likely losing 15-25% in fuel efficiency")
- Tracks hypothesis confidence as evidence accumulates
- Surfaces hypotheses that need validation — these drive question suggestions

### 4. Consultant Brain
- The reasoning layer that decides what to explore next based on the current Discovery Graph state
- Considers: what's known, what's unknown, what's critical for the current PDIF phase, what creates executive credibility
- Prioritizes depth over breadth when a thread is productive
- Adapts to buyer persona, industry, and deal stage

### 5. Business Case Builder
- Continuously constructs a value narrative from accumulated evidence
- Maps operational inefficiencies → quantified financial impact → PTV solution alignment → expected ROI
- Produces executive summaries, proposal content, and CRM updates at any point in the engagement

### 6. Industry Benchmark Engine
- Maintains reference data for fleet sizes, cost-per-mile, delivery density, on-time rates, driver utilization by industry
- Enables "You're at X; best-in-class is Y; the gap represents $Z annually" framing
- Feeds the ROI calculator and business case builder with credible comparison data

---

## PDIF Phase Requirements

### REQ-1: Phase 1 — DISCOVER

#### REQ-1.1: Objective
The system guides the rep to understand the customer's business before discussing solutions.

#### REQ-1.2: Information Capture
The system must progressively capture:
- Company profile, industry, business model
- Transportation network structure
- Fleet composition (owned, leased, contracted, size, types)
- Geographic footprint and service areas
- Customer mix and delivery patterns
- Distribution strategy (hub-and-spoke, direct, milk run, etc.)
- Organizational structure and reporting lines
- Strategic initiatives and growth objectives
- Current challenges and success metrics

#### REQ-1.3: AI Analysis During DISCOVER
The system continuously identifies and displays:
- Known facts (with evidence from transcript)
- Unknown information (gaps that need exploration)
- Business hypotheses (inferred from partial data)
- Confidence score per knowledge area

#### REQ-1.4: Phase Transition
The system recommends advancing to DIAGNOSE when sufficient business context exists (configurable confidence threshold across DISCOVER categories).

### REQ-2: Phase 2 — DIAGNOSE

#### REQ-2.1: Objective
The system guides the rep to identify operational inefficiencies and quantify business pain.

#### REQ-2.2: Operational Evaluation Areas
The system must assess and score:
- Planning processes
- Routing processes
- Dispatch workflows
- Driver management
- Fleet utilization
- Equipment utilization
- Warehouse interactions
- Appointment scheduling
- Exception management
- Visibility and tracking
- Optimization maturity
- Compliance and regulatory
- Data quality
- Technology integration
- Current KPIs
- Financial impact of inefficiencies

#### REQ-2.3: AI Estimation During DIAGNOSE
The system continuously estimates:
- Business risk level
- Operational maturity score
- Optimization opportunity size ($)
- Potential root causes
- Hidden operational constraints

#### REQ-2.4: Pain Quantification
The system helps the rep quantify pain in financial terms: wasted miles, excess vehicles, overtime hours, failed deliveries, fuel waste, compliance penalties.

### REQ-3: Phase 3 — DESIGN

#### REQ-3.1: Objective
Map customer challenges to measurable business outcomes and PTV solution areas.

#### REQ-3.2: Design Outputs
The system generates:
- Desired future state description
- Business priorities ranked by impact
- Executive objectives alignment
- Operational improvements possible
- Technology requirements
- Implementation constraints
- Change management risks
- Competitive landscape analysis
- PTV solution alignment recommendations
- Potential ROI ranges
- Implementation complexity estimate

#### REQ-3.3: Solution Mapping
The system recommends specific PTV products/modules based on diagnosed problems, not generic feature lists.

### REQ-4: Phase 4 — DEMONSTRATE

#### REQ-4.1: Objective
Prepare the most relevant demonstration and executive business case.

#### REQ-4.2: Demonstration Recommendations
The system recommends:
- Specific products/capabilities to demonstrate
- Which customer pain points each demo addresses
- Relevant customer success stories
- Industry benchmarks for comparison
- ROI examples with customer-specific numbers
- Executive talking points
- Competitive differentiators to emphasize
- Suggested demonstration agenda

#### REQ-4.3: Business Case Assembly
Every recommendation must directly trace back to a validated business challenge uncovered during DISCOVER and DIAGNOSE phases.

### REQ-5: Phase 5 — DELIVER

#### REQ-5.1: Objective
Prepare the customer for successful adoption and executive approval.

#### REQ-5.2: Buying Process Capture
The system captures:
- Buying committee members and roles
- Economic buyer identification
- Decision process steps and timeline
- Decision criteria (technical, business, political)
- Implementation timeline expectations
- Technical dependencies
- Success metrics agreed upon
- Executive sponsor

#### REQ-5.3: Readiness Assessment
The system builds:
- Implementation readiness score
- Business case confidence score
- Risk assessment (adoption, change management, technical)

#### REQ-5.4: Deliverables Generation
The system produces:
- Executive summary
- CRM field updates
- Action items with owners and dates
- Follow-up email drafts
- Proposal recommendations
- Next discovery session strategy

---

## REQ-6: Discovery Confidence Engine

#### REQ-6.1: Purpose
Measure how well the salesperson truly understands the customer's business — not just methodology completion.

#### REQ-6.2: Confidence Categories (17 total)
Continuously calculate confidence (0-100%) across:
1. Company Strategy
2. Business Objectives
3. Transportation Operations
4. Fleet & Network Design
5. Planning & Dispatch
6. Routing & Optimization
7. Technology Ecosystem
8. Data Quality
9. Financial Drivers
10. KPIs & Success Metrics
11. Executive Priorities
12. Buying Process
13. Economic Buyer
14. Competitive Position
15. Implementation Readiness
16. Business Case Strength
17. Overall Discovery Completeness

#### REQ-6.3: Per-Category Display
Each category shows:
- Current confidence (%)
- Supporting evidence (transcript excerpts, facts)
- Missing information (what's still unknown)
- Recommended next questions to increase confidence
- Potential business impact of this knowledge

#### REQ-6.4: Evidence-Based Scoring
Confidence increases only when specific evidence is captured in the transcript — not from asking the question, but from receiving a substantive answer.

---

## REQ-7: Background Sales Methodologies

#### REQ-7.1: Hidden Methodology Assessments
The AI automatically calculates and maintains:
- MEDDICC completion
- SPICED alignment
- Challenger positioning
- BANT qualification
- Value Selling readiness
- Solution Selling progress

#### REQ-7.2: Usage
These enrich coaching suggestions, scoring, CRM exports, and opportunity health reporting but are never shown as primary UI elements.

#### REQ-7.3: Manager Visibility
Managers can view methodology scores in dashboards for pipeline review, but reps see only the PDIF confidence engine.

---

## REQ-8: Live Session Coaching

#### REQ-8.1: Continuous Transcription
Speech is transcribed continuously without interrupting the conversation flow.

#### REQ-8.2: Background Analysis
Every 8-10 seconds of accumulated new speech, the AI silently:
- Updates the Discovery Graph
- Recalculates confidence scores
- Refreshes question suggestions
- Evaluates hypotheses against new evidence
- Updates background methodology scores

#### REQ-8.3: Question Suggestions
2-3 contextual questions are always visible in a suggestion panel. These:
- Target the lowest-confidence areas relevant to the current PDIF phase
- Flow naturally from what was just discussed
- Sound like a consultant asking, not a checklist being filled
- Refresh when the AI detects a new conversational thread

#### REQ-8.4: Rep Control
The rep taps a suggested question when they feel the conversational moment is right. No forced transitions, no auto-interrupts, no accept/skip paradigm.

#### REQ-8.5: Phase Awareness
Question suggestions adapt to the current PDIF phase. In DISCOVER, questions explore business context. In DIAGNOSE, questions probe operational detail. In DESIGN, questions validate solution fit.

---

## REQ-9: Ultimate Success Criteria

The application succeeds when the salesperson leaves every meeting with:
- ✓ A deep understanding of the customer's transportation operation
- ✓ A validated business problem
- ✓ Quantified operational and financial impact
- ✓ Executive-level credibility
- ✓ A compelling business case for change
- ✓ A clear strategy for the next customer engagement

Every recommendation, question, score, insight, and coaching suggestion must contribute toward these outcomes.

---

## REQ-10: Existing Infrastructure (Retained)

The following already-built capabilities remain and integrate into the PDIF architecture:
- Account creation with business card OCR (OpenAI Vision)
- AI-powered industry segment detection with dynamic segment creation
- Contact management with persona mapping
- Real-time speech transcription (Web Speech API)
- Session persistence (Neon PostgreSQL via Drizzle ORM)
- JWT authentication with role-based access
- ROI Calculator
- Leexi integration for recorded call import
- Electron desktop packaging
- GDPR consent for EU accounts
