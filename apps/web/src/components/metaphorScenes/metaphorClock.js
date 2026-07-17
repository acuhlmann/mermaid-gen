/**
 * Shared scene clock for metaphor3d animations (twinkles, flow pulses, water).
 * MetaphorRenderer owns the provider component (it advances the clock via
 * useFrame and gates it off during streaming); scenes read it through this hook.
 */
import { createContext, useContext } from 'react';

export const MetaphorClockContext = createContext({
  getTime: () => 0,
  animated: false,
  intensity: 0
});

export function useMetaphorClock() {
  return useContext(MetaphorClockContext);
}
