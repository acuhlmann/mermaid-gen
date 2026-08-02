import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The parody-OS frame's load-bearing facts are geometric, and jsdom has no
 * layout engine — so they are asserted against the stylesheet's own text, the
 * way `officeFloorStyles` and `bottomChromeAdvisorLayer` pin rules whose
 * consequence only exists in a real browser. Node environment on purpose:
 * `import.meta.url` is an http URL under jsdom and `fileURLToPath` throws.
 *
 * Comments are stripped first — this stylesheet documents its own history, so
 * the prose above a rule quotes the value the rule was written to replace, and
 * a scanner that reads comments finds every bug it was built to catch.
 */
const css = readFileSync(fileURLToPath(new URL('../src/App.css', import.meta.url)), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ''
);

/** The body of the first rule whose selector list exactly matches `selector`. */
function ruleBody(selector) {
  const idx = css.indexOf(`${selector} {`);
  if (idx === -1) return null;
  const open = css.indexOf('{', idx);
  const close = css.indexOf('}', open);
  return close === -1 ? null : css.slice(open + 1, close);
}

describe('parody-OS frame geometry', () => {
  it('anchors the taskbar to the viewport edge, not mid-canvas', () => {
    // The strip shipped as a centred pill at `bottom: 4.6rem`, which was fine
    // for something that only appeared with a window open and wrong the moment
    // it had to carry permanent residents.
    const body = ruleBody('.desk-os-taskbar');
    expect(body).toBeTruthy();
    expect(body).toContain('position: fixed');
    expect(body).toMatch(/\bbottom:\s*0;/);
    expect(body).toMatch(/\bleft:\s*0;/);
    expect(body).toMatch(/\bright:\s*0;/);
    // A centred pill's transform would drag the full-bleed bar off-screen.
    expect(body).not.toContain('transform:');
  });

  it('stacks the bottom chrome on top of the taskbar at every breakpoint', () => {
    // If either `bottom` goes back to a bare length, the composer band sits
    // *under* the taskbar and the Work Order's own footer becomes unclickable.
    const bottoms = [...css.matchAll(/\.bottom-chrome\s*\{([^}]*)\}/g)]
      .map(([, body]) => body.match(/\bbottom:\s*([^;]+);/)?.[1]?.trim())
      .filter(Boolean);
    expect(bottoms.length).toBeGreaterThanOrEqual(2);
    for (const value of bottoms) {
      expect(value).toContain('var(--desk-taskbar-h)');
    }
  });

  it('keeps the taskbar under the focus stack so a dragged window can cover it', () => {
    // FOCUS_Z_BASE is 300 (state/overlayStack.js). A taskbar above it would
    // clip whatever window you just dragged down, with no way to tell why.
    const zIndex = ruleBody('.desk-os-taskbar')?.match(/z-index:\s*(\d+)/)?.[1];
    expect(Number(zIndex)).toBeLessThan(300);
    expect(Number(zIndex)).toBeGreaterThan(279); // above the officeModal band
  });

  // Slice 6 put a second resident in the leading cluster. The bar has no spare
  // width — at 320px it already drops Concentration, the wordmark, the pill
  // labels and Tidy up — so which of the two yields is a decision, not a
  // default.
  it('lets the leading cluster shrink, but never past its children', () => {
    const body = ruleBody('.desk-os-taskbar-lead');
    expect(body).toBeTruthy();
    // `0 0 auto` was right for a lone fixed-width button; kept, the strip's
    // caption would push the tray end out of the bar's right edge.
    expect(body).toMatch(/\bflex:\s*0\s+1\s+auto\b/);
    // And `min-width: 0` — the reflex for every other flexible resident here —
    // is exactly wrong on this one. It defeats the automatic minimum size, so
    // the cluster shrinks past the floors its children declare and their
    // content spills sideways into the window list. Measured at 320px: the
    // cluster collapsed to 19px and the faces painted over the window pills.
    expect(body).not.toMatch(/\bmin-width:\s*0\b/);
  });

  it('makes the presence strip yield before Stand up does', () => {
    // ADR-0011 rule 3: the labelled control is the one that must survive, and
    // the diegetic duplicate beside it is what absorbs a narrow viewport.
    expect(ruleBody('.desk-os-taskbar-lead .overlay-button.slop-action-button')).toMatch(
      /\bflex:\s*0\s+0\s+auto\b/
    );
    expect(ruleBody('.desk-os-presence')).toMatch(/\bflex:\s*0\s+1\s+auto\b/);
  });

  it('clips the strip and floors it, so a squeeze loses words and not people', () => {
    const body = ruleBody('.desk-os-presence');
    // The faces are `flex: 0 0 auto` inside a button that shrinks. Without the
    // clip they overflow into the sibling window list — and the bar's own
    // `overflow: hidden` cannot catch that, because it is not out of the bar.
    expect(body).toContain('overflow: hidden');
    // A floor wide enough for the faces alone; the caption carries min-width: 0
    // and is therefore what ellipsizes first. Anchored to the line start rather
    // than read through `ruleBody`, which finds the selector as the *tail* of
    // the compound `.desk-os-presence:not(…) .desk-os-presence-caption` rule
    // above it and returns the wrong body.
    expect(body).toMatch(/\bmin-width:\s*[\d.]+rem/);
    const caption = css.match(/\n\.desk-os-presence-caption\s*\{([^}]*)\}/)?.[1];
    expect(caption).toContain('min-width: 0');
    // Cap before the flex fight so mid-widths ellipsize cleanly; the portaled
    // peek recovers the full line on hover / focus / long-press.
    expect(caption).toMatch(/max-width:\s*min\(/);
    expect(ruleBody('.desk-os-presence-peek')).toMatch(/\bz-index:\s*290\b/);
  });

  it('drops the presence caption on a phone, keeping the faces', () => {
    // ~95px of caption is the difference between a readable run status and none
    // at 320px. The faces and the button's accessible name still carry it.
    const bodies = [...css.matchAll(/\.desk-os-presence-caption\s*\{([^}]*)\}/g)].map(
      ([, body]) => body
    );
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    expect(bodies.some((body) => /display:\s*none/.test(body))).toBe(true);
    // The faces are never in that trade — a strip with no faces is not a
    // presence strip.
    expect(css).not.toMatch(/\.desk-os-presence-faces\s*\{[^}]*display:\s*none/);
  });

  it('trims faces and the overflow badge together', () => {
    // The badge counts what is *hidden*. Trimming the third face in CSS while
    // the badge still rendered would quietly make it undercount by one, and
    // nothing else in the app would notice.
    const trimmed = css.match(
      /\.desk-os-presence-faces\s*>\s*svg:nth-child\([^)]*\)[^{]*\{[^}]*\}/
    )?.[0];
    expect(trimmed).toBeTruthy();
    expect(trimmed).toContain('.desk-os-presence-more');
    expect(trimmed).toMatch(/display:\s*none/);
  });

  it('retires HR standing before the presence strip below 360px', () => {
    // Presence is the office-life signal; the XP chip is status you can still
    // open from Admin. Same cascade trap as before: the override must win
    // source order against the base `.desk-os-taskbar-xp { display: flex }`.
    expect(css).toMatch(
      /@media\s*\(max-width:\s*360px\)\s*\{\s*\.desk-os-taskbar-xp\s*\{[^}]*display:\s*none/
    );
    const displays = [...css.matchAll(/\.desk-os-taskbar-xp\s*\{([^}]*)\}/g)]
      .map(([, body]) => body.match(/display:\s*([^;]+);/)?.[1]?.trim())
      .filter(Boolean);
    expect(displays.at(-1)).toBe('none');
    // And the strip itself is never hard-hidden — faces stay so the desk still
    // feels inhabited when width is tight.
    expect(css).not.toMatch(
      /@media\s*\(max-width:\s*360px\)\s*\{\s*\.desk-os-presence\s*\{[^}]*display:\s*none/
    );
  });

  it('reserves the safe-area inset once, on the bar that touches the edge', () => {
    // Double-counting it pushes the composer band a notch-height into the canvas
    // on every iPhone.
    expect(ruleBody('.desk-os-taskbar')).toContain('env(safe-area-inset-bottom');
  });

  it('lifts huddle bottom seats and chrome above the taskbar on every viewport', () => {
    // Desktop used to park chrome at `bottom: 0.9rem` — under the permanent
    // `--desk-taskbar-h` strip. Mobile clears via `--mobile-bottom-chrome-est`
    // (taskbar + composer from the viewport edge — do not also add taskbar).
    const layer = ruleBody('.office-huddle-layer');
    expect(layer).toBeTruthy();
    expect(layer).toContain('--huddle-bottom-clearance');
    expect(layer).toContain('var(--desk-taskbar-h)');

    const bottomSeat = css.match(
      /\.office-huddle-seat\.is-side-bottom\s*\{[^}]*bottom:\s*var\(--huddle-bottom-clearance\)/
    );
    expect(bottomSeat).toBeTruthy();
    const chrome = css.match(
      /\.office-huddle-chrome\s*\{[^}]*bottom:\s*calc\(var\(--huddle-bottom-clearance\)/
    );
    expect(chrome).toBeTruthy();

    const mobile = css.match(
      /@media\s*\(max-width:\s*1024px\)\s*\{[^}]*\.office-huddle-layer\s*\{[^}]*--huddle-bottom-clearance:[^}]*\}/
    );
    expect(mobile).toBeTruthy();
    expect(mobile?.[0]).toContain('var(--mobile-bottom-chrome-est');
    expect(mobile?.[0]).not.toMatch(
      /--huddle-bottom-clearance:\s*calc\(\s*var\(--desk-taskbar-h\)/
    );
  });

  it('keeps huddle remark bubbles compact so the diagram keeps the middle', () => {
    const bubble = ruleBody('.office-huddle-bubble');
    expect(bubble).toBeTruthy();
    expect(bubble).toMatch(/width:\s*min\(156px/);
    expect(bubble).toMatch(/max-width:\s*11\.5rem/);
    expect(css).toMatch(
      /\.office-huddle-seat\.is-side-top\s+\.office-huddle-bubble\s*\{[^}]*left:\s*50%/
    );
  });
});
