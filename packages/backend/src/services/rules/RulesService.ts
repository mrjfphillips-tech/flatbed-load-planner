/**
 * Rules Service — CRUD operations and audit logging for flatbed loading rules.
 *
 * When a rule's classification (type) is changed, an audit log entry is created
 * recording the timestamp, user identity, previous type, and new type.
 *
 * Requirements: 4.4, 4.5
 */

import { db, schema } from '../../db/index.js';
import { eq, desc, and } from 'drizzle-orm';
import type { IRulesRepository, RuleRecord, RuleAuditRecord, RuleType } from './RulesRepository.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateRuleInput {
  name: string;
  description?: string;
  type: RuleType;
  conditions?: Record<string, unknown>;
  createdBy: string;
}

export interface UpdateRuleInput {
  name?: string;
  description?: string;
  type?: RuleType;
  conditions?: Record<string, unknown>;
  isActive?: boolean;
}

// ─── Default Drizzle Repository Implementation ────────────────────────────────

class DrizzleRulesRepository implements IRulesRepository {
  async insertRule(data: Omit<RuleRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<RuleRecord> {
    const [rule] = await db
      .insert(schema.flatbedRules)
      .values({
        name: data.name,
        description: data.description,
        type: data.type,
        conditions: data.conditions,
        isActive: data.isActive,
        isDefault: data.isDefault,
        createdBy: data.createdBy,
      })
      .returning();
    return rule as unknown as RuleRecord;
  }

  async getRuleById(ruleId: string): Promise<RuleRecord | null> {
    const [rule] = await db
      .select()
      .from(schema.flatbedRules)
      .where(eq(schema.flatbedRules.id, ruleId));
    return (rule as unknown as RuleRecord) ?? null;
  }

  async listRules(options: { type?: RuleType; isActive?: boolean; limit: number; offset: number }): Promise<RuleRecord[]> {
    const { type, isActive, limit, offset } = options;

    let query = db
      .select()
      .from(schema.flatbedRules)
      .orderBy(desc(schema.flatbedRules.createdAt))
      .limit(limit)
      .offset(offset);

    const conditions = [];
    if (type) conditions.push(eq(schema.flatbedRules.type, type));
    if (isActive !== undefined) conditions.push(eq(schema.flatbedRules.isActive, isActive));

    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions)) as any;
    }

    const rules = await query;
    return rules as unknown as RuleRecord[];
  }

  async updateRule(ruleId: string, data: Partial<Omit<RuleRecord, 'id' | 'createdAt'>>): Promise<RuleRecord | null> {
    const [updated] = await db
      .update(schema.flatbedRules)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(schema.flatbedRules.id, ruleId))
      .returning();
    return (updated as unknown as RuleRecord) ?? null;
  }

  async deleteRule(ruleId: string): Promise<boolean> {
    const result = await db
      .delete(schema.flatbedRules)
      .where(eq(schema.flatbedRules.id, ruleId))
      .returning();
    return result.length > 0;
  }

  async insertAuditLog(data: Omit<RuleAuditRecord, 'id' | 'changedAt'>): Promise<RuleAuditRecord> {
    const [log] = await db
      .insert(schema.ruleAuditLog)
      .values({
        ruleId: data.ruleId,
        changedBy: data.changedBy,
        previousType: data.previousType,
        newType: data.newType,
        changeDescription: data.changeDescription,
      })
      .returning();
    return log as unknown as RuleAuditRecord;
  }

  async getAuditLogByRuleId(ruleId: string): Promise<RuleAuditRecord[]> {
    const logs = await db
      .select()
      .from(schema.ruleAuditLog)
      .where(eq(schema.ruleAuditLog.ruleId, ruleId))
      .orderBy(desc(schema.ruleAuditLog.changedAt));
    return logs as unknown as RuleAuditRecord[];
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class RulesService {
  private repo: IRulesRepository;

  constructor(repo?: IRulesRepository) {
    this.repo = repo ?? new DrizzleRulesRepository();
  }

  /**
   * Create a new custom rule.
   * Requirement 4.5: Administrators can add custom rules with name, description, type, conditions.
   */
  async createRule(input: CreateRuleInput): Promise<RuleRecord> {
    const { name, description, type, conditions, createdBy } = input;

    if (!name || name.trim().length === 0) {
      throw new RuleValidationError('Rule name is required');
    }

    if (!isValidRuleType(type)) {
      throw new RuleValidationError(`Invalid rule type: ${type}. Must be one of: hard_constraint, soft_preference, advisory`);
    }

    const rule = await this.repo.insertRule({
      name: name.trim(),
      description: description?.trim() ?? null,
      type,
      conditions: conditions ?? null,
      isActive: true,
      isDefault: false,
      createdBy,
    });

    return rule;
  }

  /**
   * List all rules, optionally filtered by type or active status.
   */
  async listRules(options?: { type?: RuleType; isActive?: boolean; limit?: number; offset?: number }) {
    const { type, isActive, limit = 100, offset = 0 } = options ?? {};

    const rules = await this.repo.listRules({ type, isActive, limit, offset });
    return { rules, total: rules.length };
  }

  /**
   * Get a single rule by ID.
   */
  async getRule(ruleId: string): Promise<RuleRecord> {
    const rule = await this.repo.getRuleById(ruleId);
    if (!rule) {
      throw new RuleNotFoundError(ruleId);
    }
    return rule;
  }

  /**
   * Update a rule's properties. If the type (classification) is changed,
   * an audit log entry is created.
   *
   * Requirement 4.4: Log classification change with timestamp, user, previous/new type.
   */
  async updateRule(ruleId: string, userId: string, input: UpdateRuleInput): Promise<{ rule: RuleRecord; auditCreated: boolean }> {
    const existingRule = await this.repo.getRuleById(ruleId);

    if (!existingRule) {
      throw new RuleNotFoundError(ruleId);
    }

    if (input.name !== undefined && input.name.trim().length === 0) {
      throw new RuleValidationError('Rule name cannot be empty');
    }

    if (input.type !== undefined && !isValidRuleType(input.type)) {
      throw new RuleValidationError(`Invalid rule type: ${input.type}. Must be one of: hard_constraint, soft_preference, advisory`);
    }

    // Detect classification (type) change for audit logging
    let auditCreated = false;
    if (input.type && input.type !== existingRule.type) {
      await this.repo.insertAuditLog({
        ruleId,
        changedBy: userId,
        previousType: existingRule.type,
        newType: input.type,
        changeDescription: `Classification changed from '${existingRule.type}' to '${input.type}'`,
      });
      auditCreated = true;
    }

    const updateData: Partial<Omit<RuleRecord, 'id' | 'createdAt'>> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.description !== undefined) updateData.description = input.description?.trim() ?? null;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.conditions !== undefined) updateData.conditions = input.conditions;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const updatedRule = await this.repo.updateRule(ruleId, updateData);

    if (!updatedRule) {
      throw new RuleNotFoundError(ruleId);
    }

    return { rule: updatedRule, auditCreated };
  }

  /**
   * Delete a rule. Default rules cannot be deleted.
   */
  async deleteRule(ruleId: string): Promise<void> {
    const rule = await this.repo.getRuleById(ruleId);

    if (!rule) {
      throw new RuleNotFoundError(ruleId);
    }

    if (rule.isDefault) {
      throw new RuleValidationError('Cannot delete a default rule. You may deactivate it instead.');
    }

    const deleted = await this.repo.deleteRule(ruleId);

    if (!deleted) {
      throw new RuleNotFoundError(ruleId);
    }
  }

  /**
   * Get the audit log for a specific rule.
   */
  async getAuditLog(ruleId: string): Promise<RuleAuditRecord[]> {
    const rule = await this.repo.getRuleById(ruleId);
    if (!rule) {
      throw new RuleNotFoundError(ruleId);
    }
    return this.repo.getAuditLogByRuleId(ruleId);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_RULE_TYPES: RuleType[] = ['hard_constraint', 'soft_preference', 'advisory'];

function isValidRuleType(type: string): type is RuleType {
  return VALID_RULE_TYPES.includes(type as RuleType);
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class RuleNotFoundError extends Error {
  public statusCode = 404;
  constructor(ruleId: string) {
    super(`Rule not found: ${ruleId}`);
    this.name = 'RuleNotFoundError';
  }
}

export class RuleValidationError extends Error {
  public statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'RuleValidationError';
  }
}
