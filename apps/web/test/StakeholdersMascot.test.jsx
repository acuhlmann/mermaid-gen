// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  // Three ways to reach the team, in ascending headcount. Headphones used to sit
  // in this row; it was never a way of reaching anybody and now lives in the desk
  // menu with the rest of the sound posture.
  it('lists the three team verbs in the roster when expanded (test mode)', () => {
    const onTalkToTeam = vi.fn();
    const onCallMeeting = vi.fn();
    const onHuddle = vi.fn();
    render(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        onTalkToTeam={onTalkToTeam}
        onCallMeeting={onCallMeeting}
        onHuddle={onHuddle}
        canTalkToTeam
        canCallMeeting
        canHuddle
      />
    );
    expect(screen.getByRole('menuitem', { name: /Huddle up/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Grab whoever is free/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Call a meeting/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /headphones/i })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: /Huddle up/ }));
    expect(onHuddle).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('menuitem', { name: /Grab whoever is free/ }));
    expect(onTalkToTeam).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('menuitem', { name: /Call a meeting/ }));
    expect(onCallMeeting).toHaveBeenCalledTimes(1);
  });

  it('blocks every team verb on an empty canvas', () => {
    render(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        onTalkToTeam={vi.fn()}
        onCallMeeting={vi.fn()}
        onHuddle={vi.fn()}
        canTalkToTeam={false}
        canCallMeeting={false}
        canHuddle={false}
      />
    );
    expect(screen.getByRole('menuitem', { name: /Huddle up/ }).disabled).toBe(true);
    expect(screen.getByRole('menuitem', { name: /Grab whoever is free/ }).disabled).toBe(true);
    expect(screen.getByRole('menuitem', { name: /Call a meeting/ }).disabled).toBe(true);
  });

  it('reads persona rows as delegating to a person, and acknowledges the hand-off', () => {
    const onClick = vi.fn();
    render(
      <StakeholdersMascot
        personas={[{ variant: 'gilfoyle', onClick }]}
        onTalkToTeam={vi.fn()}
        onCallMeeting={vi.fn()}
        onHuddle={vi.fn()}
      />
    );
    expect(screen.getByText('Delegate to…')).toBeTruthy();
    const row = screen.getByRole('button', { name: /Delegate to .* Refine/i });
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
    // The click runs the streaming agent, not the advisor roundtable, so the
    // roster owns the only acknowledgement that a person picked the work up.
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
    const { container } = render(<StakeholdersMascot personas={TEST_PERSONAS} />);
    const gilfoyleRow = screen.getByText('Bertram Gilfoyle').closest('.stakeholders-roster-row');
    expect(gilfoyleRow?.getAttribute('title')).toMatch(/Gilfoyle/);
    expect(container.querySelector('.stakeholders-roster')).toBeTruthy();
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

  it('shows Richard comment controls after thinking completes', () => {
    const bubbleProps = {
      persona: 'richard',
      suggestion: 'Consider the saga between Order and Payment.',
      kind: 'comment',
      onDismiss: vi.fn(),
      onDumbDown: vi.fn(),
      onDrillDeeper: vi.fn()
    };
    const { rerender } = render(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        activeAdvisorVariant="richard"
        thinkingPersona="richard"
      />
    );
    expect(screen.getByTestId('advisor-thinking-indicator')).toBeTruthy();

    rerender(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        activeAdvisorVariant="richard"
        thinkingPersona={null}
        bubbleProps={bubbleProps}
      />
    );
    expect(screen.queryByTestId('advisor-thinking-indicator')).toBeNull();
    const bubble = screen.getByTestId('advisor-speech-bubble');
    expect(bubble).toBeTruthy();
    expect(bubble.classList.contains('is-richard')).toBe(true);
    expect(screen.getByRole('button', { name: /Dumb it Down/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Drill Deeper/i })).toBeTruthy();
    expect(screen.getByText(/Consider the saga/i)).toBeTruthy();
  });

  it('keeps the thinking indicator until the speech bubble is renderable', () => {
    render(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        activeAdvisorVariant="richard"
        thinkingPersona="richard"
      />
    );
    expect(screen.getByTestId('advisor-thinking-indicator')).toBeTruthy();
    expect(screen.queryByTestId('advisor-speech-bubble')).toBeNull();
    expect(screen.getByText(/is naming it/i)).toBeTruthy();
  });

  it('prefers the speech bubble once suggestion text is available', () => {
    const bubbleProps = {
      persona: 'richard',
      suggestion: 'Consider the saga between Order and Payment.',
      kind: 'comment',
      onDismiss: vi.fn()
    };
    render(
      <StakeholdersMascot
        personas={TEST_PERSONAS}
        activeAdvisorVariant="richard"
        thinkingPersona="richard"
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
        activeAdvisorVariant="gilfoyle"
        thinkingPersona={null}
        bubbleProps={bubbleProps}
      />
    );
    expect(screen.queryByTestId('advisor-thinking-indicator')).toBeNull();
    expect(screen.getByTestId('advisor-speech-bubble')).toBeTruthy();
    expect(screen.getByText(/Ship the comment/i)).toBeTruthy();
  });

  it('does not render the first-run spotlight without introProps', () => {
    render(<StakeholdersMascot personas={TEST_PERSONAS} thinkingPersona="gilfoyle" />);
    expect(screen.queryByTestId('stakeholder-intro-spotlight')).toBeNull();
    // Surface still renders on its own outside the float stack.
    expect(screen.getByTestId('advisor-thinking-indicator')).toBeTruthy();
  });

  it('holds the last advisor surface briefly across handoff gaps', async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <StakeholdersMascot personas={TEST_PERSONAS} thinkingPersona="gilfoyle" />
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
        <StakeholdersMascot personas={TEST_PERSONAS} thinkingPersona="gilfoyle" />
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
        thinkingPersona="gilfoyle"
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
