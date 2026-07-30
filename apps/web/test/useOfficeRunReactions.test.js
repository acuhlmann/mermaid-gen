// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useOfficeRunReactions,
  RUN_REACTION_DELAY_MS
} from '../src/hooks/useOfficeRunReactions.js';

vi.mock('../utils/officeAmbienceStorage.js', () => ({
  readOfficeCadenceMemory: () => ({ lastFiredAt: 0 }),
  writeOfficeCadenceMemory: vi.fn()
}));

vi.mock('../utils/officeMomentDelivery.js', () => ({
  deliverCannedMoment: vi.fn(() => true),
  deliverLlmMoment: vi.fn(() => false),
  readSlotContext: () => ({ diagramSource: 'graph TD\n  A-->B' }),
  RECENT_MOMENTS_CAP: 8
}));

vi.mock('../state/officeMomentStore.js', () => ({
  getOfficeSnapshot: () => ({ focusTime: false }),
  shouldHoldAmbientOfficeMoments: () => false
}));

describe('useOfficeRunReactions fire()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not throw when a run signal fires (memory read before planRunReaction)', async () => {
    const { rerender } = renderHook(
      ({ runSignal }) =>
        useOfficeRunReactions({
          runSignal,
          getDiagramSource: () => 'graph TD\n  A-->B',
          random: () => 0
        }),
      { initialProps: { runSignal: null } }
    );

    await act(async () => {
      rerender({ runSignal: { id: 1, variant: 'jared' } });
      await vi.advanceTimersByTimeAsync(RUN_REACTION_DELAY_MS + 50);
    });
  });
});
