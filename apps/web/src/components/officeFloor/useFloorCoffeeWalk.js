/**
 * Walk you to the coffee machine once a break is accepted.
 *
 * Coffee set pieces belong at the machine (slice 4), not at your desk. An
 * invite stays over the canvas until you say yes; accepting stands you up
 * (`OfficeLayer`) and this hook finishes the trip — a plain roam walk, not a
 * prop-use intent, so arriving does not call `getCoffee` and pour a second
 * break on top of the one already running.
 */

import { useEffect, useRef } from 'react';
import { propTileFor } from '../../utils/officeFloorMovement.js';

/**
 * @param {{
 *   coffee?: { id?: string, accepted?: boolean } | null,
 *   walkTo: (tile: { x: number, y: number }) => void,
 *   suspended?: boolean
 * }} options
 */
export function useFloorCoffeeWalk({ coffee, walkTo, suspended = false }) {
  const walkToRef = useRef(walkTo);
  useEffect(() => {
    walkToRef.current = walkTo;
  });

  const coffeeId = coffee?.accepted ? (coffee?.id ?? null) : null;

  useEffect(() => {
    if (suspended || !coffeeId) return;
    const tile = propTileFor('coffeeMachine');
    if (!tile) return;
    walkToRef.current(tile);
  }, [coffeeId, suspended]);
}

export default useFloorCoffeeWalk;
