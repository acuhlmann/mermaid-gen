// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfficeCollaborationHandlers } from '../src/features/session/useOfficeCollaborationHandlers.js';

describe('useOfficeCollaborationHandlers', () => {
  it('bumps huddle, pair, call-meeting, and talk signals', () => {
    const setHuddleSignal = vi.fn((updater) => updater({ seq: 2 }));
    const setCallMeetingSignal = vi.fn((updater) => updater(4));
    const setTalkSignal = vi.fn((updater) => updater({ seq: 1 }));

    const { result } = renderHook(() =>
      useOfficeCollaborationHandlers({ setHuddleSignal, setCallMeetingSignal, setTalkSignal })
    );

    act(() => result.current.onHuddle());
    expect(setHuddleSignal).toHaveBeenCalledOnce();
    expect(setHuddleSignal.mock.calls[0][0]({ seq: 2 })).toEqual({
      seq: 3,
      mode: 'mob',
      colleagueId: null
    });

    act(() => result.current.onPair('gilfoyle'));
    expect(setHuddleSignal.mock.calls[1][0]({ seq: 2 })).toEqual({
      seq: 3,
      mode: 'pair',
      colleagueId: 'gilfoyle'
    });

    act(() => result.current.onCallMeeting());
    expect(setCallMeetingSignal.mock.calls[0][0](4)).toBe(5);

    act(() => result.current.onTalk('dinesh', 'ping'));
    expect(setTalkSignal.mock.calls[0][0]({ seq: 1 })).toEqual({
      seq: 2,
      colleagueId: 'dinesh',
      text: 'ping'
    });
  });
});
