# The office window manager — desktop windows, phone sheets

A slice of the screen-world skin ([`office-isometric-mode.md`](office-isometric-mode.md) §4).
**Slices 1–3 shipped; slice 4 (the merged comms strip) has not** — see §6 and §10.

Written as a design before any code moved, because the change touches `overlayStack` — shared
state with four consumers — and because the diagnosis is the part worth keeping even if the
design were rejected. §10 records what building it actually taught, including the two places
the design was wrong.

## 1. Why this exists

The complaint, in the user's words: the draggable / minimizable email and IM windows are
"rather uncommon for mobiles and unnecessarily complicated, and often lead to clipped parts
where the user doesn't see the full window."

The app is mobile-first. The parody-OS frame is not — it was designed at 1440px and
_verified_ at 390 and 320 (§4b), which is a different claim: the frame fits, but the windows
inside it are still Windows 95 on a phone.

## 2. What is there today

Five surfaces, one shell:

| Window         | Component                     | Registers as  |
| -------------- | ----------------------------- | ------------- |
| Inbox          | `OfficeInboxDock.jsx:202`     | `officeModal` |
| Slop Chat™     | `OfficeMessenger.jsx:282`     | `officeModal` |
| WG meeting     | `MeetingOverlay.jsx:414`      | `officeModal` |
| Meeting picker | `CallMeetingPicker.jsx:133`   | `officeModal` |
| Training       | `OfficeTrainingWindow.jsx:44` | `officeModal` |

`FloatingWindow` composes two independent things: `useDraggablePosition` (free `left`/`top`,
per-window `sessionStorage`, clamped against `visualViewport`) and `useOverlayLayer` →
`overlayStack` (a global monotonic focus z-index). `DeskOsTray` lists the open ones as
taskbar pills.

## 3. Diagnosis — five mechanisms, not one feeling

Worth separating, because the fix follows from the mechanism.

**1. The clipping is deliberate, at a desktop magnitude.** `clampWindowPosition` permits a
window to hang off-screen down to `minVisiblePx: 56` (`useDraggablePosition.js:105`, and
again at `:194` during the drag). On a desktop that is the familiar "park it at the edge"
affordance. At 390px wide it is 14% of the viewport, and it reads as broken rather than
parked. **The tolerance is not a bug; applying the desktop value on a phone is.**

**2. The recovery verb is hidden exactly where it is needed.** `resetAllFloatingWindows`
("Tidy up") exists because windows get stranded — §4a re-homed it for precisely that, and
`floatingWindowControl.js`'s own header says so. `App.css:23450` hides it below **720px**.
So the phone is the one breakpoint where a window can be stranded and there is no way back.
The comment explaining the hide is correct on its own terms (the pills are what a taskbar is
_for_, and Tidy up cost them 13px at 390px) — it is the free dragging underneath it that
should not have survived to that width.

**3. Minimize is one concept with four implementations, and the taskbar is not one of them.**

- `OfficeMessenger.jsx:233` — local `useState`
- `OfficeInboxDock.jsx:46` — local `useState`
- `OfficeTrainingWindow.jsx:32` — local `useState`
- `MeetingOverlay.jsx:328` — local `useState`, **persisted** to `localStorage` via
  `readOfficeMeetingMinimized` / `writeOfficeMeetingMinimized`
  (`utils/officeAmbienceStorage.js:251`)
- `CallMeetingPicker` — none at all

Minimizing collapses a window to its titlebar _in place_ — so it stays wherever it was
dragged, floating over the canvas, giving nothing back. Meanwhile the taskbar pill calls
`bringOverlayToFront` and nothing else (`DeskOsTray.jsx:71`): it cannot restore, because it
does not know the window is minimized. **Two half-implementations of one idea, wired to each
other by nothing.** That is the "unnecessarily complicated" in the complaint, and it is not
mobile-specific.

**4. The phone height is an estimate stacked on an estimate.** `App.css:22452` sizes the
messenger at
`min(72dvh, var(--app-vvh) - var(--mobile-bottom-chrome-est, 10.5rem) - 2.5rem)`. The token
is named `-est` because it is one, its CSS fallback here (10.5rem) disagrees with the one in
`App.css` at `--mobile-bottom-chrome-est` (8.75rem), and `readMobileBottomChromeReservePx()`
falls back to a hardcoded `140` (`viewportBounds.js:122`, `:134`). Three guesses at one
number, and when they disagree the window clips into the composer band.

**5. Free dragging declared `touch-action: none` on the window root, where it could only do
harm.** `.floating-window` set it so the drag could own the gesture; no descendant re-enabled
panning, and a descendant **cannot** — Chrome intersects touch-action up the whole ancestor
chain, so a nested scroll container inherits the veto. That points at
`.office-messenger-log` and the inbox list not scrolling by finger.

**Resolved, and more cheaply than expected.** The drag handlers are not on the root: they are
spread onto `FloatingWindowDragHandle`, which declares its own `touch-action: none`. The root
declaration was **redundant for dragging** — so removing it cannot affect the drag, and it
closes the scroll risk outright. That much is verified in code and pinned by a test. Whether
the veto was actively breaking scroll on a real device was never measured, and no longer
needs to be.

## 4. The principle

Do not drop the OS metaphor on mobile. It is the joke, it is what ADR-0011 rule 3 licensed,
and §4 built the whole frame around it.

Replace the **window manager**, not the fiction: **a phone OS is still an OS.** It has a task
switcher, app-sized surfaces, and a back gesture. What it does not have is free-floating
windows with off-screen tolerance. Windows 95 on the desktop, iOS on the phone — both are
parody-OS chrome, and only one of them is wrong at 390px.

This is the same move ADR-0011 rule 1 makes for the floor: one state, a second _rendering_ of
it. A window's identity (open, focused, minimized, its title and kind) is presentation-
agnostic; how it is placed is not.

## 5. The design

### A. One `presentation` axis on `FloatingWindow`, resolved from viewport

| Mode       | Breakpoint | Behaviour                                                                 |
| ---------- | ---------- | ------------------------------------------------------------------------- |
| `floating` | ≥1025px    | Today, unchanged — drag, cascade, focus ring, remembered position.        |
| `docked`   | 640–1024px | Panel that cannot overlap the composer band.                              |
| `sheet`    | ≤639px     | Bottom sheet: full width, snap points (peek / half / full), no free drag. |

Breakpoints reuse `layoutBreakpoints.js` (`PHONE_MEDIA_QUERY`, `WIDE_MOBILE_MEDIA_QUERY`) via
`useAppLayoutMedia` — no new numbers. `docked` generalizes a rule that already exists for
exactly one window: `App.css:22495`'s phone bottom-sheet footprint for a dragged-to-dock
meeting. That rule is evidence the sheet shape is right; it is currently reachable only by
dragging a window to the right place, which no phone user will do.

**The sheet must not extend `useDraggablePosition`.** Free positioning and snap positioning
are different state machines — one clamps a point in a plane, the other selects from an
ordered list of heights — and merging them is how a 238-line hook becomes 400. A sibling
`useSheetSnap` owns the vertical-only gesture; `FloatingWindow` picks one hook or the other.

The structural payoff, and the reason this fixes the clipping rather than tuning it: **at
phone width `left`/`top` are never computed at all.** No clamp constant, no stale
`sessionStorage` entry, no rotation and no keyboard-open `visualViewport` shrink can put the
window anywhere except full-width against the bottom chrome. Positions are also not persisted
in `sheet` mode — there is nothing to persist.

### B. Minimize means "go to the taskbar" — at every breakpoint

Move `minimized` out of the four components into `overlayStack` as a per-overlay flag,
alongside the `title` / `kind` / `manageable` metadata already there. Then:

- Minimized window renders nothing (no stub over the canvas).
- `DeskOsTray` renders its pill in a minimized state; clicking restores **and** focuses.
- On phone, swiping the sheet down minimizes to the tray, and the pill is the way back.

This is a net deletion: four `useState`s, one `localStorage` round-trip in
`officeAmbienceStorage.js`, the `.is-minimized { height: auto !important }` special-cases
(`App.css:18054`), and the per-component stub branches all go. It also fixes the desktop
complaint, which is the tell that it is the right layer.

It works on a phone only because the tray already survives the demotion ladder: pill labels
go glyph-only at 720px (`App.css:23439`) and `.desk-os-tray` keeps a one-pill floor at 320px
(`App.css:23457`) specifically so that "there is no way to switch windows at all" cannot
happen. **The taskbar is already a phone dock. Nothing is currently routed to it.**

Note the ordering dependency: (B) is a prerequisite for (A)'s dismiss gesture, because a
swipe-down needs somewhere to go that is not "closed".

### C. On a phone, one office window at a time

Opening Slop Chat™ while the inbox is open minimizes the inbox to the tray. Free once (B)
lands, matches every phone OS, and makes overlapping-and-clipped structurally impossible
rather than merely unlikely. The `officeChrome` band (transient IM pings, walk-by cards) is
unaffected — those are notifications, not windows, and `manageable` already distinguishes
them.

This does not apply above 640px. Two windows side by side on a tablet is fine; two sheets
stacked on a phone is not.

### D. Merge the comms icons with the tray, on phone only

The composer band carries Mail / Chat / Meeting as direct icons (§4b) and the taskbar carries
the window pills. On a phone those are the same three things in two rows — one row opens
them, the other switches them. Collapse to a single strip where each icon shows an unread
badge when its window is closed and acts as a switcher pill when it is open.

This **reduces** command surfaces, so it stays inside §4b's "frequency, not category" rule
and does not add a sixth. It is also the only part of this design that touches the composer
band, which is why it is last.

## 6. Slices

1. ~~**Minimize → taskbar**~~ (B) — ✅ shipped. Pure simplification, net deletion, no new
   gesture system. Fixes the floating-stub weirdness at every breakpoint.
2. ~~**`presentation` axis + `sheet`**~~ (A) — ✅ shipped. Where the clipping class stops
   existing.
3. ~~**Sheet gestures + one window at a time**~~ (C) — ✅ shipped, and 1–3 landed together
   because 1 is a prerequisite for 2's dismiss gesture and 3 is four lines once 1 exists.
4. **Merged comms strip** (D) — **not built.** The only part that touches the composer band,
   and the only one that is a layout question rather than a placement one.

## 7. Considered and not chosen

- **Tune the clamp: raise `minVisiblePx` on phone.** The cheapest possible change, and it
  treats the symptom. A window that cannot be dragged _mostly_ off-screen is still a window
  being dragged by a thumb on a 390px canvas, still paying `touch-action: none`, still
  stranded with Tidy up hidden. It also leaves three guesses at the bottom-chrome height in
  place.
- **Hide the windows on mobile and put the office in a full-screen route.** Kills the joke
  and forks the office into two experiences, which is the shape ADR-0011 rule 1 exists to
  refuse.
- **Make everything a modal dialog on phone.** Correct about placement, wrong about
  blocking: the inbox and Slop Chat™ are explicitly non-modal so you can read while working
  (`OfficeMessenger.jsx` header comment, `aria-modal="false"`). A sheet keeps that; a modal
  does not.
- **A third `presentation` value for the meeting's docked-call state.** The docked "Look at
  my screen" card is a _minimized call_ in the fiction (§4 intro), so it should ride (B)'s
  minimize state rather than becoming a fourth placement mode.
- **Drop free dragging entirely, all breakpoints.** Tempting — it would delete
  `useDraggablePosition`, `floatingWindowControl`, and Tidy up outright. Rejected because
  desktop drag is the diegesis working as intended, and there is no complaint about it.

## 8. Still unverified

The arithmetic was checked by hand at 640 / 390 / 360 tall (no snap yields a negative or
overflowing height) and every CSS fact is pinned in `deskOsFrameStyles.test.js`, but **no
headless capture was taken** — jsdom has no layout engine and the scoped recipe in
`apps/web/.claude/skills/verify/` assumes a Linux sandbox. What a real browser would still
settle:

- **Geometry at 390 / 360 / 320**, plus keyboard-open (`visualViewport` shrink) and rotation.
  These are the two states that stranded a window before; a sheet has no stored position to
  strand, so the expected result is "nothing happens" — worth confirming rather than assuming.
- **Whether the `touch-action` veto was actually breaking scroll** (§3.5). Now academic: the
  declaration is gone and the drag provably did not depend on it.
- **The sheet drag's feel** — `STEP_PX` (56) and `DISMISS_PX` (96) in `useSheetSnap.js` are
  reasoned defaults, not tuned ones. Exported constants for tests and tuning:

  | Constant             | Value                      | Role                                                                             |
  | -------------------- | -------------------------- | -------------------------------------------------------------------------------- |
  | `SHEET_SNAPS`        | `['peek', 'half', 'full']` | Ordered snap heights (actual sizes are CSS `--sheet-block-size` per `data-snap`) |
  | `DEFAULT_SHEET_SNAP` | `'full'`                   | Open height on phone — mail/chat/meeting are apps, not half-height panels        |
  | `STEP_PX`            | 56                         | Drag distance that commits to the next snap                                      |
  | `DISMISS_PX`         | 96                         | Extra pull past `peek` that minimizes to the taskbar via `onDismiss`             |
  | `OVERPULL_PX`        | 24                         | Rubber-band ceiling when dragging up from `full`                                 |

  **`enabled: false` reset:** when the viewport leaves sheet mode (rotate, fold open), the hook
  clears inline `transform`, resets snap to `DEFAULT_SHEET_SNAP`, and drops drag state — a
  half-finished gesture must not strand on the node. Titlebar controls stay clickable (same rule
  as free drag: pointer handlers ignore `button, a, input, …` targets).

## 9. Where this lives in code

- Placement axis: `apps/web/src/hooks/useWindowPresentation.js` (breakpoint → mode) and
  `apps/web/src/hooks/useSheetSnap.js` (the snap gesture), composed in
  `components/FloatingWindow.jsx`
- Minimize state: `apps/web/src/state/overlayStack.js` — `minimizeOverlay`, `restoreOverlay`,
  `minimizeOtherOverlays`, `isOverlayMinimized`, plus `SWITCHABLE_GROUPS`, which moved here
  from `DeskOsTray` because the solo rule needs the same answer
- Window context split into `components/floatingWindowContext.js` so `FloatingWindow.jsx`
  exports components only (Fast Refresh) and the chrome can read the window id without
  importing a component from a component
- CSS: the placement block is the **last** thing in `App.css`, deliberately — see §10
- Deleted: local `minimized` in all four windows, `readOfficeMeetingMinimized` /
  `writeOfficeMeetingMinimized` (+ its storage key), the `.is-minimized` size rules for four
  window kinds, `windowRestore` / `windowRestoreTitle` copy in three locale bundles
- Tests: `apps/web/test/officeWindowManager.test.jsx` (behaviour),
  `floatingWindow.test.js` (store semantics), `useSheetSnap.test.jsx` (snap thresholds,
  dismiss, `enabled: false` reset), `deskOsFrameStyles.test.js` (the CSS facts)

## 10. What building it taught

**Two things the design got wrong.**

_The meeting's minimize was not what §4 says it is._ The intro to
[`office-isometric-mode.md`](office-isometric-mode.md) §4 describes the docked "Look at my
screen" card as "literally a minimized call", which read as a diegetic feature that routing
minimize to the taskbar would destroy. It is not wired: `.office-meeting-room.is-docked` has
three CSS rules and **no code path that ever applies the class**, and its
`readOfficeMeetingDocked` / `writeOfficeMeetingDocked` pair had no callers either. The
objection evaporated on inspection. (The dead `is-docked` rules and the docked storage pair
are still there — pre-existing, and out of this slice's scope.)

_Deleting the meeting's persisted minimize deleted a bug with it._ `readOfficeMeetingMinimized`
seeded a **new** meeting from the last one's collapsed state, which is why a second effect
existed to force-expand on join ("leftover minimize from the last call would make 'Hop on a
call' look like a silent no-op"). One feature and its own workaround, both gone: `registerOverlay`
clears the flag, so opening is never minimized and no effect has to say so. The two remaining
`restoreOverlay` calls in `MeetingOverlay` are a different case — the window stays registered
across `joining → playing → ended`, so those transitions never pass through the open path.

**Where the bodies are buried.**

- **The placement CSS is the last block in `App.css`, and that is load-bearing.** Every window
  sets its own width/height at (0,1,0) — including inside phone media queries. The sheet
  selectors are (0,2,0)+ _and_ last, so a new window kind inherits the placement without
  opting in. Move the block up and a window silently wins back its desktop footprint on a
  phone. Pinned by a cascade-order assertion, not just a specificity one.
- **The sheet reserves `--desk-taskbar-h` and nothing else.** §8's original ask was to
  reconcile three disagreeing bottom-chrome estimates; the answer was to stop needing them.
  The only chrome a sheet must not cover is the taskbar, because minimize sends windows there
  — cover it and you strand what you just minimized. The composer band and menu bar are
  content a sheet may cover, like any phone sheet.
- **`manageable` is what keeps the solo rule from eating notifications.** `SWITCHABLE_GROUPS`
  spans `officeChrome` too, where IM pings live. Today nothing manageable registers there, but
  the guard is the contract: if a future ping registers as manageable it will be minimized by
  the next window that opens, and the office will go quiet exactly when somebody is reaching
  you. Pinned by a test that registers an unmanageable `officeChrome` overlay and an app modal
  and asserts both survive.
- **The sheet grip is a real `<button>`.** A drag-only snap is unreachable by keyboard, and the
  same `closest('button, a, input…')` guard that keeps titlebar controls clickable during a
  drag makes the button and the gesture coexist without special-casing.

**Cost.** Two new hooks (~30 and ~130 lines), one context module, ~90 lines of CSS, and
deletions across nine files. `npm run check` passes; 1744 pre-existing tests were green before
the 18 new ones were added, which is itself the finding — **nothing covered the old split**,
because the store had focus coverage and each window had its own boolean, and no test ever
asserted the two were connected. They were not.

## 11. Slice 4 — the bottom nav rearrangement ✅ shipped

§5D said "merge the comms icons with the tray, on phone only". What shipped is
larger and simpler: **the comms icons moved to the taskbar at every breakpoint**,
and the composer band's free-standing tools moved _inside_ the lane each of them
serves. Owner's framing, which is the design: _you never need mail and chat at
once, there is not enough space anyway, and the canvas is the work — the rest is
a side show._

**The bottom bar is now the office.** `Stand up` · the comms icons · what the
room is doing, all in one cluster, with the presence strip taking the slack
because it is the one resident whose content is a sentence. The icons arrive by
**portal** through the anchor `deskSlotStore` already owned — the anchor simply
moved from the composer band into the bar — so `DeskOsTaskbar` still holds no
office state, and `deskSlotRef` stopped being threaded through four components.

**Space-constrained means phone, not "mobile".** Below 640px the bar drops
Concentration and the HR chip: both have a second home (Admin, the desk menu),
and on a phone the bar's job is the office and the windows, not a scorecard. A
tablet keeps them. This is a _render_ condition, not `display: none`, so the
controls stop mounting rather than merely hiding.

**Each composer lane carries its own tool.** The notebook rides the work-order
lane (what lands in it is what that input produced); the roster leads the talk
lane (picking a face is how you choose who you are addressing, so the lane reads
"to `<person>`: `<message>`"). Measured at 1440px the band went from **105px to
60px** — one row back for the canvas — and a phone wraps to two rows instead of
four.

**Sheets open at `full`.** These are apps and the vertical space is the reason to
open one; `half` and `peek` stay one drag or one tap away.

### What only a browser could tell me

All three of these shipped through a green `npm run check` and were caught by
driving Chrome (playwright-core + system Chrome, per the recipe in
`apps/web/.claude/skills/verify/` adapted to Windows). Each is now pinned in
`deskOsFrameStyles.test.js`.

1. **`.desk-actions` is a corner dock, and every placement must escape it.** The
   base rule is `position: fixed; top: 124px; right: 14px`. Without a reset the
   cluster painted in the top-right corner while its anchor measured 0×0 and the
   presence strip silently ate the 813px of slack. With the reset written as
   `.desk-actions--taskbar` (0,1,0), the corner rules'
   `.desk-actions:not(.desk-actions--bottom)` (0,2,0) still won `top`, so
   `position: relative` + `top: 7.4rem` put the cluster at **y=930 inside an
   844px viewport** — present, measurable, correctly sized, and entirely
   off-screen. The fix is a doubled class. A third placement will need the same
   escape; the honest fix is for the corner rules to name the corner.
2. **`.desk-work-order-group` is `flex-direction: column`.** Correct when the
   prompt was its only child, and the reason the notebook rendered _under_ the
   input rather than beside it.
3. **The flat-tool-row ordering reverses a nested lane.**
   `.prompt-actions--mobile .desk-chrome-tool { order: 1 }` was written when
   these tools were siblings of the lanes; inside one, it put the roster to the
   right of the input it exists to address. Order is declared per lane now, on
   _every_ child — an unset child defaults to 0 and ties with the one you want
   first.

Plus one cosmetic: a sheet measured **392px in a 390px viewport**, because window
kinds carry a 1px border and are not border-box. Not a scroll (the sheet is
fixed, so it clipped), just both rounded corners a pixel off-screen.

### Measured, and clean

Taskbar sibling overlap across 1440 / 1024 / 900 / 820 / 720 / 640 / 540 / 430 /
390 / 320, with and without a window open: **zero at every width**, and
`document.scrollWidth === innerWidth` throughout. Worth recording because the
mid-width tablet screenshot _looked_ like the presence caption was colliding with
the status cluster — it was the docked panel painting above the bar, which is the
documented z-order (`FOCUS_Z_BASE` 300 > taskbar 280). The measurement was right
and the picture was misleading, which is the §4-in-`windows-dev-gotchas` lesson
arriving from the opposite direction.
