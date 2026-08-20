# Recipe: add a library to the Anything-mode allowlist

Use when a class of Anything-mode asks keeps failing or degrading because vanilla JS can't reasonably do the work (real scales/axes, physics, …) and a single pinned library would fix it. Read [ADR-0008](../decisions/0008-anything-inline-libraries.md) first — the allowlist is meant to stay **short**, and the ADR's addendum records why Tone.js was evaluated and rejected (its build can't execute under the runtime check). Marker form is stored; vendored bytes are spliced in only where the page executes.

## Gate questions (answer before writing code)

1. **Does it earn its bytes?** Every entry grows the repo and the lazy client vendor chunk that all lib-using pages share. d3 is 273KB, matter 81KB; a ~600KB library needs an exceptional case.
2. **Does its dist build survive inlining?** The generator rejects sources containing `</script`, `<!--`, or `<script` (they'd terminate/corrupt the inline `<script>` block). Check the minified UMD build the package ships.
3. **Does it execute under the runtime check?** Pipe a small page using the library through `validateAndPrepareAnythingPatch` or `runAnythingRuntimeCheck` (browser by default; jsdom when `ANYTHING_RUNTIME_ENGINE=jsdom`). For quick stdin probes, `apps/server/src/tools/anythingRuntimeSandbox.js` still works. Libraries that eagerly validate real browser API semantics at load (Tone.js's Web Audio graph) will fail every page that imports them — that's a disqualifier, not something to patch around per-lib.
4. **Does it define one global?** The mechanism assumes a classic script that attaches a single global (`d3`, `Matter`).

## Steps

1. **Pin the devDep** (exact version, no `^`) in `packages/shared/package.json`: `npm install --save-dev --save-exact <pkg>@<version> -w packages/shared`.
2. **Add the registry entry** in `packages/shared/src/anythingLibs.ts` (`ANYTHING_LIBS`): id (lowercase, becomes the `@lib:` marker), name, version (must match the pin — a test enforces this), global, and a one-line `promptSummary` (it's injected into agent prompts verbatim; say what the lib is FOR, not just what it is).
3. **Add the manifest entry** in `packages/shared/scripts/vendorAnythingLibs.mjs` (`MANIFEST`): id, npmPackage, and the dist path of the minified browser build.
4. **Regenerate the vendored bytes**: `npm run vendor:anything-libs -w packages/shared`, then `npm run build -w packages/shared`. Commit the regenerated `src/vendor/anythingLibSources.ts`.
5. **Extend the real-execution test** in `apps/server/test/anythingRuntimeCheck.test.js` ("vendored libraries execute cleanly in the sandbox") with a snippet that actually exercises the library — this is what catches a future version bump that breaks under jsdom.
6. **Add a bench case** (`valid-lib-<id>`) in `apps/server/scripts/benchAnythingCorpus.js`, then run `node apps/server/scripts/benchAnything.js --tag <label>` and commit the snapshot.
7. **Add when-to-use craft rules** to `apps/server/src/prompts/anythingDesignGuide.js` (the Libraries section): one line for when the lib earns its import, one for when it does not. A drift-guard test in `anythingPrompts.test.js` rejects `@lib:` ids that aren't allowlisted.
8. **Update docs**: the allowlist mentions in `docs/guide/content-types.md`, `CLAUDE.md`'s Anything paragraph, and the ADR-0008 addendum (chunk-size numbers).

Everything else — system prompt, self-check, `unknown_lib` error text, marker lint, client badge — is generated from the registry and picks the new lib up automatically; drift-guard tests in `packages/shared/test/anythingLibs.test.ts` and `apps/server/test/anythingPrompts.test.js` fail if it somehow doesn't.

## Files you'll touch

- `packages/shared/package.json` (exact-pinned devDep)
- `packages/shared/src/anythingLibs.ts` (registry)
- `packages/shared/scripts/vendorAnythingLibs.mjs` (manifest)
- `packages/shared/src/vendor/anythingLibSources.ts` (regenerated, never hand-edited)
- `apps/server/test/anythingRuntimeCheck.test.js`, `apps/server/scripts/benchAnythingCorpus.js`
- `apps/server/src/prompts/anythingDesignGuide.js`
- `docs/guide/content-types.md`, `CLAUDE.md`, `docs/decisions/0008-anything-inline-libraries.md`

## Don't forget

- Version bumps follow the same recipe from step 1 (re-pin, regenerate, rerun the real-execution test and bench). Old revisions re-render with the NEW pinned version — ADR-0008 accepts this; the injected `data-lib-version` attribute and the canvas badge make it observable.
- Removing a lib is the reverse; the design-guide drift test and the registry/vendor lockstep test will point at every leftover mention.
