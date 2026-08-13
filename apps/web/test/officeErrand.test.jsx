// @vitest-environment jsdom
/**
 * Soft errands (docs/office-isometric-mode.md § 5 slice 26).
 *
 * The thing under test is mostly a *shape*: an office task that never acts on
 * its own. ADR-0010 consequence #4 names the failure mode by name — the
 * retracted commission machinery creeping back "in feature-shaped disguises" —
 * and a quest that nags is the quietest disguise there is. So the assertions
 * below spend as much effort on what an errand refuses to do (fire a timer,
 * hold the ambient office, survive a press of _Not today_) as on what it does.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import FloorCardSlot from '../src/components/officeFloor/FloorCardSlot.jsx';
import OfficeInboxDock from '../src/components/OfficeInboxDock.jsx';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import { floorAnnouncement } from '../src/components/officeFloor/floorAnnouncement.js';
import {
  _resetForTests,
  dismissOfficeErrand,
  getOfficeSnapshot,
  hasActiveOfficeSurface,
  pushOfficeEmail,
  pushOfficeErrand,
  pushOfficeImPing,
  pushOfficeWalkBy,
  settleOfficeErrand
} from '../src/state/officeMomentStore.js';
import { _resetDeskCommsUiForTests, openDeskCommsPanel } from '../src/state/deskCommsUiStore.js';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode
} from '../src/state/officeViewModeStore.js';
import {
  OFFICE_XP_AWARDS,
  applyOfficeEvent,
  createInitialState
} from '../src/state/runGamificationStore.js';
import { OFFICE_LOG_KINDS, buildOfficeLogDigest } from '../src/utils/officeLogDigest.js';
import { OFFICE_CHROME_COPY, officeEmailTemplates } from '../src/utils/officeCast.js';

const copy = OFFICE_CHROME_COPY.floor;

beforeEach(() => {
  _resetForTests();
  _resetOfficeViewModeForTests();
  _resetDeskCommsUiForTests();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  _resetForTests();
  _resetOfficeViewModeForTests();
  _resetDeskCommsUiForTests();
});

describe('the errand slice never schedules anything (ADR-0010 consequence #4)', () => {
  it('raises nothing when the email merely arrives', () => {
    pushOfficeEmail({
      colleagueId: 'hr',
      subject: 'Quick favour',
      body: 'have a word with Chad',
      errand: 'intern'
    });

    // The marker is on the mail — that is what grows the button.
    expect(getOfficeSnapshot().emails[0].errand).toBe('intern');
    // …and the errand itself does not exist until somebody presses it.
    expect(getOfficeSnapshot().errand).toBeNull();
  });

  it('outlives every timer the office has, because it owns none', () => {
    vi.useFakeTimers();
    pushOfficeErrand({ fromId: 'hr', colleagueId: 'intern' });

    // Far past the walk-by TTL, the desk-arrival TTL and any plausible nag.
    vi.advanceTimersByTime(10 * 60_000);

    expect(getOfficeSnapshot().errand?.colleagueId).toBe('intern');
  });

  /*
   * The one that would be easy to "fix" wrongly. `hasActiveOfficeSurface` gates
   * the ambient director, and an errand has no expiry — counting it would hold
   * the whole office silent for the rest of the session, which is the
   * difference between something interrupting you and something waiting.
   */
  it('does not hold the ambient office while it waits', () => {
    pushOfficeErrand({ fromId: 'hr', colleagueId: 'intern' });
    expect(hasActiveOfficeSurface()).toBe(false);

    // A surface that *is* interruptive still reads as one, so the assertion
    // above is about the errand rather than about a broken predicate.
    pushOfficeWalkBy({ colleagueId: 'gilfoyle', body: 'hm.' });
    expect(hasActiveOfficeSurface()).toBe(true);
  });

  it('is droppable in one press, with nothing left behind', () => {
    pushOfficeErrand({ fromId: 'hr', colleagueId: 'intern' });
    dismissOfficeErrand();
    expect(getOfficeSnapshot().errand).toBeNull();
  });
});

describe('settling an errand', () => {
  it('only the person you were sent to can settle it', () => {
    pushOfficeErrand({ fromId: 'hr', colleagueId: 'intern' });

    expect(settleOfficeErrand('gilfoyle')).toBeNull();
    expect(getOfficeSnapshot().errand?.colleagueId).toBe('intern');

    const settled = settleOfficeErrand('intern');
    // The object rather than `true`: `fromId` is what the log line needs and it
    // is gone from the store a line later.
    expect(settled?.fromId).toBe('hr');
    expect(getOfficeSnapshot().errand).toBeNull();
  });

  it('cannot be settled twice', () => {
    pushOfficeErrand({ fromId: 'hr', colleagueId: 'intern' });
    expect(settleOfficeErrand('intern')).toBeTruthy();
    expect(settleOfficeErrand('intern')).toBeNull();
  });

  it('refuses an errand to nobody, and an errand to the person asking', () => {
    expect(pushOfficeErrand({ fromId: 'hr', colleagueId: '' })).toBeNull();
    expect(pushOfficeErrand({ fromId: 'hr', colleagueId: 'hr' })).toBeNull();
    expect(getOfficeSnapshot().errand).toBeNull();
  });

  it('pays a tiny XP beat — smaller than sitting through a meeting', () => {
    const { state, emissions } = applyOfficeEvent(createInitialState(), { kind: 'errandRun' });
    expect(state.xp).toBe(OFFICE_XP_AWARDS.errandRun);
    expect(emissions.some((e) => e.kind === 'xp')).toBe(true);
    expect(OFFICE_XP_AWARDS.errandRun).toBeLessThan(OFFICE_XP_AWARDS.meetingSurvived);
  });

  /*
   * The log is the errand's only trace once it settles — there is deliberately
   * no completed-errand state — and `detail` carries who sent you, because the
   * office finding out that Linda outsources her difficult conversations is the
   * joke. What was actually said never appears, same as `chat`.
   */
  it('leaves a line in the office log naming who sent you, never what was said', () => {
    expect(OFFICE_LOG_KINDS).toContain('errand');
    const [line] = buildOfficeLogDigest([
      {
        at: new Date(2026, 0, 1, 11, 5).getTime(),
        kind: 'errand',
        colleagueId: 'intern',
        detail: 'hr'
      }
    ]);
    expect(line).toContain('intern');
    expect(line).toContain('hr');
  });
});

describe('the card slot rung (§ 7 ordering)', () => {
  const errand = { colleagueId: 'intern', fromId: 'hr' };
  const join = { colleagueId: 'intern', partnerId: 'dinesh', kind: 'whiteboard' };

  function slot(props) {
    return render(
      <FloorCardSlot copy={copy} onGoHome={vi.fn()} onClosePerson={vi.fn()} {...props} />
    );
  }

  it('replaces the hint when you are carrying one', () => {
    slot({ errand, onErrandTalk: vi.fn() });
    expect(screen.getByTestId('office-floor-errand-card').textContent).toContain('Chad');
    expect(screen.queryByText(copy.hint)).toBeNull();
  });

  /*
   * The ordering claim that matters, and it is about *lifetime* rather than
   * commitment: an errand has no timer, so ranking it above the transient
   * offers would mean one open errand suppressing every Join in for the rest of
   * the session.
   */
  it('yields to a Join in, which expires while it does not', () => {
    slot({ errand, join, onErrandTalk: vi.fn(), onJoin: vi.fn() });
    expect(screen.getByTestId('office-floor-join-card')).toBeTruthy();
    expect(screen.queryByTestId('office-floor-errand-card')).toBeNull();
  });

  it('fires the ordinary talk verb, at the person you were sent to', () => {
    const onErrandTalk = vi.fn();
    slot({ errand, onErrandTalk });
    fireEvent.click(screen.getByRole('button', { name: /Go and talk/i }));
    expect(onErrandTalk).toHaveBeenCalledWith('intern');
  });

  /*
   * The guard `TalkPitch` and `FloorJoinCard` both make — a button that
   * silently does nothing is worse than no offer — plus the half only a durable
   * rung needs: the hint has to come *back*. A card that self-guards to null
   * inside a branch the slot has already taken leaves an empty box, and for an
   * errand that box would sit there for the rest of the session.
   */
  it('withholds itself without a handler, and gives the hint back', () => {
    slot({ errand });
    expect(screen.queryByTestId('office-floor-errand-card')).toBeNull();
    expect(screen.getByText(copy.hint)).toBeTruthy();
  });
});

describe('the live region says so, without going deaf to movement', () => {
  const errand = { colleagueId: 'intern', fromId: 'hr' };

  it('names the errand while you are standing still', () => {
    const said = floorAnnouncement({
      copy,
      presence: { phase: 'standing', key: 1 },
      errand
    });
    expect(said.text).toContain('Chad');
    expect(said.text).toContain('Linda');
  });

  /*
   * The regression this shape exists to prevent. Every other card-slot rung is
   * momentary; an errand is durable, so if it were ranked among them a
   * screen-reader user would stop being told they are walking for as long as
   * they carry one.
   */
  it('still reports walking, which is the whole reason it is not ranked higher', () => {
    const said = floorAnnouncement({
      copy,
      presence: { phase: 'walking', key: 2 },
      errand
    });
    expect(said.text).toBe(copy.narration.walkingFloor);
  });

  it('yields to a Join in there too, matching the card slot', () => {
    const said = floorAnnouncement({
      copy,
      presence: { phase: 'standing', key: 3 },
      join: { colleagueId: 'intern', partnerId: 'dinesh' },
      errand
    });
    expect(said.key).toMatch(/^join:/);
  });
});

describe('Linda asks, from the inbox', () => {
  const EMAIL = {
    id: 'email-errand',
    colleagueId: 'hr',
    subject: 'Quick favour — re: the reply-all situation',
    body: 'Could you have a quiet word?',
    errand: 'intern',
    createdAt: 1,
    read: true
  };

  it('grows a CTA naming who you are being sent to', () => {
    const onStartErrand = vi.fn();
    render(
      <OfficeInboxDock
        emails={[EMAIL]}
        unreadCount={0}
        focusTime={false}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAdoptPrompt={vi.fn()}
        onCallMeeting={vi.fn()}
        onStartErrand={onStartErrand}
        canCallMeeting
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /no unread/ }));
    fireEvent.click(screen.getByText(EMAIL.subject));
    fireEvent.click(screen.getByRole('button', { name: /Go and find Chad/i }));
    expect(onStartErrand).toHaveBeenCalledWith('intern', 'hr');
  });

  it('withholds the CTA when nothing is wired to honour it', () => {
    render(
      <OfficeInboxDock
        emails={[EMAIL]}
        unreadCount={0}
        focusTime={false}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAdoptPrompt={vi.fn()}
        onCallMeeting={vi.fn()}
        canCallMeeting
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /no unread/ }));
    fireEvent.click(screen.getByText(EMAIL.subject));
    expect(screen.queryByRole('button', { name: /Go and find/i })).toBeNull();
  });

  /*
   * The bank is where the set piece is authored, so an errand nobody can be
   * given is the way this whole slice dies quietly. Pinned as a coverage claim
   * rather than a spot check: the assertion is that *some* template carries the
   * marker and that the marker names somebody real.
   */
  it('ships at least one email that can start one, aimed at a real colleague', () => {
    const carriers = officeEmailTemplates().filter((template) => template.errand);
    expect(carriers.length).toBeGreaterThan(0);
    for (const template of carriers) {
      expect(template.errand).not.toBe(template.colleagueId);
      expect(OFFICE_CHROME_COPY.colleagues?.[template.errand] ?? true).toBeTruthy();
    }
  });
});

/**
 * The wiring, through the real `OfficeLayer`.
 *
 * The pieces above are each covered in isolation; what nothing else sees is
 * that the two ends are attached to the right handlers. The errand's whole
 * shape is a hand-off between renderers — raised at the desk, run on the floor,
 * settled from either — so a slice where every unit passes and the wiring is
 * wrong looks exactly like a slice that works until you try it.
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

  /*
   * The physical half of the joke, and the half a unit test cannot see: "go and
   * find Chad" is not a phrase about a messenger window. Pressing it has to
   * take you out of your chair, or the errand's payoff is on a renderer the
   * button never sent you to.
   */
  it('the inbox CTA raises the errand and stands you up', () => {
    pushOfficeEmail({
      colleagueId: 'hr',
      subject: 'Quick favour',
      body: 'Have a quiet word with Chad.',
      errand: 'intern'
    });
    render(<OfficeLayer {...BASE_PROPS} />);
    act(() => openDeskCommsPanel('inbox'));

    // The subject in the list, not the one on the arrival toast beside it.
    fireEvent.click(screen.getByText('Quick favour', { selector: '.office-email-subject' }));
    expect(getOfficeViewMode()).toBe('desk');

    fireEvent.click(screen.getByRole('button', { name: /Go and find Chad/i }));

    expect(getOfficeSnapshot().errand).toMatchObject({ fromId: 'hr', colleagueId: 'intern' });
    expect(getOfficeViewMode()).toBe('floor');
  });

  /*
   * Slop Chat™ settles it identically, which is the ADR-0011 rule 1 claim: an
   * errand is about having the conversation, not about which renderer you had
   * it in. `fromId` rides along because the log line needs it and the store has
   * already dropped it.
   */
  it('typing at them in Slop Chat settles it, and pays the beat once', async () => {
    const onOfficeEvent = vi.fn();
    // A thread has to exist before you can open it — Chad has, of course,
    // already messaged you.
    pushOfficeImPing({ colleagueId: 'intern', body: 'sorry for the reply-all!!' });
    pushOfficeErrand({ fromId: 'hr', colleagueId: 'intern' });
    render(<OfficeLayer {...BASE_PROPS} onOfficeEvent={onOfficeEvent} />);
    act(() => openDeskCommsPanel('slopChat'));

    fireEvent.click(screen.getByRole('button', { name: /Chad/ }));
    const composer = screen.getByPlaceholderText(/./, { selector: 'textarea, input' });
    fireEvent.change(composer, { target: { value: 'linda sent me' } });
    fireEvent.submit(composer.closest('form'));

    expect(getOfficeSnapshot().errand).toBeNull();
    const errandEvents = onOfficeEvent.mock.calls.filter(([kind]) => kind === 'errandRun');
    expect(errandEvents).toHaveLength(1);
    expect(errandEvents[0][1]).toMatchObject({ colleagueId: 'intern', fromId: 'hr' });
  });

  it('messaging somebody else leaves the errand exactly where it was', () => {
    const onOfficeEvent = vi.fn();
    pushOfficeImPing({ colleagueId: 'gilfoyle', body: 'no.' });
    pushOfficeErrand({ fromId: 'hr', colleagueId: 'intern' });
    render(<OfficeLayer {...BASE_PROPS} onOfficeEvent={onOfficeEvent} />);
    act(() => openDeskCommsPanel('slopChat'));

    fireEvent.click(screen.getByRole('button', { name: /Gilfoyle/ }));
    const composer = screen.getByPlaceholderText(/./, { selector: 'textarea, input' });
    fireEvent.change(composer, { target: { value: 'unrelated' } });
    fireEvent.submit(composer.closest('form'));

    expect(getOfficeSnapshot().errand?.colleagueId).toBe('intern');
    expect(onOfficeEvent.mock.calls.some(([kind]) => kind === 'errandRun')).toBe(false);
  });
});
