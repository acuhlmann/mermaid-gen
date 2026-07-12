/**
 * First-run example diagram. Rendered read-only in the empty-state canvas so a
 * newcomer sees a finished archislop diagram — and grasps what the app is for —
 * before typing anything. It is deliberately a *meta* diagram: it explains the
 * core loop (pick a topic, AI drafts, refine / go mad / switch modes) and lands
 * the corporate-stakeholder gag, all while demonstrating the actual output.
 *
 * Labels are single-line (the shared preview init uses htmlLabels:false, so
 * `<br/>` would render literally) and quoted for parser safety. This is
 * illustrative content, not user data — it does not live in a diagram slot and
 * never syncs to the server.
 */
export const EXAMPLE_DIAGRAM_SOURCE = `flowchart TD
    A["🎯 Pick any topic"] --> B["🤖 AI drafts a diagram"]
    B --> C{"Make it yours"}
    C -->|Refine| D["✨ Polish it"]
    C -->|Go Mad| E["🌀 Chaos redesign"]
    C -->|As 3D / Chart| F["🎨 Switch modes"]
    D --> G["👔 Stakeholders chime in"]
    E --> G
    F --> G
    G --> H["💡 Now you get it"]
`;

/**
 * Curated topic the empty-state example's "try this one" call-to-action seeds
 * and submits. It is a concrete, broadly interesting subject (not the meta loop
 * the preview draws) so the newcomer's very first result is a real archislop
 * diagram of something recognisable rather than a diagram about the app itself.
 */
export const EXAMPLE_TRY_PROMPT = 'Explain how the OAuth 2.0 authorization code flow works';
