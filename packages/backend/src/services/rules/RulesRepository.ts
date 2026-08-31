/**
 * Rules Repository — Data access interface for Rules Service.
 *
 * Abstracts database operations to enable testing with in-memory implementations.
 */

export type RuleType = 'hard_constraint' | 'soft_preference' | 'advisory';

export interface RuleRecord {
  id: string;
  name: string;
  description: string | null;
  type: RuleType;
  conditions: Record<string, unknown> | null;
  isActive: boolean;
  isDefault: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleAuditRecord {
  id: string;
  ruleId: string;
  changedBy: string;
  previousType: RuleType;
  newType: RuleType;
  changeDescription: string | null;
  changedAt: Date;
}

export interface IRulesRepository {
  insertRule(data: Omit<RuleRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<RuleRecord>;
  getRuleById(ruleId: string): Promise<RuleRecord | null>;
  listRules(options: { type?: RuleType; isActive?: boolean; limit: number; offset: number }): Promise<RuleRecord[]>;
  updateRule(ruleId: string, data: Partial<Omit<RuleRecord, 'id' | 'createdAt'>>): Promise<RuleRecord | null>;
  deleteRule(ruleId: string): Promise<boolean>;
  insertAuditLog(data: Omit<RuleAuditRecord, 'id' | 'changedAt'>): Promise<RuleAuditRecord>;
  getAuditLogByRuleId(ruleId: string): Promise<RuleAuditRecord[]>;
}
