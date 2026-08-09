# Verify apps/web changes (headless render capture)

How to observe web-app changes at runtime in a sandboxed/headless environment.
Worked out while verifying metaphor3d scene changes; the renderer-specific
recipe below generalizes to any canvas-heavy component.

## Launch

```bash
npm ci                       # repo root; workspaces install
cd apps/web && npx vite --port 5199 --strictPort   # dev server, no backend needed for pure-render components
```

Chromium is preinstalled at `/opt/pw-browsers/chromium`; drive it with
`playwright-core` (install into the scratchpad, not the repo). Launch args for
software WebGL: `['--enable-unsafe-swiftshader']`. WebGL2 + the three.js
EffectComposer (half-float MSAA target) both work under SwiftShader.

## Rendering a component in isolation

Create a temporary `apps/web/<name>.html` + `apps/web/src/<name>Harness.jsx`
(vite serves any root-level html; delete both before committing). Mount the
component under test directly with `createRoot`, parameterized via
`URLSearchParams`. For MetaphorRenderer pass a stringified metaphor DSL
(see `packages/shared/src/metaphorSchema.ts` for shapes).

## Gotchas that produce a BLANK page (all-transparent canvas)

The sandbox network policy blocks CDNs, and two runtime fetches crash the
whole R3F tree when they fail — the canvas stays mounted but renders nothing:

1. **drei `<Text>` (troika) font resolution** — fetched from jsdelivr _inside a
   blob worker_, which bypasses `page.route`. Fix in the harness:
   `import { configureTextBuilder } from 'troika-three-text';
configureTextBuilder({ useWorker: false });` then intercept with
   `page.route` and fulfill:
   - `codepoint-index/plane*/*.json` → `[1, {"en": {"latin": "<'o' × 44>"}}]`
     (each char carries 6 coverage bits; `'o'` = all set)
   - `font-meta/*.json` → `[1, {"id":"latin","ranges":"0-ff","typeforms":{"sans-serif":{"normal":[400]}}}]`
   - `*.woff` → any local TTF (`/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`)
2. **drei `<Environment preset>`** (noir/arcade themes) — fetches an `.hdr`;
   fulfill with a minimal Radiance file: header
   `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 8 +X 8\n` + 256 bytes of
   `0x80 0x80 0x80 0x80` (flat mid-gray).

After a `page.goto`, `waitForSelector('canvas')` + ~5s settle (the intro
auto-rotate lasts 1.4s), then `page.screenshot()` composites DOM + WebGL fine.

## Useful probes

- `?stream=1`-style streaming/preview flags: animations freeze via the shared
  metaphor clock; scene must still render statically.
- Animated one-shot effects (e.g. shooting stars): burst-capture N screenshots
  ~700ms apart and inspect the largest files.
- For a baseline comparison, `git stash push -u -- <paths>` → capture → `git stash pop`.

## Capturing a CSS transition at an exact moment

Racing the wall clock with `waitForTimeout` gives frames you cannot reproduce.
Instead let the phase change land (one `requestAnimationFrame`), then pause and
seek **every** live animation — `document.getAnimations()` covers CSS
transitions and the floor's ambient loops as well as the keyframe animations:

```js
document.getAnimations().forEach((a) => {
  try {
    a.pause();
    a.currentTime = ms;
  } catch {
    /* finished/idle reject a seek */
  }
});
```

**Seek to the animation's END, not to `0`.** `ms = 0` is the tempting default and it is wrong
for the floor: `.office-floor[data-view-phase='stand-up']` runs `office-floor-cover`, a `both`-
filled fade **from `opacity: 0`**, so parking it at 0 pins the entire room invisible while every
DOM measurement stays perfectly healthy. Every screenshot comes back an empty carpet-coloured
rectangle that reads exactly like your change broke the room. Use
`a.effect.getComputedTiming().endTime` unless you specifically want a mid-transition frame.

**A floor harness must import `components/OfficeFloor.css` itself.** `ArchiSlop.jsx` is its only
importer, so the `index.css` + `App.css` recipe above leaves `.office-floor` unfixed and
`.office-floor-prop` unpositioned — every prop falls into static flow. The tell is _geometry_,
not blankness: props measure at `y ≈ 2000` in an 844 px viewport, which looks like a projection
bug and is a missing stylesheet.

**Use `deviceScaleFactor: 4`** when judging small art (a 62 px whiteboard panel, a 19 px screen
face). At 1× you cannot honestly say whether it reads.

Two traps this walks into, both found on the stand-up camera move
(`docs/office-isometric-mode.md` § 1a):

- **Never diff two frames across a remount.** `OfficeFloor` re-randomizes
  walkers and idle phases every time it mounts, so a "with effect vs without"
  diff taken as _sit down → stand up → shoot, repeat_ is dominated by people
  standing somewhere else — it reported a 235/255 max delta for a band actually
  worth 18/255. Mount **once**, park it with the seek above, and toggle only the
  thing under test (`addStyleTag` an `opacity: 0 !important` override, shoot,
  remove it). Contamination hides while the room is still blurred and explodes
  the moment it goes crisp, which reads convincingly like a real effect.
- **Driving the store twice in one `page.evaluate` is one React tick.**
  `standUp()` immediately followed by `sitDown()` never enters the `sit-down`
  phase at all — `useFloorViewPhase` sees only the final value. Each store call
  needs its own `evaluate` so React commits in between.

A white-on-near-white overlay needs measuring, not eyeballing: diff the frames
and read `maxDelta`. Under ~20/255 nobody will ever see it.
