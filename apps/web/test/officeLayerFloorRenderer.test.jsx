// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import {
  _resetForTests as resetOfficeMoments,
  acceptOfficeCoffee,
  pushOfficeCoffeeInvite,
  pushOfficeWalkBy,
  setOfficeCaptions,
  setOfficeNarration
} from '../src/state/officeMomentStore.js';
import {
  _resetOfficeViewModeForTests,
  sitDown,
  standUp
} from '../src/state/officeViewModeStore.js';
import { FLOOR_VIEW_EXIT_MS } from '../src/components/officeFloor/viewTransition.js';
import { WALK_BY_FIXTURE } from './helpers/officeFloorTestUtils.jsx';

const BASE_PROPS = {
  pause: false,
  advisorBusy: false,
  getDiagramSource: () => 'flowchart LR\n  A-->B',
  getContentType: () => 'mermaid',
  getSessionId: () => 'test-session',
  getSvgRoot: () => document,
  getUserTitle: () => 'Intern Architect',
  onUsage: () => {},
  onAdoptPrompt: () => {},
  onMeetingMinutes: () => {},
  onOfficeEvent: () => {},
  onTalkToTeam: () => {},
  onCheckHrProgression: () => {},
  playChime: () => {}
};

const COFFEE_LINES = [
  { speakerId: 'intern', text: 'Coffee?' },
  { speakerId: 'greybeard', text: 'The machine makes that noise since 1979.' }
];

/**
 * ADR-0011 mount-one-renderer guards in `OfficeLayer`.
 * A moment must render on the desk *or* on the floor, never both.
 */
describe('OfficeLayer floor renderer guards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetOfficeMoments();
    _resetOfficeViewModeForTests();
    setOfficeCaptions(true);
  });

  afterEach(() => {
    cleanup();
    resetOfficeMoments();
    _resetOfficeViewModeForTests();
    setOfficeCaptions(false);
    vi.useRealTimers();
  });

  it('shows the desk walk-by card at your screen and the floor walker when you stand', () => {
    pushOfficeWalkBy({
      colleagueId: WALK_BY_FIXTURE.colleagueId,
      body: WALK_BY_FIXTURE.body,
      actionPrompt: WALK_BY_FIXTURE.actionPrompt
    });

    render(<OfficeLayer {...BASE_PROPS} />);

    expect(document.querySelector('[data-floating-window="office-walkby"]')).toBeTruthy();
    expect(screen.queryByTestId('office-floor')).toBeNull();
    expect(screen.queryByTestId('office-floor-walker')).toBeNull();

    act(() => standUp());

    expect(document.querySelector('[data-floating-window="office-walkby"]')).toBeNull();
    expect(screen.getByTestId('office-floor')).toBeTruthy();
    expect(screen.getByTestId('office-floor-walker')).toBeTruthy();
    expect(screen.getByText(/still in the mainframe/)).toBeTruthy();

    act(() => sitDown());

    expect(document.querySelector('[data-floating-window="office-walkby"]')).toBeTruthy();
    // The floor lingers for its sit-down exit beat (§ 1a) — fading out under
    // the opaque room, never beside the desk card — then lets go.
    expect(screen.getByTestId('office-floor').dataset.viewPhase).toBe('sit-down');
    act(() => {
      vi.advanceTimersByTime(FLOOR_VIEW_EXIT_MS + 50);
    });
    expect(screen.queryByTestId('office-floor')).toBeNull();
  });

  it('keeps a coffee invite over the desk canvas until you accept', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_LINES });

    render(<OfficeLayer {...BASE_PROPS} />);

    expect(screen.getByTestId('office-coffee-invite')).toBeTruthy();
    expect(screen.queryByTestId('office-floor-coffee-invite')).toBeNull();
    expect(screen.queryByTestId('office-floor')).toBeNull();
  });

  it('stands you up to the floor coffee scene only after you accept', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_LINES });

    render(<OfficeLayer {...BASE_PROPS} />);

    expect(screen.getByTestId('office-coffee-invite')).toBeTruthy();
    expect(screen.queryByTestId('office-floor-coffee-invite')).toBeNull();

    act(() => acceptOfficeCoffee());

    expect(screen.queryByTestId('office-coffee-invite')).toBeNull();
    expect(screen.getByTestId('office-floor')).toBeTruthy();
    expect(screen.getByTestId('office-floor-scene-actor-intern')).toBeTruthy();

    act(() => sitDown());

    expect(screen.getByTestId('office-coffee-scene')).toBeTruthy();
    // Same exit beat as the walk-by above: the desk scene is back while the
    // room finishes its sit-down move, then the floor unmounts.
    act(() => {
      vi.advanceTimersByTime(FLOOR_VIEW_EXIT_MS + 50);
    });
    expect(screen.queryByTestId('office-floor')).toBeNull();

    act(() => standUp());

    expect(screen.queryByTestId('office-coffee-scene')).toBeNull();
    expect(screen.getByTestId('office-floor-scene-actor-intern')).toBeTruthy();
  });

  it('keeps coffee scene pacing when toggling desk and floor mid-break', async () => {
    // Timer-driven pacing only — real TTS does not resolve under fake timers.
    setOfficeNarration(false);
    pushOfficeCoffeeInvite({ lines: COFFEE_LINES });

    render(<OfficeLayer {...BASE_PROPS} />);

    act(() => acceptOfficeCoffee());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2300);
    });

    act(() => sitDown());
    const deskScene = screen.getByTestId('office-coffee-scene');
    expect(deskScene.textContent).toContain('1979');

    act(() => standUp());
    expect(screen.getByTestId('office-floor-scene-actor-greybeard').textContent).toContain('1979');
    expect(screen.getByTestId('office-floor-scene-actor-intern').textContent).not.toContain(
      'Coffee?'
    );
  });
});
