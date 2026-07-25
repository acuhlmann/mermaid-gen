/**
 * The set pieces, at their locations (§ 5 slice 4).
 *
 * Two calls with the same shape — a coffee break by the machine, a cubicle
 * battle across the aisle — kept together so the view component does not carry
 * both prop lists. `FloorScene` itself owns the pacing; this is only which
 * scenes are on.
 *
 * `OfficeLayer` renders these **or** the desk-mode overlays, never both: two
 * paced performances would speak every line twice through TTS.
 */

import FloorScene from './FloorScene.jsx';

/**
 * @param {{
 *   coffee?: any,
 *   battle?: any,
 *   scale: number,
 *   sceneHandlers?: Record<string, any>
 * }} props
 */
export function FloorScenes({ coffee = null, battle = null, scale, sceneHandlers = {} }) {
  return (
    <>
      {coffee ? (
        <FloorScene
          kind="coffee"
          scene={coffee}
          scale={scale}
          narrateLine={sceneHandlers.narrateLine}
          prefetchLine={sceneHandlers.prefetchLine}
          onAccept={sceneHandlers.onAcceptCoffee}
          onDecline={sceneHandlers.onDeclineCoffee}
          onDone={sceneHandlers.onCoffeeDone}
        />
      ) : null}
      {battle ? (
        <FloorScene
          kind="battle"
          scene={battle}
          scale={scale}
          narrateLine={sceneHandlers.narrateLine}
          prefetchLine={sceneHandlers.prefetchLine}
          onAccept={sceneHandlers.onAcceptBattle}
          onDecline={sceneHandlers.onDeclineBattle}
          onVote={sceneHandlers.onVoteBattle}
          onDone={sceneHandlers.onBattleDone}
        />
      ) : null}
    </>
  );
}

export default FloorScenes;
