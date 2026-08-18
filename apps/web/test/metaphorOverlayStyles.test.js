import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Metaphor overlay geometry is load-bearing on phones and foldables, and jsdom
 * has no layout engine — pin the stylesheet the same way deskOsFrameStyles
 * pins fullscreen chrome.
 */
const css = readFileSync(fileURLToPath(new URL('../src/App.css', import.meta.url)), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ''
);

describe('metaphor overlay geometry', () => {
  it('uses a compact native select, not a wrapping pill row', () => {
    expect(css).toMatch(/\.metaphor-kind-switcher-select[\s\S]{0,800}appearance:\s*none/);
    expect(css).toMatch(
      /\.metaphor-kind-switcher\s*\{[\s\S]*?max-width:\s*min\(46vw,\s*12\.5rem\)/
    );
    expect(css).not.toMatch(
      /\.metaphor-kind-switcher-select[\s\S]{0,400}appearance:\s*base-select/
    );
    expect(css).not.toContain('.metaphor-kind-switcher-segment');
    expect(css).not.toContain('.metaphor-kind-switcher-option');
  });

  it('parks the layers key above the compact select in fullscreen', () => {
    expect(css).toMatch(
      /\.diagram-output:fullscreen\s+\.metaphor-layers-overlay[\s\S]*?\bbottom:\s*calc\(\s*var\(--diagram-fullscreen-corner-inset\)\s*\+\s*var\(--metaphor-kind-switcher-stack\)/
    );
    expect(css).toMatch(/--metaphor-kind-switcher-stack:\s*5\.5rem/);
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)[\s\S]*--metaphor-kind-switcher-stack:\s*6\.25rem/
    );
  });

  it('keeps overlay fade from clobbering centering transforms', () => {
    expect(css).not.toMatch(/@keyframes\s+metaphor-overlay-fade[\s\S]{0,280}\btransform\s*:/);
  });

  it('sizes overlay boxes so phone padding cannot overflow the max-width', () => {
    expect(css).toMatch(/\.metaphor-overlay\s*\{[\s\S]*?box-sizing:\s*border-box/);
  });

  it('insets phone overlays for the live viewport and safe area', () => {
    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*\.metaphor-context-overlay[\s\S]*env\(safe-area-inset-top/
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*\.metaphor-legend-overlay[\s\S]*max-height:\s*min\(28vh/
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*1024px\)\s+and\s+\(max-height:\s*500px\)\s+and\s+\(orientation:\s*landscape\)/
    );
  });

  it('places phone overlay overrides after the desktop overlay rules so they win', () => {
    const kindBase = css.indexOf('.metaphor-kind-switcher {');
    const phoneBlock = css.search(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]{0,1800}?\.metaphor-kind-switcher\s*\{[\s\S]{0,280}?env\(safe-area-inset-bottom/
    );
    expect(kindBase).toBeGreaterThan(-1);
    expect(phoneBlock).toBeGreaterThan(kindBase);
  });

  it('gives an open pick the only panel on screen', () => {
    // One panel budget: the ambient keys and the mouse tooltip yield to a pick
    // so a phone never stacks three cards over a small canvas. Done with a
    // general sibling combinator, which is why the inspector must be declared
    // before them — see MetaphorRenderer's overlay order.
    expect(css).toMatch(
      /\.metaphor-inspector\s*~\s*\.metaphor-legend-overlay[\s\S]{0,200}?display:\s*none/
    );
    expect(css).toMatch(/\.metaphor-inspector\s*~\s*\.metaphor-layers-overlay/);
    expect(css).toMatch(/\.metaphor-inspector\s*~\s*\.metaphor-hover-tooltip/);
  });

  it('drops the hover tooltip on touch, where it can only flash under the finger', () => {
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)[\s\S]*\.metaphor-hover-tooltip\s*\{[\s\S]{0,80}?display:\s*none/
    );
  });

  it('turns the pick into a full-width bottom sheet on phones, after the base rule', () => {
    const base = css.indexOf('.metaphor-inspector {');
    const phone = css.search(
      /@media\s*\(max-width:\s*720px\)[\s\S]*?\.metaphor-inspector\s*\{[\s\S]{0,320}?env\(safe-area-inset-bottom/
    );
    expect(base).toBeGreaterThan(-1);
    expect(phone).toBeGreaterThan(base);
    // A 38vh sheet would swallow a landscape cover screen — it caps there.
    expect(css).toMatch(
      /@media\s*\(max-width:\s*1024px\)\s+and\s+\(max-height:\s*500px\)[\s\S]*\.metaphor-inspector[\s\S]{0,200}?max-height:\s*min\(52vh/
    );
  });

  it('keeps fullscreen chrome off the hinge on dual-screen foldables', () => {
    expect(css).toMatch(
      /horizontal-viewport-segments:\s*2[\s\S]*\.metaphor-kind-switcher[\s\S]*viewport-segment-width 1 0/
    );
  });
});
