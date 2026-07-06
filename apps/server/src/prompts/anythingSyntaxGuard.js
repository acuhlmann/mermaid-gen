import { ANYTHING_SYSTEM_PROMPT } from './anythingSystemPrompt.js';

export const ANYTHING_RULE_PACK = ANYTHING_SYSTEM_PROMPT;

export const ANYTHING_SELF_CHECK = `Self-check before calling apply_anything_patch:
- The output is one complete HTML document (doctype, <html>, <head>, <body>).
- Every stylesheet and script is inline — zero external URLs (no CDN, no fonts, no remote images).
- No fetch/XHR/WebSocket, no cookies/localStorage/sessionStorage/IndexedDB, no window.parent/top, no alert/confirm/prompt.
- No nested iframes/objects/embeds, no javascript: URLs, no meta refresh, no base href.
- Inline script blocks must be valid JavaScript; inline style blocks must have balanced braces.
- Scripts run after the DOM exists (end of <body> or DOMContentLoaded).
- The document stays under the size budget (~150KB).`;

/**
 * Build repair instructions after a failed anything patch tool call.
 */
export function buildAnythingRepairInstruction({ errorMessage, brokenSource, originalRequest }) {
  const previous =
    brokenSource && brokenSource.trim()
      ? `PREVIOUS ATTEMPT (failed)
\`\`\`html
${brokenSource}
\`\`\`

`
      : '';
  const intent =
    typeof originalRequest === 'string' && originalRequest.trim()
      ? `ORIGINAL USER REQUEST (for intent only — do not echo):
${originalRequest.trim()}

`
      : '';
  return `Your previous Anything-mode patch failed validation.

${intent}${previous}ERROR
${errorMessage}

RULES
${ANYTHING_RULE_PACK}

${ANYTHING_SELF_CHECK}

Rewrite the full HTML document via apply_anything_patch. Do not narrate outside the tool call.`;
}
