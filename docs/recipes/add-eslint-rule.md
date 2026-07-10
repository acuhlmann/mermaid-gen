# Add an ESLint rule (with agent guidance)

Adding a rule isn't done until the agent reading its violation knows the canonical fix. Two files always change together.

## Steps

1. **Pick the workspace** — `apps/web` (frontend), `apps/server` (backend), or `packages/shared` (base, strictest).
2. **Edit the matching config** in `packages/eslint-config/`:
   - `index.js` for rules that apply to all three workspaces
   - `backend.js` for `apps/server`-only rules
   - `frontend.js` for `apps/web`-only rules
3. **Add the rule**. Default to severity `'warn'` for the warm-up window; promote to `'error'` only after a quiet two-week period. Threshold rules should respect `packages/eslint-config/legacy-monoliths.js` automatically (the override in `index.js` disables the threshold rules for those files).
4. **Add an agent-guidance entry**. Two places:
   - `packages/eslint-config/guidance.js` (ESM, source of truth)
   - `packages/eslint-config/formatter.cjs` (the duplicated `GUIDANCE` map — CommonJS formatter; keep in sync)
     Each entry is 3–4 lines: what the rule prevents, the canonical fix, and the suppression syntax with `(reason: ...)`.
5. **Run `npm run lint`** in the affected workspace; expect the warning to fire on at least one file (otherwise the rule is dead).
6. **Document the rule** in [`docs/agents/sensors.md`](../agents/sensors.md) only if it adds a new _category_ of check; small additions don't need a doc update.

## Rule severity policy

- New rule → start at `'warn'`
- After two weeks with zero unexplained suppressions → promote to `'error'`
- If suppressions keep coming with `(reason: ...)`, the rule may be wrong for this codebase — revisit

## When NOT to add a rule

- One-off code smells: open an issue or fix the file instead
- Style preferences without a maintainability cost: use Prettier
- Anything that needs project-wide context: that's a dependency-cruiser rule — see [`add-dep-cruiser-layer.md`](add-dep-cruiser-layer.md)
