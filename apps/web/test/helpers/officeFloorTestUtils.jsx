/**
 * Shared helpers for isometric mode (renderer #2) Vitest suites.
 *
 * Import from here instead of re-copying `standUp()` + render boilerplate.
 * See `docs/agents/isometric-floor-tests.md` for the full floor test map.
 */

import { cleanup, render } from '@testing-library/react';
import OfficeFloor from '../../src/components/OfficeFloor.jsx';
import { setOfficeCaptions, setOfficeNarration } from '../../src/state/officeMomentStore.js';
import { _resetOfficeViewModeForTests, standUp } from '../../src/state/officeViewModeStore.js';

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
 */
export function renderFloor(props = {}) {
  standUp();
  return render(<OfficeFloor {...props} />);
}
