// canvas-confetti uses HTMLCanvasElement.getContext('2d') and trips on jsdom
// (which returns null). Gate so test runs don't see async confetti errors.
let _confettiSupportCache = null;

/** Returns true if HTMLCanvasElement.getContext('2d') works in this environment. */
export function canvasConfettiAvailable() {
  if (_confettiSupportCache !== null) return _confettiSupportCache;
  if (typeof document === 'undefined') {
    _confettiSupportCache = false;
    return false;
  }
  try {
    const c = document.createElement('canvas');
    _confettiSupportCache = Boolean(c.getContext?.('2d'));
  } catch {
    _confettiSupportCache = false;
  }
  return _confettiSupportCache;
}

/**
 * One celebratory burst for an office set piece, carrying the same three guards
 * `useRunCeremony` applies to run celebrations: canvas support, reduced motion,
 * and a swallow around the call itself (canvas-confetti throws in headless
 * environments). Exported so office surfaces do not each re-import
 * canvas-confetti and re-derive the guards — the ceremony hook owns run
 * fanfares, this owns the office's.
 *
 * Dynamically imported: the office is decorative, and a set piece that fires at
 * most once a session should not put canvas-confetti in the initial bundle.
 *
 * @param {{ colors?: string[], particleCount?: number, spread?: number }} [options]
 * @returns {Promise<boolean>} whether a burst was actually fired — tests assert
 *   on this rather than on the canvas.
 */
export async function fireOfficeConfetti({
  colors = ['#fde68a', '#fcd34d', '#f59e0b', '#38bdf8', '#a855f7'],
  particleCount = 90,
  spread = 100
} = {}) {
  if (!canvasConfettiAvailable()) return false;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch {
      // A matchMedia that throws is not a reason to skip the burst.
    }
  }
  try {
    const { default: confetti } = await import('canvas-confetti');
    confetti({
      particleCount,
      spread,
      startVelocity: 48,
      ticks: 220,
      origin: { x: 0.5, y: 0.35 },
      colors
    });
    return true;
  } catch {
    return false;
  }
}
