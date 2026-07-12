/**
 * Cold-start gate copy.
 * Lead with plain language for new users; Slopitect flavor lives in `hint` lines.
 */

export const COLD_START_COPY = {
  eyebrow: 'ArchiSlop',
  checking: {
    title: 'Connecting to the server…',
    hint: ''
  },
  waking: {
    title:
      'Starting the server — this usually takes 10–30 seconds when nobody has used the app lately.',
    hint: 'Nothing is wrong: the app scales down when idle to save cost. (Internally we call this “spinning up the synergy plane.”)'
  },
  timeout: {
    title: 'Still starting — the server has not responded yet.',
    hint: 'Try again in a moment. If you are feeling corporate, escalate to your imaginary platform team and mention the architecture slop stack.'
  },
  retryLabel: 'Try again',
  retryAria: 'Try connecting to ArchiSlop again'
};
