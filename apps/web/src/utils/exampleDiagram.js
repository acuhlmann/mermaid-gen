/**
 * First-run demo shown on the empty canvas. Intentionally a *tiny real topic*
 * (coffee supply chain), not a meta flowchart about the app — newcomers learn
 * by seeing a finished result they can immediately generate, not by reading a
 * large explainer graph that crowds mobile and disconnects from the CTA.
 *
 * Labels are single-line (the shared preview init uses htmlLabels:false) and
 * quoted for parser safety. Illustrative only — never lives in a diagram slot.
 */
export const EXAMPLE_DIAGRAM_SOURCE = `flowchart TD
    A["Farm"] --> B["Roaster"]
    B --> C["Distributor"]
    C --> D["Cafe"]
`;

/**
 * Fallback English topic the empty-state CTA seeds when locale starters are
 * unavailable. Prefer `controls.prompt.starters[0].prompt` at the call site so
 * the generated request matches the UI language.
 */
export const EXAMPLE_TRY_PROMPT = 'Break down the global coffee supply chain';
