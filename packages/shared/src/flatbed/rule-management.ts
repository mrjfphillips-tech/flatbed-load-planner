// ─── OptiFlow Flatbed Steel Load Planner — Rule Management ──────────────────
// Provides CRUD operations for custom rules, classification change auditing,
// and rule summary presentation for planner acknowledgment.
// All functions are pure — they return new objects rather than mutating inputs.

import type { Rule, RuleContext, RuleResult } from './rules';
import type { RuleType } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A custom rule extends Rule with creation and modification metadata */
export interface CustomRule extends Rule {
  createdBy: string;
  createdAt: Date;
  modifiedAt: Date;
}

/** Audit entry for a rule classification change */
export interface RuleClassificationChange {
  ruleId: string;
  previousType: RuleType;
  newType: RuleType;
  changedBy: string;
  changedAt: Date;
  reason: string;
}

/** A summary of rules grouped by type for planner acknowledgment */
export interface RuleSummary {
  hardConstraints: { id: string; name: string; description: string }[];
  softPreferences: { id: string; name: string; description: string }[];
  advisoryRules: { id: string; name: string; description: string }[];
  totalCount: number;
}

/** The complete rule set containing default rules, custom rules, and audit log */
export interface RuleSet {
  defaultRules: Rule[];
  customRules: CustomRule[];
  auditLog: RuleClassificationChange[];
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

/** Parameters for creating a custom rule */
export interface CreateCustomRuleParams {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  createdBy: string;
  evaluate: (context: RuleContext) => RuleResult;
  isApplicable?: (context: RuleContext) => boolean;
}

// ─── Rule Set Factory ────────────────────────────────────────────────────────

/**
 * Creates an initial RuleSet from a set of default rules.
 */
export function createRuleSet(defaultRules: Rule[]): RuleSet {
  return {
    defaultRules: [...defaultRules],
    customRules: [],
    auditLog: [],
    acknowledged: false,
  };
}

// ─── Custom Rule CRUD ────────────────────────────────────────────────────────

/**
 * Creates a new custom rule and adds it to the rule set.
 * Returns the updated rule set with the new custom rule appended.
 *
 * @param ruleSet - The current rule set (immutable, not modified)
 * @param params - Parameters for the new custom rule
 * @returns A new RuleSet with the custom rule added
 * @throws Error if a rule with the same ID already exists
 */
export function createCustomRule(ruleSet: RuleSet, params: CreateCustomRuleParams): RuleSet {
  const allRuleIds = getAllRuleIds(ruleSet);
  if (allRuleIds.has(params.id)) {
    throw new Error(`A rule with ID "${params.id}" already exists.`);
  }

  if (!params.name.trim()) {
    throw new Error('Rule name is required.');
  }

  if (!params.description.trim()) {
    throw new Error('Rule description is required.');
  }

  const now = new Date();
  const newRule: CustomRule = {
    id: params.id,
    name: params.name,
    description: params.description,
    type: params.type,
    createdBy: params.createdBy,
    createdAt: now,
    modifiedAt: now,
    evaluate: params.evaluate,
    isApplicable: params.isApplicable ?? (() => true),
  };

  return {
    ...ruleSet,
    customRules: [...ruleSet.customRules, newRule],
    acknowledged: false, // Adding a rule invalidates acknowledgment
  };
}

/**
 * Removes a custom rule from the rule set.
 * Cannot remove default rules — only custom rules may be removed.
 *
 * @param ruleSet - The current rule set
 * @param ruleId - ID of the custom rule to remove
 * @returns A new RuleSet with the specified rule removed
 * @throws Error if the rule is a default rule or does not exist
 */
export function removeCustomRule(ruleSet: RuleSet, ruleId: string): RuleSet {
  const isDefault = ruleSet.defaultRules.some((r) => r.id === ruleId);
  if (isDefault) {
    throw new Error(`Cannot remove default rule "${ruleId}". Only custom rules may be removed.`);
  }

  const existsInCustom = ruleSet.customRules.some((r) => r.id === ruleId);
  if (!existsInCustom) {
    throw new Error(`Custom rule "${ruleId}" not found.`);
  }

  return {
    ...ruleSet,
    customRules: ruleSet.customRules.filter((r) => r.id !== ruleId),
    acknowledged: false, // Removing a rule invalidates acknowledgment
  };
}

// ─── Rule Classification Change ──────────────────────────────────────────────

/**
 * Changes the classification (type) of a rule with audit logging.
 * Works on both default and custom rules.
 *
 * @param ruleSet - The current rule set
 * @param ruleId - ID of the rule to reclassify
 * @param newType - The new rule classification
 * @param changedBy - User identity making the change
 * @param reason - Justification for the reclassification
 * @returns A new RuleSet with the reclassified rule and audit entry
 * @throws Error if the rule does not exist or newType equals current type
 */
export function updateRuleClassification(
  ruleSet: RuleSet,
  ruleId: string,
  newType: RuleType,
  changedBy: string,
  reason: string
): RuleSet {
  if (!changedBy.trim()) {
    throw new Error('changedBy is required for audit logging.');
  }

  if (!reason.trim()) {
    throw new Error('A reason is required when changing rule classification.');
  }

  // Find the rule in either default or custom rules
  const defaultRule = ruleSet.defaultRules.find((r) => r.id === ruleId);
  const customRule = ruleSet.customRules.find((r) => r.id === ruleId);
  const rule = defaultRule ?? customRule;

  if (!rule) {
    throw new Error(`Rule "${ruleId}" not found.`);
  }

  if (rule.type === newType) {
    throw new Error(
      `Rule "${ruleId}" is already classified as "${newType}". No change needed.`
    );
  }

  const now = new Date();
  const auditEntry: RuleClassificationChange = {
    ruleId,
    previousType: rule.type,
    newType,
    changedBy,
    changedAt: now,
    reason,
  };

  // Update the rule in the appropriate collection
  let updatedDefaultRules = ruleSet.defaultRules;
  let updatedCustomRules = ruleSet.customRules;

  if (defaultRule) {
    updatedDefaultRules = ruleSet.defaultRules.map((r) =>
      r.id === ruleId ? { ...r, type: newType } : r
    );
  } else {
    updatedCustomRules = ruleSet.customRules.map((r) =>
      r.id === ruleId
        ? { ...r, type: newType, modifiedAt: now }
        : r
    );
  }

  return {
    ...ruleSet,
    defaultRules: updatedDefaultRules,
    customRules: updatedCustomRules,
    auditLog: [...ruleSet.auditLog, auditEntry],
    acknowledged: false, // Classification change invalidates acknowledgment
  };
}

// ─── Rule Summary ────────────────────────────────────────────────────────────

/**
 * Produces a summary of all rules grouped by type for planner acknowledgment.
 * This summary is presented to the planner before load plan generation.
 *
 * @param ruleSet - The current rule set
 * @returns A structured summary with rules categorized by type
 */
export function getRuleSummary(ruleSet: RuleSet): RuleSummary {
  const allRules = getAllRules(ruleSet);

  const hardConstraints = allRules
    .filter((r) => r.type === 'hard_constraint')
    .map((r) => ({ id: r.id, name: r.name, description: r.description }));

  const softPreferences = allRules
    .filter((r) => r.type === 'soft_preference')
    .map((r) => ({ id: r.id, name: r.name, description: r.description }));

  const advisoryRules = allRules
    .filter((r) => r.type === 'advisory')
    .map((r) => ({ id: r.id, name: r.name, description: r.description }));

  return {
    hardConstraints,
    softPreferences,
    advisoryRules,
    totalCount: allRules.length,
  };
}

// ─── Rule Acknowledgment ─────────────────────────────────────────────────────

/**
 * Marks the rule set as acknowledged by the planner.
 * This is required before load plan generation can proceed.
 *
 * @param ruleSet - The current rule set
 * @param acknowledgedBy - The user acknowledging the rules
 * @returns A new RuleSet with acknowledged=true
 */
export function acknowledgeRules(ruleSet: RuleSet, acknowledgedBy: string): RuleSet {
  if (!acknowledgedBy.trim()) {
    throw new Error('acknowledgedBy is required.');
  }

  return {
    ...ruleSet,
    acknowledged: true,
    acknowledgedAt: new Date(),
    acknowledgedBy,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns all rules (default + custom) as a flat array.
 */
export function getAllRules(ruleSet: RuleSet): Rule[] {
  return [...ruleSet.defaultRules, ...ruleSet.customRules];
}

/**
 * Returns a Set of all rule IDs in the rule set.
 */
function getAllRuleIds(ruleSet: RuleSet): Set<string> {
  return new Set([
    ...ruleSet.defaultRules.map((r) => r.id),
    ...ruleSet.customRules.map((r) => r.id),
  ]);
}
