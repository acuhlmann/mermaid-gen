// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('shows Wise Architect comment controls after thinking completes', () => {
    const bubbleProps = {
      persona: 'explain',
      suggestion: 'Consider the saga between Order and Payment.',
      kind: 'comment',
      onDismiss: vi.fn(),
      onDumbDown: vi.fn(),
      onDrillDeeper: vi.fn()
    };
    const { rerender } = render(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        activeAdvisorVariant="explain"
        thinkingPersona="explain"
      />
    );
    expect(screen.getByTestId('advisor-thinking-indicator')).toBeTruthy();

    rerender(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        activeAdvisorVariant="explain"
        thinkingPersona={null}
        bubbleProps={bubbleProps}
      />
    );
    expect(screen.queryByTestId('advisor-thinking-indicator')).toBeNull();
    const bubble = screen.getByTestId('advisor-speech-bubble');
    expect(bubble).toBeTruthy();
    expect(bubble.classList.contains('is-explain')).toBe(true);
    expect(screen.getByRole('button', { name: /Dumb it Down/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Drill Deeper/i })).toBeTruthy();
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

  it('uses activeAdvisorVariant when bubbleProps.persona is briefly missing', () => {
    const bubbleProps = {
      persona: null,
      suggestion: 'Ship the comment even if persona wiring lags a tick.',
      kind: 'comment',
      onDismiss: vi.fn()
    };
    render(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        activeAdvisorVariant="refine"
        thinkingPersona={null}
        bubbleProps={bubbleProps}
      />
    );
    expect(screen.queryByTestId('advisor-thinking-indicator')).toBeNull();
    expect(screen.getByTestId('advisor-speech-bubble')).toBeTruthy();
    expect(screen.getByText(/Ship the comment/i)).toBeTruthy();
  });

  it('does not render the first-run spotlight without introProps', () => {
    render(<StakeholdersMascot personas={TEST_PERSONAS} thinkingPersona="refine" />);
    expect(screen.queryByTestId('stakeholder-intro-spotlight')).toBeNull();
    // Surface still renders on its own outside the float stack.
    expect(screen.getByTestId('advisor-thinking-indicator')).toBeTruthy();
  });

  it('holds the last advisor surface briefly across handoff gaps', async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <StakeholdersMascot personas={TEST_PERSONAS} thinkingPersona="refine" />
    );
    expect(screen.getByTestId('advisor-thinking-indicator')).toBeTruthy();

    rerender(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        thinkingPersona={null}
        activeAdvisorVariant={null}
      />
    );
    expect(screen.getByTestId('advisor-thinking-indicator')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });
    expect(screen.queryByTestId('advisor-thinking-indicator')).toBeNull();
    vi.useRealTimers();
  });

  it('keeps a real positioning box while the advisor surface is up (no display:contents)', () => {
    const { container } = render(
      <div className="prompt-actions prompt-actions--mobile">
        <StakeholdersMascot personas={TEST_PERSONAS} thinkingPersona="refine" />
      </div>
    );
    const wrap = container.querySelector('.stakeholders-mascot-wrap');
    expect(wrap?.classList.contains('has-float-surface')).toBe(true);
    // JSDOM won't compute CSS, but the class hook must be present so the
    // mobile stylesheet can keep position:relative instead of display:contents.
    expect(wrap?.className).toMatch(/has-float-surface/);
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
    expect(
      container.querySelector('.stakeholders-mascot-wrap')?.classList.contains('has-float-surface')
    ).toBe(true);
    expect(stack?.querySelector('[data-testid="stakeholder-intro-spotlight"]')).toBeTruthy();
    expect(stack?.querySelector('[data-testid="advisor-thinking-indicator"]')).toBeTruthy();
  });
});
