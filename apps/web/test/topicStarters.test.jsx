// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TopicStarters from '../src/components/TopicStarters.jsx';

const STARTERS = [
  { label: 'Coffee supply chain', prompt: 'Break down the global coffee supply chain' },
  { label: 'OAuth 2.0 flow', prompt: 'Explain OAuth' }
];

// Day One shape: assignment chips attributed to a requester across both casts
// (barker resolves via SENIOR_STAKEHOLDERS, ciso via OFFICE_COLLEAGUES).
const ASSIGNMENT_STARTERS = [
  {
    label: 'Coffee supply chain',
    prompt: 'Break down the global coffee supply chain',
    fromId: 'barker',
    ask: 'Needs it before the board offsite.'
  },
  {
    label: 'OAuth 2.0 flow',
    prompt: 'Explain OAuth',
    fromId: 'ciso',
    ask: 'Wants every arrow accountable.'
  }
];

describe('TopicStarters', () => {
  afterEach(() => cleanup());

  it('places the hint beside the default starter chip', () => {
    const { container } = render(
      <TopicStarters hint="New here?" ariaLabel="Examples" starters={STARTERS} onPick={vi.fn()} />
    );
    const lead = container.querySelector('.topic-starters-lead');
    expect(lead).toBeTruthy();
    expect(lead?.querySelector('.topic-starters-hint')?.textContent).toBe('New here?');
    const chips = container.querySelectorAll('.topic-starter-chip');
    expect(chips[0].classList.contains('is-default')).toBe(true);
    expect(chips[1].classList.contains('is-default')).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Coffee supply chain' }).getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('attributes assignment chips to their requester from either cast', () => {
    const onPick = vi.fn();
    const { container } = render(
      <TopicStarters
        hint="Day one."
        ariaLabel="Assignments"
        starters={ASSIGNMENT_STARTERS}
        onPick={onPick}
      />
    );
    const chips = container.querySelectorAll('.topic-starter-chip.has-from');
    expect(chips.length).toBe(2);
    // Requester names resolve through officeSenderInfo — stakeholder + colleague.
    expect(screen.getByText('Jack Barker')).toBeTruthy();
    expect(screen.getByText('Sasha')).toBeTruthy();
    expect(screen.getByText('Needs it before the board offsite.')).toBeTruthy();
    // The underlying generation prompt is untouched by the fiction.
    fireEvent.click(chips[0]);
    expect(onPick).toHaveBeenCalledWith('Break down the global coffee supply chain');
  });

  it('falls back to plain chips for old-shape locale starters', () => {
    const { container } = render(
      <TopicStarters hint="New here?" ariaLabel="Examples" starters={STARTERS} onPick={vi.fn()} />
    );
    expect(container.querySelector('.topic-starter-chip.has-from')).toBeNull();
    expect(container.querySelector('.topic-starter-from')).toBeNull();
    expect(screen.getByRole('button', { name: 'OAuth 2.0 flow' })).toBeTruthy();
  });
});
