/**
 * TransportationKnowledgePack
 *
 * The platform's domain expertise — structured knowledge about how
 * transportation operations work, including causal patterns, industry
 * benchmarks, and question templates organized by PDIF phase and topic.
 *
 * This is NOT a database of questions. It's structured knowledge that
 * the AI uses to REASON about customer operations and generate
 * contextually appropriate, consultant-grade questions.
 *
 * PDIF V1 Task 2.1
 */

// ─── Causal Patterns ──────────────────────────────────────────────────────────
// These patterns enable the platform to form hypotheses:
// "If we observe X, then Y is likely true, with financial impact Z"

export interface CausalPattern {
  id: string;
  trigger: string;          // What observable condition triggers this pattern
  effect: string;           // What is likely true as a result
  confidence: number;       // How reliable is this pattern (0-1)
  financialImpact: string;  // How to estimate the dollar cost
  validationQuestion: string; // Question that confirms/denies this
  pdifPhase: string;        // Which phase is this most relevant in
  industry?: string[];      // Which industries (null = all)
}

export const CAUSAL_PATTERNS: CausalPattern[] = [
  // ─── Fleet & Routing ────────────────────────────────────────────────
  {
    id: 'cp_manual_routing_waste',
    trigger: 'Manual route planning AND fleet size > 50 vehicles',
    effect: 'Route inefficiency 15-30% above optimal (excess miles, time, fuel)',
    confidence: 0.85,
    financialImpact: 'fleet_size × avg_daily_miles × waste_pct × cost_per_mile × 250_days',
    validationQuestion: 'How do your actual routes compare to what you\'d consider optimal? Do you track miles per stop or cost per delivery?',
    pdifPhase: 'diagnose',
  },
  {
    id: 'cp_excess_fleet',
    trigger: 'No route optimization AND fleet size > 100 vehicles',
    effect: 'Excess fleet 15-30% (vehicles not needed with optimized routing)',
    confidence: 0.80,
    financialImpact: 'excess_vehicles × (annual_lease + insurance + maintenance) = $60K-$100K per vehicle',
    validationQuestion: 'On an average day, how many of your vehicles actually run routes versus sitting in the yard?',
    pdifPhase: 'diagnose',
  },
  {
    id: 'cp_fuel_waste_no_telematics',
    trigger: 'No telematics/GPS tracking AND fleet size > 75',
    effect: 'Fuel waste 10-20% from idling, speeding, inefficient routing',
    confidence: 0.75,
    financialImpact: 'fleet_size × annual_fuel_cost × waste_pct',
    validationQuestion: 'Do you have visibility into driver behavior — idling time, speed compliance, route adherence?',
    pdifPhase: 'diagnose',
  },
  {
    id: 'cp_overtime_poor_planning',
    trigger: 'Manual dispatch AND daily order volume > 150',
    effect: 'Driver overtime 8-15% above optimal from route imbalance',
    confidence: 0.70,
    financialImpact: 'excess_overtime_hours × (hourly_rate × 1.5) × 250_days',
    validationQuestion: 'What does your average driver\'s day look like? Are some consistently running late while others finish early?',
    pdifPhase: 'diagnose',
  },
  {
    id: 'cp_dock_dwell_no_scheduling',
    trigger: 'No appointment scheduling system AND facility throughput > 50 trucks/day',
    effect: 'Average dwell time 90-180 minutes (industry best: 30-45 min)',
    confidence: 0.65,
    financialImpact: 'daily_trucks × excess_dwell_hours × driver_hourly_cost × 250_days',
    validationQuestion: 'How long do your drivers typically wait at customer docks? Is dock scheduling managed electronically?',
    pdifPhase: 'diagnose',
  },
  {
    id: 'cp_failed_deliveries',
    trigger: 'No real-time customer notification AND residential/commercial deliveries > 200/day',
    effect: 'Failed delivery rate 4-8% (redelivery cost $25-$75 each)',
    confidence: 0.70,
    financialImpact: 'daily_deliveries × fail_rate × redelivery_cost × 250_days',
    validationQuestion: 'What happens when a customer isn\'t available for delivery? How often do you have to redeliver?',
    pdifPhase: 'diagnose',
  },
  // ─── Technology & Data ─────────────────────────────────────────────
  {
    id: 'cp_legacy_tms_limitations',
    trigger: 'TMS installed > 5 years ago AND no major upgrade',
    effect: 'System limitations preventing optimization, workarounds creating manual processes',
    confidence: 0.70,
    financialImpact: 'Manual workaround labor + missed optimization + maintenance cost',
    validationQuestion: 'When was your TMS last significantly updated? Are there things you work around because the system doesn\'t handle them well?',
    pdifPhase: 'diagnose',
  },
  {
    id: 'cp_data_quality_issues',
    trigger: 'Multiple disconnected systems AND no master data governance',
    effect: 'Address data errors 5-15%, causing failed deliveries and route inaccuracy',
    confidence: 0.65,
    financialImpact: 'address_error_rate × daily_stops × failed_delivery_cost × 250_days',
    validationQuestion: 'How confident are you in your address and customer data quality? Do drivers frequently find addresses are wrong?',
    pdifPhase: 'diagnose',
  },
  // ─── Operational Patterns ────────────────────────────────────────────
  {
    id: 'cp_peak_season_overrun',
    trigger: 'Static routing AND seasonal volume variance > 30%',
    effect: 'Peak season cost overrun 20-35% from emergency carriers and overtime',
    confidence: 0.70,
    financialImpact: 'peak_months × (overflow_carrier_premium + overtime_premium)',
    validationQuestion: 'How does your operation handle peak seasons? Do you bring in outside carriers or run significant overtime?',
    pdifPhase: 'diagnose',
  },
  {
    id: 'cp_driver_turnover_routes',
    trigger: 'High driver turnover (>30%) AND long average route time (>10 hours)',
    effect: 'Route design contributing to driver dissatisfaction and turnover',
    confidence: 0.60,
    financialImpact: 'turnover_rate × drivers × replacement_cost ($8K-$12K per driver)',
    validationQuestion: 'What\'s your driver turnover rate? When drivers leave, what reasons do they give?',
    pdifPhase: 'diagnose',
  },
  {
    id: 'cp_empty_miles_no_backhaul',
    trigger: 'No backhaul optimization AND outbound-heavy network',
    effect: 'Empty miles 25-40% of total (deadhead returning to base)',
    confidence: 0.75,
    financialImpact: 'total_daily_miles × empty_pct × cost_per_mile × 250_days',
    validationQuestion: 'What percentage of your miles are loaded versus empty? Do you actively seek backhaul freight?',
    pdifPhase: 'diagnose',
  },
];

// ─── Industry Benchmarks (V1 — Top 4 Segments) ───────────────────────────────

export interface Benchmark {
  metric: string;
  unit: string;
  industry: string;
  p25: number;      // Bottom quartile
  median: number;   // Typical
  p75: number;      // Good
  p90: number;      // Best-in-class
  source: string;
}

export const BENCHMARKS: Benchmark[] = [
  // ─── 3PL / Carrier ──────────────────────────────────────────────────
  { metric: 'Cost per mile', unit: 'USD', industry: '3PL', p25: 2.80, median: 2.20, p75: 1.85, p90: 1.60, source: 'ATRI 2024' },
  { metric: 'Vehicle utilization', unit: '%', industry: '3PL', p25: 62, median: 72, p75: 82, p90: 90, source: 'PTV benchmark' },
  { metric: 'Empty miles', unit: '%', industry: '3PL', p25: 35, median: 25, p75: 18, p90: 12, source: 'ATA data' },
  { metric: 'On-time delivery', unit: '%', industry: '3PL', p25: 85, median: 91, p75: 95, p90: 98, source: 'Industry average' },
  { metric: 'Driver turnover', unit: '%', industry: '3PL', p25: 85, median: 60, p75: 35, p90: 20, source: 'ATA 2024' },
  { metric: 'Stops per hour', unit: 'stops/hr', industry: '3PL', p25: 2.5, median: 3.5, p75: 4.5, p90: 5.5, source: 'PTV benchmark' },

  // ─── Manufacturing & Distribution ───────────────────────────────────
  { metric: 'Cost per mile', unit: 'USD', industry: 'Manufacturing', p25: 3.20, median: 2.50, p75: 2.00, p90: 1.75, source: 'Industry data' },
  { metric: 'Vehicle utilization', unit: '%', industry: 'Manufacturing', p25: 55, median: 68, p75: 78, p90: 88, source: 'PTV benchmark' },
  { metric: 'On-time delivery', unit: '%', industry: 'Manufacturing', p25: 88, median: 93, p75: 96, p90: 99, source: 'Industry data' },
  { metric: 'Routes per planner', unit: 'routes/person', industry: 'Manufacturing', p25: 15, median: 30, p75: 60, p90: 100, source: 'PTV benchmark' },
  { metric: 'Plan-to-execute variance', unit: '%', industry: 'Manufacturing', p25: 25, median: 15, p75: 8, p90: 3, source: 'PTV benchmark' },

  // ─── Building Supply ────────────────────────────────────────────────
  { metric: 'Cost per stop', unit: 'USD', industry: 'BuildingSupply', p25: 120, median: 85, p75: 60, p90: 45, source: 'Industry estimate' },
  { metric: 'Vehicle utilization', unit: '%', industry: 'BuildingSupply', p25: 50, median: 62, p75: 72, p90: 82, source: 'PTV benchmark' },
  { metric: 'Failed delivery rate', unit: '%', industry: 'BuildingSupply', p25: 12, median: 7, p75: 4, p90: 2, source: 'Industry data' },
  { metric: 'Driver overtime', unit: '% of hours', industry: 'BuildingSupply', p25: 18, median: 12, p75: 7, p90: 3, source: 'BLS data' },

  // ─── Food & Beverage ────────────────────────────────────────────────
  { metric: 'Cost per mile', unit: 'USD', industry: 'FoodBeverage', p25: 3.50, median: 2.80, p75: 2.20, p90: 1.90, source: 'Industry data' },
  { metric: 'Temperature compliance', unit: '%', industry: 'FoodBeverage', p25: 92, median: 96, p75: 98, p90: 99.5, source: 'FDA requirements' },
  { metric: 'Delivery window compliance', unit: '%', industry: 'FoodBeverage', p25: 78, median: 87, p75: 93, p90: 97, source: 'Industry data' },
  { metric: 'Stops per route', unit: 'stops', industry: 'FoodBeverage', p25: 8, median: 14, p75: 20, p90: 28, source: 'PTV benchmark' },
  { metric: 'Dock dwell time', unit: 'minutes', industry: 'FoodBeverage', p25: 90, median: 55, p75: 35, p90: 20, source: 'Industry average' },
];

// ─── PDIF Phase Question Templates ────────────────────────────────────────────
// Organized by phase and topic. These are templates the AI uses as a starting
// point — it adapts them to the specific conversation context.

export interface QuestionTemplate {
  id: string;
  text: string;
  pdifPhase: string;
  topic: string;
  whyItMatters: string;
  targetConfidenceCategory: string;
  industry?: string[];
}

export const QUESTION_TEMPLATES: QuestionTemplate[] = [
  // ═══ PHASE 1: DISCOVER ═══════════════════════════════════════════════
  // Goal: Understand the customer's business before discussing solutions

  // Company & Business Model
  { id: 'q_d_01', text: 'Walk me through how your transportation operation fits into your overall business model.', pdifPhase: 'discover', topic: 'business_model', whyItMatters: 'Establishes whether transportation is a cost center or profit driver', targetConfidenceCategory: 'company_operations' },
  { id: 'q_d_02', text: 'What does a typical day look like for your logistics team — from when orders come in to when deliveries are complete?', pdifPhase: 'discover', topic: 'operations_flow', whyItMatters: 'Maps the end-to-end process and identifies where complexity lives', targetConfidenceCategory: 'company_operations' },
  { id: 'q_d_03', text: 'How many delivery points do you serve, and how would you describe your geographic footprint?', pdifPhase: 'discover', topic: 'network_scope', whyItMatters: 'Establishes network scale and density — drives optimization potential', targetConfidenceCategory: 'fleet_network' },
  { id: 'q_d_04', text: 'Tell me about your fleet — how many vehicles, what types, owned versus leased?', pdifPhase: 'discover', topic: 'fleet_composition', whyItMatters: 'Fleet size and mix are primary optimization variables', targetConfidenceCategory: 'fleet_network' },
  { id: 'q_d_05', text: 'What are the top 2-3 strategic initiatives driving your business this year?', pdifPhase: 'discover', topic: 'strategic_context', whyItMatters: 'Aligns transportation discussion to executive priorities', targetConfidenceCategory: 'company_operations' },
  { id: 'q_d_06', text: 'How is your organization structured around transportation decisions? Who are the key stakeholders?', pdifPhase: 'discover', topic: 'org_structure', whyItMatters: 'Maps the buying committee and decision-making process', targetConfidenceCategory: 'buying_process' },
  { id: 'q_d_07', text: 'What does success look like for your transportation operation this year? What metrics define winning?', pdifPhase: 'discover', topic: 'success_metrics', whyItMatters: 'Identifies KPIs we can tie our value story to', targetConfidenceCategory: 'financial_drivers' },

  // ═══ PHASE 2: DIAGNOSE ═══════════════════════════════════════════════
  // Goal: Identify operational inefficiencies and quantify business pain

  // Planning & Routing
  { id: 'q_diag_01', text: 'How do you build your routes today? Walk me through the planning process from start to finish.', pdifPhase: 'diagnose', topic: 'planning_process', whyItMatters: 'Manual planning is the #1 source of route inefficiency', targetConfidenceCategory: 'company_operations' },
  { id: 'q_diag_02', text: 'How many routes does your team typically plan per day, and how long does that take?', pdifPhase: 'diagnose', topic: 'planning_capacity', whyItMatters: 'Quantifies planning labor cost and identifies bottleneck', targetConfidenceCategory: 'company_operations' },
  { id: 'q_diag_03', text: 'When an order comes in after routes are finalized, what happens? How do you handle same-day changes?', pdifPhase: 'diagnose', topic: 'exception_handling', whyItMatters: 'Exception handling maturity reveals operational agility', targetConfidenceCategory: 'company_operations' },
  { id: 'q_diag_04', text: 'How do you currently account for delivery time windows, driver hours, and vehicle capacity constraints in your planning?', pdifPhase: 'diagnose', topic: 'constraint_management', whyItMatters: 'Constraint handling directly determines route quality', targetConfidenceCategory: 'company_operations' },

  // Fleet Utilization
  { id: 'q_diag_05', text: 'On an average day, how many of your vehicles actually run routes versus sitting idle?', pdifPhase: 'diagnose', topic: 'fleet_utilization', whyItMatters: 'Direct measure of excess fleet — often $60K-100K per idle vehicle per year', targetConfidenceCategory: 'fleet_network' },
  { id: 'q_diag_06', text: 'What does your driver\'s average day look like — start time, number of stops, end time? Do some finish early while others run late?', pdifPhase: 'diagnose', topic: 'route_balance', whyItMatters: 'Route imbalance means some drivers are overworked (overtime) while others are underutilized', targetConfidenceCategory: 'fleet_network' },
  { id: 'q_diag_07', text: 'What percentage of your miles are loaded versus empty? Do you actively manage backhaul?', pdifPhase: 'diagnose', topic: 'empty_miles', whyItMatters: 'Every empty mile costs $1.50-3.00 with zero revenue return', targetConfidenceCategory: 'financial_drivers' },

  // Technology
  { id: 'q_diag_08', text: 'What systems does your planning team use today? TMS, spreadsheets, or something else?', pdifPhase: 'diagnose', topic: 'technology_stack', whyItMatters: 'Maps current technology landscape and integration requirements', targetConfidenceCategory: 'technology_data' },
  { id: 'q_diag_09', text: 'If your current TMS could do one thing better, what would it be?', pdifPhase: 'diagnose', topic: 'technology_gaps', whyItMatters: 'Identifies primary technology pain point from user perspective', targetConfidenceCategory: 'technology_data' },

  // Financial
  { id: 'q_diag_10', text: 'Do you track your cost per mile or cost per delivery? What does that look like today?', pdifPhase: 'diagnose', topic: 'cost_metrics', whyItMatters: 'Establishes baseline for ROI calculation and benchmark comparison', targetConfidenceCategory: 'financial_drivers' },
  { id: 'q_diag_11', text: 'What\'s your total annual transportation spend, roughly? And what direction is the trend?', pdifPhase: 'diagnose', topic: 'total_spend', whyItMatters: 'Anchors the total addressable opportunity and ROI discussion', targetConfidenceCategory: 'financial_drivers' },

  // ═══ PHASE 3: DESIGN ════════════════════════════════════════════════
  // Goal: Map challenges to measurable business outcomes

  { id: 'q_des_01', text: 'If you could wave a magic wand and fix one thing about your transportation operation tomorrow, what would it be?', pdifPhase: 'design', topic: 'desired_state', whyItMatters: 'Reveals top priority without forcing multiple choice', targetConfidenceCategory: 'company_operations' },
  { id: 'q_des_02', text: 'What does the ideal future state look like for your routing and delivery operation?', pdifPhase: 'design', topic: 'future_vision', whyItMatters: 'Aligns solution design to customer aspirations', targetConfidenceCategory: 'company_operations' },
  { id: 'q_des_03', text: 'What would need to be true for your leadership to approve an investment in this area?', pdifPhase: 'design', topic: 'decision_criteria', whyItMatters: 'Identifies the specific ROI threshold or business case requirements', targetConfidenceCategory: 'buying_process' },
  { id: 'q_des_04', text: 'Are there any technology constraints or integration requirements that would affect how a solution gets implemented?', pdifPhase: 'design', topic: 'technical_constraints', whyItMatters: 'Surfaces implementation blockers early', targetConfidenceCategory: 'technology_data' },

  // ═══ PHASE 4: DEMONSTRATE ════════════════════════════════════════════
  // Goal: Prepare the most relevant demonstration

  { id: 'q_demo_01', text: 'Based on what we\'ve discussed, which capabilities would be most valuable to see in action?', pdifPhase: 'demonstrate', topic: 'demo_priorities', whyItMatters: 'Ensures demo addresses validated pain, not generic features', targetConfidenceCategory: 'company_operations' },
  { id: 'q_demo_02', text: 'Who else should be in the room when we demonstrate this? Who would need to see results to support the decision?', pdifPhase: 'demonstrate', topic: 'demo_audience', whyItMatters: 'Expands stakeholder engagement and identifies decision influencers', targetConfidenceCategory: 'buying_process' },

  // ═══ PHASE 5: DELIVER ═══════════════════════════════════════════════
  // Goal: Prepare for successful adoption and approval

  { id: 'q_del_01', text: 'Walk me through how a decision like this typically gets made in your organization.', pdifPhase: 'deliver', topic: 'decision_process', whyItMatters: 'Maps the exact buying process, timeline, and approval chain', targetConfidenceCategory: 'buying_process' },
  { id: 'q_del_02', text: 'Who controls the budget for this type of investment? What does their approval process look like?', pdifPhase: 'deliver', topic: 'economic_buyer', whyItMatters: 'Identifies the economic buyer and their decision criteria', targetConfidenceCategory: 'buying_process' },
  { id: 'q_del_03', text: 'What does a realistic implementation timeline look like from your perspective? Are there any hard deadlines?', pdifPhase: 'deliver', topic: 'timeline', whyItMatters: 'Establishes urgency and implementation planning constraints', targetConfidenceCategory: 'buying_process' },
  { id: 'q_del_04', text: 'If we move forward, what would success look like 6 months after go-live? What metrics would you track?', pdifPhase: 'deliver', topic: 'success_criteria', whyItMatters: 'Aligns expectations and creates measurable success framework', targetConfidenceCategory: 'financial_drivers' },
];

// ─── PTV Solution Mapping ─────────────────────────────────────────────────────
// Maps diagnosed problems to specific PTV product capabilities

export interface SolutionMapping {
  problem: string;
  ptvProduct: string;
  capability: string;
  typicalImprovement: string;
  validationRequired: string;
}

export const SOLUTION_MAPPINGS: SolutionMapping[] = [
  { problem: 'Manual route planning', ptvProduct: 'PTV Route Optimizer', capability: 'Algorithmic multi-constraint route optimization', typicalImprovement: '15-25% cost reduction', validationRequired: 'Fleet size, delivery constraints, current cost baseline' },
  { problem: 'Excess fleet vehicles', ptvProduct: 'PTV Route Optimizer', capability: 'Vehicle minimization with service level maintenance', typicalImprovement: '10-20% fleet reduction', validationRequired: 'Current fleet size, utilization rate, service requirements' },
  { problem: 'Poor fleet utilization', ptvProduct: 'PTV Route Optimizer + Fleet Analytics', capability: 'Load and route optimization maximizing asset usage', typicalImprovement: '15-30% utilization improvement', validationRequired: 'Current utilization, capacity constraints, demand patterns' },
  { problem: 'No strategic network design', ptvProduct: 'PTV Map&Guide', capability: 'Network modeling and scenario analysis', typicalImprovement: 'Optimal hub locations, lane balancing', validationRequired: 'Current network structure, facility locations, flow volumes' },
  { problem: 'Driver overtime / imbalance', ptvProduct: 'PTV Route Optimizer', capability: 'Balanced route design with HOS compliance', typicalImprovement: '30-50% overtime reduction', validationRequired: 'Current overtime %, HOS compliance rate, route lengths' },
  { problem: 'High empty miles', ptvProduct: 'PTV Route Optimizer', capability: 'Backhaul integration and continuous-move optimization', typicalImprovement: '20-40% empty mile reduction', validationRequired: 'Current empty %, backhaul availability, network density' },
  { problem: 'Failed deliveries / missed windows', ptvProduct: 'PTV Route Optimizer + Visibility', capability: 'Time-window-aware routing with real-time ETA', typicalImprovement: '50-70% reduction in missed deliveries', validationRequired: 'Current failure rate, time window constraints, notification capability' },
];

// ─── Helper: Get patterns relevant to known facts ─────────────────────────────

export function getRelevantPatterns(knownFacts: Record<string, any>): CausalPattern[] {
  const relevant: CausalPattern[] = [];

  for (const pattern of CAUSAL_PATTERNS) {
    // Simple keyword matching against trigger conditions
    const triggerLower = pattern.trigger.toLowerCase();
    const factString = JSON.stringify(knownFacts).toLowerCase();

    if (triggerLower.includes('manual') && factString.includes('manual')) {
      relevant.push(pattern);
    } else if (triggerLower.includes('no') && triggerLower.includes('optimization') && !factString.includes('optimization')) {
      relevant.push(pattern);
    } else if (triggerLower.includes('fleet') && factString.includes('truck')) {
      relevant.push(pattern);
    } else if (triggerLower.includes('telematics') && !factString.includes('telematics') && !factString.includes('gps')) {
      relevant.push(pattern);
    }
  }

  return relevant;
}

// ─── Helper: Get benchmarks for an industry ───────────────────────────────────

export function getBenchmarksForIndustry(industry: string): Benchmark[] {
  return BENCHMARKS.filter(b => b.industry.toLowerCase().includes(industry.toLowerCase()));
}

// ─── Helper: Get questions for a phase ────────────────────────────────────────

export function getQuestionsForPhase(phase: string, excludeIds?: string[]): QuestionTemplate[] {
  return QUESTION_TEMPLATES
    .filter(q => q.pdifPhase === phase && (!excludeIds || !excludeIds.includes(q.id)));
}
