// ─── Enums ────────────────────────────────────────────────────────────────────

/** All 12 MEDDIC discovery dimensions */
export type MEDDICElement =
  | 'Metrics'
  | 'EconomicBuyer'
  | 'DecisionCriteria'
  | 'DecisionProcess'
  | 'IdentifyPain'
  | 'Champion'
  | 'People'
  | 'Organization'
  | 'Goals'
  | 'Plans'
  | 'Obstacles'
  | 'PlansToOvercomeObstacles'

export const MEDDIC_ELEMENTS: MEDDICElement[] = [
  'Metrics',
  'EconomicBuyer',
  'DecisionCriteria',
  'DecisionProcess',
  'IdentifyPain',
  'Champion',
  'People',
  'Organization',
  'Goals',
  'Plans',
  'Obstacles',
  'PlansToOvercomeObstacles',
]

export type BuyerPersona =
  | 'FleetManager'
  | 'LogisticsDirector'
  | 'SupplyChainVP'
  | 'ITArchitect'
  | 'OperationsAnalyst'

/** Industry segment — identified at session start to filter questions and terminology */
export type IndustrySegment =
  | 'ThirdPartyLogistics'
  | 'BuildingSupply'
  | 'ManufacturingDistribution'
  | 'RetailEcommerce'
  | 'FoodBeverageFMCG'
  | 'HealthcarePharma'
  | 'FieldServices'
  | 'Other'

export const INDUSTRY_SEGMENTS: IndustrySegment[] = [
  'ThirdPartyLogistics',
  'BuildingSupply',
  'ManufacturingDistribution',
  'RetailEcommerce',
  'FoodBeverageFMCG',
  'HealthcarePharma',
  'FieldServices',
  'Other',
]

export const INDUSTRY_SEGMENT_LABELS: Record<IndustrySegment, string> = {
  ThirdPartyLogistics: '3PL / Third-Party Logistics',
  BuildingSupply: 'Building Supply / Construction Materials',
  ManufacturingDistribution: 'Manufacturing & Distribution',
  RetailEcommerce: 'Retail & E-commerce',
  FoodBeverageFMCG: 'Food & Beverage / FMCG',
  HealthcarePharma: 'Healthcare & Pharma',
  FieldServices: 'Field Services (utilities, telecoms, home services)',
  Other: 'Other',
}

export type UserRole = 'Rep' | 'Manager' | 'Admin'

// ─── Coverage Scores ──────────────────────────────────────────────────────────

/** Coverage scores for all 12 MEDDIC dimensions, each in [0, 100] */
export type MEDDICScores = Record<MEDDICElement, number>

export function defaultMEDDICScores(): MEDDICScores {
  return Object.fromEntries(MEDDIC_ELEMENTS.map((el) => [el, 0])) as MEDDICScores
}

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  createdAt: Date
}

export interface Account {
  id: string
  name: string
  /** Industry segment identified at session start — drives question filtering */
  industrySegment?: IndustrySegment
  createdAt: Date
}

export interface Session {
  id: string
  accountId: string
  repId: string
  startedAt: Date
  endedAt?: Date
  durationSeconds?: number
  coverageScores: MEDDICScores
  autoSavedAt?: Date
  /** Req 14.8: distinguishes live sessions from offline recovery sessions */
  sessionType: 'live' | 'offline_recovery'
  /** Req 14.1: object storage URL for raw audio recording */
  audioRecordingUrl?: string
}

export interface TranscriptSegment {
  id: string
  sessionId: string
  text: string
  startMs: number
  endMs: number
  /** 'speech' for microphone input, 'ocr' for image-extracted text */
  source: 'speech' | 'ocr'
  /** "OCR Input" + timestamp label for OCR segments */
  ocrLabel?: string
  createdAt: Date
}

export interface Summary {
  id: string
  sessionId: string
  /** Original AI-generated text — immutable */
  aiGenerated: string
  /** Rep-edited version — auto-saved */
  repEdited: string
  generatedAt: Date
  lastEditedAt?: Date
}

export interface Question {
  id: string
  text: string
  element: MEDDICElement
  persona: BuyerPersona
  isActive: boolean
  /** Optional coaching note: why this question matters and what to listen for in the answer */
  coachingNote?: string
  /** Optional industry segment — null/undefined means question applies to all segments */
  industrySegment?: IndustrySegment
  createdAt: Date
  deactivatedAt?: Date
}

export interface RepQuestionPreference {
  repId: string
  questionId: string
  isPreferred: boolean
  /** Rolling average of Question_Intent_Score for this rep+question */
  avgIntentScore: number
  useCount: number
  starredAt?: Date
}

export interface QuestionIntentScore {
  id: string
  sessionId: string
  questionId: string
  repId: string
  /** Score in [0, 100] */
  score: number
  evaluatedAt: Date
}

export interface Attachment {
  id: string
  sessionId: string
  originalUrl: string
  extractedText?: string
  mimeType: string
  capturedAt: Date
}

export interface ExportEvent {
  id: string
  sessionId: string
  channel: 'salesforce' | 'microsoft365' | 'sms' | 'email'
  timestamp: Date
  recipientCount: number
  success: boolean
  errorMessage?: string
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  coverageScores: MEDDICScores
  suggestedQuestion: Question
  alternativeQuestions: Question[]
  /** QIS for the most recently evaluated question */
  questionIntentScore?: number
  gapRecommendations: GapRecommendation[]
}

export interface GapRecommendation {
  element: MEDDICElement
  score: number
  recommendedPersonas: BuyerPersona[]
  /** true for EconomicBuyer or Champion with score < 60 */
  isCritical: boolean
}

export interface WeightedQuestion {
  question: Question
  /** Composite score used for ranking */
  weight: number
  isPreferred: boolean
  avgIntentScore: number
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export interface Contact {
  id: string
  accountId: string
  fullName: string
  jobTitle: string
  email: string
  phone: string
  address?: string
  linkedInUrl?: string
  buyerPersona: BuyerPersona
  /** Req 15.5: stored attachment URL for business card image */
  businessCardImageUrl?: string
  createdAt: Date
  updatedAt: Date
}

export interface ContactInput {
  fullName: string
  jobTitle: string
  email: string
  phone: string
  address?: string
  linkedInUrl?: string
  buyerPersona: BuyerPersona
}

/** Join table linking contacts to sessions (Req 15.8) */
export interface SessionContact {
  sessionId: string
  contactId: string
  linkedAt: Date
}

// ─── Offline Recovery ─────────────────────────────────────────────────────────

export interface RecoveryStatus {
  stage: 'uploading' | 'transcribing' | 'analyzing' | 'summarizing' | 'complete' | 'failed'
  progressPct: number
  errorMessage?: string
}
