// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MEETING_MAX_ATTENDEES } from '@archislop/shared';
import MeetingOverlay from '../src/components/MeetingOverlay.jsx';
import { deliverCannedMoment } from '../src/utils/officeMomentDelivery.js';
import { CAST_TIERS } from '../src/utils/castTiers.js';
import {
  OFFICE_ALL_HANDS_PER_SESSION,
  OFFICE_MEETING_INVITES_PER_SESSION,
  pickNextMoment
} from '../src/utils/officeCadence.js';
import { _resetForTests, getOfficeSnapshot } from '../src/state/officeMomentStore.js';

/**
 * The all-hands (docs/office-parody.md §10.4). Its defining property is that
 * the roster and the speakers are DIFFERENT LISTS — everything below is a
 * consequence of that split, and each assertion guards a way of collapsing it
 * back into one list.
 */

afterEach(() => {
  cleanup();
  _resetForTests();
});

const CTX = { label: 'paymentGateway', userTitle: 'Associate Slopitect', userName: 'Alex' };
const deliverAllHands = () =>
  deliverCannedMoment('all-hands', CTX, { memory: { lastFiredAt: 0, seenTemplateIds: [] } });

const pick = (overrides) =>
  pickNextMoment({
    now: 10_000_000,
    sessionStartedAt: 0,
    lastFiredAt: 0,
    momentCount: 0,
    llmMomentCount: 0,
    meetingInviteCount: 0,
    hasDiagram: true,
    random: () => 0.999,
    ...overrides
  });

describe('all-hands cadence budget', () => {
  it('has a budget of its own, so it never eats the ordinary meeting invite', () => {
    expect(OFFICE_ALL_HANDS_PER_SESSION).toBeGreaterThan(0);
    expect(OFFICE_MEETING_INVITES_PER_SESSION).toBeGreaterThan(0);
  });

  it('is unreachable once spent, and never fires over an empty canvas', () => {
    // random 0.999 lands in the last weighted lane, which is all-hands.
    expect(pick().kind).toBe('all-hands');
    expect(pick({ allHandsCount: OFFICE_ALL_HANDS_PER_SESSION }).kind).not.toBe('all-hands');
    expect(pick({ hasDiagram: false }).kind).not.toBe('all-hands');
  });

  it('never spends an LLM call on the summons itself', () => {
    // The meeting that follows costs one /meeting call like any other; the
    // invite is canned, so the set piece does not cost two.
    expect(pick().useLlm).toBe(false);
  });
});

describe('all-hands delivery', () => {
  it('seats a bounded speaking panel and puts everybody else in the audience', () => {
    expect(deliverAllHands()).toBe(true);
    const invite = getOfficeSnapshot().meetingInvite;

    expect(invite.colleagueId).toBe('belson');
    expect(invite.attendees).toContain('belson');
    // The whole reason this design exists: the roster stays inside the ceiling
    // even though the room does not.
    expect(invite.attendees.length).toBeLessThanOrEqual(MEETING_MAX_ATTENDEES);

    const everyone = [...CAST_TIERS.team, ...CAST_TIERS.senior, ...CAST_TIERS.office];
    expect(invite.audience.length).toBeGreaterThan(MEETING_MAX_ATTENDEES);
    expect(invite.attendees.length + invite.audience.length).toBe(everyone.length);
    // Nobody is both scripted and silent.
    for (const id of invite.attendees) expect(invite.audience).not.toContain(id);
  });

  it('leaves an ordinary meeting invite with no audience at all', () => {
    expect(
      deliverCannedMoment('meeting-invite', CTX, {
        memory: { lastFiredAt: 0, seenTemplateIds: [] }
      })
    ).toBe(true);
    expect(getOfficeSnapshot().meetingInvite.audience).toBeUndefined();
  });
});

describe('MeetingOverlay crowd', () => {
  const baseMeeting = {
    state: 'playing',
    title: 'All-Hands',
    attendees: ['belson', 'barker'],
    facilitatorId: 'barker',
    modality: 'physical',
    transcript: [{ speakerId: 'belson', kind: 'procedural', text: 'Welcome, everyone.' }],
    completed: false,
    interjectionsLeft: 0
  };

  it('renders the silent crowd only when there is one', () => {
    const { container: withCrowd } = render(
      <MeetingOverlay meeting={{ ...baseMeeting, audience: ['gilfoyle', 'dinesh', 'hr'] }} />
    );
    expect(withCrowd.ownerDocument.querySelector('.office-meeting-audience')).not.toBeNull();
    expect(screen.getByLabelText('3 more attending, not speaking')).toBeTruthy();

    cleanup();

    const { container: ordinary } = render(<MeetingOverlay meeting={baseMeeting} />);
    expect(ordinary.ownerDocument.querySelector('.office-meeting-audience')).toBeNull();
  });
});
