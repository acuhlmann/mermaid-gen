import { useEffect, useState } from 'react';

export function readPrefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Reactively follows the OS/browser motion preference. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(readPrefersReducedMotion);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * Streaming disables motion entirely for stable bounds. Reduced-motion keeps
 * the authored intensity so fused primitives can resolve one deterministic,
 * meaningful frozen pose without advancing time.
 */
export function resolveMetaphorMotionPolicy({ streamingPreview, reducedMotion, motionIntensity }) {
  const intensity =
    typeof motionIntensity === 'number' && Number.isFinite(motionIntensity)
      ? Math.max(0, Math.min(1, motionIntensity))
      : 0.65;
  if (streamingPreview) return { animated: false, intensity: 0, frozen: true };
  if (reducedMotion) return { animated: false, intensity, frozen: true };
  return { animated: intensity > 0, intensity, frozen: intensity === 0 };
}
