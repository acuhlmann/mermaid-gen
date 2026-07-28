/**
 * Opens the browser audio gate for office ambience (room tone + soundscape cues).
 *
 * Web Audio requires a user gesture before playback. Diagram actions already
 * primed the gate; office UI (stand up, check in, desk menu) did not — so the
 * ElevenLabs bed and cues stayed silent until someone generated a diagram.
 */
import { getContext } from './agentChimes.js';
import { warmAllCueSamples } from './officeCueSamples.js';

/** @type {Set<() => void>} */
const gateOpenListeners = new Set();

/**
 * @param {() => void} listener
 * @returns {() => void} unsubscribe
 */
export function onOfficeAudioGateOpen(listener) {
  gateOpenListeners.add(listener);
  return () => gateOpenListeners.delete(listener);
}

/**
 * Resume AudioContext, warm cue buffers, and notify room-tone directors.
 *
 * @param {{ current: AudioContext | null }} audioContextRef
 * @param {import('react').MutableRefObject<boolean>} [hasInteractedRef]
 * @returns {boolean} whether the gate was newly opened
 */
export function primeOfficeAudio(audioContextRef, hasInteractedRef) {
  const wasOpen = Boolean(hasInteractedRef?.current);
  if (hasInteractedRef && !wasOpen) {
    hasInteractedRef.current = true;
  }
  const context = getContext(audioContextRef);
  context?.resume?.().catch(() => {});
  warmAllCueSamples(audioContextRef);
  if (!wasOpen && hasInteractedRef) {
    for (const fn of gateOpenListeners) {
      try {
        fn();
      } catch {
        // A listener throwing must not block the gate for everyone else.
      }
    }
  }
  return !wasOpen;
}
