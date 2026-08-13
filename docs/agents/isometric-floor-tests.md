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

| File                                 | What it guards                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `officeFloorPlan.test.js`            | Pure geometry: projection, marks, glass, peek roster                                     |
| `officeFloorMovement.test.js`        | Where you may walk, approach/peek/prop marks                                             |
| `officeFloorReach.test.js`           | Where somebody is when away, and whether it is a mark                                    |
| `officeFloorInterrupt.test.js`       | What somebody says when you take the square they wanted (slice 18)                       |
| `officeFloorDwell.test.jsx`          | Who you are stood next to, and the line it earns (slice 19)                              |
| `officeFloorContracts.test.js`       | **ADR-0011 executable rules** (narration, props, POV)                                    |
| `officeFloorModuleInventory.test.js` | Bench components + test files still exist                                                |
| `officeFloorPropsTable.test.js`      | `officeFloorProps.js` ↔ `propTileFor` alignment                                          |
| `officeLayerFloorRenderer.test.jsx`  | Desk overlay **or** floor scene — never both                                             |
| `officeFloor.test.jsx`               | Substrate, person cards, walk-bys, mode toggle                                           |
| `officeFloorArrival.test.jsx`        | First-run ceremony on the floor                                                          |
| `officeFloorAccess.test.jsx`         | Live region, `floorAnnouncement`, reduced motion                                         |
| `officeFloorRoam.test.jsx`           | Free roam click + keyboard                                                               |
| `officeFloorShopTalk.test.jsx`       | The proximity ladder, the overheard pair, and the offer to join (22, 23)                 |
| `officeFloorTalk.test.jsx`           | Floor as second renderer of IM thread; CC-off bubble hide; joining (23)                  |
| `useFloorSpokenText.test.js`         | Voice-first narration hook: CC off + spoken → hide bubble                                |
| `officeCaptions.test.js`             | `shouldShowSpokenText` policy (captions × voiceActive)                                   |
| `officeWalkBy.test.jsx`              | Desk-mode shoulder lean-in + voice-first caption hide                                    |
| `deskActionsDock.test.jsx`           | Stand up primary control; Walk the floor removed from menu                               |
| `officeFloorPeek.test.jsx`           | Desk peeking marks and fiction                                                           |
| `officeFloorProps.test.jsx`          | Usable props + `getCoffee` verb                                                          |
| `officeFloorScene.test.jsx`          | Coffee + battle set pieces                                                               |
| `officeFloorMeeting.test.jsx`        | Glass room meeting renderer; nobody lost walking in (27)                                 |
| `officeFloorWander.test.jsx`         | Ambient wander roster, yields, and the interrupted-errand line                           |
| `officeFloorStyles.test.js`          | CSS facts (hit box, focus, reduced motion)                                               |
| `officeFloorViewTransition.test.js`  | Stand-up/sit-down transition: JS exit timer ↔ CSS fade, veil z-order, light-sweep timing |
| `useFloorArrivalFocus.test.jsx`      | Day One follow-cam scale boost and ceiling clamp                                         |
| `useFloorAway.test.jsx`              | Commute ids merged into awayIds; wanderer vs floorState split                            |
| `officeFloorCommute.test.js`         | The commute state machine; the glass-room threshold, its queue and dispersal (17, 27)    |
| `officeFloorCommuters.test.jsx`      | The one-surface-draws-a-person hand-off, both ways round (17, 27)                        |
| `useWalkAnimation.test.jsx`          | Walk interrupts + `liveTileOf` read-back                                                 |
| `officeDeskWork.test.js`             | Fictional desk workloads for peek                                                        |
| `officeFloorActivity.test.jsx`       | Held items, headphones posture, who-is-talking derivation, the office day                |
| `officeFloorWallClock.test.jsx`      | The wall clock: placement, hand angles, heartbeat poll, both stages mount it             |
| `officeErrand.test.jsx`              | Soft errands (26): the absent timer, the card-slot rung, settling, the inbox CTA         |
| `useOfficeDayPhase.test.jsx`         | The wall-clock sampler: catch-up, no-repaint-on-no-change, teardown                      |

## Rules encoded as tests (add here when you learn new ones)

1. **Mount one renderer** — `officeLayerFloorRenderer.test.jsx`: walk-by and coffee overlays swap with floor actors when `standUp()`.
2. **Spatial narration only** — `officeFloorContracts.test.js`: `floorAnnouncement` never quotes speech lines.
3. **Coffee is the only prop with a desk verb** — `officeFloorPropsTable.test.js` + contracts.
4. **Wander marks use walker POV** — `isStandableTile(mark, { excludeSeatId })` in contracts + wander suite.
5. **One live region on the floor** — `officeFloorAccess.test.jsx` counts `[aria-live]`.
6. **Only a settled figure is reachable** — `officeFloorContracts.test.js` + `officeFloorReach.test.js`: a walker and anybody a moment has claimed get no mark, so the verb does not render.
7. **One derivation of what somebody is doing** — `officeFloorActivity.test.jsx`: the precedence (call ▸ your headphones ▸ coffee ▸ carried item ▸ the hour ▸ trait row) is asserted once, and no surface composes it itself. The hour is rung 5, so anybody a moment is drawing gets no phase; the boundaries themselves live in `officeCadence.test.js`.
8. **An overheard exchange offers a walk, never a reply** — `officeFloorContracts.test.js`: slice 23's offer carries two seat ids and a prop kind, and none of the exchange's text. A `line`, a quote or an `actionPrompt` on it would make the exchange something addressed to the user, which belongs in the moment store as a walk-by.
9. **A surface whose cast does not all commute asks the opposite question** — `officeFloorCommuters.test.jsx`: `FloorScene` and `FloorHuddle` gate on `settledIds` because everybody in them sets off, so absent-from-settled means still walking. The glass room's roster includes people sealed behind their own glass who never commute at all, so it takes `walkingIds` instead — gating it on arrival deletes every executive from the meeting. Assert both halves: the version that only checks the walker passes while the room is quietly empty.
10. **The card slot's order is the live region's order** — `officeFloorContracts.test.js` walks the whole chain (meeting ▸ talk ▸ peek ▸ prop ▸ walk-by ▸ join ▸ roam). A card added without a sentence in the same position is two surfaces disagreeing about what you are doing.

## Adding a new floor slice

1. Add behaviour tests beside the slice (component or util).
2. If you add a **new invariant** (geometry rule, narration rule, mount guard), add one assertion to `officeFloorContracts.test.js` or the relevant contract file.
3. If you add a **new component** under `officeFloor/`, add it to `EXPECTED_OFFICE_FLOOR_COMPONENTS` in `officeFloorModuleInventory.test.js`.
4. If you add a **new test file**, add it to `ISOMETRIC_FLOOR_BLAST_TESTS` in `scripts/test-affected-lib.mjs` and this doc.
5. Run `npm run test:floor` before commit.

## jsdom limitations

Vitest jsdom has **no layout engine** — hit-box overlap and CSS size facts live in `officeFloorStyles.test.js` (stylesheet text) or Playwright harness (see `docs/office-isometric-mode.md` §6 verification recipe). Do not assert `getBoundingClientRect` overlap in jsdom component tests.

Walking uses **no WAAPI** in jsdom — `useWalkAnimation` settles immediately (same as `prefers-reduced-motion`). Floor suites rely on that; see `useWalkAnimation.test.jsx`.

## Two inputs a mounting floor test does not name, and both have bitten

Any suite that renders the whole floor inherits ambient life, and ambient life reads two globals that a test which is not about ambient life will forget to control.

- **The wall clock.** The hour is rung 5 of `floorActivityFor`, above the trait row, so a render assertion about what somebody is holding is only true in the two day phases with no `PHASE_ART`. Pin it: `vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] })` at a **midday** instant, faking `Date` only.
- **`Math.random`.** `useFloorWander` sends somebody out on an unstubbed random, so an unpinned suite shares one PRNG stream across the **file** — and any change anywhere that consumes a different number of randoms re-seeds who is wandering and where. Found by slice 23, which consumes one fewer: `officeFloorDwell.test.jsx` went red on a test that passed in isolation and failed in file order, which is this class's signature. Pin with `vi.spyOn(Math, 'random').mockReturnValue(0.75)` (the floor suites' seed: Chad to the whiteboard) unless the suite is genuinely about the roll.

Neither failure mentions time or randomness in its message; both look like a broken assertion about the feature under test.
