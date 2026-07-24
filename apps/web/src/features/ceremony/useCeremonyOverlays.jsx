import { useMemo } from 'react';
import { CeremonyOverlaysSlot } from './CeremonyOverlaysSlot.jsx';

/**
 * Memoized ceremony overlay stack for live runs and streak HUD.
 */
export function useCeremonyOverlays({
  ceremonyAnchor,
  bootSeq,
  streakHudToasts,
  streakHudAchievement,
  streakHudLevelUp,
  liveVariant,
  liveStreamingEntry,
  insightsOpen,
  insightsMounted,
  gamification
}) {
  return useMemo(
    () => (
      <CeremonyOverlaysSlot
        anchor={ceremonyAnchor}
        bootSeq={bootSeq}
        toasts={streakHudToasts}
        achievement={streakHudAchievement}
        levelUp={streakHudLevelUp}
        liveVariant={liveVariant}
        liveStreaming={Boolean(liveStreamingEntry)}
        showLiveRunHud={Boolean(liveStreamingEntry) && !insightsOpen}
        liveStreak={gamification?.streakByVariant?.[liveVariant] ?? 0}
        insightsOpen={insightsMounted && insightsOpen}
      />
    ),
    [
      bootSeq,
      ceremonyAnchor,
      gamification?.streakByVariant,
      insightsMounted,
      insightsOpen,
      liveStreamingEntry,
      liveVariant,
      streakHudAchievement,
      streakHudLevelUp,
      streakHudToasts
    ]
  );
}
