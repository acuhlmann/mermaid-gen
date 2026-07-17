# ADR-0009: Dynamic Composite v2 — semantic DSL is canonical; the fused render plan is internal

## Status

Accepted — 2026-07-17

## Context

Composite v1 mounts complete metaphor scenes beside or over one another. That preserves the base renderers, but it produces a montage rather than one meaningful world. Composite v2 needs prompt-dependent structure, deterministic revision stability, real relationship anchors, and continuous semantic motion without permitting model-authored JavaScript.

We investigated whether the first milestone should instead make an OpenUSD Stage the stored scene:

- **USD Core Specification v1.0.1** (AOUSD, 2025-12-12) is the stable normative specification for USD data representation and stage composition. It covers layers, references, variants, attributes, relationships, and scene construction. OpenUSD v26.03 added official Emscripten build targets for the core libraries and a `wasmFetchResolver` browser example. The build produces monolithic static libraries; the example explicitly describes itself as illustrative rather than production infrastructure. The repository has no OpenUSD build, bindings, resolver policy, conformance corpus, or WASM loading budget today.
- The current web runtime is React Three Fiber 9.6.1 over **Three 0.185.1**. That Three release includes `USDLoader`/`USDComposer` for USDA, USDC, and USDZ and implements useful reference, payload, variant-selection, transform, material, and animation paths. It is a render importer that composes supported USD data into `THREE.Object3D`, not a declared USD Core 1.0.1 implementation or a lossless stage API. It does not provide a trustworthy canonical round-trip for arbitrary custom metadata and semantic relationships.
- A pure TypeScript library such as `@cinevva/usdjs` is promising, but its own documentation calls composition a practical subset and lists missing Pcp parity, specializes, relocates, and value clips. Adding it now would not establish Core 1.0.1 compliance.
- **glTF 2.0.1** is the stable Khronos runtime-delivery specification in the current registry and has mature Three support. It is suitable for baked geometry/material/animation delivery, not as the canonical authoring/composition model for these semantic layers and relationships. glTF 2.1 is still a candidate/in-development specification in the official announcement/registry material and is not adopted here.
- A2UI 1.0 is also a candidate/in development. A2UI, AG-UI, and MCP Apps remain UI/transport boundaries, not 3D scene representations.

Claiming OpenUSD compliance through a loader import or a speculative dependency would therefore be misleading. A standard interchange/canonical representation must preserve composition semantics and round-trip authored meaning; an internal render plan only needs to drive this renderer.

## Decision

For this milestone:

1. The validated Metaphor3D JSON DSL remains the **canonical semantic representation**. Composite adds `layout: "fused"`, a stable `seed`, bounded `novelty`, and bounded `motionIntensity`; layers and globally unique item ids preserve the user's nouns and relationships.
2. `planFusedCompositeWorld` produces a deterministic **internal render plan**. Its primitive/capability registry records roles, bounds, anchors, placement, motion style, and estimated render cost. It is neither persisted nor advertised as OpenUSD or glTF.
3. Explicit Composite v1 `adjacent` and `overlay` documents continue through the old renderer. New/omitted layouts resolve to `fused`.
4. No OpenUSD, USD-JS, glTF-export, A2UI, or MCP dependency is added in this milestone.

The migration path to an actual USD Stage is:

1. Specify a versioned Metaphor3D-to-USD mapping: stable item ids to prim paths; layers to composition arcs; links to `UsdRelationship`; semantic fields to namespaced attributes/custom data; theme and planner controls to metadata; deterministic motion to time-sampled attributes or a documented procedural schema.
2. Implement an adapter that authors USDA first, keeping the current DSL as a semantic source/sidecar until every field round-trips. Resolve references through an explicit allowlisted asset resolver.
3. Validate fixtures against USD Core 1.0.1 supplemental/conformance material and the official OpenUSD runtime. Test references, variants, relationship targets, unknown metadata preservation, and deterministic stage reconstruction before calling the Stage canonical.
4. Evaluate an official OpenUSD WASM build in a separate lazy worker/chunk: startup bytes, memory, CSP, cross-origin isolation, resolver cancellation, browser support, and Node parity are release gates. Three's USD loader may remain a rendering adapter, but not the conformance boundary.
5. Offer glTF 2.0.1 as an optional baked delivery/export representation when needed, with stable ids/semantic metadata in a documented extension or sidecar. Re-evaluate glTF 2.1 only after ratification and production loader support.

**Shipped (export only):** the web Export menu includes `metaphor-gltf` (`.glb`) which bakes the live R3F content root via Three's `GLTFExporter`. Item ids/labels are node `extras`; the Metaphor JSON DSL is attached as root `extras.archislop.diagramSource`. The JSON DSL remains canonical; GLB is not a round-trip authoring format.

## Follow-on dynamics (still ADR-0009)

Without changing the canonical boundary, the fused planner/renderer now also:

1. **Binds landmarks and path stations by affinity** — shared `district` / `chain` / `bed` / label tokens attach items to the matching substrate site instead of seeded modulo placement.
2. **Encodes storytelling fields** — `hazard`, `health`, `lighting`, `condition`, `maturity`, `cracks`, and `tilt` become plan `presentation` params that drive materials, posture, foam, and bloom height.
3. **Differentiates motion styles** — `flow` is a distinct transform (not a bob fallback); path width/mote speed scale with `flow` × `motionIntensity`; high novelty may remix landmark/accent styles.
4. **Draws affinity groups and tree connectors** — soft district/chain rings plus parent→child connector arcs for tree layers.
5. **Applies cost-aware LOD** — `estimatedCost` / item count select `high` | `medium` | `low` detail (motes, glow, hazard foam, group rings).
6. **Chooses composite atmosphere from roles** — sky/theme family prefers substrate (ocean) then path (river daylight) over `layers[0].as`.

OpenUSD / WASM / persisted Stage work remains on the migration path above and is still out of scope.

## Consequences

Positive:

- Composite v2 ships a visible integrated world without a large runtime or an unsupported standards claim.
- Base metaphor documents and renderers remain unchanged.
- Stable ids, anchors, roles, and deterministic controls create a clean future USD mapping seam.
- The canonical semantic source remains compact and agent-authorable; the renderer can evolve without wire churn.

Trade-offs:

- The stored document is not yet interoperable USD, and the internal planner cannot be consumed as one.
- Procedural geometry and motion cannot yet round-trip through DCC tools.
- A future Stage adapter must define schemas and conformance tests before changing the canonical boundary.

## Alternatives considered

- **Adopt OpenUSD WASM immediately.** Rejected: official WASM build support is real, but this repository lacks production bindings, resolver/conformance work, and a measured browser budget.
- **Use Three's `USDLoader` as canonical parsing.** Rejected: it is a useful renderer importer, not a lossless Core 1.0.1 Stage and semantic round-trip API.
- **Adopt a third-party JS USD implementation.** Deferred: current implementations document partial composition parity; dependency adoption should follow corpus evidence.
- **Use glTF as the authored composite format.** Rejected for canonical authoring: stable glTF 2.0.1 optimizes runtime asset delivery, not USD-style layered semantic composition.

## Where this lives in code

- Canonical contract: `packages/shared/src/metaphorSchema.ts`, `metaphorSanitizer.ts`
- Capability/primitive registry: `apps/web/src/components/metaphorScenes/compositePrimitiveRegistry.js`
- Internal planner: `apps/web/src/components/metaphorScenes/fusedCompositePlanner.js`
- R3F renderer: `apps/web/src/components/metaphorScenes/FusedCompositeScene.jsx`
- Agent contract: `apps/server/src/prompts/metaphorSystemPrompt.js`
- Optional baked export: `apps/web/src/utils/metaphorGltfExport.js` + `metaphor-gltf` in `apps/web/src/utils/exportDiagram.js`

## Evidence reviewed

- [USD Core Specification v1.0.1](https://github.com/aousd/specifications-public/blob/main/core/1.0.1/core_spec.md)
- [OpenUSD v26.03 WebAssembly announcement](https://aousd.org/blog/openusd-v26-03/) and [official build instructions](https://github.com/PixarAnimationStudios/OpenUSD#webassembly)
- [OpenUSD `wasmFetchResolver` example](https://github.com/PixarAnimationStudios/OpenUSD/tree/dev/extras/usd/examples/wasmFetchResolver)
- [Three `USDLoader` documentation](https://threejs.org/docs/pages/USDLoader.html) and the installed Three 0.185.1 `USDLoader`/`USDComposer` source
- [Khronos glTF registry](https://registry.khronos.org/glTF/) and [glTF 2.1 development announcement](https://www.khronos.org/blog/introducing-gltf-2.1-with-complex-scenes)
- [`@cinevva/usdjs` composition coverage](https://cinevva-engine.github.io/usdjs/COMPOSITION)
- [A2UI specification status](https://a2ui.org/) (`v0.9.1` current, `v1.0` candidate)
