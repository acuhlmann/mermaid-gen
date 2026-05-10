import { createInitialDiagramState } from '@mermaid-architect/shared';

const rawApiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
/** In production, leave `VITE_API_BASE_URL` unset for same-origin `/api/...` (Cloud Run). In dev, defaults to the local server. */
export const API_BASE_URL = rawApiBase
  ? rawApiBase.replace(/\/+$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:4000'
    : '';

export async function fetchDiagramState() {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/state`);
  if (!response.ok) {
    throw new Error(`Failed to fetch state: ${response.status}`);
  }
  return response.json();
}

export async function syncClientDiagramState({ mermaidSource, styleConfig }) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mermaidSource, styleConfig })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? 'Failed to sync diagram state');
  }

  return payload;
}

export async function submitDiagramIntent({ prompt, revisionId, mermaidSource, settings }) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/intent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, revisionId, mermaidSource, settings })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? 'Intent request failed');
  }

  return payload;
}

export async function submitCoAuthorIntent({ prompt, revisionId, mermaidSource, settings }) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/coauthor`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, revisionId, mermaidSource, trigger: 'manual', settings })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? 'Co-author request failed');
  }

  return payload;
}

export async function submitStyleIntent({ prompt, revisionId, mermaidSource, settings }) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/style`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, stylePrompt: prompt, revisionId, mermaidSource, settings })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? 'Style request failed');
  }

  return payload;
}

export function deriveOptimisticState(currentState, prompt) {
  return {
    ...currentState,
    mermaidSource: `${currentState.mermaidSource}\n  Pending[${prompt.slice(0, 30)}...]`,
    updatedAt: new Date().toISOString()
  };
}

export const fallbackState = createInitialDiagramState();
