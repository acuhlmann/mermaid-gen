import { describe, expect, it } from 'vitest';
import { activeCaptionIndex, shouldShowSpokenText } from '../src/utils/officeCaptions.js';
import {
  bubbleAlignForTile,
  bubbleAlignForSpeaker,
  STAGE_W,
  projectIso
} from '../src/utils/officeFloorPlan.js';

describe('shouldShowSpokenText', () => {
  it('shows text when captions are on', () => {
    expect(shouldShowSpokenText({ captions: true, voiceActive: true })).toBe(true);
  });

  it('hides text when voice is playing and captions are off', () => {
    expect(shouldShowSpokenText({ captions: false, voiceActive: true })).toBe(false);
  });

  it('keeps text when nothing is speaking aloud', () => {
    expect(shouldShowSpokenText({ captions: false, voiceActive: false })).toBe(true);
  });
});

describe('bubbleAlignForTile', () => {
  it('biases left-edge speakers toward screen centre', () => {
    // Chad (intern) at (2, 5) — left of the room in the screenshot that
    // clipped his intro balloon off the phone.
    expect(bubbleAlignForTile({ x: 2, y: 5 })).toBe('start');
    expect(bubbleAlignForTile({ x: 1, y: 6 })).toBe('start');
  });

  it('biases right-edge speakers the other way', () => {
    expect(bubbleAlignForTile({ x: 10, y: 4 })).toBe('end');
  });

  it('keeps mid-floor speakers centred', () => {
    expect(bubbleAlignForTile({ x: 7, y: 7 })).toBe('center');
  });

  it('uses projected screen x, not tile x alone', () => {
    // Same tile-x can land left or right depending on y (iso skew).
    const leftish = projectIso(4, 8);
    const rightish = projectIso(8, 1);
    expect(leftish.left).toBeLessThan(STAGE_W * 0.4);
    expect(rightish.left).toBeGreaterThan(STAGE_W * 0.55);
    expect(bubbleAlignForTile({ x: 4, y: 8 })).toBe('start');
    expect(bubbleAlignForTile({ x: 8, y: 1 })).toBe('end');
  });
});

describe('bubbleAlignForSpeaker', () => {
  it('biases a central standing speaker away from a bystander head (§ 6 rule 29)', () => {
    // Chad at the whiteboard mark — centred bubble covers Gilfoyle; start clears.
    expect(bubbleAlignForSpeaker({ x: 8, y: 4 }, 'intern', { standing: true })).toBe('start');
  });

  it('keeps seated desk speakers on the edge bias path', () => {
    expect(bubbleAlignForSpeaker({ x: 2, y: 5 }, 'intern', { standing: false })).toBe('start');
  });
});

/**
 * Caption karaoke (narration roadmap Phase A). The interesting cases are all
 * the ones that return -1: highlighting a line nobody is speaking is a lie
 * about what the user is hearing, and it is the failure mode that would ship
 * silently because a highlight always *looks* plausible.
 */
describe('activeCaptionIndex', () => {
  it('marks the newest line of a growing transcript', () => {
    expect(activeCaptionIndex({ lineCount: 3, playing: true, voiceActive: true })).toBe(2);
    expect(activeCaptionIndex({ lineCount: 1, playing: true, voiceActive: true })).toBe(0);
  });

  it('marks nothing when no voice is in the air', () => {
    // Narration off, or between beats: every line is equally past.
    expect(activeCaptionIndex({ lineCount: 3, playing: true, voiceActive: false })).toBe(-1);
    // Meeting over: the minutes card is showing, nobody is talking.
    expect(activeCaptionIndex({ lineCount: 3, playing: false, voiceActive: true })).toBe(-1);
  });

  it('marks nothing for an empty or nonsensical transcript', () => {
    const live = { playing: true, voiceActive: true };
    expect(activeCaptionIndex({ lineCount: 0, ...live })).toBe(-1);
    expect(activeCaptionIndex({ lineCount: -2, ...live })).toBe(-1);
    expect(activeCaptionIndex({ lineCount: Number.NaN, ...live })).toBe(-1);
    expect(activeCaptionIndex()).toBe(-1);
  });
});
