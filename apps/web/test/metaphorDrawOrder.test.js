/**
 * A marker never overpaints the name of the thing it marks.
 *
 * `accent` is the scene's thesis: exactly one item, the one the topic is
 * actually about. Its callout is depth-test-free by design — a city building
 * stacks a roof, a spire and a rooftop glyph above its own anchor, so a
 * depth-tested marker renders inside the tower it points at. But the item's own
 * label sits in that same column, and the callout out-ordered it: measured over
 * six kinds x three viewports (390x844, 717x512, 1440x900), the callout altered
 * 8.2% of the accented item's own name box, past 1% in 13 of 18 cases and up to
 * 30% on the subway — an amber rod struck through "Scheduler" and "Platform".
 * Accented names rendering every glyph went from 10 of 18 to 18 of 18.
 *
 * The collision is structural rather than a bad anchor, which is what makes a
 * per-scene fix the wrong shape and this invariant worth pinning. Every scene
 * puts an item's name directly above that item, at the same `(x, z)` as its
 * accent anchor, and a vertical stem at that `(x, z)` projects to a screen line
 * through the projection of every point on it — the name's centre included —
 * under any camera. No framing change and no anchor tweak can separate them.
 * Draw order is the only thing that decides it, so the ladder is the contract.
 *
 * Two of the cases below pin things that are NOT draw order, because the same
 * name was being destroyed two other ways at once and each is invisible to the
 * check that catches the others: a depth-test-free mesh that still WRITES depth
 * deletes glyphs without painting a pixel, and `material-depthTest` on an
 * outlined troika `<Text>` is assigned onto an array and silently does nothing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ACCENT_CAPTION_TEXT_ORDER,
  ACCENT_ITEM_LABEL_ORDER,
  ACCENT_ITEM_LABEL_PLATE_OPACITY,
  ACCENT_ITEM_LABEL_PLATE_ORDER,
  ACCENT_MARKER_ORDER,
  ACCENT_PIN_ORDER,
  LABEL_PLATE_ORDER
} from '../src/components/metaphorScenes/metaphorDrawOrder.js';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('the accent draw-order ladder', () => {
  it('puts the accented item’s own name above every rung of its own callout', () => {
    // The whole point of the file. Both the chip and the glyphs have to clear
    // the caption, which is the highest thing the marker draws.
    for (const marker of [ACCENT_MARKER_ORDER, ACCENT_PIN_ORDER, ACCENT_CAPTION_TEXT_ORDER]) {
      expect(ACCENT_ITEM_LABEL_PLATE_ORDER).toBeGreaterThan(marker);
      expect(ACCENT_ITEM_LABEL_ORDER).toBeGreaterThan(marker);
    }
  });

  it('keeps the name in front of its own chip', () => {
    expect(ACCENT_ITEM_LABEL_ORDER).toBeGreaterThan(ACCENT_ITEM_LABEL_PLATE_ORDER);
  });

  it('keeps the callout above an ordinary label chip', () => {
    // Unchanged behaviour, and the reason the ladder is not simply "labels
    // last": an UNaccented name must still be able to lose to the callout, or
    // a crowded scene draws its thesis behind six chips that outrank nothing.
    expect(ACCENT_MARKER_ORDER).toBeGreaterThan(LABEL_PLATE_ORDER);
  });

  it('rises in the order the marker is built', () => {
    expect(ACCENT_PIN_ORDER).toBeGreaterThan(ACCENT_MARKER_ORDER);
    expect(ACCENT_CAPTION_TEXT_ORDER).toBeGreaterThan(ACCENT_PIN_ORDER);
  });

  it('gives the accented chip enough body to hide the rod behind it', () => {
    // A 0.58 chip over a saturated amber stem reads as a line struck through
    // the word — the rod is the one thing an ordinary chip was never sized to
    // sit in front of.
    expect(ACCENT_ITEM_LABEL_PLATE_OPACITY).toBeGreaterThan(0.9);
    expect(ACCENT_ITEM_LABEL_PLATE_OPACITY).toBeLessThanOrEqual(1);
  });
});

describe('MetaphorAccents draws from the ladder', () => {
  const source = read('../src/components/metaphorScenes/MetaphorAccents.jsx');

  it('names every render order instead of spelling one out', () => {
    // A literal here is how the ladder silently stops being one: the caption
    // was `30`, `+1`, `+2`, so nothing outside this file could know what it
    // had to clear.
    expect(source).not.toMatch(/renderOrder=\{\s*\d/);
    expect(source).toMatch(/from '\.\/metaphorDrawOrder\.js'/);
  });

  it('keeps the callout depth-test-free', () => {
    // Unchanged, and load-bearing: the marker exists because the accented item
    // is so often the one the scene buries.
    expect(source).toMatch(/depthTest=\{false\}/);
  });

  it('never writes depth from a mesh that ignores it', () => {
    // The half of the bug that leaves no evidence. `meshStandardMaterial`
    // defaults `depthWrite` to true, so the stem and pin stamped their distance
    // into the buffer and DELETED the glyphs drawn behind them — no amber pixel
    // where the letter was, which is why a colour diff scored it as clean.
    // Every mesh in the callout that sets `depthTest={false}` must also say so.
    const elements = source.match(/<[A-Za-z][^<>]*?\/>/gs) ?? [];
    const ignoringDepth = elements.filter((el) => /(?:material-)?depthTest=\{false\}/.test(el));
    expect(ignoringDepth.length).toBeGreaterThanOrEqual(4);
    for (const el of ignoringDepth) {
      expect(el).toMatch(/(?:material-)?depthWrite=\{false\}/);
    }
  });
});

describe('ItemLabel lifts the accented name over the callout', () => {
  const source = read('../src/components/metaphorScenes/MetaphorSceneChrome.jsx');

  it('draws the accented name last', () => {
    expect(source).toMatch(/renderOrder=\{accented \? ACCENT_ITEM_LABEL_ORDER : 0\}/);
  });

  it('sets the name’s depth through troika, never through a material- prop', () => {
    // With an outline configured — every label here has one — troika's
    // `material` getter returns an ARRAY of two materials, so r3f's
    // `material-depthTest` pierce assigns onto the array and the renderer never
    // sees it. Silent: no warning, and a screenshot identical to doing nothing.
    expect(source).not.toMatch(/material-depthTest=/);
    expect(source).toMatch(/onSync=\{applyLabelDepth\}/);
    expect(source).toMatch(/material\.depthTest = !accented/);
    expect(source).toMatch(/Array\.isArray\(troikaMesh\?\.material\)/);
  });

  it('lifts the accented chip with it', () => {
    expect(source).toMatch(
      /renderOrder=\{accented \? ACCENT_ITEM_LABEL_PLATE_ORDER : LABEL_PLATE_ORDER\}/
    );
    expect(source).toMatch(/depthTest=\{!accented\}/);
  });

  it('thickens only the accented chip', () => {
    expect(source).toMatch(/ACCENT_ITEM_LABEL_PLATE_OPACITY/);
    // Guarded by `style.plate > 0`, so a group placard — which has no chip at
    // all, and is written across its ground — does not grow one by being
    // accented.
    expect(source).toMatch(/accented && style\.plate > 0/);
  });

  it('leaves every other label exactly as it was', () => {
    // The lift is scoped to `accented`, which is one item per scene. Dropping
    // depth for all names would put a back-row label in front of the tower
    // standing between it and the camera, which is the trap the declutter pass
    // and `assignSiteLabelPlacement` both exist to avoid. Every branch above is
    // a ternary on that flag, so the unaccented arm is the pre-existing value:
    // this pins that nobody made the lift unconditional.
    expect(source).toMatch(/const accented = useItemAccent\(\);/);
    expect(source).not.toMatch(/renderOrder=\{ACCENT_ITEM_LABEL/);
    expect(source).not.toMatch(/material\.depthTest = false/);
  });
});
