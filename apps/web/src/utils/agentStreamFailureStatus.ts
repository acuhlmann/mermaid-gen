import { extractLastValidationError } from '@archislop/shared';
import { getActiveControlsCopy } from '../i18n/activeControlsCopy.js';

export type AgentStreamFailureClass =
  'syntax_exhausted' | 'no_patch' | 'stale_revision' | 'timeout' | 'network' | 'generic';

const MAX_DETAIL_LENGTH = 240;

type StreamFailureCopy = {
  staleRevision?: string;
  timeout?: string;
  network?: string;
  syntaxExhausted?: string;
  noPatch?: string;
  generic?: string;
};

function failureCopy(copy?: StreamFailureCopy): StreamFailureCopy {
  return copy ?? getActiveControlsCopy().insights?.streamFailures ?? {};
}

function truncateDetail(text: string): string {
  return text.length > MAX_DETAIL_LENGTH ? `${text.slice(0, MAX_DETAIL_LENGTH - 1)}…` : text;
}

function extractFirstErrorLine(message: string): string | null {
  const trimmed = (message ?? '').trim();
  if (!trimmed) return null;
  const lines = trimmed
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (line.length > 12) return truncateDetail(line);
  }
  return lines[0] ?? null;
}

/**
 * Root-cause detail for the status strip. Prefers the explicit
 * "Last validation error: …" marker the server appends to budget-exceeded /
 * exhausted-run messages; falls back to the first meaningful line.
 */
function extractRootCauseDetail(message: string): string | null {
  const marker = extractLastValidationError(message);
  if (marker) return truncateDetail(marker.replace(/\s+/g, ' ').trim());
  return null;
}

function stripFailurePrefix(message: string): string {
  return message
    .replace(/^diagram update failed:\s*/i, '')
    .replace(/^infographic update failed:\s*/i, '')
    .replace(/^chart update failed:\s*/i, '')
    .replace(/^metaphor update failed:\s*/i, '')
    .replace(/^page update failed:\s*/i, '');
}

/** User-facing status for failed intent/transform agent streams. */
export function resolveAgentStreamFailureStatus({
  code,
  message,
  copy
}: {
  operation?: string;
  code?: string;
  message?: string;
  copy?: StreamFailureCopy;
}): { failureClass: AgentStreamFailureClass; statusText: string; detail: string | null } {
  const localized = failureCopy(copy);
  const msg = String(message ?? '').trim();
  const lower = msg.toLowerCase();

  if (
    code === 'stale_revision' ||
    (lower.includes('stale') && lower.includes('retry')) ||
    lower.includes('refresh state')
  ) {
    return {
      failureClass: 'stale_revision',
      statusText: localized.staleRevision ?? 'Diagram changed elsewhere — refresh and retry.',
      detail: null
    };
  }

  if (
    code === 'run_budget_exceeded' ||
    lower.includes('time limit') ||
    lower.includes('budget exceeded')
  ) {
    return {
      failureClass: 'timeout',
      statusText: localized.timeout ?? 'Run timed out — try Fast or retry.',
      detail: extractRootCauseDetail(msg)
    };
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    (!lower.includes('abort') &&
      (lower.includes('network') ||
        lower.includes('failed to fetch') ||
        lower.includes('stream request failed')))
  ) {
    return {
      failureClass: 'network',
      statusText: localized.network ?? 'Connection or stream timed out. Retry.',
      detail: null
    };
  }

  if (
    lower.includes('parse error') ||
    lower.includes('parser rejected') ||
    lower.includes('unknown top-level key') ||
    lower.includes('unknown key in object') ||
    lower.includes('infographic dsl') ||
    lower.includes('chart dsl') ||
    lower.includes('vega-lite') ||
    lower.includes('anything html') ||
    lower.includes('html validation') ||
    lower.includes('diagram update failed') ||
    lower.includes('page update failed') ||
    lower.includes('chart update failed') ||
    lower.includes('metaphor update failed') ||
    lower.includes('infographic update failed') ||
    lower.includes('script block') ||
    lower.includes('style block') ||
    lower.includes('external url') ||
    lower.includes('must not reference') ||
    lower.includes('must not load') ||
    lower.includes('syntax fixer') ||
    (lower.includes('syntax') && lower.includes('failed'))
  ) {
    const detail =
      extractRootCauseDetail(msg) ??
      extractFirstErrorLine(stripFailurePrefix(msg)) ??
      extractFirstErrorLine(msg);
    return {
      failureClass: 'syntax_exhausted',
      statusText: localized.syntaxExhausted ?? "Couldn't apply a valid result.",
      detail
    };
  }

  if (
    code === 'no_mutation_revision' ||
    lower.includes('not updated') ||
    lower.includes('did not apply') ||
    lower.includes('no valid patch')
  ) {
    return {
      failureClass: 'no_patch',
      statusText: localized.noPatch ?? 'No diagram patch was applied. Retry or try Quality.',
      detail: extractRootCauseDetail(msg)
    };
  }

  return {
    failureClass: 'generic',
    statusText: localized.generic ?? 'Something failed. You can retry.',
    detail: extractRootCauseDetail(msg) ?? extractFirstErrorLine(msg)
  };
}
