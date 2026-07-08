import { describe, expect, it } from 'vitest';
import {
  formatActionDurationMs,
  formatPatchApplyDetail
} from '../src/utils/formatTechnicalActionDetail.js';

describe('formatActionDurationMs', () => {
  it('formats sub-second durations in ms', () => {
    expect(formatActionDurationMs(420)).toBe('420ms');
  });

  it('formats seconds with one decimal under 10s', () => {
    expect(formatActionDurationMs(1250)).toBe('1.3s');
  });
});

describe('formatPatchApplyDetail', () => {
  it('joins duration, line diff, graph diff, and revision', () => {
    expect(
      formatPatchApplyDetail({
        durationMs: 840,
        linesAdded: 3,
        linesRemoved: 1,
        nodesAdded: 2,
        revisionId: 7
      })
    ).toBe('840ms · +3/−1 lines · +2 nodes · rev 7');
  });

  it('notes sanitizer rescue when present', () => {
    expect(
      formatPatchApplyDetail({
        durationMs: 2000,
        sanitizerApplied: ['quote-fix'],
        revisionId: 4
      })
    ).toBe('2.0s · sanitizer rescue · rev 4');
  });
});
