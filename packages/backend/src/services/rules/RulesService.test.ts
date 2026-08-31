/**
 * Unit Tests for RulesService — CRUD operations and audit logging for flatbed loading rules.
 *
 * Validates: Requirements 4.4, 4.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database module to prevent PostgreSQL connection attempts
vi.mock('../../db/index.js', () => ({
  db: {},
  schema: { flatbedRules: {}, ruleAuditLog: {} },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
}));

import {
  RulesService,
  RuleNotFoundError,
  RuleValidationError,
} from './RulesService.js';
import type { IRulesRepository, RuleRecord, RuleAuditRecord, RuleType } from './RulesRepository.js';

// ─── In-Memory Repository ─────────────────────────────────────────────────────

class InMemoryRulesRepository implements IRulesRepository {
  rules: RuleRecord[] = [];
  auditLogs: RuleAuditRecord[] = [];
  private idSeq = 0;
  private nextId() { return `rule-${++this.idSeq}`; }

  async insertRule(data: Omit<RuleRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<RuleRecord> {
    const rule: RuleRecord = {
      ...data,
      id: this.nextId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rules.push(rule);
    return rule;
  }

  async getRuleById(ruleId: string): Promise<RuleRecord | null> {
    return this.rules.find(r => r.id === ruleId) ?? null;
  }

  async listRules(options: { type?: RuleType; isActive?: boolean; limit: number; offset: number }): Promise<RuleRecord[]> {
    let result = [...this.rules];
    if (options.type) result = result.filter(r => r.type === options.type);
    if (options.isActive !== undefined) result = result.filter(r => r.isActive === options.isActive);
    return result.slice(options.offset, options.offset + options.limit);
  }

  async updateRule(ruleId: string, data: Partial<Omit<RuleRecord, 'id' | 'createdAt'>>): Promise<RuleRecord | null> {
    const idx = this.rules.findIndex(r => r.id === ruleId);
    if (idx === -1) return null;
    this.rules[idx] = { ...this.rules[idx], ...data, updatedAt: new Date() };
    return this.rules[idx];
  }

  async deleteRule(ruleId: string): Promise<boolean> {
    const idx = this.rules.findIndex(r => r.id === ruleId);
    if (idx === -1) return false;
    this.rules.splice(idx, 1);
    return true;
  }

  async insertAuditLog(data: Omit<RuleAuditRecord, 'id' | 'changedAt'>): Promise<RuleAuditRecord> {
    const log: RuleAuditRecord = {
      ...data,
      id: `audit-${++this.idSeq}`,
      changedAt: new Date(),
    };
    this.auditLogs.push(log);
    return log;
  }

  async getAuditLogByRuleId(ruleId: string): Promise<RuleAuditRecord[]> {
    return this.auditLogs
      .filter(l => l.ruleId === ruleId)
      .sort((a, b) => {
        // Sort by changedAt descending, using ID as tiebreaker for same-millisecond entries
        const timeDiff = b.changedAt.getTime() - a.changedAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        // Higher ID sequence number = more recent
        const aNum = parseInt(a.id.replace('audit-', ''), 10);
        const bNum = parseInt(b.id.replace('audit-', ''), 10);
        return bNum - aNum;
      });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultCreateInput() {
  return {
    name: 'Max Axle Weight',
    description: 'Ensure no axle exceeds legal weight limit',
    type: 'hard_constraint' as RuleType,
    conditions: { maxWeight: 34000 },
    createdBy: 'admin-1',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RulesService', () => {
  let repo: InMemoryRulesRepository;
  let service: RulesService;

  beforeEach(() => {
    repo = new InMemoryRulesRepository();
    service = new RulesService(repo);
  });

  // ─── Create Rule ────────────────────────────────────────────────────────────

  describe('createRule', () => {
    it('creates a rule with the provided attributes (Req 4.5)', async () => {
      const rule = await service.createRule(defaultCreateInput());

      expect(rule).toBeDefined();
      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('Max Axle Weight');
      expect(rule.description).toBe('Ensure no axle exceeds legal weight limit');
      expect(rule.type).toBe('hard_constraint');
      expect(rule.conditions).toEqual({ maxWeight: 34000 });
      expect(rule.isActive).toBe(true);
      expect(rule.isDefault).toBe(false);
      expect(rule.createdBy).toBe('admin-1');
    });

    it('trims whitespace from name and description', async () => {
      const rule = await service.createRule({
        ...defaultCreateInput(),
        name: '  Trimmed Name  ',
        description: '  Trimmed Description  ',
      });

      expect(rule.name).toBe('Trimmed Name');
      expect(rule.description).toBe('Trimmed Description');
    });

    it('allows creation without optional fields (description, conditions)', async () => {
      const rule = await service.createRule({
        name: 'Simple Rule',
        type: 'advisory',
        createdBy: 'admin-1',
      });

      expect(rule.name).toBe('Simple Rule');
      expect(rule.type).toBe('advisory');
      expect(rule.description).toBeNull();
      expect(rule.conditions).toBeNull();
    });

    it('throws RuleValidationError for empty name', async () => {
      await expect(
        service.createRule({ ...defaultCreateInput(), name: '' })
      ).rejects.toThrow(RuleValidationError);

      await expect(
        service.createRule({ ...defaultCreateInput(), name: '   ' })
      ).rejects.toThrow(RuleValidationError);
    });

    it('throws RuleValidationError for invalid rule type', async () => {
      await expect(
        service.createRule({ ...defaultCreateInput(), type: 'invalid_type' as RuleType })
      ).rejects.toThrow(RuleValidationError);
    });

    it('accepts all three valid rule types', async () => {
      const types: RuleType[] = ['hard_constraint', 'soft_preference', 'advisory'];

      for (const type of types) {
        const rule = await service.createRule({ ...defaultCreateInput(), name: `Rule ${type}`, type });
        expect(rule.type).toBe(type);
      }
    });
  });

  // ─── List Rules ─────────────────────────────────────────────────────────────

  describe('listRules', () => {
    it('returns all rules when no filters applied', async () => {
      await service.createRule(defaultCreateInput());
      await service.createRule({ ...defaultCreateInput(), name: 'Rule 2', type: 'soft_preference' });

      const result = await service.listRules();

      expect(result.rules.length).toBe(2);
    });

    it('filters rules by type', async () => {
      await service.createRule(defaultCreateInput()); // hard_constraint
      await service.createRule({ ...defaultCreateInput(), name: 'Soft', type: 'soft_preference' });
      await service.createRule({ ...defaultCreateInput(), name: 'Advisory', type: 'advisory' });

      const result = await service.listRules({ type: 'hard_constraint' });

      expect(result.rules.length).toBe(1);
      expect(result.rules[0].type).toBe('hard_constraint');
    });

    it('filters rules by active status', async () => {
      await service.createRule(defaultCreateInput());
      const rule2 = await service.createRule({ ...defaultCreateInput(), name: 'Rule 2' });

      // Deactivate rule2
      await service.updateRule(rule2.id, 'admin-1', { isActive: false });

      const activeResult = await service.listRules({ isActive: true });
      expect(activeResult.rules.length).toBe(1);

      const inactiveResult = await service.listRules({ isActive: false });
      expect(inactiveResult.rules.length).toBe(1);
    });

    it('respects limit and offset for pagination', async () => {
      await service.createRule({ ...defaultCreateInput(), name: 'Rule 1' });
      await service.createRule({ ...defaultCreateInput(), name: 'Rule 2' });
      await service.createRule({ ...defaultCreateInput(), name: 'Rule 3' });

      const result = await service.listRules({ limit: 2, offset: 1 });

      expect(result.rules.length).toBe(2);
    });

    it('returns empty array when no rules exist', async () => {
      const result = await service.listRules();

      expect(result.rules).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ─── Get Rule ───────────────────────────────────────────────────────────────

  describe('getRule', () => {
    it('retrieves a rule by ID', async () => {
      const created = await service.createRule(defaultCreateInput());

      const rule = await service.getRule(created.id);

      expect(rule.id).toBe(created.id);
      expect(rule.name).toBe('Max Axle Weight');
    });

    it('throws RuleNotFoundError for non-existent rule', async () => {
      await expect(service.getRule('non-existent')).rejects.toThrow(RuleNotFoundError);
    });
  });

  // ─── Update Rule ────────────────────────────────────────────────────────────

  describe('updateRule', () => {
    it('updates rule name and description', async () => {
      const created = await service.createRule(defaultCreateInput());

      const { rule } = await service.updateRule(created.id, 'admin-1', {
        name: 'Updated Name',
        description: 'Updated Description',
      });

      expect(rule.name).toBe('Updated Name');
      expect(rule.description).toBe('Updated Description');
    });

    it('updates rule conditions', async () => {
      const created = await service.createRule(defaultCreateInput());

      const { rule } = await service.updateRule(created.id, 'admin-1', {
        conditions: { maxWeight: 40000, threshold: 0.95 },
      });

      expect(rule.conditions).toEqual({ maxWeight: 40000, threshold: 0.95 });
    });

    it('deactivates a rule via isActive flag', async () => {
      const created = await service.createRule(defaultCreateInput());

      const { rule } = await service.updateRule(created.id, 'admin-1', {
        isActive: false,
      });

      expect(rule.isActive).toBe(false);
    });

    it('throws RuleNotFoundError for non-existent rule', async () => {
      await expect(
        service.updateRule('non-existent', 'admin-1', { name: 'New' })
      ).rejects.toThrow(RuleNotFoundError);
    });

    it('throws RuleValidationError for empty name', async () => {
      const created = await service.createRule(defaultCreateInput());

      await expect(
        service.updateRule(created.id, 'admin-1', { name: '' })
      ).rejects.toThrow(RuleValidationError);
    });

    it('throws RuleValidationError for invalid type', async () => {
      const created = await service.createRule(defaultCreateInput());

      await expect(
        service.updateRule(created.id, 'admin-1', { type: 'bogus' as RuleType })
      ).rejects.toThrow(RuleValidationError);
    });
  });

  // ─── Classification Change Audit Logging (Req 4.4) ─────────────────────────

  describe('updateRule — classification change audit logging', () => {
    it('creates an audit log entry when type is changed (Req 4.4)', async () => {
      const created = await service.createRule(defaultCreateInput()); // hard_constraint

      const { rule, auditCreated } = await service.updateRule(created.id, 'admin-1', {
        type: 'soft_preference',
      });

      expect(auditCreated).toBe(true);
      expect(rule.type).toBe('soft_preference');

      // Verify audit log was created
      const auditLog = await service.getAuditLog(created.id);
      expect(auditLog.length).toBe(1);
      expect(auditLog[0].ruleId).toBe(created.id);
      expect(auditLog[0].changedBy).toBe('admin-1');
      expect(auditLog[0].previousType).toBe('hard_constraint');
      expect(auditLog[0].newType).toBe('soft_preference');
      expect(auditLog[0].changedAt).toBeInstanceOf(Date);
    });

    it('does not create an audit log when type is not changed', async () => {
      const created = await service.createRule(defaultCreateInput());

      const { auditCreated } = await service.updateRule(created.id, 'admin-1', {
        name: 'Renamed Rule',
      });

      expect(auditCreated).toBe(false);

      const auditLog = await service.getAuditLog(created.id);
      expect(auditLog.length).toBe(0);
    });

    it('does not create an audit log when type is set to same value', async () => {
      const created = await service.createRule(defaultCreateInput()); // hard_constraint

      const { auditCreated } = await service.updateRule(created.id, 'admin-1', {
        type: 'hard_constraint', // same as current
      });

      expect(auditCreated).toBe(false);

      const auditLog = await service.getAuditLog(created.id);
      expect(auditLog.length).toBe(0);
    });

    it('records multiple classification changes in order', async () => {
      const created = await service.createRule(defaultCreateInput()); // hard_constraint

      // Change hard_constraint → soft_preference
      await service.updateRule(created.id, 'admin-1', { type: 'soft_preference' });

      // Change soft_preference → advisory
      await service.updateRule(created.id, 'admin-2', { type: 'advisory' });

      // Change advisory → hard_constraint
      await service.updateRule(created.id, 'admin-1', { type: 'hard_constraint' });

      const auditLog = await service.getAuditLog(created.id);
      expect(auditLog.length).toBe(3);

      // Most recent first (sorted by changedAt descending)
      expect(auditLog[0].previousType).toBe('advisory');
      expect(auditLog[0].newType).toBe('hard_constraint');
      expect(auditLog[0].changedBy).toBe('admin-1');

      expect(auditLog[1].previousType).toBe('soft_preference');
      expect(auditLog[1].newType).toBe('advisory');
      expect(auditLog[1].changedBy).toBe('admin-2');

      expect(auditLog[2].previousType).toBe('hard_constraint');
      expect(auditLog[2].newType).toBe('soft_preference');
      expect(auditLog[2].changedBy).toBe('admin-1');
    });

    it('includes a description of the classification change', async () => {
      const created = await service.createRule(defaultCreateInput());

      await service.updateRule(created.id, 'admin-1', { type: 'advisory' });

      const auditLog = await service.getAuditLog(created.id);
      expect(auditLog[0].changeDescription).toContain('hard_constraint');
      expect(auditLog[0].changeDescription).toContain('advisory');
    });
  });

  // ─── Delete Rule ────────────────────────────────────────────────────────────

  describe('deleteRule', () => {
    it('deletes a custom rule', async () => {
      const created = await service.createRule(defaultCreateInput());

      await service.deleteRule(created.id);

      await expect(service.getRule(created.id)).rejects.toThrow(RuleNotFoundError);
    });

    it('throws RuleNotFoundError for non-existent rule', async () => {
      await expect(service.deleteRule('non-existent')).rejects.toThrow(RuleNotFoundError);
    });

    it('throws RuleValidationError when trying to delete a default rule', async () => {
      // Manually insert a default rule into the repo
      repo.rules.push({
        id: 'default-rule-1',
        name: 'Default Axle Rule',
        description: 'Built-in rule',
        type: 'hard_constraint',
        conditions: null,
        isActive: true,
        isDefault: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.deleteRule('default-rule-1')).rejects.toThrow(RuleValidationError);
      await expect(service.deleteRule('default-rule-1')).rejects.toThrow(/default rule/i);
    });
  });

  // ─── Get Audit Log ──────────────────────────────────────────────────────────

  describe('getAuditLog', () => {
    it('returns audit log for a rule', async () => {
      const created = await service.createRule(defaultCreateInput());

      await service.updateRule(created.id, 'admin-1', { type: 'advisory' });

      const log = await service.getAuditLog(created.id);

      expect(log.length).toBe(1);
      expect(log[0].ruleId).toBe(created.id);
    });

    it('returns empty array for a rule with no classification changes', async () => {
      const created = await service.createRule(defaultCreateInput());

      const log = await service.getAuditLog(created.id);

      expect(log).toEqual([]);
    });

    it('throws RuleNotFoundError for non-existent rule', async () => {
      await expect(service.getAuditLog('non-existent')).rejects.toThrow(RuleNotFoundError);
    });
  });

  // ─── Error Classes ──────────────────────────────────────────────────────────

  describe('error classes', () => {
    it('RuleNotFoundError has statusCode 404', () => {
      const err = new RuleNotFoundError('abc-123');
      expect(err.statusCode).toBe(404);
      expect(err.message).toContain('abc-123');
      expect(err.name).toBe('RuleNotFoundError');
    });

    it('RuleValidationError has statusCode 400', () => {
      const err = new RuleValidationError('Bad input');
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Bad input');
      expect(err.name).toBe('RuleValidationError');
    });
  });
});
