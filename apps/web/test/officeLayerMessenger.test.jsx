// @vitest-environment jsdom
/**
 * Regression for the Slop Chat "new thread" and floor "Message" verbs: both
 * called an `setMessengerOpen` that was never defined anywhere in
 * `OfficeLayer` (the panel's open/closed state is derived from
 * `deskCommsUiStore`, opened via `openDeskCommsPanel`). Picking a colleague
 * from the empty-thread "New message" flow threw a `ReferenceError` instead
 * of starting the thread.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import { _resetForTests as resetOfficeMoments } from '../src/state/officeMomentStore.js';
import { _resetDeskCommsUiForTests } from '../src/state/deskCommsUiStore.js';
import {
  _resetOfficeMessengerUiForTests,
  requestOfficeMessengerOpen
} from '../src/state/officeMessengerUiStore.js';
import { OFFICE_CHROME_COPY } from '../src/utils/officeCast.js';

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

describe('OfficeLayer Slop Chat new-thread flow', () => {
  beforeEach(() => {
    resetOfficeMoments();
    _resetOfficeMessengerUiForTests();
    _resetDeskCommsUiForTests();
  });

  afterEach(() => {
    cleanup();
    resetOfficeMoments();
    _resetOfficeMessengerUiForTests();
    _resetDeskCommsUiForTests();
  });

  it('starts a thread with a picked colleague from an empty Slop Chat', () => {
    const onWindowError = vi.fn();
    window.addEventListener('error', onWindowError);

    try {
      render(<OfficeLayer {...BASE_PROPS} />);

      act(() => requestOfficeMessengerOpen());

      const newMessageButton = screen.getByText(OFFICE_CHROME_COPY.messenger.newMessage);
      fireEvent.click(newMessageButton);

      const colleagueOption = screen.getAllByRole('option')[0];
      fireEvent.click(colleagueOption);

      // The panel must still be open on the picked thread, not have crashed shut.
      expect(screen.getByRole('dialog', { name: OFFICE_CHROME_COPY.messenger.title })).toBeTruthy();
      expect(onWindowError).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('error', onWindowError);
    }
  });
});
