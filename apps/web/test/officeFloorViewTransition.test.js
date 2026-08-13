import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FLOOR_VIEW_EXIT_MS,
  FLOOR_VIEW_EXIT_REDUCED_MS
} from '../src/components/officeFloor/viewTransition.js';

/**
 * The stand-up / sit-down transition (§ 1a) lives in two places that must
 * agree: `OfficeFloor.css` owns the choreography, `viewTransition.js` owns how
 * long the floor stays mounted for the exit. jsdom has no animation engine, so
 * — like `officeFloorStyles.test.js` — the contract is asserted as text.
 * Node environment for the same reason (`import.meta.url` is an http URL under
 * jsdom and `fileURLToPath` throws on it).
 */
const css = readFileSync(
  fileURLToPath(new URL('../src/components/OfficeFloor.css', import.meta.url)),
  'utf8'
).replace(/\/\*[\s\S]*?\*\//g, '');

const appCss = readFileSync(
  fileURLToPath(new URL('../src/App.css', import.meta.url)),
  'utf8'
).replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of the first rule whose selector list exactly matches `selector`. */
function ruleBody(selector, sheet = css) {
  const idx = sheet.indexOf(`${selector} {`);
  if (idx === -1) return null;
  const open = sheet.indexOf('{', idx);
  const close = sheet.indexOf('}', open);
  return close === -1 ? null : sheet.slice(open + 1, close);
}

describe('the stand-up / sit-down view transition (§ 1a)', () => {
  it('gives both phases a camera move on the viewport', () => {
    expect(ruleBody(".office-floor[data-view-phase='stand-up'] .office-floor-viewport")).toMatch(
      /animation:\s*office-camera-rise/
    );
    expect(ruleBody(".office-floor[data-view-phase='sit-down'] .office-floor-viewport")).toMatch(
      /animation:\s*office-camera-sink/
    );
  });

  it('keeps the JS exit timer and the CSS exit fade the same length', () => {
    /*
     * The floor unmounts when `FLOOR_VIEW_EXIT_MS` elapses; if the fade is
     * still running at that point the room snaps out mid-move, and if the fade
     * finished early the room sits invisible-but-mounted eating clicks. The
     * two numbers are one fact — this test is what keeps them one fact.
     */
    const fade = ruleBody(".office-floor[data-view-phase='sit-down']");
    const ms = Number(fade?.match(/office-floor-cover-out\s+(\d+)ms/)?.[1]);
    expect(ms).toBe(FLOOR_VIEW_EXIT_MS);
  });

  it('keeps the reduced-motion exit on the same clock too', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    const ms = Number(reduced.match(/office-floor-fade-out\s+(\d+)ms/)?.[1]);
    expect(ms).toBeLessThanOrEqual(FLOOR_VIEW_EXIT_REDUCED_MS);
  });

  it('paints the desk haze below the floor, never above it', () => {
    /*
     * The veil blurs the workstation; the room it covers for must stay crisp.
     * One token apart in App.css's `:root` ladder, and the veil reads the
     * floor's token rather than hard-coding the gap.
     */
    const veilZ = Number(appCss.match(/--z-office-desk-veil:\s*(\d+)/)?.[1]);
    const floorZ = Number(appCss.match(/--z-office-floor:\s*(\d+)/)?.[1]);
    expect(veilZ).toBeGreaterThan(0);
    expect(veilZ).toBeLessThan(floorZ);
    expect(ruleBody('.office-view-desk-veil')).toMatch(
      /z-index:\s*var\(--z-office-desk-veil,\s*149\)/
    );
  });

  it('lifts the haze from the shell class, not from the floor', () => {
    /*
     * The desk side must not hang off `.office-floor` at all: while the floor
     * is exiting the veil is already clearing, and the two overlap. The shell
     * class flips with the store, which is the only clock both sides share.
     */
    expect(ruleBody('.app-shell.is-floor-view .office-view-desk-veil')).toMatch(/backdrop-filter:/);
  });

  it('finishes the fluorescent sweep inside the stand-up gesture', () => {
    /*
     * White over a near-white floor: a low peak reads as nothing at all, and a
     * tail past ~640ms keeps glowing after the rise has landed. Measured in
     * headless Chrome — pinned here so a "softer" tweak cannot silently regress
     * to invisible again.
     */
    const sweep = css.match(/@keyframes office-floor-light-sweep[\s\S]*?^\}/m)?.[0];
    expect(sweep).toBeTruthy();
    expect(sweep).toMatch(/20%\s*\{\s*opacity:\s*0\.34/);

    const band = ruleBody(".office-floor[data-view-phase='stand-up']::after");
    expect(band).toMatch(/office-floor-light-sweep\s+560ms/);
    expect(band).toMatch(/90ms\s+both/);
    expect(band).not.toMatch(/720ms/);
  });
});
