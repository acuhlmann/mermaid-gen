import { actionPersonaEmoji, actionPersonaName } from './appActionPersonas.js';
import { summarizeInsightNowStatus } from './insightNowStatus.js';

/**
 * Compact live-run cue for when the notebook pane is closed mid-stream.
 * Returns null when nothing is in flight.
 *
 * @param {object | null | undefined} liveEntry
 * @param {boolean} busy
 * @param {Record<string, string>} copy
 * @returns {{ emoji: string, name: string | null, statusLine: string } | null}
 */
export function resolveNotebookLiveCue(liveEntry, busy, copy = {}) {
  const running = liveEntry && (liveEntry.status ?? 'running') === 'running';
  if (!running && !busy) return null;

  const variant = typeof liveEntry?.variant === 'string' ? liveEntry.variant : null;
  const fromStatus =
    liveEntry != null
      ? summarizeInsightNowStatus(
          typeof liveEntry.statusText === 'string' ? liveEntry.statusText : '',
          liveEntry
        )
      : '';
  const statusLine =
    (fromStatus && fromStatus.trim()) || copy.thinkingLiveWorking || 'Still scribbling…';

  return {
    emoji: variant ? actionPersonaEmoji(variant) : '✏️',
    name: variant ? actionPersonaName(variant) : null,
    statusLine
  };
}
