/**
 * Prompt builders for the client-triggered auto-fix flow (App.jsx
 * `runAutoFix`): a render/runtime error was observed in the canvas and the
 * agent is asked to repair the current document via the intent pipeline.
 */

/**
 * Build the auto-fix intent prompt for the given content type.
 *
 * The Anything variant deliberately omits the broken source — the server-side
 * agent already receives the full current document from the synced slot, and
 * duplicating a large HTML document into the prompt only burns tokens.
 *
 * @param {{ contentType: string, errorMessage: string, brokenSource: string }} args
 * @returns {string}
 */
export function buildAutoFixPrompt({ contentType, errorMessage, brokenSource }) {
  if (contentType === 'anything') {
    return `The current Anything-mode page fails at runtime in the sandboxed canvas. Fix the page and apply a corrected version with apply_anything_patch.

Runtime error reported by the canvas:
${errorMessage}

Hard requirements:
- Preserve the page's concept, layout, and interactivity as much as possible.
- Keep the document fully self-contained: inline CSS/JS only, no external URLs, no cookies/storage, no window.parent/top access.
- Apply the fix with apply_anything_patch before summarizing.`;
  }

  return `The Mermaid editor currently shows a syntax error. Please fix the diagram and apply a corrected version with apply_mermaid_patch.

Mermaid renderer error:
${errorMessage}

Current invalid Mermaid source:
\`\`\`mermaid
${brokenSource}
\`\`\`

Hard requirements:
- Preserve the user's intent and as much of the structure as possible.
- Output complete, valid Mermaid source.
- Apply the fix with apply_mermaid_patch before summarizing.`;
}
