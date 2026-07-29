import { describe, expect, it } from 'vitest';
import {
  MEETING_MODALITY_PHYSICAL,
  MEETING_MODALITY_REMOTE,
  normalizeMeetingModality
} from '../src/utils/officeCast.js';
import { awayFromDeskIds } from '../src/utils/officeSceneCast.js';

describe('normalizeMeetingModality', () => {
  it('keeps an explicit physical or remote pick', () => {
    expect(normalizeMeetingModality(MEETING_MODALITY_PHYSICAL)).toBe('physical');
    expect(normalizeMeetingModality(MEETING_MODALITY_REMOTE)).toBe('remote');
  });

  it('defaults inbox and chat to remote headsets', () => {
    expect(normalizeMeetingModality(undefined, { source: 'email' })).toBe('remote');
    expect(normalizeMeetingModality(null, { source: 'chat' })).toBe('remote');
  });

  it('defaults desk summons to the glass room', () => {
    expect(normalizeMeetingModality(undefined, { source: 'desk' })).toBe('physical');
    expect(normalizeMeetingModality('nope')).toBe('physical');
  });
});

describe('awayFromDeskIds meeting modality', () => {
  it('clears desks for a physical glass-room sync', () => {
    expect(
      awayFromDeskIds({
        meeting: { attendees: ['gilfoyle', 'pam'], modality: 'physical' },
        playerId: 'you'
      })
    ).toEqual(expect.arrayContaining(['you', 'gilfoyle', 'pam']));
  });

  it('leaves everyone at their desks for a remote headset sync', () => {
    expect(
      awayFromDeskIds({
        meeting: { attendees: ['gilfoyle', 'pam'], modality: 'remote' },
        playerId: 'you'
      })
    ).toEqual([]);
  });

  it('treats a missing modality as physical (legacy glass-room meetings)', () => {
    expect(
      awayFromDeskIds({
        meeting: { attendees: ['gilfoyle'] },
        playerId: 'you'
      })
    ).toEqual(expect.arrayContaining(['you', 'gilfoyle']));
  });
});
