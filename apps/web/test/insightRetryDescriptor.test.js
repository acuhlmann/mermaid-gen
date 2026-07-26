import { describe, expect, it } from 'vitest';
import {
  buildInsightRetryDescriptor,
  canRetryInsightEntry,
  showRetryWithQualityForEntry
} from '../src/utils/insightRetryDescriptor.js';

describe('insightRetryDescriptor', () => {
  it('builds intent descriptor with prompt', () => {
    const d = buildInsightRetryDescriptor({
      operation: 'intent',
      variant: 'intent',
      modelProfile: 'fast',
      payload: { prompt: 'Add a node', focusNode: { id: 'A' } }
    });
    expect(d).toEqual(
      expect.objectContaining({
        operation: 'intent',
        prompt: 'Add a node',
        modelProfile: 'fast'
      })
    );
  });

  it('returns null for analyze variant', () => {
    expect(
      buildInsightRetryDescriptor({
        operation: 'analyze',
        variant: 'critique',
        payload: { kind: 'critique' }
      })
    ).toBeNull();
  });

  it('builds transform descriptor for the Barker simplify mode', () => {
    const d = buildInsightRetryDescriptor({
      operation: 'transform',
      variant: 'barker',
      modelProfile: 'fast',
      payload: { mode: 'barker' }
    });
    expect(d).toEqual(
      expect.objectContaining({
        operation: 'transform',
        variant: 'barker',
        mode: 'barker'
      })
    );
  });

  it('detects retry UI eligibility', () => {
    const entry = {
      status: 'failed',
      retryDescriptor: { operation: 'intent', prompt: 'x' }
    };
    expect(canRetryInsightEntry(entry)).toBe(true);
    expect(showRetryWithQualityForEntry(entry)).toBe(false);
    expect(
      showRetryWithQualityForEntry({
        ...entry,
        retryDescriptor: { ...entry.retryDescriptor, modelProfile: 'fast' }
      })
    ).toBe(true);
  });
});
