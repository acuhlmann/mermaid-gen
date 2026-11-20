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
 * never chased** (ADR-0010); and the dismissals that are *not* answers to the
 * invite still leave nothing, because a toast that closes to get out of the way
 * is not a toast you answered.
 *
 * **Accepting is the other answer, and until 2026-11-20 this file pinned it as
 * no answer at all.** The case below it used to read `accepting it leaves no
 * mark`, with a comment arguing something narrower and correct — that a
 * *decline* beat there would tell the next `/moment` you skipped a meeting you
 * were walking into. `hasWorkingMemoryFact(organizer) === false` asserts a
 * great deal more than that: it says nothing whatever was recorded, which is
 * the claim that kept the room remembering every no to an invite and forgetting
 * every yes. It is rewritten to its own claim rather than deleted — a deleted
 * case is indistinguishable from a lost invariant — and the thing it was
 * actually defending is pinned beside it: the acceptance writes the *accepted*
 * line and never the refused one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import MeetingInviteToast from '../src/components/MeetingInviteToast.jsx';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import {
  _resetForTests,
  dismissOfficeMeetingInvite,
  getOfficeSnapshot,
  hasActiveOfficeSurface,
  pushOfficeMeetingInvite
} from '../src/state/officeMomentStore.js';
import {
  _resetOfficeWorkingMemoryForTests,
  hasWorkingMemoryFact,
  workingMemoryPromptLines
} from '../src/state/officeWorkingMemoryStore.js';
import {
  acceptOfficeMeetingInviteWithMemory,
  declineOfficeMeetingInviteWithMemory
} from '../src/utils/officeInviteMemory.js';
import { _resetDeskCommsUiForTests } from '../src/state/deskCommsUiStore.js';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode
} from '../src/state/officeViewModeStore.js';
import { OFFICE_CHROME_COPY } from '../src/utils/officeCast.js';

const copy = OFFICE_CHROME_COPY.meetingInvite;
const DECLINED_LINE = "you put a meeting on the user's calendar; they did not go to it";
const ACCEPTED_LINE = "you put a meeting on the user's calendar; they went to it";

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
   * Accepting is the **other** answer, and the thing the old version of this
   * case was defending is the half that still matters: a beat here must not say
   * you skipped a meeting you were walking into. So the assertion is which line
   * was written, not whether anything was — the matcher is the claim, and
   * `hasWorkingMemoryFact(...) === false` was making three of them at once.
   */
  it('accepting it leaves the organizer knowing you came, and never that you ducked it', () => {
    pushOfficeMeetingInvite(INVITE);
    render(<OfficeLayer {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: copy.accept }));

    expect(getOfficeSnapshot().meetingInvite).toBeNull();
    expect(workingMemoryPromptLines('scrumMaster')).toEqual([ACCEPTED_LINE]);
    expect(workingMemoryPromptLines('scrumMaster')).not.toContain(DECLINED_LINE);
  });

  /*
   * And it still stands you up on the way, which is the half of the handler
   * that runs *after* the writer. It used to read the invite off the snapshot
   * and then clear it; it now takes the object back from the writer, so an
   * early return smuggled in there would leave you at your desk with the toast
   * gone. (The glass room itself is `startMeeting`'s, and it is asynchronous —
   * the roster the handler passes it is pinned at the unit below instead.)
   */
  it('still stands you up on the way to the glass room', () => {
    pushOfficeMeetingInvite(INVITE);
    render(<OfficeLayer {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: copy.accept }));

    expect(getOfficeViewMode()).toBe('floor');
  });
});

/**
 * Accepting, at the unit the handler calls.
 *
 * The write is one line; what it must not do is fire on the two presses that
 * clear the same toast without answering it. `dismissOfficeMeetingInvite` has
 * four callers and only three are answers, which is why the store still writes
 * nothing and each caller that knows what the press meant owns the beat.
 */
describe('accepting a meeting invite', () => {
  it('leaves the mark on the organizer, and on nobody else', () => {
    pushOfficeMeetingInvite(INVITE);

    const accepted = acceptOfficeMeetingInviteWithMemory();

    expect(accepted?.colleagueId).toBe('scrumMaster');
    expect(accepted?.attendees).toEqual(INVITE.attendees);
    expect(getOfficeSnapshot().meetingInvite).toBeNull();
    expect(workingMemoryPromptLines('scrumMaster')).toEqual([ACCEPTED_LINE]);
    /*
     * The organizer asked and the organizer is answered. The other attendees
     * were in the room too — whether sitting in a meeting is itself a fact
     * anybody holds is a question nothing in this office answers yet, and it is
     * a different slice from this one, so nothing here is claimed about them
     * beyond that *your answer to the invite* did not reach them.
     */
    expect(workingMemoryPromptLines('intern')).not.toContain(ACCEPTED_LINE);
    expect(workingMemoryPromptLines('greybeard')).not.toContain(ACCEPTED_LINE);
  });

  it('is not an answer when there was nothing on screen to accept', () => {
    expect(acceptOfficeMeetingInviteWithMemory()).toBeNull();
    expect(hasWorkingMemoryFact('scrumMaster')).toBe(false);
  });

  /*
   * The invariant this file's header has always claimed and which, until the
   * accept writer existed, was carried entirely by the case that said accepting
   * leaves no mark. Two of the four callers clear the same toast to get it out
   * of the way — calling your own meeting, and opening the people picker — and
   * neither is an answer to anybody's invite. They are on the **bare store
   * call**, and the store writes nothing: a function that guessed would tell
   * the organizer you had ducked, or come to, a meeting you never replied to.
   */
  it('leaves nothing when the toast is cleared by something that is not an answer', () => {
    pushOfficeMeetingInvite(INVITE);

    const cleared = dismissOfficeMeetingInvite();

    expect(cleared?.colleagueId).toBe('scrumMaster');
    expect(getOfficeSnapshot().meetingInvite).toBeNull();
    expect(hasWorkingMemoryFact('scrumMaster')).toBe(false);
  });

  /*
   * Queue 13's rule holds for a yes exactly as it does for a no: the office may
   * *notice* and may never *chase*. An acceptance that re-raised the card would
   * be auto-fix-on-idle with a calendar (ADR-0010 consequence #4).
   */
  it('owns no timer once it has been accepted', () => {
    vi.setSystemTime(new Date('2026-07-11T12:00:00Z'));
    vi.useFakeTimers();
    pushOfficeMeetingInvite(INVITE);
    acceptOfficeMeetingInviteWithMemory();

    vi.advanceTimersByTime(10 * 60_000);

    expect(getOfficeSnapshot().meetingInvite).toBeNull();
    expect(workingMemoryPromptLines('scrumMaster')).toEqual([ACCEPTED_LINE]);
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
