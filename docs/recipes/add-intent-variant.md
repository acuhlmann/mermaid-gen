# Recipe: add a transform / intent variant

Use when you want a new top-level user action besides Go / Refine / Erlich / Go Mad / Critique / Explain / Fix / Style — e.g. "Simplify", "Pitch deck", "Storyboard".

## Decide which path it belongs to

- **Intent path** — anything that takes user input and produces a diagram (like Go or Fix). Same system prompt, single user turn from user wording. Hits `POST /api/copilotkit/intent` or `agent-stream` with `operation: intent`.
- **Transform path** — same tools, but the _user message_ is server-generated for the named mode. Hits `POST /api/copilotkit/transform` (or `agent-stream` with `operation: transform`). This is where Refine/Erlich/Go Mad live.
- **Analyze path** — read-only Markdown, no diagram tools. This is where Critique / Explain live.

Pick by asking "does the user type the prompt?" — yes = intent; "does the server own the prompt for the named mode?" — yes = transform; "is the output Markdown only?" — yes = analyze.

## Steps (transform path — the most common case)

1. **Name the mode.** Use a short camelCase identifier like `simplify` or `pitch`. This will land in `TransformModeSchema` and many switch statements.
2. **Schema.** Add the literal to `packages/shared/src/diagramSchema.ts` (`TransformModeSchema`) so the server and web both validate it.
3. **User-message builder.** Add a branch in `buildTransformUserContent` (search for `'gilfoyle'` / `'erlich'` / `'goMad'`). Compose a clear instruction including the current diagram, the desired flavor, and a numeric budget (nodes / edges).
4. **Sampling profile.** Add caps in `TRANSFORM_MODEL_LIMITS` (and `goMadTransformModelOptions(depth)` if it has a "depth" notion). Pick a starting `temperature` — Refine is ~0.42, Erlich ~0.82.
5. **Web wiring.**
   - Add a button in `apps/web/src/App.jsx` (or the relevant action surface like `RadialActionMenu.jsx`).
   - Add a copy entry in `apps/web/src/utils/slopitectCopy.js` (Slopitect persona reactions).
   - If the mode has audio cues, add to `apps/web/src/utils/agentChimes.js`.
6. **Tests.** Cover the new branch in `apps/server/test/mermaidLangChainAgent.test.js` and (if you added a web button) `apps/web/test/App.test.jsx`.
7. **Update [`docs/guide/agents.md`](../guide/agents.md)** under _User-facing modes_ with a row for your new mode.

## Steps (intent path)

Most of the same, but skip the `buildTransformUserContent` step — the user's prompt-bar text _is_ the user message. The web client just calls `submitDiagramIntent` with the prompt and `operation: 'intent'`. Differences from Go are in how the _web app_ composes the prompt (see `App.jsx` for the Fix-from-critique pattern, which is a heavy server-built prompt that still hits the intent path).

## Files you'll touch (transform-path checklist)

- `packages/shared/src/diagramSchema.ts` — `TransformModeSchema`.
- `packages/shared/src/mermaidTransformPolicy.ts` / `infographicTransformPolicy.ts` — node/edge caps if needed.
- `apps/server/src/agents/{mermaid,infographic}LangChainAgent.js` — user-message builder, sampling.
- `apps/server/src/routes/copilot.ts` — usually no change; the route already takes `mode`.
- `apps/web/src/App.jsx` / `apps/web/src/components/RadialActionMenu.jsx` — UI.
- `apps/web/src/utils/{slopitectCopy,agentChimes}.js` — feedback.
- `apps/server/test/*`, `apps/web/test/*` — tests.
- `docs/guide/agents.md` — user-facing modes table.

## Don't forget

- Forward `contentType` everywhere; the mode applies to Mermaid _and_ Infographic by default.
- Sampling differences should be **bounded** per profile (Fast vs Quality). Hot temperatures + tools can derail; bench before committing.
