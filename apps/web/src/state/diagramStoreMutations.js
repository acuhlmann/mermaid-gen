import {
  AGENT_REQUEST_TIMEOUT_MS,
  agentMutationTimeoutMs,
  createSessionHeaders,
  fetchWithTimeout,
  throwApiPayloadError
} from './diagramStoreHttp.js';
import { API_BASE_URL } from './diagramSession.js';

export async function syncClientDiagramState({
  contentType = 'mermaid',
  diagramSource,
  styleConfig,
  sessionId
}) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
    body: JSON.stringify({
      contentType,
      diagramSource,
      ...(styleConfig != null ? { styleConfig } : {})
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throwApiPayloadError(payload, 'Failed to sync diagram state');
  }

  return payload;
}

/**
 * Discrete canvas graph edit. Unlike `syncClientDiagramState`, this records an
 * `origin: user` history patch and refuses stale revisions (409).
 */
export async function applyUserDiagramEdit({
  contentType = 'mermaid',
  diagramSource,
  previousRevisionId,
  reason,
  sessionId
}) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/user-edit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
    body: JSON.stringify({
      contentType,
      diagramSource,
      previousRevisionId,
      reason
    })
  });

  const payload = await response.json();
  if (response.status === 409) {
    const err = new Error(payload?.error ?? 'Diagram changed');
    err.code = 'stale_revision';
    throw err;
  }
  if (!response.ok) {
    throwApiPayloadError(payload, 'Failed to apply diagram edit');
  }
  return payload;
}

/**
 * Cheap render-error repair: posts the current source plus the browser's Mermaid render error
 * to the dedicated render-error endpoint. The server runs only the single-shot syntax-fixer
 * model (no full agent loop), so this returns in roughly one LLM call instead of an entire
 * agent turn.
 *
 * Returns `{repaired: true, state}` when the server applied a fix, `{repaired: false, ...}` when
 * the fixer rejected, the revision was stale, or the server isn't configured. Callers should
 * fall back to the heavyweight agent-based fix on `repaired: false`.
 */
export async function submitDiagramRenderRepair({
  revisionId,
  source,
  renderError,
  contentType = 'mermaid',
  sessionId
}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/diagram/render-error`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
      body: JSON.stringify({ revisionId, source, renderError, contentType })
    },
    AGENT_REQUEST_TIMEOUT_MS,
    'Render-error repair timed out.'
  );

  const payload = await response.json();
  if (!response.ok) {
    // Don't throw — let the caller decide whether to fall back to the heavyweight path.
    return { repaired: false, error: payload?.error ?? `HTTP ${response.status}` };
  }
  return payload;
}

export async function submitDiagramIntent({
  prompt,
  revisionId,
  diagramSource,
  contentType = 'mermaid',
  settings,
  focusNode,
  modelProfile,
  sessionId,
  uiLocale
}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/intent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
      body: JSON.stringify({
        prompt,
        revisionId,
        diagramSource,
        contentType,
        settings,
        focusNode,
        ...(modelProfile != null ? { modelProfile } : {}),
        ...(uiLocale != null ? { uiLocale } : {})
      })
    },
    agentMutationTimeoutMs(modelProfile),
    'Helper agent request timed out. Please try again.'
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? 'Intent request failed');
  }

  return payload;
}

export async function submitDiagramTransform({
  revisionId,
  diagramSource,
  contentType = 'mermaid',
  mode,
  focusNode,
  modelProfile,
  russDepth,
  sessionId,
  uiLocale
}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/transform`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
      body: JSON.stringify({
        revisionId,
        diagramSource,
        contentType,
        mode,
        focusNode,
        ...(modelProfile != null ? { modelProfile } : {}),
        ...(typeof russDepth === 'number' && Number.isFinite(russDepth) ? { russDepth } : {}),
        ...(uiLocale != null ? { uiLocale } : {})
      })
    },
    agentMutationTimeoutMs(modelProfile, mode),
    'Transform agent request timed out. Please try again.'
  );

  const payload = await response.json();
  if (!response.ok) {
    throwApiPayloadError(payload, 'Transform request failed');
  }

  return payload;
}

export async function submitDiagramAnalyze({
  revisionId,
  diagramSource,
  contentType = 'mermaid',
  kind,
  focusNode,
  modelProfile,
  sessionId,
  uiLocale
}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/analyze`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
      body: JSON.stringify({
        revisionId,
        diagramSource,
        contentType,
        kind,
        focusNode,
        ...(modelProfile != null ? { modelProfile } : {}),
        ...(uiLocale != null ? { uiLocale } : {})
      })
    },
    AGENT_REQUEST_TIMEOUT_MS,
    'Analyze request timed out. Please try again.'
  );

  const payload = await response.json();
  if (!response.ok) {
    throwApiPayloadError(payload, 'Analyze request failed');
  }

  return payload;
}

export async function submitDiagramStyle({
  prompt,
  stylePrompt,
  revisionId,
  diagramSource,
  contentType = 'mermaid',
  settings,
  modelProfile,
  sessionId,
  uiLocale
}) {
  const resolvedPrompt = (stylePrompt ?? prompt ?? '').trim();
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/style`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
      body: JSON.stringify({
        prompt: resolvedPrompt,
        stylePrompt: resolvedPrompt,
        revisionId,
        diagramSource,
        contentType,
        settings,
        ...(modelProfile != null ? { modelProfile } : {}),
        ...(uiLocale != null ? { uiLocale } : {})
      })
    },
    agentMutationTimeoutMs(modelProfile),
    'Style agent request timed out. Please try again.'
  );

  const payload = await response.json();
  if (!response.ok) {
    throwApiPayloadError(payload, 'Style request failed');
  }

  return payload;
}
