import { describe, expect, it } from 'vitest';
import { CAST_TIERS, tierOf } from '../src/utils/castTiers.js';
import {
  MEETING_FACILITATOR,
  MEETING_PRESENTER_POOL,
  MEETING_ROSTER_MAX,
  MEETING_SENIOR_POOL,
  OFFICE_COLLEAGUES,
  OFFICE_EMAIL_LLM_CAST,
  OFFICE_IM_LLM_CAST,
  OFFICE_WALKBY_LLM_CAST,
  SENIOR_EMAIL_TEMPLATES,
  SENIOR_STAKEHOLDERS,
  buildMeetingAttendeesFromColleagues,
  listMeetingDirectory,
  meetingTopicFromEmailSubjects,
  normalizeMeetingRoster,
  officeSenderInfo,
  pickMeetingAttendees
} from '../src/utils/officeCast.js';
import { VARIANT_PERSONAS } from '../src/utils/slopitectCopy.js';

const ALL_IDS = Object.values(CAST_TIERS).flat();

describe('cast tiers', () => {
  it('assigns every cast member to exactly one tier', () => {
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length);
    for (const id of ALL_IDS) expect(tierOf(id)).toBeTruthy();
    expect(tierOf('nobody')).toBeNull();
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
    expect(officeSenderInfo('cto').name).toBe('Marcus');
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
  it('seats the facilitator, senior stakeholders, and one team presenter', () => {
    // Sweep a spread of random values so both the 1- and 2-senior branches run.
    for (const value of [0, 0.2, 0.49, 0.5, 0.75, 0.99]) {
      const seats = pickMeetingAttendees(() => value);
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
});

describe('buildMeetingAttendeesFromColleagues', () => {
  it('always includes the facilitator and dedupes senders', () => {
    const seats = buildMeetingAttendeesFromColleagues(['intern', 'greybeard', 'intern']);
    expect(seats[0]).toBe(MEETING_FACILITATOR);
    expect(seats).toEqual(['scrumMaster', 'intern', 'greybeard']);
  });

  it('pads a single invitee so the huddle meets the seat floor', () => {
    const seats = buildMeetingAttendeesFromColleagues([]);
    expect(seats[0]).toBe(MEETING_FACILITATOR);
    expect(seats.length).toBeGreaterThanOrEqual(2);
  });
});

describe('normalizeMeetingRoster', () => {
  it('caps at eight and can skip forcing Pam for a true huddle', () => {
    const many = normalizeMeetingRoster([
      'intern',
      'greybeard',
      'facilities',
      'hr',
      'helpdesk',
      'refine',
      'critique',
      'explain',
      'exec'
    ]);
    expect(many[0]).toBe('scrumMaster');
    expect(many.length).toBe(MEETING_ROSTER_MAX);
    expect(normalizeMeetingRoster(['intern'], { forceFacilitator: false })).toEqual([
      'intern',
      'refine'
    ]);
  });
});

describe('listMeetingDirectory', () => {
  it('lists every tier so the picker can grab anyone', () => {
    const rows = listMeetingDirectory();
    expect(rows.some((row) => row.id === 'facilities' && row.tier === 'office')).toBe(true);
    expect(rows.some((row) => row.id === 'exec' && row.tier === 'senior')).toBe(true);
    expect(rows.some((row) => row.id === 'refine' && row.tier === 'team')).toBe(true);
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
