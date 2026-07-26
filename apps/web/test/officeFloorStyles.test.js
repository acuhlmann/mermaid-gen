import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Three CSS facts about the floor with no runtime shape at all — jsdom has no
 * layout engine and Vitest stubs stylesheet imports to empty — so they are
 * asserted against the sheet's own text, the way `bottomChromeAdvisorLayer`
 * pins a rule whose consequence only exists in a real browser. Node
 * environment on purpose: `import.meta.url` is an http URL under jsdom and
 * `fileURLToPath` throws on it.
 *
 * Each of the three cost a browser to find, and none of them would fail a
 * review — the hit box is invisible, the spread reads like a focus ring, and
 * forced colours are a mode nobody has open.
 */
/*
 * Comments stripped first, and not as tidiness: this stylesheet documents its
 * own history, so the prose above a rule quotes the broken value the rule was
 * written to replace. A scanner that reads the comments finds every bug it was
 * built to catch, forever.
 */
const css = readFileSync(
  fileURLToPath(new URL('../src/components/OfficeFloor.css', import.meta.url)),
  'utf8'
).replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of the first rule whose selector list exactly matches `selector`. */
function ruleBody(selector) {
  const idx = css.indexOf(`${selector} {`);
  if (idx === -1) return null;
  const open = css.indexOf('{', idx);
  const close = css.indexOf('}', open);
  return close === -1 ? null : css.slice(open + 1, close);
}

describe('the person is the size of the person', () => {
  it('keeps the name chip out of the button’s layout flow', () => {
    /*
     * § 6 rule 22. As a flex sibling the chip *sized the button*, so every
     * seat's clickable box was as wide as the longest name and reached ~20 px
     * above the head — invisibly, since the chip is transparent until hover.
     * The printer once answered 11 of 441 sampled points because of it.
     */
    expect(ruleBody('.office-floor-person-name')).toMatch(/position:\s*absolute/);
  });

  it('draws a real focus outline, which only the fix above made meaningful', () => {
    const focus = ruleBody('.office-floor-person:focus-visible');
    expect(focus).toMatch(/outline:\s*2px solid/);
    expect(focus).not.toMatch(/outline:\s*none/);
  });
});

describe('indicators that actually render', () => {
  it('writes no drop-shadow with a spread, which no browser parses', () => {
    /*
     * `drop-shadow(0 0 0 2px …)` reads like a focus ring and parses like a
     * mistake: four lengths, where the function takes at most three (x, y,
     * blur) and has no spread at all. One invalid entry invalidates the whole
     * `filter` declaration, so the indicator silently does not exist — which is
     * how focus *and* selection on a person went unmarked for nine slices.
     */
    const isLength = (token) => /^-?[\d.]+(px|rem|em|%)?$/.test(token);

    for (const [, args] of css.matchAll(/drop-shadow\(([^)]*)/g)) {
      const tokens = args.trim().split(/\s+/);
      let lengths = 0;
      while (lengths < tokens.length && isLength(tokens[lengths])) lengths += 1;
      expect(lengths, `drop-shadow(${args}) has ${lengths} lengths; the limit is 3`).toBeLessThan(
        4
      );
    }
  });

  it('keeps focus visible when the colours are taken away', () => {
    const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
    expect(forced, 'no forced-colors block at all').not.toBe('');
    expect(forced).toContain('.office-floor-person:focus-visible');
    /*
     * The prop cannot use an outline — it would trace the 260×260 `PROP_VIEW`
     * box rather than the machine, which is why slice 9 suppressed it. So its
     * indicator goes where its hit target already goes: the drawn shapes.
     */
    expect(forced).toMatch(/\.office-floor-prop--usable:focus-visible \.office-floor-prop-art \*/);
    expect(forced).toMatch(/stroke:\s*Highlight/);
  });
});

describe('counter-scaled balloons stay on screen (§ 6 rule 28)', () => {
  it('divides bubble layout width by the inverse scale', () => {
    /*
     * Without this, at MIN_SCALE (0.5) a `max-width: 60vw` box is painted at
     * 120 vw and clips every left-desk intro (Chad) off the phone.
     */
    const bubble = ruleBody('.office-floor-bubble');
    expect(bubble).toMatch(/width:\s*calc\(15rem\s*\/\s*var\(--floor-inverse-scale/);
    expect(bubble).toMatch(/max-width:\s*calc\(min\(60vw/);
  });

  it('divides panel layout width the same way', () => {
    const panel = ruleBody('.office-floor-panel');
    expect(panel).toMatch(/width:\s*calc\(19rem\s*\/\s*var\(--floor-inverse-scale/);
  });

  it('biases edge speakers toward screen centre', () => {
    expect(ruleBody('.office-floor-bubble--align-start')).toMatch(/translateX\(42%\)/);
    expect(ruleBody('.office-floor-bubble--align-end')).toMatch(/translateX\(-42%\)/);
  });
});

describe('reduced motion covers the whole floor', () => {
  /**
   * Every selector that switches an animation *on*, split out of its list.
   * A forward scan rather than a parser: selector lists here are either one
   * line ending in `{` or a run of lines ending in `,` before it.
   */
  function animatedSelectors() {
    const found = new Set();
    let pending = '';
    let selector = '';

    for (const raw of css.split('\n')) {
      const line = raw.trim();
      if (line.endsWith('{')) {
        selector = `${pending}${line.slice(0, -1).trim()}`;
        pending = '';
      } else if (line.endsWith(',')) {
        pending += line;
      } else if (line === '}') {
        selector = '';
      }

      const anim = line.match(/^animation:\s*([\w-]+)/);
      if (anim && anim[1] !== 'none' && selector) {
        for (const one of selector.split(',')) {
          if (one.trim()) found.add(one.trim());
        }
      }
    }
    return found;
  }

  it('silences every animation the sheet declares', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    const selectors = animatedSelectors();

    // Not a spot check: anything that starts animating on this floor has to
    // name itself in that block, and this fails until it does. The floor's
    // motion is the reason reduced motion is a *decision* here — walking is
    // already handled in `useWalkAnimation`, and this is the other half.
    expect(selectors.size).toBeGreaterThan(0);
    for (const one of selectors) {
      expect(reduced, `${one} keeps animating under reduced motion`).toContain(one);
    }
  });
});
