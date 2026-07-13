/**
 * First-run demo shown on the empty canvas. Intentionally a *tiny real topic*
 * (OAuth), not a meta flowchart about the app — newcomers learn by seeing a
 * finished result they can immediately generate, not by reading a large
 * explainer graph that crowds mobile and disconnects from the CTA.
 *
 * Labels are single-line (the shared preview init uses htmlLabels:false) and
 * quoted for parser safety. Illustrative only — never lives in a diagram slot.
 */
export const EXAMPLE_DIAGRAM_SOURCE = `flowchart TD
    A["Browser"] --> B["Authorize"]
    B --> C["Get token"]
    C --> D["Call API"]
`;

/**
 * Fallback English topic the empty-state CTA seeds when locale starters are
 * unavailable. Prefer `controls.prompt.starters[0].prompt` at the call site so
 * the generated request matches the UI language.
 */
export const EXAMPLE_TRY_PROMPT = 'Explain how the OAuth 2.0 authorization code flow works';
