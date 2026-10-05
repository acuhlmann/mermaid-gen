/**
 * Shared helpers for isometric mode (renderer #2) Vitest suites.
 *
 * Import from here instead of re-copying `standUp()` + render boilerplate.
 * See `docs/agents/isometric-floor-tests.md` for the full floor test map.
 */

import { cleanup, render } from '@testing-library/react';
import { vi } from 'vitest';
import OfficeFloor from '../../src/components/OfficeFloor.jsx';
import { setOfficeCaptions, setOfficeNarration } from '../../src/state/officeMomentStore.js';
import { _resetOfficeViewModeForTests, standUp } from '../../src/state/officeViewModeStore.js';

/** Midday on a fixed calendar day — one of the two phases with no `PHASE_ART` hold. */
export const OFFICE_FLOOR_TEST_MIDDAY = new Date(2026, 7, 11, 12, 0, 0);

/** Floor suites' shared PRNG seed (Chad at the whiteboard under midday wander rules). */
export const OFFICE_FLOOR_TEST_PRNG_SEED = 0.75;

let floorDeterminismPinned = false;

/**
 * Pin wall clock and `Math.random` before mounting `OfficeFloor`.
 * Without this, mounts read the real hour and PRNG — red ~7.5 h/day in CI.
 */
export function pinOfficeFloorDeterminism() {
  if (!vi.isFakeTimers()) {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  }
  vi.setSystemTime(OFFICE_FLOOR_TEST_MIDDAY);
  if (!vi.isMockFunction(Math.random)) {
    vi.spyOn(Math, 'random').mockReturnValue(OFFICE_FLOOR_TEST_PRNG_SEED);
  }
  floorDeterminismPinned = true;
}

/** Tear down fake `Date` / PRNG after a mount suite finishes. */
export function unpinOfficeFloorDeterminism() {
  if (!floorDeterminismPinned) {
    return;
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
  floorDeterminismPinned = false;
}

/** Walk-by fixture used across desk and floor renderer tests. */
export const WALK_BY_FIXTURE = {
  id: 'walk-test-1',
  colleagueId: 'greybeard',
  body: 'We tried that in 1979. It is still in the mainframe.',
  actionPrompt: 'Add the legacy system'
};

/** Coffee scene lines — two speakers at the machine. */
export const COFFEE_SCENE_FIXTURE = {
  id: 'coffee-test-1',
  accepted: false,
  lines: [
    { speakerId: 'intern', text: 'Is the machine meant to make that noise?' },
    { speakerId: 'greybeard', text: 'It has made that noise since 1979.' }
  ]
};

/** Holy war fixture — two sides and a verdict. */
export const BATTLE_SCENE_FIXTURE = {
  id: 'battle-test-1',
  topic: 'Tabs vs spaces',
  accepted: false,
  votedFor: null,
  lines: [
    { speakerId: 'scrumMaster', text: 'Spaces. Consistency is a ceremony.' },
    { speakerId: 'greybeard', text: 'Tabs. I have been right since 1998.' }
  ],
  verdicts: { scrumMaster: 'Noted in the retro.', greybeard: 'As I said. In 1998.' }
};

/**
 * Reset module-level floor stores between tests.
 */
export function resetOfficeFloorTestState() {
  cleanup();
  unpinOfficeFloorDeterminism();
  _resetOfficeViewModeForTests();
  setOfficeCaptions(false);
  setOfficeNarration(false);
}

/**
 * Default captions on for suites that assert dialogue in bubbles.
 */
export function enableFloorDialogueCaptions() {
  setOfficeCaptions(true);
}

/**
 * Stand up and render `OfficeFloor`. Pass flat props (walkBy, coffee, handlers, …).
 *
 * @param {Record<string, unknown>} [props]
 * @param {{ pinDeterminism?: boolean }} [opts] Set `pinDeterminism: false` when the suite pins its own hour (slice 29 meeting holds).
 */
export function renderFloor(props = {}, { pinDeterminism = true } = {}) {
  if (pinDeterminism) {
    pinOfficeFloorDeterminism();
  }
  standUp();
  return render(<OfficeFloor {...props} />);
}
