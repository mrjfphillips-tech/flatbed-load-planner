// ─── Rule Management Unit Tests ──────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  createRuleSet,
  createCustomRule,
  removeCustomRule,
  updateRuleClassification,
  getRuleSummary,
  acknowledgeRules,
  getAllRules,
} from './rule-management';
import type { RuleSet, CreateCustomRuleParams } from './rule-management';
import type { Rule, RuleContext, RuleResult } from './rules';
import { defaultRules } from './rules';
import type { RuleType } from './types';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makePassingEvaluate() {
  return (ctx: RuleContext): RuleResult => ({
    passed: true,
    ruleId: 'test',
    ruleType: 'advisory',
    severity: 'info',
    message: 'Test rule passed.',
    affectedItems: [],
  });
}

function makeCustomRuleParams(overrides: Partial<CreateCustomRuleParams> = {}): CreateCustomRuleParams {
  return {
    id: 'custom_test_rule',
    name: 'Test Custom Rule',
    description: 'A custom rule for testing purposes.',
    type: 'advisory',
    createdBy: 'admin@example.com',
    evaluate: makePassingEvaluate(),
    ...overrides,
  };
}

function makeRuleSetWithDefaults(): RuleSet {
  return createRuleSet(defaultRules);
}

// ─── createRuleSet Tests ─────────────────────────────────────────────────────

describe('createRuleSet', () => {
  it('creates a rule set from default rules', () => {
    const ruleSet = createRuleSet(defaultRules);
    expect(ruleSet.defaultRules).toHaveLength(defaultRules.length);
    expect(ruleSet.customRules).toHaveLength(0);
    expect(ruleSet.auditLog).toHaveLength(0);
    expect(ruleSet.acknowledged).toBe(false);
  });

  it('does not mutate the original default rules array', () => {
    const original = [...defaultRules];
    const ruleSet = createRuleSet(defaultRules);
    ruleSet.defaultRules.push(ruleSet.defaultRules[0]);
    expect(defaultRules).toHaveLength(original.length);
  });
});

// ─── createCustomRule Tests ──────────────────────────────────────────────────

describe('createCustomRule', () => {
  it('adds a custom rule to the rule set', () => {
    const ruleSet = makeRuleSetWithDefaults();
    const updated = createCustomRule(ruleSet, makeCustomRuleParams());
    expect(updated.customRules).toHaveLength(1);
    expect(updated.customRules[0].id).toBe('custom_test_rule');
    expect(updated.customRules[0].name).toBe('Test Custom Rule');
    expect(updated.customRules[0].type).toBe('advisory');
    expect(updated.customRules[0].createdBy).toBe('admin@example.com');
  });

  it('sets createdAt and modifiedAt timestamps', () => {
    const ruleSet = makeRuleSetWithDefaults();
    const updated = createCustomRule(ruleSet, makeCustomRuleParams());
    const rule = updated.customRules[0];
    expect(rule.createdAt).toBeInstanceOf(Date);
    expect(rule.modifiedAt).toBeInstanceOf(Date);
    expect(rule.createdAt.getTime()).toBe(rule.modifiedAt.getTime());
  });

  it('invalidates acknowledgment when a rule is added', () => {
    let ruleSet = makeRuleSetWithDefaults();
    ruleSet = acknowledgeRules(ruleSet, 'planner@example.com');
    expect(ruleSet.acknowledged).toBe(true);

    const updated = createCustomRule(ruleSet, makeCustomRuleParams());
    expect(updated.acknowledged).toBe(false);
  });

  it('throws when a rule with duplicate ID exists in defaults', () => {
    const ruleSet = makeRuleSetWithDefaults();
    expect(() =>
      createCustomRule(ruleSet, makeCustomRuleParams({ id: 'hard_axle_overweight' }))
    ).toThrow('already exists');
  });

  it('throws when a rule with duplicate ID exists in custom rules', () => {
    let ruleSet = makeRuleSetWithDefaults();
    ruleSet = createCustomRule(ruleSet, makeCustomRuleParams({ id: 'my_rule' }));
    expect(() =>
      createCustomRule(ruleSet, makeCustomRuleParams({ id: 'my_rule' }))
    ).toThrow('already exists');
  });

  it('throws when name is empty', () => {
    const ruleSet = makeRuleSetWithDefaults();
    expect(() =>
      createCustomRule(ruleSet, makeCustomRuleParams({ name: '  ' }))
    ).toThrow('name is required');
  });

  it('throws when description is empty', () => {
    const ruleSet = makeRuleSetWithDefaults();
    expect(() =>
      createCustomRule(ruleSet, makeCustomRuleParams({ description: '' }))
    ).toThrow('description is required');
  });

  it('does not mutate the original rule set', () => {
    const ruleSet = makeRuleSetWithDefaults();
    const updated = createCustomRule(ruleSet, makeCustomRuleParams());
    expect(ruleSet.customRules).toHaveLength(0);
    expect(updated.customRules).toHaveLength(1);
  });

  it('defaults isApplicable to always-true when not provided', () => {
    const ruleSet = makeRuleSetWithDefaults();
    const params = makeCustomRuleParams();
    delete (params as any).isApplicable;
    const updated = createCustomRule(ruleSet, params);
    const rule = updated.customRules[0];
    expect(rule.isApplicable({} as RuleContext)).toBe(true);
  });

  it('supports all three rule types', () => {
    let ruleSet = makeRuleSetWithDefaults();
    const types: RuleType[] = ['hard_constraint', 'soft_preference', 'advisory'];
    for (const type of types) {
      ruleSet = createCustomRule(ruleSet, makeCustomRuleParams({
        id: `custom_${type}`,
        type,
      }));
    }
    expect(ruleSet.customRules).toHaveLength(3);
    expect(ruleSet.customRules.map((r) => r.type)).toEqual(types);
  });
});

// ─── removeCustomRule Tests ──────────────────────────────────────────────────

describe('removeCustomRule', () => {
  it('removes a custom rule by ID', () => {
    let ruleSet = makeRuleSetWithDefaults();
    ruleSet = createCustomRule(ruleSet, makeCustomRuleParams({ id: 'to_remove' }));
    expect(ruleSet.customRules).toHaveLength(1);

    const updated = removeCustomRule(ruleSet, 'to_remove');
    expect(updated.customRules).toHaveLength(0);
  });

  it('throws when trying to remove a default rule', () => {
    const ruleSet = makeRuleSetWithDefaults();
    expect(() => removeCustomRule(ruleSet, 'hard_axle_overweight')).toThrow(
      'Cannot remove default rule'
    );
  });

  it('throws when the custom rule does not exist', () => {
    const ruleSet = makeRuleSetWithDefaults();
    expect(() => removeCustomRule(ruleSet, 'nonexistent')).toThrow('not found');
  });

  it('invalidates acknowledgment when a rule is removed', () => {
    let ruleSet = makeRuleSetWithDefaults();
    ruleSet = createCustomRule(ruleSet, makeCustomRuleParams({ id: 'temp_rule' }));
    ruleSet = acknowledgeRules(ruleSet, 'planner@example.com');
    expect(ruleSet.acknowledged).toBe(true);

    const updated = removeCustomRule(ruleSet, 'temp_rule');
    expect(updated.acknowledged).toBe(false);
  });

  it('does not mutate the original rule set', () => {
    let ruleSet = makeRuleSetWithDefaults();
    ruleSet = createCustomRule(ruleSet, makeCustomRuleParams({ id: 'keep_me' }));
    const updated = removeCustomRule(ruleSet, 'keep_me');
    expect(ruleSet.customRules).toHaveLength(1);
    expect(updated.customRules).toHaveLength(0);
  });
});

// ─── updateRuleClassification Tests ──────────────────────────────────────────

describe('updateRuleClassification', () => {
  it('changes classification of a default rule', () => {
    const ruleSet = makeRuleSetWithDefaults();
    const updated = updateRuleClassification(
      ruleSet,
      'soft_heavier_lower',
      'advisory',
      'admin@example.com',
      'Downgrading to advisory per team decision'
    );

    const rule = updated.defaultRules.find((r) => r.id === 'soft_heavier_lower');
    expect(rule?.type).toBe('advisory');
  });

  it('changes classification of a custom rule', () => {
    let ruleSet = makeRuleSetWithDefaults();
    ruleSet = createCustomRule(ruleSet, makeCustomRuleParams({
      id: 'custom_advisory',
      type: 'advisory',
    }));

    const updated = updateRuleClassification(
      ruleSet,
      'custom_advisory',
      'hard_constraint',
      'admin@example.com',
      'Promoting to hard constraint for safety'
    );

    const rule = updated.customRules.find((r) => r.id === 'custom_advisory');
    expect(rule?.type).toBe('hard_constraint');
  });

  it('creates an audit log entry with correct fields', () => {
    const ruleSet = makeRuleSetWithDefaults();
    const updated = updateRuleClassification(
      ruleSet,
      'soft_cg_position',
      'hard_constraint',
      'admin@example.com',
      'Regulatory requirement change'
    );

    expect(updated.auditLog).toHaveLength(1);
    const entry = updated.auditLog[0];
    expect(entry.ruleId).toBe('soft_cg_position');
    expect(entry.previousType).toBe('soft_preference');
    expect(entry.newType).toBe('hard_constraint');
    expect(entry.changedBy).toBe('admin@example.com');
    expect(entry.changedAt).toBeInstanceOf(Date);
    expect(entry.reason).toBe('Regulatory requirement change');
  });

  it('appends to existing audit log without overwriting', () => {
    let ruleSet = makeRuleSetWithDefaults();
    ruleSet = updateRuleClassification(
      ruleSet,
      'soft_cg_position',
      'hard_constraint',
      'admin@example.com',
      'First change'
    );
    ruleSet = updateRuleClassification(
      ruleSet,
      'soft_lateral_imbalance',
      'advisory',
      'admin@example.com',
      'Second change'
    );

    expect(ruleSet.auditLog).toHaveLength(2);
    expect(ruleSet.auditLog[0].ruleId).toBe('soft_cg_position');
    expect(ruleSet.auditLog[1].ruleId).toBe('soft_lateral_imbalance');
  });

  it('updates modifiedAt on custom rules', () => {
    let ruleSet = makeRuleSetWithDefaults();
    ruleSet = createCustomRule(ruleSet, makeCustomRuleParams({
      id: 'updatable',
      type: 'advisory',
    }));
    const originalModifiedAt = ruleSet.customRules[0].modifiedAt;

    // Small delay to ensure timestamp difference
    const updated = updateRuleClassification(
      ruleSet,
      'updatable',
      'soft_preference',
      'admin@example.com',
      'Upgrading'
    );

    const rule = updated.customRules.find((r) => r.id === 'updatable');
    expect(rule?.modifiedAt.getTime()).toBeGreaterThanOrEqual(originalModifiedAt.getTime());
  });

  it('invalidates acknowledgment on classification change', () => {
    let ruleSet = makeRuleSetWithDefaults();
    ruleSet = acknowledgeRules(ruleSet, 'planner@example.com');
    expect(ruleSet.acknowledged).toBe(true);

    const updated = updateRuleClassification(
      ruleSet,
      'soft_heavier_lower',
      'advisory',
      'admin@example.com',
      'Testing'
    );
    expect(updated.acknowledged).toBe(false);
  });

  it('throws when rule does not exist', () => {
    const ruleSet = makeRuleSetWithDefaults();
    expect(() =>
      updateRuleClassification(ruleSet, 'nonexistent', 'advisory', 'admin', 'reason')
    ).toThrow('not found');
  });

  it('throws when newType equals current type', () => {
    const ruleSet = makeRuleSetWithDefaults();
    expect(() =>
      updateRuleClassification(
        ruleSet,
        'hard_axle_overweight',
        'hard_constraint',
        'admin',
        'no change'
      )
    ).toThrow('already classified');
  });

  it('throws when changedBy is empty', () => {
    const ruleSet = makeRuleSetWithDefaults();
    expect(() =>
      updateRuleClassification(ruleSet, 'soft_heavier_lower', 'advisory', '  ', 'reason')
    ).toThrow('changedBy is required');
  });

  it('throws when reason is empty', () => {
    const ruleSet = makeRuleSetWithDefaults();
    expect(() =>
      updateRuleClassification(ruleSet, 'soft_heavier_lower', 'advisory', 'admin', '')
    ).toThrow('reason is required');
  });

  it('does not mutate the original rule set', () => {
    const ruleSet = makeRuleSetWithDefaults();
    const originalType = ruleSet.defaultRules.find((r) => r.id === 'soft_heavier_lower')?.type;

    updateRuleClassification(
      ruleSet,
      'soft_heavier_lower',
      'advisory',
      'admin@example.com',
      'Testing immutability'
    );

    const unchangedType = ruleSet.defaultRules.find((r) => r.id === 'soft_heavier_lower')?.type;
    expect(unchangedType).toBe(originalType);
    expect(ruleSet.auditLog).toHaveLength(0);
  });
});

// ─── getRuleSummary Tests ────────────────────────────────────────────────────

describe('getRuleSummary', () => {
  it('groups rules by type', () => {
    const ruleSet = makeRuleSetWithDefaults();
    const summary = getRuleSummary(ruleSet);

    // Default rules: 6 hard constraints, 4 soft preferences, 0 advisory
    expect(summary.hardConstraints.length).toBe(6);
    expect(summary.softPreferences.length).toBe(4);
    expect(summary.advisoryRules.length).toBe(0);
    expect(summary.totalCount).toBe(10);
  });

  it('includes custom rules in the summary', () => {
    let ruleSet = makeRuleSetWithDefaults();
    ruleSet = createCustomRule(ruleSet, makeCustomRuleParams({
      id: 'custom_advisory_1',
      type: 'advisory',
      name: 'My Advisory Rule',
      description: 'Custom advisory description.',
    }));

    const summary = getRuleSummary(ruleSet);
    expect(summary.advisoryRules).toHaveLength(1);
    expect(summary.advisoryRules[0].name).toBe('My Advisory Rule');
    expect(summary.advisoryRules[0].description).toBe('Custom advisory description.');
    expect(summary.totalCount).toBe(11);
  });

  it('each summary entry contains id, name, and description', () => {
    const ruleSet = makeRuleSetWithDefaults();
    const summary = getRuleSummary(ruleSet);

    for (const rule of summary.hardConstraints) {
      expect(rule.id).toBeDefined();
      expect(rule.name.length).toBeGreaterThan(0);
      expect(rule.description.length).toBeGreaterThan(0);
    }
  });

  it('reflects classification changes', () => {
    let ruleSet = makeRuleSetWithDefaults();
    ruleSet = updateRuleClassification(
      ruleSet,
      'soft_heavier_lower',
      'advisory',
      'admin',
      'Demoting'
    );

    const summary = getRuleSummary(ruleSet);
    expect(summary.softPreferences.length).toBe(3);
    expect(summary.advisoryRules.length).toBe(1);
    expect(summary.advisoryRules[0].id).toBe('soft_heavier_lower');
  });
});

// ─── acknowledgeRules Tests ──────────────────────────────────────────────────

describe('acknowledgeRules', () => {
  it('marks the rule set as acknowledged', () => {
    const ruleSet = makeRuleSetWithDefaults();
    const updated = acknowledgeRules(ruleSet, 'planner@example.com');
    expect(updated.acknowledged).toBe(true);
    expect(updated.acknowledgedBy).toBe('planner@example.com');
    expect(updated.acknowledgedAt).toBeInstanceOf(Date);
  });

  it('throws when acknowledgedBy is empty', () => {
    const ruleSet = makeRuleSetWithDefaults();
    expect(() => acknowledgeRules(ruleSet, '  ')).toThrow('acknowledgedBy is required');
  });

  it('does not mutate the original rule set', () => {
    const ruleSet = makeRuleSetWithDefaults();
    acknowledgeRules(ruleSet, 'planner@example.com');
    expect(ruleSet.acknowledged).toBe(false);
  });
});

// ─── getAllRules Tests ────────────────────────────────────────────────────────

describe('getAllRules', () => {
  it('returns both default and custom rules', () => {
    let ruleSet = makeRuleSetWithDefaults();
    ruleSet = createCustomRule(ruleSet, makeCustomRuleParams({ id: 'custom_1' }));
    ruleSet = createCustomRule(ruleSet, makeCustomRuleParams({ id: 'custom_2' }));

    const all = getAllRules(ruleSet);
    expect(all.length).toBe(defaultRules.length + 2);
  });

  it('returns default rules only when no custom rules exist', () => {
    const ruleSet = makeRuleSetWithDefaults();
    const all = getAllRules(ruleSet);
    expect(all.length).toBe(defaultRules.length);
  });
});
