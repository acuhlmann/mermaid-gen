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
    expect(screen.getByText('THE Engineer')).toBeTruthy();
    expect(screen.getByText('Chief Innovation Officer')).toBeTruthy();
    expect(screen.getByText('THE SLOPITECT')).toBeTruthy();
    expect(screen.getByText('The VP')).toBeTruthy();
    expect(screen.getByText('The Auditor')).toBeTruthy();
    expect(screen.getByText('The Wise Architect')).toBeTruthy();
  });

  it('exposes Engineer in the refine row tooltip', () => {
    const { container } = render(<StakeholdersMascot personas={TEST_PERSONAS} />);
    const engineerRow = screen.getByText('THE Engineer').closest('.stakeholders-roster-row');
    expect(engineerRow?.getAttribute('title')).toMatch(/Engineer/);
    expect(container.querySelector('.stakeholders-roster')).toBeTruthy();
  });

  it('invokes persona onClick when anywhere on the roster row is clicked', () => {
    const onRefine = vi.fn();
    const personas = TEST_PERSONAS.map((p) =>
      p.variant === 'refine' ? { ...p, onClick: onRefine } : p
    );
    render(<StakeholdersMascot personas={personas} />);
    fireEvent.click(screen.getByText('THE Engineer'));
    expect(onRefine).toHaveBeenCalledTimes(1);
  });

  it('shows speech bubble after thinking completes for the Wise Architect', () => {
    const bubbleProps = {
      persona: 'explain',
      suggestion: 'Consider the saga between Order and Payment.',
      kind: 'comment',
      onDismiss: vi.fn()
    };
    const { rerender } = render(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        activeAdvisorVariant="explain"
        thinkingPersona="explain"
      />
    );
    expect(screen.getByTestId('advisor-thinking-indicator')).toBeTruthy();
    expect(screen.queryByTestId('advisor-speech-bubble')).toBeNull();

    rerender(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        activeAdvisorVariant="explain"
        thinkingPersona={null}
        bubbleProps={bubbleProps}
      />
    );
    expect(screen.queryByTestId('advisor-thinking-indicator')).toBeNull();
    expect(screen.getByTestId('advisor-speech-bubble')).toBeTruthy();
    expect(screen.getByText(/Consider the saga/i)).toBeTruthy();
  });

  it('keeps the thinking indicator until the speech bubble is renderable', () => {
    render(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        activeAdvisorVariant="explain"
        thinkingPersona="explain"
      />
    );
    expect(screen.getByTestId('advisor-thinking-indicator')).toBeTruthy();
    expect(screen.queryByTestId('advisor-speech-bubble')).toBeNull();
    expect(screen.getByText(/is musing/i)).toBeTruthy();
  });

  it('prefers the speech bubble once suggestion text is available', () => {
    const bubbleProps = {
      persona: 'explain',
      suggestion: 'Consider the saga between Order and Payment.',
      kind: 'comment',
      onDismiss: vi.fn()
    };
    render(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        activeAdvisorVariant="explain"
        thinkingPersona="explain"
        bubbleProps={bubbleProps}
      />
    );
    expect(screen.queryByTestId('advisor-thinking-indicator')).toBeNull();
    expect(screen.getByTestId('advisor-speech-bubble')).toBeTruthy();
  });

  it('does not render the first-run spotlight without introProps', () => {
    render(<StakeholdersMascot personas={TEST_PERSONAS} thinkingPersona="refine" />);
    expect(screen.queryByTestId('stakeholder-intro-spotlight')).toBeNull();
    // Surface still renders on its own outside the float stack.
    expect(screen.getByTestId('advisor-thinking-indicator')).toBeTruthy();
  });

  it('stacks the first-run spotlight above the live advisor surface', () => {
    const introProps = {
      eyebrow: '👥 The roundtable has convened',
      body: 'A stakeholder is weighing in.',
      dismissLabel: 'Got it',
      ariaLabel: 'Meet the stakeholders',
      onDismiss: vi.fn()
    };
    const { container } = render(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        thinkingPersona="refine"
        introProps={introProps}
      />
    );
    const stack = container.querySelector('.stakeholders-float-stack');
    expect(stack).toBeTruthy();
    expect(stack.querySelector('[data-testid="stakeholder-intro-spotlight"]')).toBeTruthy();
    expect(stack.querySelector('[data-testid="advisor-thinking-indicator"]')).toBeTruthy();
  });
});
