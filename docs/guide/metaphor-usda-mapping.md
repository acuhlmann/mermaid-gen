# Metaphor3D → USDA mapping (v0.1.0)

This is the versioned mapping between the canonical Metaphor3D JSON DSL and USD ASCII (`.usda`)
output, implementing migration steps 1–2 of [ADR-0009](../decisions/0009-dynamic-composite-standards.md).
The adapter (`authorMetaphorUsda` in `packages/shared/src/metaphorUsda.ts`) authors USDA text from a
validated DSL document; the web Export menu offers it as **USD scene (.usda)** on the metaphor3d slot.

The JSON DSL remains the canonical semantic source. The USDA artifact is a **semantic interchange
stub**: it carries the document's items, fields, and relationships in USD vocabulary so DCC tools,
USD tooling, and curious humans can inspect the structure. It is **not** a conformance claim against
the USD Core 1.0.1 specification, and it is not a rendering artifact — the R3F renderer keeps
reading the DSL, and the internal fused render plan stays internal.

## Layer (file) level

Every export starts:

```usda
#usda 1.0
(
    defaultPrim = "World"
    upAxis = "Y"
    metersPerUnit = 1
    customLayerData = {
        string "archislop:mappingVersion" = "0.1.0"
        ...
    }
)
```

`customLayerData` keys, in stable emission order:

| Key                         | Value                                                                    |
| --------------------------- | ------------------------------------------------------------------------ |
| `archislop:mappingVersion`  | This mapping's version (`0.1.0`). Bump on any breaking change below.     |
| `archislop:metaphor`        | DSL discriminator (`city` … `machine`, `composite`).                     |
| `archislop:layout`          | Composite only: `fused` / `adjacent` / `overlay`.                        |
| `archislop:seed`            | Composite only: planner seed, stringified (schema allows string or int). |
| `archislop:novelty`         | Composite only: `0`–`1` as a decimal string.                             |
| `archislop:motionIntensity` | Composite only: `0`–`1` as a decimal string.                             |
| `archislop:sceneTheme`      | `whiteboard` / `noir` / `arcade` / `blueprint`.                          |
| `archislop:sceneCamera`     | Schema value (`orbit` default; renderer currently always orbits).        |
| `archislop:sceneTitle`      | Optional.                                                                |
| `archislop:sceneSubtitle`   | Optional.                                                                |
| `archislop:sceneLegend`     | Optional. JSON-encoded legend object (`{"height":"team size",…}`).       |
| `archislop:sceneNebula`     | Optional. JSON-encoded `scene.nebula` array (galaxy).                    |
| `archislop:sceneSurface`    | Optional. JSON-encoded `scene.surface` object (terrain).                 |

Structured values (legend, nebula, surface) are JSON strings inside `customLayerData` because
`customLayerData` is a flat `string → string` dictionary; the JSON encoding is part of this mapping
and must be documented wherever it changes.

## Prim hierarchy

```
/World                              def Xform — the defaultPrim
/World/<scope>                      def Xform — one per metaphor kind (base documents)
/World/<scope>/<Item>               def Xform — one per item
```

- **Base kinds** — `<scope>` is the kind itself (`city`, `garden`, …), with
  `doc = "archislop metaphor kind: <kind>"`.
- **Composite** — `<scope>` is the sanitized layer id, carrying:
  - `custom string archislop:layerId` — original DSL layer id
  - `custom token archislop:layerAs` — which base kind the layer mounts
  - `custom string archislop:layerLabel` — optional
  - `custom double3 archislop:layerPosition` / `custom double archislop:layerScale` — optional, from
    the layer `transform`; authored hints only, never planner output

Item prims get `doc = "<item label>"` plus the attributes below.

### Identifier sanitization

USD prim/property names allow `[A-Za-z_][A-Za-z0-9_]*`; DSL ids allow dashes. Mapping:

1. Replace every character outside `[A-Za-z0-9_]` with `_`.
2. Prefix `_` when the first character is a digit.
3. Dedupe collisions **within the same parent scope** by appending `_2`, `_3`, … in document order
   (`a-b` and `a_b` collide; the later one becomes `a_b_2`).
4. The original DSL id is always preserved verbatim in `custom string archislop:id`.

## Item attributes

Common attributes, emitted first, in this order:

| Attribute            | Type      | Source                                                                                                              |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `archislop:id`       | `string`  | DSL item id (verbatim)                                                                                              |
| `archislop:label`    | `string`  | Item label                                                                                                          |
| `archislop:position` | `double3` | Optional author hint — deliberately **not** a real `xformOp`; deterministic placement is planner-owned and internal |
| `archislop:glyph`    | `token`   | Optional procedural icon id                                                                                         |
| `archislop:note`     | `string`  | Optional ≤140-char hover note                                                                                       |

Then per-kind fields, named `archislop:<field>`, in schema order. Numbers are `double`, free strings
are `string`, enums are `token`, string lists are `string[]`:

| Kind          | Field attributes                                                                      |
| ------------- | ------------------------------------------------------------------------------------- |
| `city`        | `height` dbl · `footprint` dbl · `district` str? · `lighting` tok? · `condition` tok? |
| `layercake`   | `thickness` dbl · `components` str[] · `cracks` dbl? · `tilt` dbl?                    |
| `galaxy`      | `magnitude` dbl · `cluster` str? · `binary` **rel?**                                  |
| `tree`        | `parent` **rel?** · `weight` dbl · `kind` tok?                                        |
| `terrain`     | `elevation` dbl · `intensity` dbl                                                     |
| `orrery`      | `orbit` dbl · `size` dbl · `moon` **rel?**                                            |
| `river`       | `stage` dbl · `flow` dbl · `hazard` dbl?                                              |
| `garden`      | `maturity` dbl · `impact` dbl · `bed` str? · `health` tok                             |
| `archipelago` | `mass` dbl · `relief` dbl · `chain` str?                                              |
| `machine`     | `size` dbl · `speed` dbl · `axle` str? · `torque` dbl? · `mesh` **rel?**              |

Composite layer items re-validate against the per-kind mini schemas but keep optional fields
absent when the agent omitted them; only present fields are emitted. Base-kind documents carry
schema defaults, so their non-optional fields always appear.

### Item→item references (UsdRelationship)

Fields that reference another item (`binary`, `parent`, `moon`, `mesh`) become relationships:

```usda
custom rel archislop:parent = </World/tree/root>
```

When the referenced id does not resolve to an emitted prim (dangling reference the sanitizer kept),
the adapter falls back to the raw value so no information is lost:

```usda
custom string archislop:parent = "missing-id"
```

### Links

Each DSL `links[]` entry (`from` / `to` / `kind?` / `label?`) is emitted on the **`from` item's
prim** as an outgoing relationship set:

```usda
custom rel archislop:links = [</World/city/db>, </World/city/cache>]
custom uniform token[] archislop:linkKinds = ["flow", "dependency"]
custom string[] archislop:linkLabels = ["calls", ""]
```

- The parallel arrays are index-aligned with the relationship targets; absent `kind` / `label`
  become empty strings (relationships carry no per-target metadata in USD, hence the arrays).
- Links whose `from` or `to` does not resolve to an emitted prim are skipped.
- For composite documents, links resolve across layers via the globally unique item ids.

## Worked example

```usda
#usda 1.0
(
    defaultPrim = "World"
    upAxis = "Y"
    metersPerUnit = 1
    customLayerData = {
        string "archislop:mappingVersion" = "0.1.0"
        string "archislop:metaphor" = "city"
        string "archislop:sceneTheme" = "noir"
        string "archislop:sceneCamera" = "orbit"
        string "archislop:sceneTitle" = "Payments platform"
    }
)

def Xform "World"
{
    def Xform "city" (
        doc = "archislop metaphor kind: city"
    )
    {
        def Xform "payments_api" (
            doc = "Payments API"
        )
        {
            custom string archislop:id = "payments-api"
            custom string archislop:label = "Payments API"
            custom double archislop:height = 12
            custom double archislop:footprint = 3
            custom string archislop:district = "core"
            custom token archislop:lighting = "lit"
            custom rel archislop:links = [</World/city/ledger_db>]
            custom uniform token[] archislop:linkKinds = ["flow"]
            custom string[] archislop:linkLabels = ["writes"]
        }

        def Xform "ledger_db" (
            doc = "Ledger DB"
        )
        {
            custom string archislop:id = "ledger-db"
            custom string archislop:label = "Ledger DB"
            custom double archislop:height = 6
            custom double archislop:footprint = 4
            custom string archislop:district = "core"
            custom token archislop:condition = "aging"
        }
    }
}
```

## Explicit non-goals (v0.1)

- **No geometry, materials, or `xformOp`s.** Procedural visuals belong to the internal render plan
  (ADR-0009 decision 2). A baked delivery format is ADR-0009 step 5 (glTF 2.0.1), not this artifact.
- **No composition arcs.** Layers are sibling scopes in one file; `subLayers` / `references` /
  `payloads` with a real asset resolver come with ADR-0009 step 2's later iterations.
- **No time-sampled motion.** `motionIntensity` and per-item motion style stay planner concerns;
  time-sampled attributes or a procedural schema are named in ADR-0009 step 1 as follow-up work.
- **No USDA parser / round-trip.** Field-coverage tests in
  `packages/shared/test/metaphorUsda.test.ts` are the current guard; a real inverse mapping and
  conformance validation belong to ADR-0009 steps 2–3.
- **No USDZ/USDC output and no OpenUSD dependency.** Authoring is pure text generation.

## Versioning

- The mapping version is independent of the DSL schema and of any app release: bump the minor digit
  for additive attributes, the leading digit for renames/removals.
- The version string is emitted in every file (`archislop:mappingVersion`) and exported from code as
  `METAPHOR_USDA_MAPPING_VERSION`.
- Consumers must treat unknown `archislop:*` attributes as ignorable, matching USD's own custom-data
  conventions.

## Where this lives in code

- Adapter: `packages/shared/src/metaphorUsda.ts` (`authorMetaphorUsda`)
- Canonical DSL contract: `packages/shared/src/metaphorSchema.ts`, `metaphorSanitizer.ts`
- Export wiring: `metaphor-usda` in `apps/web/src/utils/exportDiagram.js`
- Tests: `packages/shared/test/metaphorUsda.test.ts`, `apps/web/test/exportDiagram.test.js`
