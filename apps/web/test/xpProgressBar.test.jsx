// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    render(<XpProgressBar level={1} progressRatio={1.42} xpInto={120} xpForNext={50} />);
    const fill = screen.getByTestId('xp-progress-bar').querySelector('.xp-progress-bar-fill');
    expect(fill.getAttribute('style')).toContain('100%');
  });

  it('renders as a button and fires onClick when interactive', () => {
    const onClick = vi.fn();
    render(
      <XpProgressBar
        level={3}
        short="Lvl 3"
        flair="✏️"
        progressRatio={0.4}
        xpInto={28}
        xpForNext={70}
        totalXp={148}
        onClick={onClick}
        expanded={false}
        controlsId="levelup-info-panel"
      />
    );
    const bar = screen.getByTestId('xp-progress-bar');
    expect(bar.tagName).toBe('BUTTON');
    expect(bar.getAttribute('aria-expanded')).toBe('false');
    expect(bar.getAttribute('aria-controls')).toBe('levelup-info-panel');
    expect(bar.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(bar);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reflects the expanded state in aria attributes when open', () => {
    render(
      <XpProgressBar
        level={3}
        progressRatio={0.4}
        xpInto={28}
        xpForNext={70}
        onClick={() => {}}
        expanded
      />
    );
    const bar = screen.getByTestId('xp-progress-bar');
    expect(bar.getAttribute('aria-expanded')).toBe('true');
    expect(bar.className).toContain('is-expanded');
  });

  it('falls back to a div with meter semantics when no onClick is supplied', () => {
    render(<XpProgressBar level={2} progressRatio={0.5} xpInto={10} xpForNext={20} />);
    const bar = screen.getByTestId('xp-progress-bar');
    expect(bar.tagName).toBe('DIV');
    expect(bar.getAttribute('role')).toBe('meter');
  });
});
