import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MetaphorClockContext } from './metaphorClock.js';

/** Advances the shared scene clock and exposes its authored motion intensity. */
export function MetaphorClockProvider({ enabled, intensity, children }) {
  const timeRef = useRef(0);
  useFrame((_, delta) => {
    if (enabled) timeRef.current += delta;
  });
  const value = useMemo(
    () => ({
      getTime: () => (enabled ? timeRef.current : 0),
      animated: enabled,
      intensity
    }),
    [enabled, intensity]
  );
  return <MetaphorClockContext.Provider value={value}>{children}</MetaphorClockContext.Provider>;
}
