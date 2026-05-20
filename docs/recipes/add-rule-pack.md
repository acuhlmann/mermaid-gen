# Recipe: add a Mermaid or Infographic rule pack

Use when a specific diagram type (e.g. a new Mermaid `quadrantChart` or a new AntV Infographic template family) needs targeted "don't write X, do Y" guidance for the single-shot syntax fixer and the agent repair turns.

## Mermaid

1. **Add the pack** in `apps/server/src/prompts/mermaidSyntaxGuard.js`. Match the existing shape: a function returning a string keyed by detected diagram type. Look at the `flowchart` / `sequenceDiagram` packs for the format — each rule is one line, imperative, with a concrete example.
2. **Wire detection.** If the diagram type is new to the inference layer, add a branch in `apps/server/src/agents/inferDiagramType.js`. The detector reads the first non-comment line; usually just a header keyword check.
3. **Reference the pack** from both consumers:
   - The single-shot fixer (`apps/server/src/agents/mermaidSyntaxFixer.js`) — it already pulls packs by diagram type.
   - The agent repair-turn message (constructed in `mermaidLangChainAgent.js`).
4. **Add cases** to the offline bench corpus (`apps/server/scripts/benchMermaid.js` reads from a fixed corpus) — pair each new pack rule with at least one broken source string that demonstrates the rule pays off.
5. **Run the bench** to confirm sanitizer-rescue rate doesn't regress: `node apps/server/scripts/benchMermaid.js --tag before` (before your change) and `--tag after`.
6. **Update tests** in `apps/server/test/mermaidLangChainAgent.test.js` if the pack changes a repair path that's covered.

## Infographic

1. Add to `apps/server/src/prompts/infographicSyntaxGuard.js`. Packs are organized by template family (list/sequence, chart, hierarchy, compare, relation).
2. Wire into `apps/server/src/agents/infographicSyntaxFixer.js` and the agent repair-turn message in `infographicLangChainAgent.js`.
3. Add fixtures to `apps/server/test/infographicDslTool.test.js`.

## Files you'll touch

- `apps/server/src/prompts/{mermaidSyntaxGuard,infographicSyntaxGuard}.js`
- `apps/server/src/agents/inferDiagramType.js` (Mermaid only, if new type)
- `apps/server/src/agents/{mermaidSyntaxFixer,infographicSyntaxFixer}.js`
- `apps/server/src/agents/{mermaidLangChainAgent,infographicLangChainAgent}.js`
- `apps/server/scripts/benchMermaid.js` (Mermaid corpus)
- Relevant `apps/server/test/*.test.js`

## Don't forget

- Rule packs are appended to prompts — keep them short (the fixer is fast-model + low-temp; less wins).
- A bad rule will _hurt_ repair quality. Validate with the bench before merging.
- The deterministic sanitizer in `packages/shared/src/mermaidSanitizer.ts` is the first line of defense; if your rule is purely mechanical (smart quotes, etc.), prefer adding a sanitizer pass there.
