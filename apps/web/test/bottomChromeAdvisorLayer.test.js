import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Regression guard for the advisor speech bubble vanishing on mobile.
//
// `.bottom-chrome` is `position: fixed` (via `.corner-control`). The advisor
// speech bubble is an absolutely-positioned descendant that floats ABOVE the
// chrome box (`bottom: calc(100% + …)`), i.e. entirely outside it. If
// `.bottom-chrome` is promoted to its own compositor layer with
// `transform: translateZ(0)`, mobile WebKit clips that fully-outside descendant
// to the layer bounds and the bubble disappears (it flashes in during the
// thinking→bubble handoff, then vanishes).
//
// The layer is only needed while a stream is live (that is the only time the
// `.app-shell[data-streaming]::after` variant overlays paint over the chrome and
// cause the foldable flicker from PR #93), and the advisor loop is paused during
// streaming — so the two never coexist. The promotion MUST therefore be gated on
// `[data-streaming='true']` and MUST NOT be applied to `.bottom-chrome`
// unconditionally.
const cssPath = fileURLToPath(new URL('../src/App.css', import.meta.url));
const css = readFileSync(cssPath, 'utf8');

/** Return the body of the first rule whose selector list exactly matches `selector`. */
function ruleBody(selector) {
  const idx = css.indexOf(selector);
  if (idx === -1) return null;
  const open = css.indexOf('{', idx);
  const close = css.indexOf('}', open);
  if (open === -1 || close === -1) return null;
  return css.slice(open + 1, close);
}

describe('bottom-chrome advisor-bubble layer gating', () => {
  it('promotes .bottom-chrome to a GPU layer ONLY while streaming', () => {
    const gated = ruleBody(".app-shell[data-streaming='true'] .bottom-chrome");
    expect(gated, 'expected a streaming-gated .bottom-chrome rule').toBeTruthy();
    expect(gated).toMatch(/transform:\s*translateZ\(0\)/);
  });

  it('never promotes .bottom-chrome unconditionally (would clip the bubble on mobile)', () => {
    // Any transform rule that mentions .bottom-chrome must also be scoped to the
    // streaming state. Scan every `transform: translateZ(0)` block for a bare
    // `.bottom-chrome` selector that is not behind `[data-streaming`.
    const ruleRe = /([^{}]+)\{([^{}]*transform:\s*translateZ\(0\)[^{}]*)\}/g;
    for (const match of css.matchAll(ruleRe)) {
      const selectorList = match[1];
      if (!/\.bottom-chrome\b/.test(selectorList)) continue;
      expect(
        selectorList.includes("[data-streaming='true']"),
        `.bottom-chrome is promoted to a compositor layer without a [data-streaming] gate — ` +
          `this clips the advisor speech bubble on mobile. Offending selector: ${selectorList.trim()}`
      ).toBe(true);
    }
  });

  it('caps advisor speech bubble height so Wise Architect controls stay inside the viewport', () => {
    const bubble = ruleBody('.advisor-speech-bubble');
    expect(bubble, 'expected base .advisor-speech-bubble rule').toBeTruthy();
    expect(bubble).toMatch(/max-height:/);
    expect(bubble).toMatch(/--advisor-float-max-h/);
    expect(bubble).toMatch(/overflow-y:\s*auto/);
    expect(css).toMatch(/\.advisor-speech-bubble\.is-explain[\s\S]*max-height:/);
    expect(css).toMatch(/\.advisor-thinking-indicator[\s\S]*--advisor-float-max-h/);
  });
});
