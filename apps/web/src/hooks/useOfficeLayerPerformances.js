/**
 * Scene pacing for renderer #1 and #2 (ADR-0011).
 *
 * Coffee, battle, and huddle line reveals live here — in `OfficeLayer`, which
 * never unmounts when you stand up or sit down — so toggling desk ↔ floor does
 * not restart dialogue mid-scene. Each overlay / floor set piece receives
 * `visibleLines` (or huddle ring controls) as props and renders only.
 */

import { useEffect, useState } from 'react';
import {
  BATTLE_LINE_PACE_MS,
  BATTLE_SILENT_DURATION_MS,
  COFFEE_BREAK_DURATION_MS,
  COFFEE_LINE_PACE_MS
} from './officeScenePacingConstants.js';
import { useHuddleRingControls } from './useHuddleRingControls.js';
import { useScenePacing } from './useScenePacing.js';

/**
 * @param {{
 *   coffee: any,
 *   battle: any,
 *   huddle: any,
 *   narrateLine?: (line: any) => Promise<{ spoken?: boolean }> | void,
 *   prefetchLine?: (line: any) => void,
 *   onCoffeeDone?: () => void,
 *   huddleHandlers?: {
 *     onHardStop?: () => void,
 *     onAdoptPrompt?: (prompt: string, colleagueId: string) => void,
 *     onRequestSuggestion?: (speakerId: string) => Promise<any>,
 *     narrateLine?: (line: any) => Promise<{ spoken?: boolean }>,
 *     prefetchLine?: (line: any) => void,
 *     onCancelNarration?: () => void
 *   }
 * }} options
 */
export function useOfficeLayerPerformances({
  coffee,
  battle,
  huddle,
  narrateLine,
  prefetchLine,
  onCoffeeDone,
  huddleHandlers = {}
}) {
  const [battleLinesDone, setBattleLinesDone] = useState(false);
  const battleId = battle?.id ?? null;

  useEffect(() => {
    setBattleLinesDone(false);
  }, [battleId]);

  const coffeePace = useScenePacing({
    lines: coffee?.lines ?? [],
    active: Boolean(coffee?.accepted && coffee),
    narrateLine,
    prefetchLine,
    paceMs: COFFEE_LINE_PACE_MS,
    silentDurationMs: COFFEE_BREAK_DURATION_MS,
    sceneId: coffee?.id ?? null,
    onDone: onCoffeeDone
  });

  const battlePace = useScenePacing({
    lines: battle?.lines ?? [],
    active: Boolean(battle?.accepted && battle),
    narrateLine: typeof narrateLine === 'function' ? narrateLine : () => ({ spoken: false }),
    prefetchLine,
    paceMs: BATTLE_LINE_PACE_MS,
    silentDurationMs: BATTLE_SILENT_DURATION_MS,
    sceneId: battle?.id ?? null,
    onDone: () => setBattleLinesDone(true)
  });

  const huddleRing = useHuddleRingControls({
    huddle,
    onHardStop: huddleHandlers.onHardStop,
    onAdoptPrompt: huddleHandlers.onAdoptPrompt,
    onRequestSuggestion: huddleHandlers.onRequestSuggestion,
    narrateLine: huddleHandlers.narrateLine,
    prefetchLine: huddleHandlers.prefetchLine,
    onCancelNarration: huddleHandlers.onCancelNarration
  });

  return {
    coffeeVisibleLines: coffeePace.visibleLines,
    coffeeLineSpoken: coffeePace.lineSpoken,
    battleVisibleLines: battlePace.visibleLines,
    battleLineSpoken: battlePace.lineSpoken,
    battleLinesDone,
    huddleRing
  };
}

export default useOfficeLayerPerformances;
