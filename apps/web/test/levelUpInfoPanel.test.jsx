// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LevelUpInfoPanel from '../src/components/LevelUpInfoPanel.jsx';

const baseProps = {
  level: 3,
  levelTitle: 'Junior Slopitect',
  levelFlair: '✏️',
  levelShortLabel: 'Lvl 3',
  progressRatio: 0.4,
  xpInto: 40,
  xpForNext: 100,
  totalXp: 160,
  isMaxLevel: false,
  prestigeShortLabel: 'Trainee',
  totalRuns: 4,
  runsByVariant: { refine: 2, innovate: 1, goMad: 0, critique: 1, explain: 0 },
  achievements: { firstSlop: true, hatTrick: true }
};

describe('LevelUpInfoPanel', () => {
  afterEach(() => cleanup());

  it('renders the current level title, progress fill, and next-level taunt', () => {
    render(<LevelUpInfoPanel {...baseProps} onClose={() => {}} />);
    const panel = screen.getByTestId('levelup-info-panel');
    expect(panel.textContent).toContain('Junior Slopitect');
    expect(panel.textContent).toContain('160 XP');
    expect(panel.textContent).toContain('60 XP');
    const fill = panel.querySelector('.levelup-info-progress-fill');
    expect(fill.getAttribute('style')).toContain('40%');
    // Next-tier name is rendered.
    expect(panel.textContent).toMatch(/Mid-level Slopitect/i);
  });

  it('shows the MAX-level treatment when xpForNextLevel is null', () => {
    render(
      <LevelUpInfoPanel
        {...baseProps}
        level={12}
        levelTitle="Slopitect, Lord of Synergy"
        levelFlair="🔮"
        levelShortLabel="Lvl 12"
        progressRatio={1}
        xpInto={0}
        xpForNext={null}
        totalXp={3200}
        isMaxLevel
        onClose={() => {}}
      />
    );
    const panel = screen.getByTestId('levelup-info-panel');
    expect(panel.textContent).toMatch(/Max level/i);
    expect(panel.querySelector('.levelup-info-progress-caption.is-max')).toBeTruthy();
  });

  it('lists the variant XP rates with run counts and Go Mad depth bonus', () => {
    render(<LevelUpInfoPanel {...baseProps} onClose={() => {}} />);
    const panel = screen.getByTestId('levelup-info-panel');
    // Per-persona base XP + streak bonus is exposed.
    expect(panel.textContent).toContain('+25 base');
    expect(panel.textContent).toContain('+15 per streak');
    expect(panel.textContent).toContain('+35 depth ≥ 3');
    // Run counts render with the ×N marker.
    expect(panel.textContent).toContain('×2');
    expect(panel.textContent).toContain('×1');
  });

  it('shows trophy counts and recently-unlocked trophies', () => {
    render(<LevelUpInfoPanel {...baseProps} onClose={() => {}} />);
    const panel = screen.getByTestId('levelup-info-panel');
    expect(panel.textContent).toMatch(/2 \/ \d+ unlocked/);
    // Both achievements appear in the trophy list.
    expect(panel.textContent).toContain('FIRST SLOP');
    expect(panel.textContent).toContain('HAT TRICK');
  });

  it('invokes onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<LevelUpInfoPanel {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Close level details/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose when the Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<LevelUpInfoPanel {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('highlights the current row inside the ladder', () => {
    const { container } = render(<LevelUpInfoPanel {...baseProps} onClose={() => {}} />);
    const current = container.querySelector('.levelup-info-ladder-row.is-current');
    expect(current).toBeTruthy();
    expect(current.textContent).toContain('Junior Slopitect');
  });
});
