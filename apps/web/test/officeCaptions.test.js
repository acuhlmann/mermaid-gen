import { describe, expect, it } from 'vitest';
import { shouldShowSpokenText } from '../src/utils/officeCaptions.js';
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
