import { useEffect, useState } from 'react';

/**
 * Cycle through `examples` on an interval so the empty-state input can hint at
 * *what* you might type ("Explain how OAuth works…", "Map our deploy pipeline…")
 * instead of a static, uninformative placeholder.
 *
 * Returns the current example string. Rotation pauses when `active` is false
 * (e.g. the entry form is hidden) and is disabled entirely under
 * `prefers-reduced-motion`, in which case the first example is shown statically.
 *
 * @param {string[]} examples
 * @param {{ active?: boolean, intervalMs?: number }} [options]
 * @returns {string}
 */
export function useRotatingPlaceholder(examples, { active = true, intervalMs = 3200 } = {}) {
  const [index, setIndex] = useState(0);
  const count = Array.isArray(examples) ? examples.length : 0;

  useEffect(() => {
    if (!active || count <= 1) return undefined;
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [active, count, intervalMs]);

  if (count === 0) return '';
  return examples[index % count];
}
