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

  it('reserves the safe-area inset once, on the bar that touches the edge', () => {
    // Double-counting it pushes the composer band a notch-height into the canvas
    // on every iPhone.
    expect(ruleBody('.desk-os-taskbar')).toContain('env(safe-area-inset-bottom');
  });
});
