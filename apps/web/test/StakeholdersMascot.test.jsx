// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StakeholdersMascot from '../src/components/StakeholdersMascot.jsx';

const TEST_PERSONAS = [
  { variant: 'gilfoyle', onClick: vi.fn() },
  { variant: 'erlich', onClick: vi.fn() },
  { variant: 'russ', onClick: vi.fn() },
  { variant: 'barker', onClick: vi.fn() },
  { variant: 'jared', onClick: vi.fn() },
  { variant: 'richard', onClick: vi.fn() }
];

describe('StakeholdersMascot', () => {
  afterEach(() => cleanup());

  it('lists Huddle up and closes the roster when it starts', () => {
    const onHuddle = vi.fn();
    render(<StakeholdersMascot personas={TEST_PERSONAS} onHuddle={onHuddle} canHuddle />);
    expect(screen.getByRole('menuitem', { name: /Huddle up/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Have a meeting/ })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: /Huddle up/ }));
    expect(onHuddle).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu', { name: 'Your team' })).toBeNull();
  });

  it('allows Huddle up on an empty canvas when canHuddle is true', () => {
    render(<StakeholdersMascot personas={TEST_PERSONAS} onHuddle={vi.fn()} canHuddle />);
    expect(screen.getByRole('menuitem', { name: /Huddle up/ }).disabled).toBe(false);
  });

  it('blocks Huddle up when canHuddle is false (busy / surface)', () => {
    render(<StakeholdersMascot personas={TEST_PERSONAS} onHuddle={vi.fn()} canHuddle={false} />);
    expect(screen.getByRole('menuitem', { name: /Huddle up/ }).disabled).toBe(true);
  });

  it('does not render advising speech bubbles or thinking indicators', () => {
    render(<StakeholdersMascot personas={TEST_PERSONAS} />);
    expect(screen.queryByTestId('advisor-speech-bubble')).toBeNull();
    expect(screen.queryByTestId('advisor-thinking-indicator')).toBeNull();
  });

  it('reads persona rows as delegating to a person, and acknowledges the hand-off', () => {
    const onClick = vi.fn();
    render(<StakeholdersMascot personas={[{ variant: 'gilfoyle', onClick }]} onHuddle={vi.fn()} />);
    expect(screen.getByText('Delegate to…')).toBeTruthy();
    const row = screen.getByRole('button', { name: /Delegate to .* Refine/i });
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(row.className).toContain('is-handed-off');
    expect(row.textContent).toContain('took it');
  });

  it('lists personality verbs on roster chips, not duplicate names', () => {
    render(<StakeholdersMascot personas={TEST_PERSONAS} />);
    expect(screen.getByText('Refine')).toBeTruthy();
    expect(screen.getByText('Innovate')).toBeTruthy();
    expect(screen.getByText('Synergize')).toBeTruthy();
    expect(screen.queryByText('Gilfoyle', { selector: '.stakeholders-roster-chip' })).toBeNull();
  });

  it('lists all stakeholder names in the roster when expanded (test mode)', () => {
    render(<StakeholdersMascot personas={TEST_PERSONAS} />);
    expect(screen.getByRole('menu', { name: 'Your team' })).toBeTruthy();
    expect(screen.getByText('Bertram Gilfoyle')).toBeTruthy();
    expect(screen.getByText('Erlich Bachman')).toBeTruthy();
    expect(screen.getByText('Russ Hanneman')).toBeTruthy();
    expect(screen.getByText('Jack Barker')).toBeTruthy();
    expect(screen.getByText('Jared Dunn')).toBeTruthy();
    expect(screen.getByText('Richard Hendricks')).toBeTruthy();
  });

  it('exposes Gilfoyle in the gilfoyle row tooltip', () => {
    render(<StakeholdersMascot personas={TEST_PERSONAS} />);
    const gilfoyleRow = screen.getByText('Bertram Gilfoyle').closest('.stakeholders-roster-row');
    expect(gilfoyleRow?.getAttribute('title')).toMatch(/Gilfoyle/);
    expect(document.body.querySelector('.stakeholders-roster')).toBeTruthy();
  });

  it('invokes persona onClick when anywhere on the roster row is clicked', () => {
    const onRefine = vi.fn();
    const personas = TEST_PERSONAS.map((p) =>
      p.variant === 'gilfoyle' ? { ...p, onClick: onRefine } : p
    );
    render(<StakeholdersMascot personas={personas} />);
    fireEvent.click(screen.getByText('Bertram Gilfoyle'));
    expect(onRefine).toHaveBeenCalledTimes(1);
  });

  it('does not render the first-run spotlight without introProps', () => {
    render(<StakeholdersMascot personas={TEST_PERSONAS} />);
    expect(screen.queryByTestId('stakeholder-intro-spotlight')).toBeNull();
  });
});
