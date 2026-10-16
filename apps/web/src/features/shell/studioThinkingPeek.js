const MAX_LINES = 3;
const MAX_LINE_LENGTH = 140;

/**
 * Plan beats quote the request back — and the wire request carries prompt
 * boilerplate (the LANGUAGE LOCK suffix) that is an instruction to the
 * model, not something a person waiting on their first result should read.
 * Cut the line there; the human part is always in front of it.
 */
const BOILERPLATE_MARKERS = ['LANGUAGE LOCK', '```'];

function cleanLine(value) {
  if (typeof value !== 'string') return '';
  let text = value;
  for (const marker of BOILERPLATE_MARKERS) {
    const at = text.indexOf(marker);
    if (at >= 0) text = text.slice(0, at);
  }
  text = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[::—–-]\s*$/, '');
  if (!text) return '';
  return text.length > MAX_LINE_LENGTH ? `${text.slice(0, MAX_LINE_LENGTH - 1)}…` : text;
}

/**
 * The few human-readable lines a newcomer can watch while a run is in
 * flight — a deliberately small slice of the Thinking pane, not the pane.
 *
 * Plan beats are written for people, so they win. Technical actions and
 * phase labels are the fallback for the long stretch before the first beat
 * lands. Most recent last, de-duplicated, capped so the card never grows
 * into a second UI the user has to learn mid-wait.
 *
 * @param {{ planBeats?: unknown, technicalActions?: unknown, phases?: unknown } | null | undefined} entry
 * @returns {string[]}
 */
export function studioThinkingPeekLines(entry) {
  if (!entry || typeof entry !== 'object') return [];
  const beats = Array.isArray(entry.planBeats)
    ? entry.planBeats.map((beat) => cleanLine(beat?.text))
    : [];
  const actions = Array.isArray(entry.technicalActions)
    ? entry.technicalActions.map((action) => cleanLine(action?.label || action?.name))
    : [];
  const phases = Array.isArray(entry.phases)
    ? entry.phases.map((phase) => cleanLine(phase?.label))
    : [];
  const source = beats.some(Boolean) ? beats : actions.some(Boolean) ? actions : phases;
  const seen = new Set();
  const lines = [];
  for (const line of source) {
    if (!line || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines.slice(-MAX_LINES);
}
