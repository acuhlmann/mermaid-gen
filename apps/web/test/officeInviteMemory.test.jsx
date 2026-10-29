// @vitest-environment jsdom
/**
 * Declining a meeting leaves a mark (`docs/automations/office-life.md` queue 13,
 * the second instance).
 *
 * The errand drop closed the first half of this item; the refusal sweep that
 * found it also found the calendar invite still silent — `dismissOfficeMeetingInvite`
 * cleared the toast and kept nothing, so Chad could book your afternoon, read
 * your no, and be a stranger to `hasWorkingMemoryFact` the next time you stood
 * next to him.
 *
 * Three things are worth pinning and only one of them is the write. The mark
 * lands on the **organizer** and on nobody else; the refusal is **noticed and
 * never chased** (ADR-0010); and the three dismissals that are *not* answers
 * to the invite still leave nothing, because a toast that closes because you
 * accepted is not a toast you refused.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import MeetingInviteToast from '../src/components/MeetingInviteToast.jsx';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import {
  _resetForTests,
  getOfficeSnapshot,
  hasActiveOfficeSurface,
  pushOfficeMeetingInvite
} from '../src/state/officeMomentStore.js';
import {
  _resetOfficeWorkingMemoryForTests,
  hasWorkingMemoryFact,
  workingMemoryPromptLines
} from '../src/state/officeWorkingMemoryStore.js';
import { declineOfficeMeetingInviteWithMemory } from '../src/utils/officeInviteMemory.js';
import { _resetDeskCommsUiForTests } from '../src/state/deskCommsUiStore.js';
import { _resetOfficeViewModeForTests } from '../src/state/officeViewModeStore.js';
import { OFFICE_CHROME_COPY } from '../src/utils/officeCast.js';

const copy = OFFICE_CHROME_COPY.meetingInvite;
const DECLINED_LINE = 'they put a meeting on your calendar; you did not go to it';

const INVITE = {
  colleagueId: 'scrumMaster',
  title: 'WG: Diagram Alignment Sync (recurring)',
  body: 'Agenda: alignment.',
  attendees: ['scrumMaster', 'intern', 'greybeard']
};

beforeEach(() => {
  _resetForTests();
  _resetOfficeViewModeForTests();
  _resetDeskCommsUiForTests();
  _resetOfficeWorkingMemoryForTests();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('refusing a meeting invite', () => {
  it('leaves the mark on the organizer, and on nobody else', () => {
    pushOfficeMeetingInvite(INVITE);

    const declined = declineOfficeMeetingInviteWithMemory();

    expect(declined?.colleagueId).toBe('scrumMaster');
    expect(getOfficeSnapshot().meetingInvite).toBeNull();
    expect(hasWorkingMemoryFact('scrumMaster')).toBe(true);
    expect(workingMemoryPromptLines('scrumMaster')).toEqual([DECLINED_LINE]);
    /*
     * The fiction rule rather than the wiring one: a calendar decline reaches
     * the person who sent the invite. The other attendees were not told your
     * answer, and a memory on one of them is a colleague remembering a
     * conversation that never got to them — the fabrication the situation rule
     * in `docs/agents/domains/office.md` was measured on, arriving through
     * memory instead of through a prompt.
     */
    expect(hasWorkingMemoryFact('intern')).toBe(false);
    expect(hasWorkingMemoryFact('greybeard')).toBe(false);
  });

  it('is not a refusal when there was nothing on screen to refuse', () => {
    expect(declineOfficeMeetingInviteWithMemory()).toBeNull();
    expect(hasWorkingMemoryFact('scrumMaster')).toBe(false);
  });

  /*
   * Queue 13's own rule, asserted rather than trusted: a refusal may be
   * *noticed* and may never be *chased*. A declined invite that comes back is
   * auto-fix-on-idle with a calendar (ADR-0010 consequence #4).
   */
  it('owns no timer once it has been refused', () => {
    vi.setSystemTime(new Date('2026-07-11T12:00:00Z'));
    vi.useFakeTimers();
    pushOfficeMeetingInvite(INVITE);
    declineOfficeMeetingInviteWithMemory();

    vi.advanceTimersByTime(10 * 60_000);

    expect(getOfficeSnapshot().meetingInvite).toBeNull();
    expect(hasActiveOfficeSurface()).toBe(false);
    // And the noticing did not grow a second copy of itself in the meantime.
    expect(workingMemoryPromptLines('scrumMaster')).toEqual([DECLINED_LINE]);
  });
});

/**
 * The wiring, through the real `OfficeLayer`.
 *
 * The write is covered above; what nothing else sees is which button is
 * attached to it. `dismissOfficeMeetingInvite` has four callers and only one of
 * them is an answer to the invite, so a slice where the unit passes and the
 * handler is still the bare store call looks exactly like a slice that works.
 */
describe('end to end, through OfficeLayer', () => {
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

  it("pressing “Can't — I'm shipping” leaves the organizer knowing", () => {
    pushOfficeMeetingInvite(INVITE);
    render(<OfficeLayer {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: copy.decline }));

    expect(getOfficeSnapshot().meetingInvite).toBeNull();
    expect(workingMemoryPromptLines('scrumMaster')).toEqual([DECLINED_LINE]);
  });

  /*
   * Accepting is the negative case that keeps the line honest. It clears the
   * same toast through the same store function, and it is not a refusal — a
   * beat here would tell the next `/moment` you skipped a meeting you are
   * walking into.
   */
  it('accepting it leaves no mark', () => {
    pushOfficeMeetingInvite(INVITE);
    render(<OfficeLayer {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: copy.accept }));

    expect(getOfficeSnapshot().meetingInvite).toBeNull();
    expect(hasWorkingMemoryFact('scrumMaster')).toBe(false);
  });
});

/**
 * The second exit, which shares the handler.
 *
 * "Propose new time" is a gag: the organizer turns your counter-offer down and
 * the toast closes itself 2.6 s later through `onDecline`. It is a different
 * refusal from the button beside it and the office can only see what they have
 * in common — the meeting was on your calendar and you did not go to it — which
 * is why one line covers both.
 */
describe('proposing a new time', () => {
  it('ends the same way, and is remembered the same way', async () => {
    vi.useFakeTimers();
    pushOfficeMeetingInvite(INVITE);
    render(
      <MeetingInviteToast
        invite={getOfficeSnapshot().meetingInvite}
        onAccept={vi.fn()}
        onDecline={declineOfficeMeetingInviteWithMemory}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: copy.proposeNewTime }));
    // The gag's own 2.6 s, in its own act block: the effect that schedules the
    // timer flushes when the scope closes, so advancing the clock in the same
    // block advances it before the timer exists.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(getOfficeSnapshot().meetingInvite).toBeNull();
    expect(workingMemoryPromptLines('scrumMaster')).toEqual([DECLINED_LINE]);
  });
});
