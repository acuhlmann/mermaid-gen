# Add a dependency-cruiser layer rule

Use this when you want to forbid an import direction across a layer boundary, prevent a cycle, or flag orphans in a new tree. The `comment` field is the agent's reading material — write it carefully.

## Steps

1. **State the rule in one English sentence** before writing config. "Routes must not import from prompts" or "shared cannot reach into apps".
2. **Open `.dependency-cruiser.cjs`** and add a new entry under `forbidden`:
   ```js
   {
     name: '<kebab-case-rule-name>',
     severity: 'error',
     comment:
       '<one-paragraph fix the agent will read when this fires; cite the ADR or section of CLAUDE.md that motivates the rule>',
     from: { path: '^apps/server/src/<layer>/' },
     to: { path: '^apps/server/src/<other-layer>/' },
   },
   ```
3. **The `comment` IS the agent's fix.** Write it in second person ("invert the dependency by..."), name the canonical alternative, and reference an ADR or doc when the rule encodes a decision.
4. **Audit before activating.** Run `npm run verify:boundaries` and confirm the new rule passes against the current tree. If it fails, either fix the violations *first* in the same PR or set `severity: 'warn'` with a `# TODO: promote to error after <ticket>` line in the comment.
5. **Promote to `error`** when violations reach zero and the team has had a chance to see warnings for a week.
6. **No corresponding doc update needed** in most cases — the comment is self-documenting. Mention the new rule in the PR description.

## Tips

- Use `pathNot` to exclude test files: `from: { path: '...', pathNot: '\\.test\\.' }`
- Use `circular: true` on the `to` side to forbid cycles (we already have `no-cycles`)
- Use `orphan: true` to flag files nothing imports (we already have `no-orphans` as a warning)
- See the [dependency-cruiser rules docs](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) for the full predicate vocabulary

## When NOT to add a layer rule

- The rule depends on the *content* of an import, not its location → that's an ESLint rule
- The rule is enforced by types (e.g., "this function only accepts ids of this brand") → use TypeScript
- The constraint is semantic (cohesion, hub-ness) → run a `/modularity:review` instead
