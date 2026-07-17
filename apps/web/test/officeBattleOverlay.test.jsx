// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import OfficeBattleOverlay, {
  BATTLE_LINE_PACE_MS
} from '../src/components/OfficeBattleOverlay.jsx';

const BATTLE = {
  id: 'battle-1',
  topic: 'Tabs vs. spaces',
  lines: [
    { speakerId: 'greybeard', text: 'Tabs. We settled this in 2009.' },
    { speakerId: 'intern', text: 'the style guide says two spaces!!' },
    { speakerId: 'greybeard', text: 'The style guide has never opened a terminal.' }
  ],
  verdicts: {
    greybeard: 'Tabs it is.',
    intern: 'two spaces win!!'
  },
  accepted: false,
  votedFor: null,
  createdAt: 0
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('OfficeBattleOverlay', () => {
  it('renders nothing without a battle', () => {
    const { container } = render(<OfficeBattleOverlay battle={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the invite pill with both combatants and the topic', () => {
    const onAccept = vi.fn();
    const onDone = vi.fn();
    render(<OfficeBattleOverlay battle={BATTLE} onAccept={onAccept} onDone={onDone} />);
    const invite = screen.getByRole('status');
    expect(invite.textContent).toContain('Ulrich');
    expect(invite.textContent).toContain('Chad');
    expect(invite.textContent).toContain('Tabs vs. spaces');
    fireEvent.click(screen.getByText('Grab popcorn'));
    expect(onAccept).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Not my circus'));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('paces the lines in one by one, then offers the vote', () => {
    render(<OfficeBattleOverlay battle={{ ...BATTLE, accepted: true }} />);
    const arena = screen.getByRole('dialog');
    expect(arena.querySelectorAll('.office-battle-line')).toHaveLength(1);
    expect(arena.querySelector('.office-battle-settle')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(BATTLE_LINE_PACE_MS + 10);
    });
    expect(arena.querySelectorAll('.office-battle-line')).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(BATTLE_LINE_PACE_MS + 10);
    });
    expect(arena.querySelectorAll('.office-battle-line')).toHaveLength(3);
    expect(arena.querySelector('.office-battle-settle')).not.toBeNull();
  });

  it('reports the chosen side and then shows the winning verdict', () => {
    const onVote = vi.fn();
    const { rerender } = render(
      <OfficeBattleOverlay battle={{ ...BATTLE, accepted: true }} onVote={onVote} />
    );
    for (let i = 0; i < BATTLE.lines.length; i += 1) {
      act(() => {
        vi.advanceTimersByTime(BATTLE_LINE_PACE_MS + 10);
      });
    }
    fireEvent.click(screen.getByText(/Side with Chad/));
    expect(onVote).toHaveBeenCalledWith('intern');

    rerender(
      <OfficeBattleOverlay
        battle={{ ...BATTLE, accepted: true, votedFor: 'intern' }}
        onVote={onVote}
      />
    );
    const verdict = screen.getByRole('status');
    expect(verdict.textContent).toContain('two spaces win!!');
    expect(verdict.textContent).toContain('Chad');
  });
});
