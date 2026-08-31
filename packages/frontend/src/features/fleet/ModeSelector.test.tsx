/**
 * Unit tests for ModeSelector component.
 *
 * Tests cover:
 * - Rendering both mode options
 * - Updating fleet store mode on selection
 * - Calling onSelect callback with correct mode
 * - Accessibility attributes (aria-pressed)
 *
 * Validates: Requirements 6.3, 6.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeSelector } from './ModeSelector';
import { useFleetStore } from './fleet-store';

describe('ModeSelector', () => {
  beforeEach(() => {
    // Reset fleet store to defaults before each test
    useFleetStore.setState({ mode: 'single' });
  });

  it('should render both mode options', () => {
    const onSelect = vi.fn();
    render(<ModeSelector onSelect={onSelect} />);

    expect(screen.getByText('Single Truck')).toBeInTheDocument();
    expect(screen.getByText('Fleet Planning')).toBeInTheDocument();
  });

  it('should display descriptive text for each mode', () => {
    const onSelect = vi.fn();
    render(<ModeSelector onSelect={onSelect} />);

    expect(
      screen.getByText(/Plan a load for one vehicle at a time/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Upload a fleet manifest and generate plans for multiple vehicles/)
    ).toBeInTheDocument();
  });

  it('should render a heading prompting the user to choose', () => {
    const onSelect = vi.fn();
    render(<ModeSelector onSelect={onSelect} />);

    expect(screen.getByText('Choose Planning Mode')).toBeInTheDocument();
  });

  it('should call onSelect with "single" when Single Truck is clicked', () => {
    const onSelect = vi.fn();
    render(<ModeSelector onSelect={onSelect} />);

    const singleButton = screen.getByText('Single Truck').closest('button')!;
    fireEvent.click(singleButton);

    expect(onSelect).toHaveBeenCalledWith('single');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('should call onSelect with "fleet" when Fleet Planning is clicked', () => {
    const onSelect = vi.fn();
    render(<ModeSelector onSelect={onSelect} />);

    const fleetButton = screen.getByText('Fleet Planning').closest('button')!;
    fireEvent.click(fleetButton);

    expect(onSelect).toHaveBeenCalledWith('fleet');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('should update fleet store mode to "fleet" when Fleet Planning is selected', () => {
    const onSelect = vi.fn();
    render(<ModeSelector onSelect={onSelect} />);

    const fleetButton = screen.getByText('Fleet Planning').closest('button')!;
    fireEvent.click(fleetButton);

    expect(useFleetStore.getState().mode).toBe('fleet');
  });

  it('should update fleet store mode to "single" when Single Truck is selected', () => {
    // Start in fleet mode
    useFleetStore.setState({ mode: 'fleet' });

    const onSelect = vi.fn();
    render(<ModeSelector onSelect={onSelect} />);

    const singleButton = screen.getByText('Single Truck').closest('button')!;
    fireEvent.click(singleButton);

    expect(useFleetStore.getState().mode).toBe('single');
  });

  it('should have aria-pressed="true" on the currently active mode', () => {
    useFleetStore.setState({ mode: 'fleet' });
    const onSelect = vi.fn();
    render(<ModeSelector onSelect={onSelect} />);

    const fleetButton = screen.getByText('Fleet Planning').closest('button')!;
    const singleButton = screen.getByText('Single Truck').closest('button')!;

    expect(fleetButton).toHaveAttribute('aria-pressed', 'true');
    expect(singleButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('should apply custom className to the container', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ModeSelector onSelect={onSelect} className="my-custom-class" />
    );

    expect(container.firstChild).toHaveClass('my-custom-class');
  });
});
