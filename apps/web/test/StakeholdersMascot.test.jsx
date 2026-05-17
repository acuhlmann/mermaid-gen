// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StakeholdersMascot from '../src/components/StakeholdersMascot.jsx';

const TEST_PERSONAS = [
  { variant: 'refine', onClick: vi.fn() },
  { variant: 'innovate', onClick: vi.fn() },
  { variant: 'goMad', onClick: vi.fn() },
  { variant: 'exec', onClick: vi.fn() },
  { variant: 'critique', onClick: vi.fn() },
  { variant: 'explain', onClick: vi.fn() }
];

describe('StakeholdersMascot', () => {
  afterEach(() => cleanup());

  it('lists all stakeholder names in the roster when expanded (test mode)', () => {
    render(<StakeholdersMascot personas={TEST_PERSONAS} />);
    expect(screen.getByRole('menu', { name: 'Stakeholder personas' })).toBeTruthy();
    expect(screen.getByText('The Polisher')).toBeTruthy();
    expect(screen.getByText('The Disruptor')).toBeTruthy();
    expect(screen.getByText('THE SLOPITECT')).toBeTruthy();
    expect(screen.getByText('The VP')).toBeTruthy();
    expect(screen.getByText('The Auditor')).toBeTruthy();
    expect(screen.getByText('The Wise Architect')).toBeTruthy();
  });

  it('exposes Engineer in the Polisher row tooltip', () => {
    const { container } = render(<StakeholdersMascot personas={TEST_PERSONAS} />);
    const polisherRow = screen.getByText('The Polisher').closest('.stakeholders-roster-row');
    expect(polisherRow?.getAttribute('title')).toMatch(/Engineer/);
    expect(container.querySelector('.stakeholders-roster')).toBeTruthy();
  });

  it('invokes persona onClick when anywhere on the roster row is clicked', () => {
    const onRefine = vi.fn();
    const personas = TEST_PERSONAS.map((p) =>
      p.variant === 'refine' ? { ...p, onClick: onRefine } : p
    );
    render(<StakeholdersMascot personas={personas} />);
    fireEvent.click(screen.getByText('The Polisher'));
    expect(onRefine).toHaveBeenCalledTimes(1);
  });
});
