// ─── Retrieval Module Barrel Export ───────────────────────────────────────────
// Requirements: 8.1, 8.2, 8.3, 8.7, 9.7, 10.5, 10.7

export { GraphEnrichedRetriever } from './graphEnrichedRetriever.js';
export type {
  GraphEnrichedRetrieverConfig,
  GraphEnrichedPassage,
  RetrievalFunction,
} from './graphEnrichedRetriever.js';

export { RightsEnforcer } from './rightsEnforcer.js';
export type {
  RightsProfileData,
  AuthorizedPassage,
  RightsProfileFetcher,
  RightsCache,
  RightsEnforcerConfig,
  LicensingType,
} from './rightsEnforcer.js';
