import { useCallback, useMemo } from 'react';

/**
 * Desk/office collaboration signal bumpers passed through AppWorkspaceSlot → OfficeLayer.
 */
export function useOfficeCollaborationHandlers({
  setHuddleSignal,
  setCallMeetingSignal,
  setTalkSignal
}) {
  const onHuddle = useCallback(
    () =>
      setHuddleSignal((prev) => ({
        seq: (prev?.seq ?? 0) + 1,
        mode: 'mob',
        colleagueId: null
      })),
    [setHuddleSignal]
  );

  const onPair = useCallback(
    (colleagueId) =>
      setHuddleSignal((prev) => ({
        seq: (prev?.seq ?? 0) + 1,
        mode: 'pair',
        colleagueId
      })),
    [setHuddleSignal]
  );

  const onCallMeeting = useCallback(
    () => setCallMeetingSignal((n) => n + 1),
    [setCallMeetingSignal]
  );

  const onTalk = useCallback(
    (colleagueId, text) =>
      setTalkSignal((prev) => ({ seq: (prev?.seq ?? 0) + 1, colleagueId, text })),
    [setTalkSignal]
  );

  return useMemo(
    () => ({ onHuddle, onPair, onCallMeeting, onTalk }),
    [onCallMeeting, onHuddle, onPair, onTalk]
  );
}
