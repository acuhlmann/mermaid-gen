// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FloorHuddleCard } from '../src/components/officeFloor/FloorHuddle.jsx';
import { officeChromeCopy } from '../src/utils/officeCast.js';
import { awayFromDeskIds } from '../src/utils/officeSceneCast.js';
import { HUDDLE_TILES, floorZoneToneAt } from '../src/utils/officeFloorPlan.js';

describe('floor huddle', () => {
  afterEach(() => cleanup());

  it('reserves six ring tiles around your desk', () => {
    expect(HUDDLE_TILES).toHaveLength(6);
  });

  it('empties teammate desks while huddling without moving you', () => {
    const away = awayFromDeskIds({
      huddle: { attendees: ['gilfoyle', 'dinesh'] },
      playerId: 'you'
    });
    expect(away).toContain('gilfoyle');
    expect(away).toContain('dinesh');
    expect(away).not.toContain('you');
  });

  it('renders a hard-stop card for the floor huddle', () => {
    render(
      <FloorHuddleCard
        huddle={{ id: 'h1', phase: 'gathering', attendees: ['gilfoyle'] }}
        copy={officeChromeCopy().floor}
        onHardStop={vi.fn()}
      />
    );
    expect(screen.getByTestId('office-floor-huddle-card')).toBeTruthy();
    expect(screen.getByText(/Hard stop/i)).toBeTruthy();
  });

  it('shows Do it on the floor card when the active beat carries an action prompt', () => {
    const handleDoIt = vi.fn();
    render(
      <FloorHuddleCard
        huddle={{ id: 'h1', phase: 'speaking', attendees: ['dinesh'] }}
        copy={officeChromeCopy().floor}
        onHardStop={vi.fn()}
        ringControls={{
          activeBeat: { speakerId: 'dinesh', text: 'Split Auth.', actionPrompt: 'Split Auth node' },
          activeSpeakerId: 'dinesh',
          pinnedSpeakerId: null,
          pinnedPrompt: null,
          handleDoIt
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Do it/i }));
    expect(handleDoIt).toHaveBeenCalledWith('dinesh', 'Split Auth node');
  });

  // ADR-0011 rule 1: the floor card is renderer #2 of the same state, so the
  // pair's side of the conversation must exist here exactly as it does on the
  // desk — not as a second implementation that drifted.
  it('offers the pair a way to answer on the floor card while listening', () => {
    const onPairReply = vi.fn();
    render(
      <FloorHuddleCard
        huddle={{
          id: 'h1',
          mode: 'pair',
          phase: 'listening',
          attendees: ['gilfoyle'],
          beats: [{ speakerId: 'gilfoyle', text: 'Auth is doing two jobs.' }],
          turns: [{ role: 'partner', text: 'Auth is doing two jobs.' }],
          awaitingReply: false
        }}
        copy={officeChromeCopy().floor}
        onHardStop={vi.fn()}
        onPairReply={onPairReply}
        ringControls={{
          activeBeat: { speakerId: 'gilfoyle', text: 'Auth is doing two jobs.' },
          activeSpeakerId: 'gilfoyle',
          pinnedSpeakerId: null,
          pinnedPrompt: null,
          handleDoIt: vi.fn()
        }}
      />
    );
    expect(screen.getByTestId('office-floor-pair-reply')).toBeTruthy();
    expect(screen.getByTestId('office-floor-huddle-listening').textContent).toMatch(
      /Bertram Gilfoyle/
    );

    fireEvent.change(screen.getByLabelText(/Answer Bertram Gilfoyle/), {
      target: { value: 'Show me the second job' }
    });
    fireEvent.click(screen.getByTestId('office-floor-pair-reply-send'));
    expect(onPairReply).toHaveBeenCalledWith('Show me the second job');
  });

  // Same chip as the desk: a pair's Do it is one of your answers, not a second
  // primary button beside the way out.
  it('folds the pair Do it into the reply strip on the floor card', () => {
    const handleDoIt = vi.fn();
    render(
      <FloorHuddleCard
        huddle={{ id: 'h1', mode: 'pair', phase: 'listening', attendees: ['gilfoyle'] }}
        copy={officeChromeCopy().floor}
        onHardStop={vi.fn()}
        onPairReply={vi.fn()}
        ringControls={{
          activeBeat: { speakerId: 'gilfoyle', text: 'Split it.', actionPrompt: 'Split Auth' },
          activeSpeakerId: 'gilfoyle',
          pinnedSpeakerId: null,
          pinnedPrompt: null,
          handleDoIt
        }}
      />
    );
    expect(document.querySelectorAll('.office-floor-card-action')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('office-floor-pair-reply-do-it'));
    expect(handleDoIt).toHaveBeenCalledWith('gilfoyle', 'Split Auth');
  });

  it('keeps the floor card quiet for a mob, which has nobody to answer', () => {
    render(
      <FloorHuddleCard
        huddle={{ id: 'h1', mode: 'mob', phase: 'listening', attendees: ['gilfoyle'] }}
        copy={officeChromeCopy().floor}
        onHardStop={vi.fn()}
        onPairReply={vi.fn()}
      />
    );
    expect(screen.queryByTestId('office-floor-pair-reply')).toBeNull();
  });
});

describe('floorZoneToneAt', () => {
  it('maps kitchen / meeting / pod tiles to zone tones', () => {
    expect(floorZoneToneAt({ x: 1, y: 7 })).toBe('kitchen');
    expect(floorZoneToneAt({ x: 10, y: 7 })).toBe('glass');
    expect(floorZoneToneAt({ x: 7, y: 7 })).toBe('pod');
    expect(floorZoneToneAt(null)).toBe('neutral');
  });
});
