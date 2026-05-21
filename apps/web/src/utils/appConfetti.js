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
