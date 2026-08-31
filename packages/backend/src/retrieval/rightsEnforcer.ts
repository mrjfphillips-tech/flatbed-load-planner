// ─── Rights Enforcer ──────────────────────────────────────────────────────────
// Filters retrieval results based on user role, team permissions, and licensing
// restrictions from Rights_Profile. Runs after reranking but before the Expert
// Panel receives results.
// Requirements: 8.7, 9.7, 10.5, 10.7

import type { RankedPassage, RightsContext } from '@ptv-discovery-coach/shared';
import type { UserRole } from '@ptv-discovery-coach/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Licensing types for source documents.
 */
export type LicensingType = 'proprietary' | 'creative_commons' | 'fair_use' | 'internal_only';

/**
 * Rights profile data attached to a source document.
 */
export interface RightsProfileData {
  id: string;
  licensingType: LicensingType;
  permittedRoles: UserRole[];
  permittedTeams: string[];
  attributionText: string | null;
}

/**
 * A passage that has passed rights enforcement, with attribution metadata.
 */
export interface AuthorizedPassage extends RankedPassage {
  /** Attribution text required by the Rights_Profile, if any. */
  attributionText: string | null;
}

/**
 * Function signature for fetching a RightsProfile from the database
 * given a source document ID.
 */
export type RightsProfileFetcher = (sourceDocumentId: string) => Promise<RightsProfileData | null>;

/**
 * Interface for a cache store (Redis or in-memory for testing).
 */
export interface RightsCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
}

/**
 * Configuration for the RightsEnforcer.
 */
export interface RightsEnforcerConfig {
  /** Cache TTL in seconds. Default: 60 (matching Req 10.7). */
  cacheTtlSeconds: number;
}

const DEFAULT_CONFIG: RightsEnforcerConfig = {
  cacheTtlSeconds: 60,
};

// ─── Usage Context ────────────────────────────────────────────────────────────

/**
 * Licensing types that restrict content based on usage context.
 * 'internal_only' content cannot be accessed by non-admin/non-manager roles
 * in external-facing contexts.
 */
const LICENSING_ROLE_RESTRICTIONS: Record<LicensingType, UserRole[]> = {
  proprietary: ['admin'],
  creative_commons: ['rep', 'manager', 'admin'],
  fair_use: ['rep', 'manager', 'admin'],
  internal_only: ['manager', 'admin'],
};

// ─── RightsEnforcer Class ─────────────────────────────────────────────────────

/**
 * RightsEnforcer filters retrieval results based on the user's role, team
 * memberships, and the licensing restrictions defined in each source document's
 * Rights_Profile.
 *
 * Caches Rights_Profile data in Redis with a 60-second TTL so that updated
 * restrictions take effect within 60 seconds without re-ingestion (Req 10.7).
 *
 * Flow:
 * 1. Accepts RankedPassage[] from the reranker and a RightsContext (user info)
 * 2. For each passage, looks up the source document's Rights_Profile (cached)
 * 3. Filters out passages where:
 *    - User's role is not in permittedRoles
 *    - User's team is not in permittedTeams (when permittedTeams is non-empty)
 *    - Licensing type restricts the current usage context
 * 4. Returns only authorized passages with their required attribution text
 */
export class RightsEnforcer {
  private readonly cache: RightsCache;
  private readonly fetcher: RightsProfileFetcher;
  private readonly config: RightsEnforcerConfig;

  constructor(
    cache: RightsCache,
    fetcher: RightsProfileFetcher,
    config?: Partial<RightsEnforcerConfig>,
  ) {
    this.cache = cache;
    this.fetcher = fetcher;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Filter retrieval results based on user role and team permissions.
   * Returns only passages the user is authorized to access, with attribution.
   */
  async enforce(
    passages: RankedPassage[],
    rightsContext: RightsContext,
  ): Promise<AuthorizedPassage[]> {
    const authorized: AuthorizedPassage[] = [];

    for (const passage of passages) {
      const sourceDocId = passage.sourceDocument.id;
      const profile = await this.getRightsProfile(sourceDocId);

      // If no profile is found, exclude the passage (fail-closed)
      if (!profile) {
        continue;
      }

      // Check role permission
      if (!this.isRolePermitted(rightsContext.role, profile)) {
        continue;
      }

      // Check team permission (if permittedTeams is specified and non-empty)
      if (!this.isTeamPermitted(rightsContext.teamIds, profile)) {
        continue;
      }

      // Check licensing restrictions
      if (!this.isLicensingPermitted(rightsContext.role, profile.licensingType)) {
        continue;
      }

      authorized.push({
        ...passage,
        attributionText: profile.attributionText,
      });
    }

    return authorized;
  }

  /**
   * Get a RightsProfile, checking cache first, then falling back to DB fetch.
   * Results are cached with a TTL to satisfy the 60-second update requirement.
   */
  async getRightsProfile(sourceDocumentId: string): Promise<RightsProfileData | null> {
    const cacheKey = `rights_profile:${sourceDocumentId}`;

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as RightsProfileData;
    }

    // Cache miss — fetch from database
    const profile = await this.fetcher(sourceDocumentId);
    if (profile) {
      await this.cache.set(cacheKey, JSON.stringify(profile), 'EX', this.config.cacheTtlSeconds);
    }

    return profile;
  }

  /**
   * Check if the user's role is in the list of permitted roles.
   */
  private isRolePermitted(userRole: UserRole, profile: RightsProfileData): boolean {
    return profile.permittedRoles.includes(userRole);
  }

  /**
   * Check if at least one of the user's teams is in the permitted teams list.
   * If permittedTeams is empty or null, access is unrestricted by team.
   */
  private isTeamPermitted(userTeamIds: string[], profile: RightsProfileData): boolean {
    // If no team restrictions defined, allow all
    if (!profile.permittedTeams || profile.permittedTeams.length === 0) {
      return true;
    }

    // User must belong to at least one permitted team
    return userTeamIds.some((teamId) => profile.permittedTeams.includes(teamId));
  }

  /**
   * Check if the licensing type permits the user's role in the current context.
   */
  private isLicensingPermitted(userRole: UserRole, licensingType: LicensingType): boolean {
    const allowedRoles = LICENSING_ROLE_RESTRICTIONS[licensingType];
    if (!allowedRoles) {
      // Unknown licensing type — fail-closed
      return false;
    }
    return allowedRoles.includes(userRole);
  }
}
