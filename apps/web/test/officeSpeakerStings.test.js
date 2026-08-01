import { describe, expect, it } from 'vitest';
import { officeSpeakerSting, officeSpeakerStingIds } from '../src/utils/officeSpeakerStings.js';
import { CAST_TIERS } from '../src/utils/castTiers.js';

/**
 * Speaker stings (narration roadmap Phase A). The load-bearing property is
 * restraint: a cue before every voice is a metronome, so the map is meant to
 * stay small and to cover only people whose job is the joke.
 */
describe('officeSpeakerSting', () => {
  it('returns a playable cue for the personas that have one', () => {
    const ids = officeSpeakerStingIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(typeof officeSpeakerSting(id)).toBe('function');
    }
  });

  it('returns null for everyone else, including unknown ids', () => {
    expect(officeSpeakerSting('gilfoyle')).toBeNull();
    expect(officeSpeakerSting('belson')).toBeNull();
    expect(officeSpeakerSting('nobody')).toBeNull();
    expect(officeSpeakerSting('')).toBeNull();
    expect(officeSpeakerSting(undefined)).toBeNull();
  });

  it('stays a minority of the cast, so the office is not a metronome', () => {
    const everyone = [...CAST_TIERS.team, ...CAST_TIERS.senior, ...CAST_TIERS.office];
    expect(officeSpeakerStingIds().length).toBeLessThan(everyone.length / 2);
  });

  it('only names real colleagues', () => {
    const everyone = new Set([...CAST_TIERS.team, ...CAST_TIERS.senior, ...CAST_TIERS.office]);
    for (const id of officeSpeakerStingIds()) expect(everyone.has(id)).toBe(true);
  });
});
