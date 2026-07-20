import RunCeremonyOverlays from '../../components/RunCeremonyOverlays.jsx';

/**
 * Gamification ceremony overlays (boot sequence, XP toasts, level-up banners).
 *
 * @param {{
 *   anchor: 'insights' | 'canvas' | 'viewport';
 *   bootSeq: { trigger: number, variant: string | null };
 *   toasts: Array<object>;
 *   achievement: object | null;
 *   levelUp: object | null;
 *   liveVariant: string | null;
 *   liveStreaming: boolean;
 *   showLiveRunHud: boolean;
 *   liveStreak: number;
 *   insightsOpen: boolean;
 * }} props
 */
export function CeremonyOverlaysSlot({
  anchor,
  bootSeq,
  toasts,
  achievement,
  levelUp,
  liveVariant,
  liveStreaming,
  showLiveRunHud,
  liveStreak,
  insightsOpen
}) {
  return (
    <RunCeremonyOverlays
      anchor={anchor}
      bootSeq={bootSeq}
      toasts={toasts}
      achievement={achievement}
      levelUp={levelUp}
      liveVariant={liveVariant}
      liveStreaming={liveStreaming}
      showLiveRunHud={showLiveRunHud}
      liveStreak={liveStreak}
      insightsOpen={insightsOpen}
    />
  );
}
