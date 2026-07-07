export type AgentStreamFailureClass =
  | 'syntax_exhausted'
  | 'no_patch'
  | 'stale_revision'
  | 'timeout'
  | 'network'
  | 'generic';

function extractFirstErrorLine(message: string): string | null {
  const trimmed = (message ?? '').trim();
  if (!trimmed) return null;
  const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length > 12) return line.length > 140 ? `${line.slice(0, 137)}…` : line;
  }
  return lines[0] ?? null;
}

function stripFailurePrefix(message: string): string {
  return message
    .replace(/^infographic update failed:\s*/i, '')
    .replace(/^chart update failed:\s*/i, '')
    .replace(/^page update failed:\s*/i, '');
}

/** User-facing status for failed intent/transform agent streams. */
export function resolveAgentStreamFailureStatus({
  code,
  message
}: {
  operation?: string;
  code?: string;
  message?: string;
}): { failureClass: AgentStreamFailureClass; statusText: string; detail: string | null } {
  const msg = String(message ?? '').trim();
  const lower = msg.toLowerCase();

  if (
    code === 'stale_revision' ||
    (lower.includes('stale') && lower.includes('retry')) ||
    lower.includes('refresh state')
  ) {
    return {
      failureClass: 'stale_revision',
      statusText: 'Diagram changed elsewhere — refresh and retry.',
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
      statusText: 'Run timed out — try Fast or retry.',
      detail: null
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
      statusText: 'Connection or stream timed out. Retry.',
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
    lower.includes('page update failed') ||
    lower.includes('chart update failed') ||
    lower.includes('script block') ||
    lower.includes('style block') ||
    lower.includes('external url') ||
    lower.includes('must not reference') ||
    lower.includes('must not load') ||
    lower.includes('syntax fixer') ||
    (lower.includes('syntax') && lower.includes('failed'))
  ) {
    const detail =
      extractFirstErrorLine(stripFailurePrefix(msg)) ??
      extractFirstErrorLine(msg);
    return {
      failureClass: 'syntax_exhausted',
      statusText: "Couldn't apply a valid result.",
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
      statusText: 'No diagram patch was applied. Retry or try Quality.',
      detail: null
    };
  }

  return {
    failureClass: 'generic',
    statusText: 'Something failed. You can retry.',
    detail: extractFirstErrorLine(msg)
  };
}
