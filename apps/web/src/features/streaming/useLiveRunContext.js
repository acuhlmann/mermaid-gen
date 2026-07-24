import { useMemo } from 'react';

/**
 * Shared live-run chrome: streaming entry, ceremony anchor, thinking indicator, run FX.
 */
export function useLiveRunContext({
  gamification,
  goMadStreak,
  insightsEntries,
  insightsMounted,
  insightsOpen,
  loading,
  phoneLayout
}) {
  const liveStreamingEntry = useMemo(
    () => insightsEntries.find((e) => (e.status ?? 'running') === 'running'),
    [insightsEntries]
  );
  const liveVariant = liveStreamingEntry?.variant ?? null;

  const ceremonyAnchor =
    insightsMounted && insightsOpen ? (phoneLayout ? 'insights' : 'canvas') : 'viewport';

  const agentThinkingChrome = useMemo(
    () => loading || insightsEntries.some((e) => (e.status ?? 'running') === 'running'),
    [insightsEntries, loading]
  );

  const runFx = useMemo(
    () => ({
      variant: liveVariant,
      streaming: Boolean(liveStreamingEntry) && (!insightsOpen || liveVariant === 'goMad'),
      intensity:
        (gamification?.streakByVariant?.[liveVariant] ?? 0) >= 2 || goMadStreak >= 2
          ? 'high'
          : 'normal'
    }),
    [gamification?.streakByVariant, goMadStreak, insightsOpen, liveStreamingEntry, liveVariant]
  );

  return {
    liveStreamingEntry,
    liveVariant,
    ceremonyAnchor,
    agentThinkingChrome,
    runFx
  };
}
