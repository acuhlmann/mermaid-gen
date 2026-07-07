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

1. **drei `<Text>` (troika) font resolution** — fetched from jsdelivr *inside a
   blob worker*, which bypasses `page.route`. Fix in the harness:
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
