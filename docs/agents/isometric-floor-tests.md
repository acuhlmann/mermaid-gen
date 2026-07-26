# Isometric floor — test map for coding agents

Isometric mode is **renderer #2** of the office (ADR-0011). These tests guard the two-renderer rule, geometry derivations, and mount-one-renderer guards in `OfficeLayer`.

Human design doc: [`docs/office-isometric-mode.md`](../../docs/office-isometric-mode.md). Blast-radius row: [`docs/agent-blast-radius.md`](../agent-blast-radius.md).

## Run the full floor suite

```bash
npm run test:floor
```

From the repo root. Faster than `npm test` when you are only touching floor code.

`npm run test:affected` pulls this suite automatically when the diff touches `OfficeFloor`, `officeFloor/*`, `officeFloorPlan.js`, `OfficeLayer` floor wiring, `officeViewModeStore`, etc. (see `ISOMETRIC_FLOOR_BLAST_TESTS` in `scripts/test-affected-lib.mjs`).

## Shared helpers

Import from [`apps/web/test/helpers/officeFloorTestUtils.jsx`](../../apps/web/test/helpers/officeFloorTestUtils.jsx):

| Helper                                                            | Use                                                |
| ----------------------------------------------------------------- | -------------------------------------------------- |
| `renderFloor(props)`                                              | `standUp()` + render `OfficeFloor` with flat props |
| `resetOfficeFloorTestState()`                                     | Reset view mode + captions between tests           |
| `enableFloorDialogueCaptions()`                                   | Turn captions on for bubble assertions             |
| `WALK_BY_FIXTURE`, `COFFEE_SCENE_FIXTURE`, `BATTLE_SCENE_FIXTURE` | Shared scene data                                  |

Do not copy `standUp(); render(<OfficeFloor />)` into new suites — extend the helper.

## Test file map

| File                                 | What it guards                                        |
| ------------------------------------ | ----------------------------------------------------- |
| `officeFloorPlan.test.js`            | Pure geometry: projection, marks, glass, peek roster  |
| `officeFloorMovement.test.js`        | Where you may walk, approach/peek/prop marks          |
| `officeFloorContracts.test.js`       | **ADR-0011 executable rules** (narration, props, POV) |
| `officeFloorModuleInventory.test.js` | Bench components + test files still exist             |
| `officeFloorPropsTable.test.js`      | `officeFloorProps.js` ↔ `propTileFor` alignment       |
| `officeLayerFloorRenderer.test.jsx`  | Desk overlay **or** floor scene — never both          |
| `officeFloor.test.jsx`               | Substrate, person cards, walk-bys, mode toggle        |
| `officeFloorArrival.test.jsx`        | First-run ceremony on the floor                       |
| `officeFloorAccess.test.jsx`         | Live region, `floorAnnouncement`, reduced motion      |
| `officeFloorRoam.test.jsx`           | Free roam click + keyboard                            |
| `officeFloorTalk.test.jsx`           | Floor as second renderer of IM thread                 |
| `officeFloorPeek.test.jsx`           | Desk peeking marks and fiction                        |
| `officeFloorProps.test.jsx`          | Usable props + `getCoffee` verb                       |
| `officeFloorScene.test.jsx`          | Coffee + battle set pieces                            |
| `officeFloorMeeting.test.jsx`        | Glass room meeting renderer                           |
| `officeFloorWander.test.jsx`         | Ambient wander roster + yields                        |
| `officeFloorStyles.test.js`          | CSS facts (hit box, focus, reduced motion)            |
| `useWalkAnimation.test.jsx`          | Walk interrupts + `liveTileOf` read-back              |
| `officeDeskWork.test.js`             | Fictional desk workloads for peek                     |

## Rules encoded as tests (add here when you learn new ones)

1. **Mount one renderer** — `officeLayerFloorRenderer.test.jsx`: walk-by and coffee overlays swap with floor actors when `standUp()`.
2. **Spatial narration only** — `officeFloorContracts.test.js`: `floorAnnouncement` never quotes speech lines.
3. **Coffee is the only prop with a desk verb** — `officeFloorPropsTable.test.js` + contracts.
4. **Wander marks use walker POV** — `isStandableTile(mark, { excludeSeatId })` in contracts + wander suite.
5. **One live region on the floor** — `officeFloorAccess.test.jsx` counts `[aria-live]`.

## Adding a new floor slice

1. Add behaviour tests beside the slice (component or util).
2. If you add a **new invariant** (geometry rule, narration rule, mount guard), add one assertion to `officeFloorContracts.test.js` or the relevant contract file.
3. If you add a **new component** under `officeFloor/`, add it to `EXPECTED_OFFICE_FLOOR_COMPONENTS` in `officeFloorModuleInventory.test.js`.
4. If you add a **new test file**, add it to `ISOMETRIC_FLOOR_BLAST_TESTS` in `scripts/test-affected-lib.mjs` and this doc.
5. Run `npm run test:floor` before commit.

## jsdom limitations

Vitest jsdom has **no layout engine** — hit-box overlap and CSS size facts live in `officeFloorStyles.test.js` (stylesheet text) or Playwright harness (see `docs/office-isometric-mode.md` §6 verification recipe). Do not assert `getBoundingClientRect` overlap in jsdom component tests.

Walking uses **no WAAPI** in jsdom — `useWalkAnimation` settles immediately (same as `prefers-reduced-motion`). Floor suites rely on that; see `useWalkAnimation.test.jsx`.
