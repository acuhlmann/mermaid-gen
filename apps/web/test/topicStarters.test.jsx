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

  it('highlights the first starter chip as the default', () => {
    const { container } = render(
      <TopicStarters hint="New here?" ariaLabel="Examples" starters={STARTERS} onPick={vi.fn()} />
    );
    const chips = container.querySelectorAll('.topic-starter-chip');
    expect(chips[0].classList.contains('is-default')).toBe(true);
    expect(chips[1].classList.contains('is-default')).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Coffee supply chain' }).getAttribute('aria-pressed')
    ).toBe('true');
  });
});
