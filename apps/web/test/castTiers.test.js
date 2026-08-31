import { describe, expect, it } from 'vitest';
import { CAST_TIERS, tierOf } from '../src/utils/castTiers.js';
import {
  DAY_ONE_INTRO_IDS,
  MEETING_FACILITATOR,
  MEETING_PRESENTER_POOL,
  MEETING_MODALITY_REMOTE,
  MEETING_ROSTER_MAX,
  MEETING_SENIOR_POOL,
  MEETING_VENUE_CAB,
  MEETING_VENUE_STEERING,
  MEETING_VENUE_WORKING_GROUP,
  OFFICE_COLLEAGUES,
  OFFICE_EMAIL_LLM_CAST,
  OFFICE_IM_LLM_CAST,
  OFFICE_WALKBY_LLM_CAST,
  SENIOR_EMAIL_TEMPLATES,
  SENIOR_STAKEHOLDERS,
  TEAM_INTRO_LINES,
  buildMeetingAttendeesFromColleagues,
  escalationRosterFor,
  listMeetingDirectory,
  meetingContextFromEmails,
  meetingTopicFromEmailSubjects,
  nextMeetingVenue,
  normalizeMeetingRoster,
  officeSenderInfo,
  pickMeetingAttendees,
  provisionalMeetingTitle
} from '../src/utils/officeCast.js';
import { VARIANT_PERSONAS } from '../src/utils/slopitectCopy.js';

const ALL_IDS = Object.values(CAST_TIERS).flat();

describe('cast tiers', () => {
  it('assigns every cast member to exactly one tier', () => {
    // Coverage claim: an emptied CAST_TIERS would pass both checks below
    // while examining nothing.
    expect(ALL_IDS.length).toBeGreaterThan(0);
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length);
    for (const id of ALL_IDS) expect(tierOf(id)).toBeTruthy();
    expect(tierOf('nobody')).toBeNull();
  });

  it('Day One intro is Your Team minus Gilfoyle/Russ plus Linda', () => {
    expect([...DAY_ONE_INTRO_IDS]).toEqual([
      'dinesh',
      'erlich',
      'jared',
      'richard',
      'barker',
      'hr'
    ]);
    expect(DAY_ONE_INTRO_IDS).not.toContain('gilfoyle');
    expect(DAY_ONE_INTRO_IDS).not.toContain('russ');
    for (const id of DAY_ONE_INTRO_IDS) {
      if (id === 'hr') {
        expect(officeSenderInfo(id).introLine).toBeTruthy();
      } else {
        expect(TEAM_INTRO_LINES[id], `${id} team intro`).toBeTruthy();
        expect(officeSenderInfo(id).introLine).toBe(TEAM_INTRO_LINES[id]);
      }
    }
  });

  it('covers every advisor persona, colleague, and invented exec', () => {
    // `fix` is a button, not a roundtable persona — it has no tier.
    for (const variant of Object.keys(VARIANT_PERSONAS)) {
      if (variant === 'fix') continue;
      expect(tierOf(variant), `persona ${variant}`).toBeTruthy();
    }
    for (const id of Object.keys(OFFICE_COLLEAGUES)) {
      expect(tierOf(id), `colleague ${id}`).toBeTruthy();
    }
    for (const id of Object.keys(SENIOR_STAKEHOLDERS)) {
      expect(tierOf(id), `senior ${id}`).toBe('senior');
    }
  });

  it('resolves display info for every tier, including the invented execs', () => {
    for (const id of ALL_IDS) {
      const info = officeSenderInfo(id);
      expect(info.name, `${id} name`).toBeTruthy();
      expect(info.name).not.toBe('A Colleague');
      expect(info.avatarEmoji, `${id} emoji`).toBeTruthy();
      expect(info.accentColor, `${id} accent`).toBeTruthy();
    }
    expect(officeSenderInfo('belson').name).toBe('Gavin Belson');
    expect(officeSenderInfo('cto')).toMatchObject({ id: 'cto' }); // retired — falls through to stakeholder stub
    expect(officeSenderInfo('cfo').name).toBe('Diane');
  });

  it('keeps the senior tier out of the day-to-day ambient casts', () => {
    // Senior stakeholders are meeting people; they never ping your desk.
    for (const cast of [OFFICE_WALKBY_LLM_CAST, OFFICE_EMAIL_LLM_CAST, OFFICE_IM_LLM_CAST]) {
      for (const id of cast) expect(tierOf(id), `${id} in ambient cast`).not.toBe('senior');
    }
  });

  it('routes senior voices only through the senior email bank', () => {
    for (const template of SENIOR_EMAIL_TEMPLATES) {
      expect(tierOf(template.colleagueId), `${template.id} sender`).toBe('senior');
    }
  });
});

describe('pickMeetingAttendees', () => {
  it('steering preset always seats Pam with seniors and a presenter', () => {
    for (const value of [0, 0.2, 0.49, 0.5, 0.75, 0.99]) {
      const seats = pickMeetingAttendees(() => value, { facilitator: true });
      expect(seats[0]).toBe('scrumMaster');
      expect(seats.length).toBeGreaterThanOrEqual(3);
      expect(seats.length).toBeLessThanOrEqual(4);
      expect(new Set(seats).size).toBe(seats.length);

      const seniors = seats.filter((id) => MEETING_SENIOR_POOL.includes(id));
      const presenters = seats.filter((id) => MEETING_PRESENTER_POOL.includes(id));
      expect(seniors.length).toBeGreaterThanOrEqual(1);
      expect(presenters.length).toBe(1);
    }
  });

  it('ambient invites sometimes skip Pam', () => {
    const seats = pickMeetingAttendees(() => 0.99, { facilitator: 'sometimes' });
    expect(seats).not.toContain(MEETING_FACILITATOR);
    expect(seats.length).toBeGreaterThanOrEqual(2);
  });
});

describe('buildMeetingAttendeesFromColleagues', () => {
  it('dedupes senders without auto-adding the facilitator', () => {
    const seats = buildMeetingAttendeesFromColleagues(['intern', 'greybeard', 'intern']);
    expect(seats).toEqual(['intern', 'greybeard']);
    expect(seats).not.toContain(MEETING_FACILITATOR);
  });

  it('returns only the colleagues you picked', () => {
    expect(buildMeetingAttendeesFromColleagues([])).toEqual([]);
  });
});

describe('normalizeMeetingRoster', () => {
  it('caps at eight and does not add uninvited colleagues', () => {
    const many = normalizeMeetingRoster([
      'intern',
      'greybeard',
      'facilities',
      'hr',
      'helpdesk',
      'gilfoyle',
      'jared',
      'richard',
      'barker'
    ]);
    expect(many.length).toBe(MEETING_ROSTER_MAX);
    expect(normalizeMeetingRoster(['intern'], { forceFacilitator: false })).toEqual(['intern']);
  });

  it('adds Pam only when the steering preset forces her', () => {
    expect(
      normalizeMeetingRoster(['gilfoyle'], { forceFacilitator: true, random: () => 0 })
    ).toEqual(['scrumMaster', 'gilfoyle']);
  });

  it('does not inject Pam into a large team-only roster', () => {
    const teamRoster = ['gilfoyle', 'erlich', 'russ', 'jared', 'richard', 'dinesh'];
    expect(normalizeMeetingRoster(teamRoster, { random: () => 0 })).toEqual(teamRoster);
  });
});

describe('provisionalMeetingTitle', () => {
  it('uses the topic, quick-sync labels, or steering only when appropriate', () => {
    expect(provisionalMeetingTitle({ topic: 'Gateway latency', attendees: ['gilfoyle'] })).toBe(
      'Gateway latency'
    );
    expect(
      provisionalMeetingTitle({
        attendees: ['gilfoyle'],
        modality: MEETING_MODALITY_REMOTE
      })
    ).toMatch(/Headset/i);
    expect(
      provisionalMeetingTitle({
        attendees: ['scrumMaster', 'belson', 'gilfoyle']
      })
    ).toMatch(/Architecture Review Board/i);
    expect(provisionalMeetingTitle({ attendees: ['gilfoyle', 'dinesh'] })).toMatch(/sync/i);
  });
});

describe('listMeetingDirectory', () => {
  it('lists every tier so the picker can grab anyone', () => {
    const rows = listMeetingDirectory();
    expect(rows.some((row) => row.id === 'facilities' && row.tier === 'office')).toBe(true);
    expect(rows.some((row) => row.id === 'barker' && row.tier === 'senior')).toBe(true);
    expect(rows.some((row) => row.id === 'gilfoyle' && row.tier === 'team')).toBe(true);
    // Both engineers are core team — Dinesh took a new seventh seat rather than
    // inheriting one, so he must show up beside Gilfoyle, not instead of him.
    expect(rows.some((row) => row.id === 'dinesh' && row.tier === 'team')).toBe(true);
  });
});

describe('meetingTopicFromEmailSubjects', () => {
  it('joins up to three subjects and truncates long topics', () => {
    expect(meetingTopicFromEmailSubjects(['A', 'B', 'C', 'D'])).toBe('A; B; C');
    const long = 'x'.repeat(120);
    const topic = meetingTopicFromEmailSubjects([long, long]);
    expect(topic?.length).toBe(200);
    expect(topic?.endsWith('...')).toBe(true);
  });
});

describe('meetingContextFromEmails', () => {
  it('includes subject and body for source-driven headset syncs', () => {
    const ctx = meetingContextFromEmails([
      { subject: 'FRIDGE CLEANOUT', body: 'Label your leftovers.' }
    ]);
    expect(ctx.topic).toBe('FRIDGE CLEANOUT');
    expect(ctx.contextSource).toBe('email');
    expect(ctx.contextDetail).toContain('Label your leftovers.');
  });
});

/**
 * §10.10 — the escalation ladder. A room that wrapped goes up one rung and
 * the change under review rides along; escalation is a scripted beat, not a
 * picker, so the destination and the roster are both decided by the client.
 */
describe('nextMeetingVenue', () => {
  it('climbs working group -> steering -> cab and stops at the top', () => {
    expect(nextMeetingVenue(undefined, { attendees: ['gilfoyle', 'dinesh'] })).toBe(
      MEETING_VENUE_STEERING
    );
    expect(
      nextMeetingVenue(MEETING_VENUE_WORKING_GROUP, { attendees: ['gilfoyle', 'dinesh'] })
    ).toBe(MEETING_VENUE_STEERING);
    expect(nextMeetingVenue(MEETING_VENUE_STEERING)).toBe(MEETING_VENUE_CAB);
    expect(nextMeetingVenue(MEETING_VENUE_CAB)).toBe(null);
  });

  it('skips the steering rung when the room already seats the committee', () => {
    // Seniors + the facilitator already make it a steering room, so the next
    // rung up is the CAB — one button takes the working group to the hearing.
    expect(
      nextMeetingVenue(MEETING_VENUE_WORKING_GROUP, {
        attendees: [MEETING_FACILITATOR, 'barker', 'gilfoyle']
      })
    ).toBe(MEETING_VENUE_CAB);
  });
});

describe('escalationRosterFor', () => {
  it('staffs the CAB with the board: the senior pool plus the facilitator', () => {
    const roster = escalationRosterFor(MEETING_VENUE_CAB, { random: () => 0 });
    for (const id of [...MEETING_SENIOR_POOL, MEETING_FACILITATOR]) {
      expect(roster).toContain(id);
    }
    // The board is deterministic — it is a board, not a lottery.
    expect(roster).toEqual([...new Set([...MEETING_SENIOR_POOL, MEETING_FACILITATOR])]);
  });

  it('reuses the current room when it already has seniors and a facilitator', () => {
    const current = [MEETING_FACILITATOR, 'barker', 'belson', 'gilfoyle'];
    expect(escalationRosterFor(MEETING_VENUE_STEERING, { current })).toEqual(current);
  });

  it('books a steering roster when the current room is not already senior', () => {
    const roster = escalationRosterFor(MEETING_VENUE_STEERING, {
      current: ['gilfoyle', 'dinesh'],
      random: () => 0
    });
    expect(roster).toContain(MEETING_FACILITATOR);
    expect(roster.some((id) => MEETING_SENIOR_POOL.includes(id))).toBe(true);
    // A team room that could not seat a steering review keeps its own seats.
    expect(escalationRosterFor(MEETING_VENUE_WORKING_GROUP, { current: ['gilfoyle'] })).toEqual([
      'gilfoyle'
    ]);
  });
});
