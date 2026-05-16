import { useEffect, useState } from 'react';

/**
 * Keeps a child rendered briefly after `open` flips to false so an exit animation can play
 * before the element is removed from the DOM. Returns `{ mounted, closing }`:
 *   - `mounted` is true while the child should be in the DOM (during open + the exit delay)
 *   - `closing` is true during the exit delay so the child can apply an exit-animation class
 */
export function useDelayedUnmount(open, exitDurationMs = 240) {
  const [mounted, setMounted] = useState(Boolean(open));
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return undefined;
    }
    if (!mounted) return undefined;
    setClosing(true);
    const handle = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, exitDurationMs);
    return () => clearTimeout(handle);
  }, [open, exitDurationMs, mounted]);

  return { mounted, closing };
}
