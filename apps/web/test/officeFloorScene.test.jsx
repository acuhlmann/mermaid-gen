// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { awayFromDeskIds, sceneParticipants } from '../src/utils/officeSceneCast.js';
import { _resetOfficeViewModeForTests, standUp } from '../src/state/officeViewModeStore.js';
import { setOfficeCaptions, setOfficeNarration } from '../src/state/officeMomentStore.js';

const COFFEE = {
  id: 'coffee-1',
  accepted: false,
  lines: [
    { speakerId: 'intern', text: 'Is the machine meant to make that noise?' },
    { speakerId: 'greybeard', text: 'It has made that noise since 2009.' }
  ]
};

const BATTLE = {
  id: 'battle-1',
  topic: 'Tabs vs spaces',
  accepted: false,
  votedFor: null,
  lines: [
    { speakerId: 'scrumMaster', text: 'Spaces. Consistency is a ceremony.' },
    { speakerId: 'greybeard', text: 'Tabs. I have been right since 1998.' }
  ],
  verdicts: { scrumMaster: 'Noted in the retro.', greybeard: 'As I said. In 1998.' }
};

function renderFloor(props = {}) {
  standUp();
  return render(<OfficeFloor {...props} />);
}

beforeEach(() => {
  // Scene suites assert dialogue text; captions on keeps balloons visible
  // under the shared voice-first narration default.
  setOfficeCaptions(true);
  setOfficeNarration(true);
});

afterEach(() => {
  cleanup();
  _resetOfficeViewModeForTests();
  setOfficeCaptions(false);
});

describe('sceneParticipants', () => {
  it('lists speakers in the order they first talk, without repeats', () => {
    expect(sceneParticipants(COFFEE.lines)).toEqual(['intern', 'greybeard']);
    expect(sceneParticipants([])).toEqual([]);
    expect(sceneParticipants(undefined)).toEqual([]);
  });
});

describe('awayFromDeskIds', () => {
  it('collects everyone up and about, and nobody when the floor is working', () => {
    expect(awayFromDeskIds({ playerId: 'you' })).toEqual([]);
    expect(awayFromDeskIds({ coffee: COFFEE, battle: BATTLE, playerId: 'you' })).toEqual([
      'intern',
      'greybeard',
      'scrumMaster',
      'greybeard'
    ]);
  });

  it('takes you out of your own chair for a meeting, and only then', () => {
    const meeting = { attendees: ['scrumMaster', 'gilfoyle'] };
    expect(awayFromDeskIds({ meeting, playerId: 'you' })).toEqual([
      'you',
      'scrumMaster',
      'gilfoyle'
    ]);
    expect(awayFromDeskIds({ meeting: { attendees: undefined }, playerId: 'you' })).toEqual([
      'you'
    ]);
    expect(awayFromDeskIds({ coffee: COFFEE, playerId: 'you' })).not.toContain('you');
  });
});

describe('coffee break on the floor', () => {
  it('puts both of them at the machine and asks before it starts', () => {
    renderFloor({ coffee: COFFEE });

    expect(screen.getByTestId('office-floor-scene-actor-intern')).toBeTruthy();
    expect(screen.getByTestId('office-floor-scene-actor-greybeard')).toBeTruthy();
    expect(screen.getByTestId('office-floor-coffee-invite')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Take 5/i })).toBeTruthy();
  });

  it('empties the desks of whoever is at the machine', () => {
    const view = renderFloor({ coffee: COFFEE });
    const seat = (id) => view.container.querySelector(`[data-seat="${id}"]`);

    expect(seat('greybeard')?.dataset.vacant).toBe('true');
    expect(seat('intern')?.dataset.vacant).toBe('true');
    // Everyone else is still working.
    expect(seat('gilfoyle')?.dataset.vacant).toBeUndefined();
  });

  it('accepts and declines through the store handlers', () => {
    const onAcceptCoffee = vi.fn();
    const onDeclineCoffee = vi.fn();
    renderFloor({ coffee: COFFEE, sceneHandlers: { onAcceptCoffee, onDeclineCoffee } });

    fireEvent.click(screen.getByRole('button', { name: /Take 5/i }));
    expect(onAcceptCoffee).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Deadline/i }));
    expect(onDeclineCoffee).toHaveBeenCalled();
  });

  it('drops the invite and shows the talk once accepted', () => {
    renderFloor({ coffee: { ...COFFEE, accepted: true } });

    expect(screen.queryByTestId('office-floor-coffee-invite')).toBeNull();
    // With narration off every line shows at once, as in the desk-mode card.
    expect(screen.getByText(/made that noise since 2009/)).toBeTruthy();
  });
});

describe('cubicle battle on the floor', () => {
  it('invites you to watch, naming both sides and the topic', () => {
    renderFloor({ battle: BATTLE });

    expect(screen.getByTestId('office-floor-battle-invite')).toBeTruthy();
    expect(screen.getByText(/Tabs vs spaces/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Grab popcorn/i })).toBeTruthy();
  });

  it('asks the floor to rule once the argument has played out', () => {
    // The scene runs on a real-time timer with narration off; fake timers keep
    // the suite fast without weakening the assertion.
    vi.useFakeTimers();
    try {
      const onVoteBattle = vi.fn();
      renderFloor({ battle: { ...BATTLE, accepted: true }, sceneHandlers: { onVoteBattle } });

      // A battle never ends itself — the vote prompt arrives after the lines.
      expect(screen.queryByTestId('office-floor-battle-verdict')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      expect(screen.getByTestId('office-floor-battle-verdict')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /Side with Ulrich/i }));
      expect(onVoteBattle).toHaveBeenCalledWith('battle-1', 'greybeard');
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives the winner the last word', async () => {
    const onBattleDone = vi.fn();
    renderFloor({
      battle: { ...BATTLE, accepted: true, votedFor: 'greybeard' },
      sceneHandlers: { onBattleDone }
    });

    expect(screen.getByText(/As I said. In 1998./)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('office-floor-battle-done')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Back to work/i }));
    expect(onBattleDone).toHaveBeenCalled();
  });
});
