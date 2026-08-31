// ─── Rights Enforcer Unit Tests ───────────────────────────────────────────────
// Requirements: 8.7, 9.7, 10.5, 10.7

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RankedPassage, RightsContext } from '@ptv-discovery-coach/shared';
import {
  RightsEnforcer,
  type RightsProfileData,
  type RightsCache,
  type RightsProfileFetcher,
} from './rightsEnforcer.js';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createMockCache(): RightsCache {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: string, _mode: 'EX', ttl: number) => {
      store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
      return 'OK';
    }),
  };
}

function createMockFetcher(profiles: Map<string, RightsProfileData>): RightsProfileFetcher {
  return vi.fn(async (sourceDocId: string) => {
    return profiles.get(sourceDocId) ?? null;
  });
}

function createPassage(overrides: Partial<RankedPassage> & { sourceDocId: string }): RankedPassage {
  const { sourceDocId, ...rest } = overrides;
  return {
    id: `passage-${sourceDocId}-${Math.random().toString(36).slice(2, 8)}`,
    content: `Content from document ${sourceDocId}`,
    sourceDocument: {
      id: sourceDocId,
      title: `Document ${sourceDocId}`,
      framework: 'ValueSelling',
    },
    framework: 'ValueSelling',
    canonicalFields: ['pain'],
    score: 0.9,
    citation: {
      documentTitle: `Document ${sourceDocId}`,
      framework: 'ValueSelling',
      passageId: `passage-${sourceDocId}`,
    },
    ...rest,
  };
}

function createRightsContext(overrides?: Partial<RightsContext>): RightsContext {
  return {
    userId: 'user-1',
    role: 'rep',
    teamIds: ['team-alpha'],
    ...overrides,
  };
}

function createRightsProfile(overrides?: Partial<RightsProfileData>): RightsProfileData {
  return {
    id: 'profile-1',
    licensingType: 'creative_commons',
    permittedRoles: ['rep', 'manager', 'admin'],
    permittedTeams: [],
    attributionText: null,
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('RightsEnforcer', () => {
  let cache: RightsCache;
  let profiles: Map<string, RightsProfileData>;
  let fetcher: RightsProfileFetcher;
  let enforcer: RightsEnforcer;

  beforeEach(() => {
    cache = createMockCache();
    profiles = new Map();
    fetcher = createMockFetcher(profiles);
    enforcer = new RightsEnforcer(cache, fetcher);
  });

  describe('role-based filtering', () => {
    it('allows passages when user role is in permittedRoles', async () => {
      profiles.set('doc-1', createRightsProfile({
        permittedRoles: ['rep', 'manager', 'admin'],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ role: 'rep' });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(1);
      expect(result[0].sourceDocument.id).toBe('doc-1');
    });

    it('excludes passages when user role is not in permittedRoles', async () => {
      profiles.set('doc-1', createRightsProfile({
        permittedRoles: ['manager', 'admin'],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ role: 'rep' });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(0);
    });

    it('admin can access passages restricted to admin only', async () => {
      profiles.set('doc-1', createRightsProfile({
        permittedRoles: ['admin'],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ role: 'admin' });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(1);
    });
  });

  describe('team-based filtering', () => {
    it('allows passage when user team is in permittedTeams', async () => {
      profiles.set('doc-1', createRightsProfile({
        permittedTeams: ['team-alpha', 'team-beta'],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ teamIds: ['team-alpha'] });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(1);
    });

    it('excludes passage when user team is not in permittedTeams', async () => {
      profiles.set('doc-1', createRightsProfile({
        permittedTeams: ['team-beta', 'team-gamma'],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ teamIds: ['team-alpha'] });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(0);
    });

    it('allows passage when permittedTeams is empty (no team restriction)', async () => {
      profiles.set('doc-1', createRightsProfile({
        permittedTeams: [],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ teamIds: ['any-team'] });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(1);
    });

    it('allows passage when user has multiple teams and one matches', async () => {
      profiles.set('doc-1', createRightsProfile({
        permittedTeams: ['team-gamma'],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ teamIds: ['team-alpha', 'team-gamma'] });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(1);
    });
  });

  describe('licensing restrictions', () => {
    it('excludes proprietary content from rep users', async () => {
      profiles.set('doc-1', createRightsProfile({
        licensingType: 'proprietary',
        permittedRoles: ['rep', 'manager', 'admin'],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ role: 'rep' });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(0);
    });

    it('allows proprietary content for admin users', async () => {
      profiles.set('doc-1', createRightsProfile({
        licensingType: 'proprietary',
        permittedRoles: ['admin'],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ role: 'admin' });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(1);
    });

    it('excludes internal_only content from rep users', async () => {
      profiles.set('doc-1', createRightsProfile({
        licensingType: 'internal_only',
        permittedRoles: ['rep', 'manager', 'admin'],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ role: 'rep' });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(0);
    });

    it('allows internal_only content for manager users', async () => {
      profiles.set('doc-1', createRightsProfile({
        licensingType: 'internal_only',
        permittedRoles: ['manager', 'admin'],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ role: 'manager' });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(1);
    });

    it('allows creative_commons content for all roles', async () => {
      profiles.set('doc-1', createRightsProfile({
        licensingType: 'creative_commons',
        permittedRoles: ['rep', 'manager', 'admin'],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ role: 'rep' });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(1);
    });

    it('allows fair_use content for all roles', async () => {
      profiles.set('doc-1', createRightsProfile({
        licensingType: 'fair_use',
        permittedRoles: ['rep', 'manager', 'admin'],
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext({ role: 'rep' });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(1);
    });
  });

  describe('attribution text', () => {
    it('includes attribution text in authorized passages', async () => {
      profiles.set('doc-1', createRightsProfile({
        attributionText: 'Source: Sales Framework Book by Author, 2024',
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext();

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(1);
      expect(result[0].attributionText).toBe('Source: Sales Framework Book by Author, 2024');
    });

    it('returns null attribution when profile has no attribution text', async () => {
      profiles.set('doc-1', createRightsProfile({
        attributionText: null,
      }));

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext();

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(1);
      expect(result[0].attributionText).toBeNull();
    });
  });

  describe('caching behavior', () => {
    it('fetches profile from DB on cache miss', async () => {
      profiles.set('doc-1', createRightsProfile());

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext();

      await enforcer.enforce(passages, ctx);

      expect(fetcher).toHaveBeenCalledWith('doc-1');
      expect(cache.set).toHaveBeenCalledWith(
        'rights_profile:doc-1',
        expect.any(String),
        'EX',
        60,
      );
    });

    it('uses cached profile on cache hit (does not call fetcher again)', async () => {
      profiles.set('doc-1', createRightsProfile());

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext();

      // First call — cache miss, fetches from DB
      await enforcer.enforce(passages, ctx);
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Second call — cache hit, should not call fetcher again
      await enforcer.enforce(passages, ctx);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('caches with configurable TTL', async () => {
      const customEnforcer = new RightsEnforcer(cache, fetcher, { cacheTtlSeconds: 30 });
      profiles.set('doc-1', createRightsProfile());

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext();

      await customEnforcer.enforce(passages, ctx);

      expect(cache.set).toHaveBeenCalledWith(
        'rights_profile:doc-1',
        expect.any(String),
        'EX',
        30,
      );
    });
  });

  describe('fail-closed behavior', () => {
    it('excludes passages when no rights profile is found', async () => {
      // No profile registered for doc-1

      const passages = [createPassage({ sourceDocId: 'doc-1' })];
      const ctx = createRightsContext();

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(0);
    });
  });

  describe('mixed passage filtering', () => {
    it('filters a mix of authorized and unauthorized passages', async () => {
      profiles.set('doc-allowed', createRightsProfile({
        permittedRoles: ['rep', 'manager', 'admin'],
        licensingType: 'creative_commons',
      }));
      profiles.set('doc-restricted-role', createRightsProfile({
        permittedRoles: ['admin'],
        licensingType: 'creative_commons',
      }));
      profiles.set('doc-restricted-team', createRightsProfile({
        permittedRoles: ['rep', 'manager', 'admin'],
        permittedTeams: ['team-exclusive'],
        licensingType: 'creative_commons',
      }));
      profiles.set('doc-restricted-license', createRightsProfile({
        permittedRoles: ['rep', 'manager', 'admin'],
        licensingType: 'proprietary',
      }));

      const passages = [
        createPassage({ sourceDocId: 'doc-allowed' }),
        createPassage({ sourceDocId: 'doc-restricted-role' }),
        createPassage({ sourceDocId: 'doc-restricted-team' }),
        createPassage({ sourceDocId: 'doc-restricted-license' }),
      ];

      const ctx = createRightsContext({ role: 'rep', teamIds: ['team-alpha'] });

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(1);
      expect(result[0].sourceDocument.id).toBe('doc-allowed');
    });

    it('preserves passage order in results', async () => {
      profiles.set('doc-a', createRightsProfile({ id: 'profile-a' }));
      profiles.set('doc-b', createRightsProfile({ id: 'profile-b' }));
      profiles.set('doc-c', createRightsProfile({ id: 'profile-c' }));

      const passages = [
        createPassage({ sourceDocId: 'doc-a', score: 0.9 }),
        createPassage({ sourceDocId: 'doc-b', score: 0.8 }),
        createPassage({ sourceDocId: 'doc-c', score: 0.7 }),
      ];

      const ctx = createRightsContext();

      const result = await enforcer.enforce(passages, ctx);
      expect(result).toHaveLength(3);
      expect(result[0].sourceDocument.id).toBe('doc-a');
      expect(result[1].sourceDocument.id).toBe('doc-b');
      expect(result[2].sourceDocument.id).toBe('doc-c');
    });
  });
});
