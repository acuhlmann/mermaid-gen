# OpenUSD approach

How archislop walks [ADR-0009](../decisions/0009-dynamic-composite-standards.md)'s remaining
migration path without claiming USD Core compliance or putting a WASM Stage in the web bundle.

The JSON Metaphor3D DSL stays the **canonical semantic source**. The USDA file is an
**interchange stub**. A composed OpenUSD Stage becomes canonical only after an official OpenUSD
runtime reconstructs it and every mapped field round-trips. Until then, say "USDA stub", never
"OpenUSD scene" or "USD-compliant".

Mapping contract: [Metaphor USDA mapping](metaphor-usda-mapping.md) (`v0.2.0`).

## Why this shape

Primary sources, not a restatement of the ADR:

| Question                                      | Answer                                                                                                                                                                                                                                                                | Source                                                                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What is the conformance target?               | **USD Core Specification v1.0.1** (2025-12-12): layers, specs, LIVERPS composition, stage population, USDA/USDC/USDZ, and a compliance rubric.                                                                                                                        | [Core spec](https://github.com/aousd/specifications-public/blob/main/core/1.0.1/core_spec.md), [AOUSD page](https://aousd.org/usd-core-specification/) |
| Can we run official OpenUSD in process today? | **Python `usd-core` 26.8** on PyPI ships the core libraries (no imaging, no `usdchecker` CLI). WASM build support landed in **OpenUSD v26.03** for wasm32/wasm64 via Emscripten.                                                                                      | [PyPI usd-core](https://pypi.org/project/usd-core/), [v26.03 announcement](https://aousd.org/blog/openusd-v26-03/)                                     |
| Is the official WASM example a product?       | **No.** `wasmFetchResolver` is "for illustrative purposes only and is not meant for production use."                                                                                                                                                                  | [OpenUSD README](https://github.com/PixarAnimationStudios/OpenUSD/blob/dev/extras/usd/examples/wasmFetchResolver/README.md)                            |
| Can Three.js be the Stage?                    | **No.** Three r185 `USDLoader` / `USDComposer` compose supported USD into `THREE.Object3D` (references, payloads, variants, transforms, animation). It is a render importer, not a Core 1.0.1 Stage or lossless custom-metadata round-trip.                           | [USDLoader](https://threejs.org/docs/pages/USDLoader.html), [USDComposer](https://threejs.org/docs/pages/USDComposer.html)                             |
| Can `@cinevva/usdjs` be the Stage?            | **Not yet.** It implements a practical Pcp subset (sublayers, references, payloads, variants, inherits). It documents missing specializes, relocates, value clips, and full prim-index parity. Useful later as a second JS parser, never as the conformance boundary. | [usdjs COMPOSITION](https://cinevva-engine.github.io/usdjs/COMPOSITION), [FEATURES](https://cinevva-engine.github.io/usdjs/FEATURES)                   |

Claiming OpenUSD through a loader import, a WASM example, or a partial JS runtime would be the
same mistake ADR-0009 rejected. The approach is: **finish the stub, then validate the stub with
official OpenUSD, then measure a worker, then maybe change the canonical boundary.**

## Three artifacts

Keep these names stable. Mixing them is how a stub becomes a false compliance claim.

| Artifact          | Role today                                                 | Becomes canonical when                                                                                                                                         |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JSON DSL**      | Session slot, agent I/O, sanitizer, R3F input              | Already canonical                                                                                                                                              |
| **USDA stub**     | Export (`metaphor-usda`) + inverse parse of _this_ mapping | Never, by itself                                                                                                                                               |
| **OpenUSD Stage** | Does not exist in-repo                                     | Official OpenUSD opens the stub, relationships resolve, unknown `archislop:*` metadata survives, reconstruction is deterministic, and the mapping is versioned |

The fused render plan (`planFusedCompositeWorld`) is none of these. It stays internal.

## Three runtimes

| Runtime                                                                  | Job                                                                          | In the product?                                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **TypeScript author/parse** (`authorMetaphorUsda` / `parseMetaphorUsda`) | Emit and round-trip the stub. No OpenUSD dependency.                         | Yes — `packages/shared`                                            |
| **Official OpenUSD** (`usd-core` Python, later a WASM worker)            | Conformance: parse, compose, inspect prims/rels/metadata                     | Not yet. Stage C is a **gated CI job**, not a browser import       |
| **Three `USDLoader`**                                                    | Optional later _render_ of a geometry-bearing USD. Not a semantic round-trip | Not wired. Our stub has no meshes, so a load would be empty Xforms |

## Stages

Each stage ends on a checkable criterion. Do not start the next stage until the current one is
done. Do not skip to WASM because it is the most visible.

### A — Mapping + author (done)

Versioned Metaphor3D → USDA mapping and `authorMetaphorUsda`. Export menu offers **USD scene
(.usda)**.

**Done when:** a validated DSL produces deterministic USDA; tests cover every kind's fields.

### B — Field-complete stub + inverse parse (this change)

The stub dropped `scene.mood`, `item.accent`, and subway `interchange` (fields added to the DSL
after v0.1.0). Stage B closes those holes and adds `parseMetaphorUsda` so
`author(parse(author(dsl)))` is byte-identical USDA.

**Done when:**

- Mapping version is `0.2.0` and documents `sceneMood`, `accent`, and `interchange`.
- `parseMetaphorUsda` lives in `packages/shared` and throws `MetaphorUsdaParseError` on non-stub
  input.
- Round-trip tests cover every base kind, composite layers, links, dangling rels, escaped labels,
  and the new fields.
- JSON DSL remains what the renderer and agents read.

### C — Official OpenUSD runtime check (next)

Validate fixtures with the **official** core, not Three and not usdjs.

Recommended seam: a Python script that `pip install`s [`usd-core`](https://pypi.org/project/usd-core/)
(current 26.8; requires Python ≥3.9) and, for each authored fixture USDA:

1. `Sdf.Layer.FindOrOpen(path)` succeeds.
2. `Usd.Stage.Open(path)` returns a stage whose `defaultPrim` is `World`.
3. Every `archislop:id` relationship target path exists on the stage (or is the documented
   dangling-string fallback).
4. `customLayerData["archislop:mappingVersion"]` matches `METAPHOR_USDA_MAPPING_VERSION`.

The PyPI wheel does **not** ship `usdchecker`; use `pxr.Sdf` / `pxr.Usd` (and `pxr.UsdValidation`
when the wheel includes it) rather than assuming CLI tools.

**Done when:** the script is in `scripts/`, pinned to a `usd-core` version, and a CI job runs it.
The job may be `continue-on-error` until the environment image has Python + the wheel; it must
not be implied by `npm test`. Do not add `usd-core` or a WASM binary to the web bundle to skip
this.

### D — Composition arcs, schema, motion (after C)

Only after official OpenUSD is opening the stub:

- Composite layers as `references` / `subLayers` with an **allowlisted** resolver (no arbitrary
  fetches).
- Typed schema (or documented `apiSchemas`) for `archislop:*` instead of a flat custom bag where
  a real USD type exists.
- Deterministic motion as time samples **or** a documented procedural schema — pick one, write it
  in the mapping, bump the mapping version.

**Done when:** the mapping version bumps, round-trip still holds, and stage C's OpenUSD job still
passes on the new arcs.

### E — WASM worker evaluation (after D, optional)

Evaluate an official OpenUSD WASM build in a **lazy worker**, never on the main thread and never
as the slot store. Release gates from ADR-0009 step 4, still in force:

startup bytes, memory, CSP, cross-origin isolation, resolver cancellation, browser support, Node
parity.

The `wasmFetchResolver` example is not the resolver to ship. Three's loader may render; it still
is not the conformance boundary.

**Done when:** those gates are measured in a write-up with numbers, and a kill switch exists
before any worker is on the default path.

### F — Optional glTF 2.0.1 bake (independent)

Baked geometry/material delivery when a DCC or share surface needs meshes. Stable ids in a
documented extension or sidecar. Re-evaluate glTF 2.1 only after ratification. This does not
replace the USDA stub or the JSON DSL.

## Rules that survive every stage

1. **Do not change the canonical boundary** until stage C's OpenUSD job has been green on a
   corpus and stage D's arcs (if any) round-trip.
2. **Do not add OpenUSD, usdjs, or Three USDLoader as a runtime dependency** of `packages/shared`
   or the metaphor renderer to "get onto USD". Shared stays a leaf: pure author/parse.
3. **Do not emit `xformOp`s or meshes in the stub** until a baked delivery path (stage F) or a
   documented procedural schema (stage D) owns placement. Planner placement stays internal.
4. **Bump `METAPHOR_USDA_MAPPING_VERSION`** with the mapping doc in the same change. Additive
   fields = minor; renames/removals = major.
5. **A new DSL field without a mapping row is a bug.** Stage B exists because `mood`, `accent`,
   and `interchange` shipped in the schema and not in the stub. The round-trip test is the sensor:
   if `author(parse(author(dsl)))` drifts, the mapping is incomplete.
6. **Unknown `archislop:*` attributes stay ignorable** (USD custom-data convention). The inverse
   parse may pass them through; `MetaphorDslSchema` strips what it does not know.

## Where this lives

| Piece         | Path                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Decision      | [`docs/decisions/0009-dynamic-composite-standards.md`](../decisions/0009-dynamic-composite-standards.md) |
| Mapping       | [`docs/guide/metaphor-usda-mapping.md`](metaphor-usda-mapping.md)                                        |
| Author        | `packages/shared/src/metaphorUsda.ts` (fields: `metaphorUsdaFields.ts`)                                  |
| Inverse parse | `packages/shared/src/metaphorUsdaParse.ts` (scan: `metaphorUsdaScan.ts`)                                 |
| Export        | `metaphor-usda` in `apps/web/src/utils/exportDiagram.js`                                                 |
| Tests         | `packages/shared/test/metaphorUsda.test.ts`                                                              |

## Adding a mapped field

1. Put it on the Zod schema / sanitizer if it is new DSL.
2. Add a row to `KIND_ITEM_FIELDS` (`metaphorUsdaFields.ts`) or `collectSceneLayerData` / `emitItem`.
3. Bump `METAPHOR_USDA_MAPPING_VERSION` (minor if additive) and the mapping doc.
4. Extend `packages/shared/test/metaphorUsda.test.ts` so author emits it and the round-trip
   re-authors identical USDA.
5. Do not teach `parseMetaphorUsda` a second grammar — it already maps `archislop:*` attributes
   by USD type. Only special-case when the mapping itself is special (`links` parallel arrays,
   dangling rel fallback).
