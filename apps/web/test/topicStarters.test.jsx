// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TopicStarters from '../src/components/TopicStarters.jsx';

const STARTERS = [
  { label: 'Coffee supply chain', prompt: 'Break down the global coffee supply chain' },
  { label: 'OAuth 2.0 flow', prompt: 'Explain OAuth' }
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
});
