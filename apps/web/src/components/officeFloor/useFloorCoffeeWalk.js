/**
 * Walk you to the coffee machine when a break is live.
 *
 * Coffee set pieces belong at the machine (slice 4), not at your desk. When the
 * ambience director seats one, `OfficeLayer` stands you up; this hook finishes
 * the trip — a plain roam walk, not a prop-use intent, so arriving does not
 * call `getCoffee` and pour a second break on top of the one already running.
 */

import { useEffect, useRef } from 'react';
import { propTileFor } from '../../utils/officeFloorMovement.js';

/**
 * @param {{
 *   coffee?: { id?: string } | null,
 *   walkTo: (tile: { x: number, y: number }) => void,
 *   suspended?: boolean
 * }} options
 */
export function useFloorCoffeeWalk({ coffee, walkTo, suspended = false }) {
  const walkToRef = useRef(walkTo);
  useEffect(() => {
    walkToRef.current = walkTo;
  });

  const coffeeId = coffee?.id ?? null;

  useEffect(() => {
    if (suspended || !coffeeId) return;
    const tile = propTileFor('coffeeMachine');
    if (!tile) return;
    walkToRef.current(tile);
  }, [coffeeId, suspended]);
}

export default useFloorCoffeeWalk;
