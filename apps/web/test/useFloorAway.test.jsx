// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const wanderMock = vi.fn(() => ({
  wanderer: null,
  handleArrive: vi.fn(),
  figureRef: { current: null }
}));

vi.mock('../src/components/officeFloor/useFloorWander.js', () => ({
  useFloorWander: (...args) => wanderMock(...args)
}));

import { useFloorAway } from '../src/components/officeFloor/useFloorAway.js';

const coffee = { lines: [{ speakerId: 'intern' }, { speakerId: 'greybeard' }] };

afterEach(() => {
  wanderMock.mockReset();
  wanderMock.mockImplementation(() => ({
    wanderer: null,
    handleArrive: vi.fn(),
    figureRef: { current: null }
  }));
});

describe('useFloorAway', () => {
  it('keeps a desk empty while somebody walks home after the moment ends', () => {
    const { result, rerender } = renderHook((props) => useFloorAway(props), {
      initialProps: { coffee }
    });

    act(() => {
      result.current.handleCommuteArrive('intern');
    });
    expect(result.current.settledIds.has('intern')).toBe(true);

    rerender({ coffee: null });

    expect(result.current.awayIds).toContain('intern');
    expect(result.current.commuters.some((c) => c.id === 'intern' && c.phase === 'home')).toBe(
      true
    );
  });

  it('extends the stage away list with a wanderer but keeps floorState on the inner list', () => {
    wanderMock.mockImplementation(() => ({
      wanderer: { seatId: 'gilfoyle' },
      handleArrive: vi.fn(),
      figureRef: { current: null }
    }));

    const { result } = renderHook(() => useFloorAway({ standing: true }));

    expect(result.current.awayIds).toContain('you');
    expect(result.current.awayIds).toContain('gilfoyle');
    expect(result.current.floorState.awayIds).not.toContain('gilfoyle');
    expect(result.current.floorState.wanderer?.seatId).toBe('gilfoyle');
  });
});
