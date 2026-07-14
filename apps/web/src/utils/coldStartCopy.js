/**
 * Cold-start gate copy.
 * Branded `title` (Slopitect / corporate IT voice) + plain `hint` so new users know what is happening.
 */

export const COLD_START_COPY = {
  eyebrow: 'ArchiSlop · Corporate IT',
  checking: {
    title: 'Checking if Corporate IT left a server in the Co-Design room…',
    hint: 'Connecting while the app wakes from idle — this is normal.'
  },
  waking: {
    title: 'Spinning up the synergy plane…',
    hint: 'Starting the server — usually 10–30 seconds when nobody has used the app lately. We scale down when idle to save cost.'
  },
  loadingApp: {
    title: 'Loading the co-design workspace…',
    hint: 'Pulling in the editor and diagram tools — this can take a little while on a cold browser tab.'
  },
  timeout: {
    title: 'Still booting the architecture slop stack…',
    hint: 'The server has not responded yet. Try again in a moment — or escalate to your imaginary platform team.'
  },
  retryLabel: 'Try again',
  retryAria: 'Try connecting to ArchiSlop again'
};
