/**
 * Office wire-contract sensor — catches duplicated enums between web cast
 * and shared schemas before one side drifts.
 */
import { describe, expect, it } from 'vitest';
import {
  MEETING_MAX_ATTENDEES,
  MEETING_MIN_ATTENDEES,
  MEETING_VENUES as SHARED_MEETING_VENUES
} from '@archislop/shared';
import {
  MEETING_ROSTER_MAX,
  MEETING_ROSTER_MIN,
  MEETING_VENUES as CAST_MEETING_VENUES
} from '../src/utils/officeCast.js';

describe('office wire contracts', () => {
  it('meeting venues are the shared ladder re-exported on the client', () => {
    expect([...CAST_MEETING_VENUES]).toEqual([...SHARED_MEETING_VENUES]);
  });

  it('client roster caps alias shared attendee bounds', () => {
    expect(MEETING_ROSTER_MAX).toBe(MEETING_MAX_ATTENDEES);
    expect(MEETING_ROSTER_MIN).toBe(MEETING_MIN_ATTENDEES);
  });
});
