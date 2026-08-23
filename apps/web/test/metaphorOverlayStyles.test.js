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

  it('gives a guided read the only panel on screen, outranking the pick', () => {
    // The read narrates one beat AND flies the camera to it, so a second card
    // would hide the arrival. Same general-sibling mechanism as the pick, one
    // rung up — which is why MetaphorRenderer declares the tour panel first.
    expect(css).toMatch(/\.metaphor-tour\s*~\s*\.metaphor-inspector/);
    expect(css).toMatch(/\.metaphor-tour\s*~\s*\.metaphor-legend-overlay/);
    expect(css).toMatch(/\.metaphor-tour\s*~\s*\.metaphor-layers-overlay/);
    expect(css).toMatch(/\.metaphor-tour\s*~\s*\.metaphor-hover-tooltip/);
    // The reading strip and the title card too: naming the scene is beat 1's
    // job, so leaving them up prints the same sentence twice on a small canvas.
    expect(css).toMatch(/\.metaphor-tour\s*~\s*\.metaphor-context-overlay/);
    expect(css).toMatch(
      /\.metaphor-tour\s*~\s*\.metaphor-title-overlay[\s\S]{0,200}?display:\s*none/
    );
  });

  it('turns the read into a bottom sheet on phones, after the base rule', () => {
    const base = css.indexOf('.metaphor-tour {');
    const phone = css.search(
      /@media\s*\(max-width:\s*720px\)[\s\S]*?\.metaphor-tour\s*\{[\s\S]{0,320}?env\(safe-area-inset-bottom/
    );
    expect(base).toBeGreaterThan(-1);
    expect(phone).toBeGreaterThan(base);
    // Capped below the pick's sheet: the camera has just flown somewhere and a
    // taller sheet hides the arrival the beat is describing.
    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*?\.metaphor-tour\s*\{[\s\S]{0,320}?max-height:\s*min\(34vh/
    );
    // A short landscape screen (foldable cover, landscape phone) gets a side
    // card, not a sheet — and on a wider net than the 500px cover query its
    // siblings use, because a 717x512 cover screen misses that one by 12px.
    expect(css).toMatch(
      /@media\s*\(max-height:\s*620px\)\s+and\s+\(orientation:\s*landscape\)[\s\S]{0,260}?\.metaphor-tour\s*\{/
    );
  });

  it('keeps Back/Next above the fold in a height-capped read', () => {
    // The panel scrolls on every small screen, so the nav must stick to its
    // own bottom edge or the one control the feature depends on is below it.
    expect(css).toMatch(/\.metaphor-tour-nav\s*\{[\s\S]{0,160}?position:\s*sticky/);
  });

  it('keeps the read and its controls thumb-sized on touch', () => {
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)[\s\S]*\.metaphor-tour-nav-btn,\s*\.metaphor-tour-start\s*\{[\s\S]{0,120}?min-height:\s*2\.5rem/
    );
  });

  it('keeps fullscreen chrome off the hinge on dual-screen foldables', () => {
    expect(css).toMatch(
      /horizontal-viewport-segments:\s*2[\s\S]*\.metaphor-kind-switcher[\s\S]*viewport-segment-width 1 0/
    );
    // The read is held to the left segment for the same reason the pick is —
    // a full-width sheet runs the hinge through the sentence being read.
    expect(css).toMatch(
      /horizontal-viewport-segments:\s*2[\s\S]*\.metaphor-tour\s*\{[\s\S]{0,260}?viewport-segment-width 0 0/
    );
  });
});

describe('the compact strip caps its axis chips', () => {
  it('hides the overflow chips and shows their count on a phone', () => {
    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*\.metaphor-context-axis--extra\s*\{[\s\S]{0,80}?display:\s*none/
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*\.metaphor-context-axis-more\s*\{[\s\S]{0,80}?display:\s*flex/
    );
  });

  it('does the same on a short landscape screen, which has the least to spare', () => {
    const shortBlock = css.indexOf('@media (max-height: 620px) and (orientation: landscape)');
    expect(shortBlock).toBeGreaterThan(-1);
    const block = css.slice(shortBlock, shortBlock + 2000);
    expect(block).toMatch(/\.metaphor-context-axis--extra\s*\{[\s\S]{0,80}?display:\s*none/);
    expect(block).toMatch(/\.metaphor-context-axis-more\s*\{[\s\S]{0,80}?display:\s*flex/);
  });

  it('shows every chip and no counter on a roomy canvas', () => {
    // The base rule, before any media block: the counter has nothing to count
    // when nothing is hidden, and a "+0" chip would be pure noise.
    const base = css.slice(0, css.indexOf('@media (max-width: 720px)'));
    expect(base).toMatch(/\.metaphor-context-axis-more\s*\{[\s\S]{0,80}?display:\s*none/);
    expect(base).not.toMatch(/\.metaphor-context-axis--extra\s*\{/);
  });

  it("spends the strip's squeeze on the chips, never on the scene's name", () => {
    // The strip is a row of two, and the axes are `flex: 0 1 auto`, so with only
    // `min-width: 0` on the heading the name lost every fight: on a 1440x900
    // desktop the fused commerce world rendered "Commerce plat…" and "Domains,
    // service la…" with 700px of empty strip beside them. An axis chip already
    // has somewhere to go — it wraps, and below the small-canvas limit it folds
    // into the `+N` counter above, which names the rest in its tooltip — while a
    // truncated title is the one line in the overlay that is nowhere else on
    // screen.
    const base = css.slice(0, css.indexOf('@media (max-width: 720px)'));
    const at = base.indexOf('.metaphor-context-heading');
    expect(at).toBeGreaterThan(-1);
    const rule = base.slice(at, base.indexOf('}', at));
    expect(rule).toMatch(/min-width:\s*min\(100%,\s*\d+(\.\d+)?rem\)/);
    expect(rule).toMatch(/flex:\s*1\s+1\s+auto/);
  });
});

describe('metaphor overlay chrome and the camera fit', () => {
  it('keeps the layer key readable on a phone instead of slicing its last row', () => {
    // Composite's layer key is the fused world's only explanation of what each
    // grammar is doing. At 11.5rem every label wrapped to two or three lines and
    // the scroll box cut the last row in half.
    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*\.metaphor-layers-overlay\s*\{[\s\S]*?max-width:\s*min\(calc\(100% - 20px\),\s*17rem\)/
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*\.metaphor-layers-label\s*\{[\s\S]*?text-overflow:\s*ellipsis/
    );
  });

  it('lets the layer key track shrink so the count is never clipped', () => {
    // An implicit `auto` grid track refuses to go below the row's min-content,
    // so an ellipsized label still measured its full text and pushed the kind
    // chip past the panel's right edge.
    expect(css).toMatch(
      /\.metaphor-layers-list\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/
    );
  });

  it('lets a layer row be pressed without letting the panel swallow an orbit', () => {
    // `.metaphor-overlay` is `pointer-events: none` so the scene can be dragged
    // through every panel. The rows opt back in — and only the rows, so the
    // key's own padding stays a hole you can turn the world through.
    expect(css).toMatch(
      /\.metaphor-layers-row\.is-pressable\s*\{[\s\S]{0,400}?pointer-events:\s*auto/
    );
    expect(css).not.toMatch(/\.metaphor-layers-overlay\s*\{[\s\S]{0,200}?pointer-events:\s*auto/);
    // A row is a real control on touch, and the schema allows four layers — see
    // the rule's own note on why it is 2.25rem and not the read's 2.5rem.
    expect(css).toMatch(
      /@media\s*\(pointer:\s*coarse\)[\s\S]*\.metaphor-layers-row\.is-pressable\s*\{[\s\S]{0,120}?min-height:\s*2\.25rem/
    );
  });

  it('stands every bottom-anchored panel off the app’s composer band and taskbar', () => {
    // The 3D canvas is full-bleed: the app's bottom band covers 139px of a
    // 390x844 phone, 141px of a 717x512 foldable cover and 101px of a 1440x900
    // desktop. Anything anchored to the canvas's bottom edge is drawn
    // underneath it — including the guided read's Back/Next, the one control
    // that feature depends on. `--metaphor-app-bottom-inset` is measured off
    // the marked bands; see overlaySafeArea.js.
    for (const panel of [
      '.metaphor-legend-overlay',
      '.metaphor-layers-overlay',
      '.metaphor-inspector',
      '.metaphor-tour'
    ]) {
      expect(css, `${panel} base rule ignores the app chrome inset`).toMatch(
        new RegExp(
          `\\${panel}\\s*\\{[\\s\\S]{0,200}?bottom:\\s*calc\\(\\s*var\\(--metaphor-app-bottom-inset`
        )
      );
    }
  });

  it('re-states the bottom inset in the phone block, which overrides bottom', () => {
    // Same specificity, later in the file: a phone override that sets `bottom`
    // without the variable silently puts the panel back under the band on
    // exactly the screens where the band is tallest.
    const phone = css.search(/@media\s*\(max-width:\s*720px\)/);
    expect(phone).toBeGreaterThan(-1);
    const block = css.slice(phone);
    for (const panel of ['.metaphor-inspector', '.metaphor-tour', '.metaphor-legend-overlay']) {
      const rule = new RegExp(
        `\\${panel}\\s*\\{[\\s\\S]{0,120}?bottom:\\s*calc\\(\\s*var\\(--metaphor-app-bottom-inset[\\s\\S]{0,80}?env\\(safe-area-inset-bottom`
      );
      expect(block, `${panel} phone override drops the app chrome inset`).toMatch(rule);
    }
  });

  it('compacts the reading strip on a short landscape screen, not only at 500px', () => {
    // A 717x512 foldable cover misses the (max-height: 500px) cover query by
    // twelve pixels and inherits the phone block's stacked full-width band,
    // which costs it a quarter of its height before the scene gets any.
    const shortLandscape = css.search(
      /@media\s*\(max-height:\s*620px\)\s+and\s+\(orientation:\s*landscape\)/
    );
    expect(shortLandscape).toBeGreaterThan(-1);
    const block = css.slice(shortLandscape, shortLandscape + 1200);
    expect(block).toMatch(/\.metaphor-context-overlay\s*\{[\s\S]*?flex-direction:\s*row/);
  });
});
