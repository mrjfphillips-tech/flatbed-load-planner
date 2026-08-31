// ─── Warning Panel Unit Tests ────────────────────────────────────────────────
// Validates Requirements 12.1, 12.2, 12.3, 12.4, 12.5

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { WarningPanel } from './WarningPanel';
import type { RuleResult } from '@ptv-discovery-coach/shared';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeWarning(overrides: Partial<RuleResult> = {}): RuleResult {
  return {
    passed: false,
    ruleId: 'test-rule-1',
    ruleType: 'hard_constraint',
    severity: 'error',
    message: 'Drive axle weight exceeds legal limit',
    affectedItems: ['ORD-001 (Hot-Rolled Coil)', 'ORD-003 (Steel Plate)'],
    threshold: 34000,
    actual: 37500,
    suggestedAction: 'Move item ORD-001 closer to the rear of the trailer',
    ...overrides,
  };
}

const errorWarning: RuleResult = makeWarning({
  ruleId: 'axle-overweight',
  severity: 'error',
  ruleType: 'hard_constraint',
  message: 'Drive axle weight exceeds legal limit',
  affectedItems: ['ORD-001 (Hot-Rolled Coil)'],
  threshold: 34000,
  actual: 37500,
  suggestedAction: 'Move heavy items toward trailer axles',
});

const warningResult: RuleResult = makeWarning({
  ruleId: 'cg-position',
  severity: 'warning',
  ruleType: 'soft_preference',
  message: 'Center of gravity is outside the optimal 40-50% range',
  affectedItems: ['ORD-002 (Rebar Bundle)', 'ORD-004 (I-Beam)'],
  threshold: 50,
  actual: 55,
  suggestedAction: 'Redistribute weight toward the front of the trailer',
});

const infoResult: RuleResult = makeWarning({
  ruleId: 'dunnage-advisory',
  severity: 'info',
  ruleType: 'advisory',
  message: 'Consider placing dunnage between items ORD-005 and ORD-006 for extra protection',
  affectedItems: ['ORD-005 (Flat Bar)', 'ORD-006 (Channel)'],
  threshold: undefined,
  actual: undefined,
  suggestedAction: 'Add 4x4 hardwood dunnage between layers',
});

const passedRule: RuleResult = makeWarning({
  passed: true,
  ruleId: 'gross-weight-ok',
  severity: 'error',
  ruleType: 'hard_constraint',
  message: 'Total gross weight within limit',
  affectedItems: [],
  threshold: 80000,
  actual: 72000,
  suggestedAction: undefined,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WarningPanel', () => {
  describe('Severity Summary Counts (Req 12.4)', () => {
    it('displays correct severity counts for mixed warnings', () => {
      render(
        <WarningPanel
          warnings={[errorWarning, warningResult, infoResult, passedRule]}
          canApprove={false}
        />
      );

      expect(screen.getByTestId('error-count')).toHaveTextContent('1 Error');
      expect(screen.getByTestId('warning-count')).toHaveTextContent('1 Warning');
      expect(screen.getByTestId('info-count')).toHaveTextContent('1 Info');
    });

    it('displays zero counts when all rules pass', () => {
      render(<WarningPanel warnings={[passedRule]} canApprove={true} />);

      expect(screen.getByTestId('error-count')).toHaveTextContent('0 Errors');
      expect(screen.getByTestId('warning-count')).toHaveTextContent('0 Warnings');
      expect(screen.getByTestId('info-count')).toHaveTextContent('0 Info');
    });

    it('only counts failed warnings (passed rules are excluded)', () => {
      render(
        <WarningPanel
          warnings={[errorWarning, passedRule, passedRule]}
          canApprove={false}
        />
      );

      expect(screen.getByTestId('error-count')).toHaveTextContent('1 Error');
    });

    it('pluralizes correctly for multiple errors', () => {
      const secondError = makeWarning({
        ruleId: 'boundary-violation',
        severity: 'error',
        message: 'Item extends beyond trailer width',
      });

      render(
        <WarningPanel
          warnings={[errorWarning, secondError]}
          canApprove={false}
        />
      );

      expect(screen.getByTestId('error-count')).toHaveTextContent('2 Errors');
    });
  });

  describe('Scrollable Warning List (Req 12.4)', () => {
    it('renders a scrollable list of failed warnings', () => {
      render(
        <WarningPanel
          warnings={[errorWarning, warningResult, infoResult]}
          canApprove={false}
        />
      );

      const list = screen.getByTestId('warning-list');
      expect(list).toBeInTheDocument();
      expect(list).toHaveStyle({ maxHeight: '360px' });
      expect(list.className).toContain('overflow-y-auto');
    });

    it('shows all failed warnings in the list', () => {
      render(
        <WarningPanel
          warnings={[errorWarning, warningResult, infoResult]}
          canApprove={false}
        />
      );

      expect(screen.getByTestId('warning-item-axle-overweight')).toBeInTheDocument();
      expect(screen.getByTestId('warning-item-cg-position')).toBeInTheDocument();
      expect(screen.getByTestId('warning-item-dunnage-advisory')).toBeInTheDocument();
    });

    it('does not display passed rules in the list', () => {
      render(
        <WarningPanel
          warnings={[errorWarning, passedRule]}
          canApprove={false}
        />
      );

      expect(screen.queryByTestId('warning-item-gross-weight-ok')).not.toBeInTheDocument();
    });

    it('sorts warnings by severity: errors first, then warnings, then info', () => {
      render(
        <WarningPanel
          warnings={[infoResult, warningResult, errorWarning]}
          canApprove={false}
        />
      );

      const list = screen.getByTestId('warning-list');
      const items = within(list).getAllByRole('listitem');

      // First item should be the error
      expect(items[0]).toHaveAttribute('data-testid', 'warning-item-axle-overweight');
      // Second should be the warning
      expect(items[1]).toHaveAttribute('data-testid', 'warning-item-cg-position');
      // Third should be info
      expect(items[2]).toHaveAttribute('data-testid', 'warning-item-dunnage-advisory');
    });

    it('shows empty state message when no warnings are active', () => {
      render(<WarningPanel warnings={[passedRule]} canApprove={true} />);

      expect(screen.getByText('No active warnings. The load plan is clear.')).toBeInTheDocument();
    });
  });

  describe('Warning Item Display (Req 12.1, 12.3)', () => {
    it('displays plain-language message for each warning', () => {
      render(
        <WarningPanel warnings={[errorWarning]} canApprove={false} />
      );

      expect(
        screen.getByText('Drive axle weight exceeds legal limit')
      ).toBeInTheDocument();
    });

    it('shows affected items by order number and description', () => {
      render(
        <WarningPanel warnings={[errorWarning]} canApprove={false} />
      );

      expect(
        screen.getByText(/ORD-001 \(Hot-Rolled Coil\)/)
      ).toBeInTheDocument();
    });

    it('shows threshold and actual values when provided', () => {
      render(
        <WarningPanel warnings={[errorWarning]} canApprove={false} />
      );

      // Check that limit and actual values are displayed
      expect(screen.getByText(/34,000/)).toBeInTheDocument();
      expect(screen.getByText(/37,500/)).toBeInTheDocument();
    });

    it('shows suggested corrective action', () => {
      render(
        <WarningPanel warnings={[errorWarning]} canApprove={false} />
      );

      expect(
        screen.getByText(/Move heavy items toward trailer axles/)
      ).toBeInTheDocument();
    });

    it('handles warnings without threshold/actual gracefully', () => {
      const noThreshold = makeWarning({
        ruleId: 'no-threshold',
        severity: 'warning',
        threshold: undefined,
        actual: undefined,
      });

      render(
        <WarningPanel warnings={[noThreshold]} canApprove={false} />
      );

      // Should still render without crashing
      expect(screen.getByTestId('warning-item-no-threshold')).toBeInTheDocument();
      // Should not show "Limit:" text when no threshold
      expect(screen.queryByText(/Limit:/)).not.toBeInTheDocument();
    });

    it('handles warnings without suggested action gracefully', () => {
      const noAction = makeWarning({
        ruleId: 'no-action',
        severity: 'info',
        suggestedAction: undefined,
      });

      render(
        <WarningPanel warnings={[noAction]} canApprove={false} />
      );

      expect(screen.getByTestId('warning-item-no-action')).toBeInTheDocument();
      expect(screen.queryByText(/Suggested action:/)).not.toBeInTheDocument();
    });

    it('handles warnings with empty affected items array', () => {
      const noItems = makeWarning({
        ruleId: 'no-items',
        severity: 'warning',
        affectedItems: [],
      });

      render(
        <WarningPanel warnings={[noItems]} canApprove={false} />
      );

      expect(screen.getByTestId('warning-item-no-items')).toBeInTheDocument();
      expect(screen.queryByText(/Affected items:/)).not.toBeInTheDocument();
    });
  });

  describe('Approve Plan Button (Req 12.5)', () => {
    it('enables Approve Plan button when canApprove is true (zero errors)', () => {
      render(
        <WarningPanel warnings={[warningResult, infoResult]} canApprove={true} />
      );

      const button = screen.getByTestId('approve-plan-button');
      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent('Approve Plan');
    });

    it('disables Approve Plan button when canApprove is false (errors exist)', () => {
      render(
        <WarningPanel warnings={[errorWarning]} canApprove={false} />
      );

      const button = screen.getByTestId('approve-plan-button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Resolve Errors to Approve');
    });

    it('shows count of errors that must be resolved when button is disabled', () => {
      render(
        <WarningPanel warnings={[errorWarning]} canApprove={false} />
      );

      expect(
        screen.getByTestId('approval-blocked-message')
      ).toHaveTextContent('1 error must be resolved before the plan can be approved.');
    });

    it('calls onApprove callback when button is clicked and enabled', () => {
      const onApprove = vi.fn();

      render(
        <WarningPanel warnings={[]} canApprove={true} onApprove={onApprove} />
      );

      fireEvent.click(screen.getByTestId('approve-plan-button'));
      expect(onApprove).toHaveBeenCalledTimes(1);
    });

    it('does not call onApprove when button is disabled', () => {
      const onApprove = vi.fn();

      render(
        <WarningPanel warnings={[errorWarning]} canApprove={false} onApprove={onApprove} />
      );

      fireEvent.click(screen.getByTestId('approve-plan-button'));
      expect(onApprove).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-label on the panel', () => {
      render(<WarningPanel warnings={[]} canApprove={true} />);

      expect(screen.getByTestId('warning-panel')).toHaveAttribute(
        'aria-label',
        'Load Plan Warnings'
      );
    });

    it('has proper aria-label on severity summary with counts', () => {
      render(
        <WarningPanel
          warnings={[errorWarning, warningResult, infoResult]}
          canApprove={false}
        />
      );

      const summary = screen.getByTestId('severity-summary');
      expect(summary).toHaveAttribute(
        'aria-label',
        '1 errors, 1 warnings, 1 info'
      );
    });

    it('has aria-disabled on the approve button when disabled', () => {
      render(
        <WarningPanel warnings={[errorWarning]} canApprove={false} />
      );

      expect(screen.getByTestId('approve-plan-button')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('has descriptive title on approve button', () => {
      render(<WarningPanel warnings={[]} canApprove={true} />);

      expect(screen.getByTestId('approve-plan-button')).toHaveAttribute(
        'title',
        'Approve the load plan'
      );
    });
  });

  describe('Styling by Severity (Req 12.2)', () => {
    it('renders error warnings with red styling', () => {
      render(
        <WarningPanel warnings={[errorWarning]} canApprove={false} />
      );

      const item = screen.getByTestId('warning-item-axle-overweight');
      expect(item.className).toContain('border-red');
      expect(item.className).toContain('bg-red');
    });

    it('renders soft preference warnings with amber styling', () => {
      render(
        <WarningPanel warnings={[warningResult]} canApprove={true} />
      );

      const item = screen.getByTestId('warning-item-cg-position');
      expect(item.className).toContain('border-amber');
      expect(item.className).toContain('bg-amber');
    });

    it('renders info warnings with blue styling', () => {
      render(
        <WarningPanel warnings={[infoResult]} canApprove={true} />
      );

      const item = screen.getByTestId('warning-item-dunnage-advisory');
      expect(item.className).toContain('border-blue');
      expect(item.className).toContain('bg-blue');
    });
  });
});
