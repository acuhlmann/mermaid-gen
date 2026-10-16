// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { studioThinkingPeekLines } from '../src/features/shell/studioThinkingPeek.js';

describe('studioThinkingPeekLines', () => {
  it('prefers plan beats, most recent last, capped at three', () => {
    const lines = studioThinkingPeekLines({
      planBeats: [
        { text: 'Reading the request' },
        { text: 'Sketching the main flow' },
        { text: 'Placing decision points' },
        { text: 'Labelling the arrows' }
      ],
      technicalActions: [{ label: 'model turn' }]
    });
    expect(lines).toEqual([
      'Sketching the main flow',
      'Placing decision points',
      'Labelling the arrows'
    ]);
  });

  it('falls back to technical actions, then phases, before the first beat', () => {
    expect(
      studioThinkingPeekLines({ planBeats: [], technicalActions: [{ label: 'Reading context' }] })
    ).toEqual(['Reading context']);
    expect(studioThinkingPeekLines({ phases: [{ label: 'Plan' }] })).toEqual(['Plan']);
  });

  it('dedupes, trims, and tolerates a missing entry', () => {
    expect(studioThinkingPeekLines(null)).toEqual([]);
    expect(
      studioThinkingPeekLines({
        planBeats: [{ text: '  Same   line ' }, { text: 'Same line' }, { text: '' }, null]
      })
    ).toEqual(['Same line']);
  });
});
