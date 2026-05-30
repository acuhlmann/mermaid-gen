import { API_BASE_URL, SESSION_HEADER } from '../state/diagramSession.js';
import { getVisibleDiagramLabels } from './visibleDiagramLabels.js';

const EXPLAIN_TIMEOUT_MS = 12_000;

/**
 * Ask the fast advisor backend for a one-sentence definition of the clicked
 * label content. Reads visible diagram labels from the live DOM so the model
 * has nearby context. Caller passes an AbortSignal to cancel the in-flight
 * request when the popover closes or the user reselects.
 *
 * @param {object} args
 * @param {object} args.descriptor   Selection descriptor from the canvas.
 * @param {string} [args.contentType]  'mermaid' | 'infographic'.
 * @param {string} [args.diagramSource]  Current diagram source (for context).
 * @param {string} [args.sessionId]    Session header value.
 * @param {'brief'|'simple'|'gibberish'} [args.style]  'brief' (default glossary),
 *   'simple' (progressive plain-language), or 'gibberish' (pre-verbal babble).
 * @param {number} [args.simpleLevel]  1–6 when style is 'simple' (younger = higher).
 * @param {AbortSignal} [args.signal]  Caller cancellation signal.
 * @returns {Promise<string>} The explanation, or an empty string if none came back.
 */
export async function fetchLabelExplanation({
  descriptor,
  contentType,
  diagramSource,
  sessionId,
  style = 'brief',
  simpleLevel = 1,
  signal
}) {
  if (!descriptor) throw new Error('No descriptor');
  const partName = String(
    descriptor.clickedLabel || descriptor.partName || descriptor.label || ''
  ).trim();
  if (!partName) throw new Error('No label content to explain');

  const visibleLabels =
    typeof document !== 'undefined'
      ? getVisibleDiagramLabels(document.body).labels
      : [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXPLAIN_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  try {
    const headers = { 'content-type': 'application/json' };
    if (sessionId) headers[SESSION_HEADER] = sessionId;
    const response = await fetch(`${API_BASE_URL}/api/advisor/explain`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        partKind: descriptor.partKind ?? undefined,
        partName,
        label: descriptor.label ?? undefined,
        contentType: contentType ?? 'mermaid',
        diagramSource: diagramSource ?? '',
        visibleLabels: visibleLabels.slice(0, 30),
        style: style === 'gibberish' ? 'gibberish' : style === 'simple' ? 'simple' : 'brief',
        ...(style === 'simple'
          ? { simpleLevel: Math.min(6, Math.max(1, Number(simpleLevel) || 1)) }
          : {})
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Explain failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ''}`);
    }
    const payload = await response.json();
    return typeof payload?.explanation === 'string' ? payload.explanation.trim() : '';
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onCallerAbort);
  }
}
