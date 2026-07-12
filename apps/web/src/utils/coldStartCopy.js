/**
 * Cold-start gate copy — corporate IT / architecture-slop voice.
 * Shown while Cloud Run scales up from idle (plain-text 429 at the edge).
 */

export const COLD_START_COPY = {
  checking: 'Checking if Corporate IT left a server in the Co-Design room…',
  waking:
    'Spinning up the synergy plane… budget-tier compute usually needs 10–30 seconds after idle.',
  wakingHint:
    'Mandatory architecture compliance: please stand by while we wake a container from its carbon-neutral offsite.',
  timeout:
    'Still booting the architecture slop stack — retry, or escalate to your imaginary platform team.',
  retryLabel: 'Retry the wake-up call',
  retryAria: 'Retry connecting to the ArchiSlop server'
};
