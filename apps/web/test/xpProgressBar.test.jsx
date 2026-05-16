// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import XpProgressBar from '../src/components/XpProgressBar.jsx';

describe('XpProgressBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders level, flair, and a fill at the supplied ratio', () => {
    render(
      <XpProgressBar
        level={3}
        short="Lvl 3"
        flair="✏️"
        progressRatio={0.4}
        xpInto={28}
        xpForNext={70}
        totalXp={148}
      />
    );

    const bar = screen.getByTestId('xp-progress-bar');
    expect(bar.textContent).toContain('Lvl 3');
    expect(bar.textContent).toContain('28/70');
    expect(bar.getAttribute('aria-valuenow')).toBe('28');
    expect(bar.getAttribute('aria-valuemax')).toBe('70');
    const fill = bar.querySelector('.xp-progress-bar-fill');
    expect(fill).toBeTruthy();
    expect(fill.getAttribute('style')).toContain('40%');
  });

  it('renders MAX when at the soft cap', () => {
    render(
      <XpProgressBar
        level={12}
        short="Lvl 12"
        flair="🔮"
        progressRatio={1}
        xpInto={0}
        xpForNext={null}
        totalXp={3200}
        isMaxLevel
      />
    );
    const bar = screen.getByTestId('xp-progress-bar');
    expect(bar.textContent).toContain('MAX');
    expect(bar.className).toContain('is-max-level');
  });

  it('clamps the fill ratio inside the 0..1 range', () => {
    render(
      <XpProgressBar
        level={1}
        progressRatio={1.42}
        xpInto={120}
        xpForNext={50}
      />
    );
    const fill = screen.getByTestId('xp-progress-bar').querySelector('.xp-progress-bar-fill');
    expect(fill.getAttribute('style')).toContain('100%');
  });
});
