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
 *   onBattleUnsettled?: () => void,
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
  onBattleUnsettled,
  huddleHandlers = {}
}) {
  const [battleLinesDone, setBattleLinesDone] = useState(false);
  const battleId = battle?.id ?? null;

  useEffect(() => {
    setBattleLinesDone(false);
  }, [battleId]);

  /*
   * Slice 28: a declined break plays out without you, so it paces on
   * `declined` as well as on `accepted`.
   *
   * **Pacing it is what makes declining safe**, not a nicety. `coffee` counts
   * toward `hasActiveOfficeSurface`, so a scene that sits in the store unpaced
   * never reaches `onDone`, never dismisses, and holds the ambient director
   * silent for the rest of the session. Declining used to delete the scene
   * outright, which is why that could not happen before.
   */
  const coffeeUnattended = Boolean(coffee?.declined && !coffee?.accepted);
  const coffeePace = useScenePacing({
    lines: coffee?.lines ?? [],
    active: Boolean(coffee && (coffee.accepted || coffee.declined)),
    /*
     * A break you turned down is **silent**, and the wrapper rather than
     * `undefined` is the whole point — CLAUDE.md's trap, met head on: with no
     * narrator `useScenePacing` reveals every line at once, so passing nothing
     * would flush the script in a tick and dismiss the scene before anybody
     * finished walking to the machine.
     *
     * Silent because the lines have nowhere to be heard from. You are at your
     * desk (the overlay is suppressed for a declined scene) or across the room,
     * and TTS has no proximity — narrating it would be two voices from an empty
     * corner of the office. On the floor the balloons still draw, which is the
     * same bargain shop talk makes: you read what you are near.
     */
    narrateLine: coffeeUnattended ? () => ({ spoken: false }) : narrateLine,
    prefetchLine: coffeeUnattended ? undefined : prefetchLine,
    paceMs: COFFEE_LINE_PACE_MS,
    silentDurationMs: COFFEE_BREAK_DURATION_MS,
    sceneId: coffee?.id ?? null,
    onDone: onCoffeeDone
  });

  /*
   * Slice 30: the same bargain for the battle, with the one difference that made
   * slice 28 defer it.
   *
   * A coffee break ends when its script ends. A battle ends when somebody
   * **settles** it — `onDone` here only raises `battleLinesDone`, and what
   * actually clears the store is a click on the verdict panel. That panel is
   * gated on `accepted`, so an unattended battle would reach the end of its
   * lines, render no panel, and sit in the store forever with
   * `hasActiveOfficeSurface` holding the ambient director silent for the rest of
   * the session. It is slice 28's trap wearing the one costume that survives
   * slice 28's fix.
   *
   * So an argument nobody refereed **goes unsettled**: `onBattleUnsettled`
   * dismisses it where an attended one would wait for a verdict. That is the
   * design answer and the joke at once — the holy war is still on, and pressing
   * the join card is what turns it into a question you get to answer.
   *
   * `onDone` is read through a ref that `useScenePacing` refreshes every render,
   * so closing over `battleUnattended` reads the current value rather than the
   * one from the render that started the scene.
   */
  const battleUnattended = Boolean(battle?.declined && !battle?.accepted);
  const battlePace = useScenePacing({
    lines: battle?.lines ?? [],
    active: Boolean(battle && (battle.accepted || battle.declined)),
    // Silent, and a wrapper rather than `undefined`, for the reason spelled out
    // on the coffee break above: no narrator flushes the whole script in a tick.
    narrateLine: battleUnattended
      ? () => ({ spoken: false })
      : typeof narrateLine === 'function'
        ? narrateLine
        : () => ({ spoken: false }),
    prefetchLine: battleUnattended ? undefined : prefetchLine,
    paceMs: BATTLE_LINE_PACE_MS,
    silentDurationMs: BATTLE_SILENT_DURATION_MS,
    sceneId: battle?.id ?? null,
    onDone: () => (battleUnattended ? onBattleUnsettled?.() : setBattleLinesDone(true))
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
