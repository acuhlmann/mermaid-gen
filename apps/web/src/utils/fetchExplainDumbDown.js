import { API_BASE_URL, SESSION_HEADER } from '../state/diagramSession.js';

const EXPLAIN_DUMB_TIMEOUT_MS = 20_000;

/**
 * Rephrase a completed Explain thinking-panel entry at the next dumb-down level.
 *
 * @param {object} args
 * @param {string} args.previousExplain  Current markdown shown in the entry.
 * @param {string} [args.contentType]
 * @param {string} [args.sessionId]
 * @param {'simple'|'gibberish'} [args.style]
 * @param {number} [args.simpleLevel]  1–6 when style is 'simple'.
 * @param {AbortSignal} [args.signal]
 * @returns {Promise<{ markdown: string, explainSections: object | null }>}
 */
export async function fetchExplainDumbDown({
  previousExplain,
  contentType,
  sessionId,
  style = 'simple',
  simpleLevel = 1,
  signal
}) {
  const prev = typeof previousExplain === 'string' ? previousExplain.trim() : '';
  if (!prev) throw new Error('No explanation to simplify');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXPLAIN_DUMB_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  try {
    const headers = { 'content-type': 'application/json' };
    if (sessionId) headers[SESSION_HEADER] = sessionId;
    const response = await fetch(`${API_BASE_URL}/api/advisor/explain-dumb`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        previousExplain: prev,
        contentType: contentType ?? 'mermaid',
        style: style === 'gibberish' ? 'gibberish' : 'simple',
        ...(style === 'simple'
          ? { simpleLevel: Math.min(6, Math.max(1, Number(simpleLevel) || 1)) }
          : {})
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Explain dumb-down failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ''}`
      );
    }
    const payload = await response.json();
    const markdown = typeof payload?.markdown === 'string' ? payload.markdown.trim() : '';
    const explainSections =
      payload?.explainSections && typeof payload.explainSections === 'object'
        ? payload.explainSections
        : null;
    return { markdown, explainSections };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onCallerAbort);
  }
}
