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
    // `0 0 auto` was right for a lone fixed-width button, then `0 1 auto` once
    // the strip joined it. This cluster now holds the whole office half of the
    // bar — Stand up, the comms icons, and what the room is doing — so it grows,
    // and the status end is what yields instead.
    expect(body).toMatch(/\bflex:\s*1\s+1\s+auto\b/);
    expect(ruleBody('.desk-os-taskbar-end')).toMatch(/\bflex:\s*0\s+1\s+auto\b/);
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
    // The strip grows as well now — it carries the office summary. What rule 3
    // turns on is the *shrink* factor, and Stand up's is still 0.
    expect(ruleBody('.desk-os-presence')).toMatch(/\bflex:\s*1\s+1\s+auto\b/);
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

  it('keeps the presence caption on a phone once the status half has retired', () => {
    // Phones shed Concentration + HR; the caption has the room the old demotion
    // ladder reserved for run status. Faces alone are the 360px fallback via
    // max-width squeeze, not display:none.
    const bodies = [...css.matchAll(/\.desk-os-presence-caption\s*\{([^}]*)\}/g)].map(
      ([, body]) => body
    );
    expect(bodies.length).toBeGreaterThanOrEqual(1);
    expect(bodies.every((body) => !/display:\s*none/.test(body))).toBe(true);
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

  it('hides the Floor role pill and prestige badge on phone taskbars', () => {
    expect(css).toMatch(
      /\.desk-os-taskbar-lead\s+\.overlay-button\.slop-action-button\.is-desk-standup\s+\.slop-action-role\s*\{[^}]*display:\s*none/
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*\.desk-os-taskbar-xp\s+\.brand-prestige-badge\s*\{[^}]*display:\s*none/
    );
  });

  it('retires HR on foldables before brain mode in the taskbar tray', () => {
    expect(css).toMatch(
      /\.app-shell\.is-wide-mobile\s+\.desk-os-taskbar-xp,\s*\.app-shell\.is-foldable-dual\s+\.desk-os-taskbar-xp\s*\{[^}]*display:\s*none/
    );
    // Foldables keep Concentration — enough width once HR yields.
    expect(css).toMatch(
      /\.app-shell\.is-wide-mobile\s+\.concentration-control--tray,\s*\.app-shell\.is-foldable-dual\s+\.concentration-control--tray\s*\{[^}]*display:\s*flex/
    );
  });

  it('overlaps taskbar comms badges on the glyph without clipping below the strip', () => {
    const badge = css.match(
      /\.desk-actions--taskbar\s+\.desk-comms-cluster\s+\.desk-actions-unread-badge\s*\{([^}]*)\}/
    )?.[1];
    expect(badge).toBeTruthy();
    expect(badge).toMatch(/top:\s*-0\.3/);
    expect(badge).toMatch(/right:\s*-0\.3/);
    expect(badge).not.toMatch(/bottom:\s*0/);
    expect(badge).not.toMatch(/translate\([^)]*30%/);
    // Parent bar must not clip the overlap — measured failure was overflow:hidden.
    expect(ruleBody('.desk-os-taskbar')).toMatch(/overflow:\s*visible/);
  });

  it('keeps Stand up labelled on desktop and foldables, glyph-only on phones', () => {
    expect(css).toMatch(
      /\.desk-os-taskbar-lead\s+\.overlay-button\.slop-action-button\.is-desk-standup\s+\.button-label\s*\{[^}]*display:\s*inline/
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*639px\)[\s\S]*\.desk-os-taskbar-lead\s+\.overlay-button\.slop-action-button\.is-desk-standup\s+\.button-label\s*\{[^}]*display:\s*none/
    );
  });

  it('lets walk-by paint above the focus stack via overlay layer, not office chrome', () => {
    const body = ruleBody('.office-walkby-overlay');
    expect(body).toBeTruthy();
    expect(body).not.toMatch(/z-index:\s*var\(--z-office-chrome\)/);
  });

  it('keeps fullscreen mailroom beside the exit control on the top right', () => {
    const toolbar = ruleBody('.diagram-fullscreen-toolbar');
    expect(toolbar).toBeTruthy();
    expect(toolbar).toMatch(/\bright:\s*var\(--diagram-fullscreen-corner-inset/);
    expect(toolbar).toMatch(/\bdisplay:\s*flex\b/);
    expect(ruleBody('.diagram-fullscreen-mailroom-btn')).toMatch(/\bposition:\s*static\b/);
    expect(ruleBody('.diagram-fullscreen-close')).toMatch(/\bposition:\s*static\b/);
    expect(css).toContain('--diagram-fullscreen-top-chrome-h');
    expect(css).toMatch(
      /\.diagram-output:fullscreen\s+\.metaphor-title-overlay[\s\S]*top:\s*var\(--diagram-fullscreen-top-chrome-h\)/
    );
    // Kind switcher must stay bottom-right content-sized — a `top` + `bottom`
    // pair stretches the absolute panel full height.
    expect(css).toMatch(
      /\.diagram-output:fullscreen\s+\.metaphor-kind-switcher[\s\S]*?\btop:\s*auto\b[\s\S]*?\bbottom:\s*var\(--diagram-fullscreen-corner-inset\)/
    );
  });

  it('sizes the fullscreen mailroom panel against the viewport, not the button anchor', () => {
    // The panel is `position: absolute` inside `.diagram-fullscreen-mailroom-anchor`,
    // which is only as tall as the 2.25rem trigger. `max-height: calc(100% - …)`
    // resolves against that tiny box and collapses to a thin clipped strip.
    const body = ruleBody('.diagram-fullscreen-mailroom-panel');
    expect(body).toBeTruthy();
    expect(body).not.toMatch(/max-height:[^;]*\b100%/);
    expect(body).toMatch(/max-height:[^;]*\b(?:\d+(?:\.\d+)?vh|100vh|100dvh)\b/);
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

/**
 * Window placement (docs/office-window-manager.md §5A). Every fact here is a
 * consequence that only exists in a real browser — a sheet's height, a cascade
 * order, whether a finger can scroll — so they are pinned against the
 * stylesheet's text like the rest of this file.
 */
describe('office window placement', () => {
  it('never disables touch-action on the window root', () => {
    // The drag handlers live on the handle, which declares its own
    // `touch-action`. On the root it did nothing for the drag and disabled
    // panning for every descendant, because a nested scroll container cannot
    // re-enable a pan an ancestor set to `none` — so the messenger log and the
    // inbox list did not scroll by finger.
    const body = ruleBody('.floating-window');
    expect(body).toBeTruthy();
    expect(body).not.toMatch(/touch-action:\s*none/);
    expect(ruleBody('.floating-window-drag-handle')).toMatch(/touch-action:\s*none/);
  });

  it('gives a phone sheet no free position at all', () => {
    // The clipping this replaced came from `left`/`top` arithmetic that was
    // allowed to leave 56px of window on screen. A sheet pins all four edges,
    // so there is no arithmetic left to get wrong.
    const body = ruleBody('.floating-window.floating-window--sheet');
    expect(body).toBeTruthy();
    expect(body).toMatch(/position:\s*fixed/);
    expect(body).toMatch(/left:\s*0;/);
    expect(body).toMatch(/right:\s*0;/);
    expect(body).toMatch(/top:\s*auto;/);
    expect(body).toMatch(/bottom:\s*var\(--sheet-bottom\)/);
    // max-height must be released, or each window's own desktop cap fights the snap.
    expect(body).toMatch(/max-height:\s*none/);
  });

  it('reserves the taskbar under a sheet, because the taskbar is the way back', () => {
    // One measured token, not the three disagreeing bottom-chrome estimates the
    // old messenger height stacked. Minimize sends a window to the taskbar, so a
    // sheet that covered it would strand whatever it covered.
    const body = ruleBody('.floating-window.floating-window--sheet');
    expect(body).toMatch(/--sheet-bottom:\s*calc\(\s*var\(--desk-taskbar-h/);
    for (const snap of ['peek', 'half', 'full']) {
      const rule = ruleBody(`.floating-window.floating-window--sheet[data-snap='${snap}']`);
      expect(rule, `snap ${snap}`).toBeTruthy();
      expect(rule, `snap ${snap}`).toMatch(/height:/);
    }
    // Half and full budget for the reserve; peek is the titlebar and nothing else.
    for (const snap of ['half', 'full']) {
      expect(
        ruleBody(`.floating-window.floating-window--sheet[data-snap='${snap}']`),
        `snap ${snap}`
      ).toContain('var(--sheet-bottom)');
    }
  });

  it('places the sheet rules after every per-window size rule', () => {
    // Same-specificity cascade trap the presence strip hit: `.office-messenger`
    // and friends set width/height at (0,1,0) in blocks further up, including
    // inside phone media queries. The placement block is last on purpose — if it
    // moves up, a window silently wins back its desktop footprint on a phone.
    const sheetIdx = css.indexOf('.floating-window.floating-window--sheet {');
    expect(sheetIdx).toBeGreaterThan(-1);
    for (const selector of [
      '.office-messenger {',
      '.office-inbox-popover {',
      '.office-meeting-room {',
      '.office-training-window {'
    ]) {
      expect(css.lastIndexOf(selector), selector).toBeLessThan(sheetIdx);
    }
  });

  it('leaves no collapsed-in-place minimize styling behind', () => {
    // Minimize renders nothing now; a window that still had `height: auto`
    // rules would be a second, silent way to be half-open.
    expect(css).not.toMatch(/\.office-messenger\.is-minimized/);
    expect(css).not.toMatch(/\.office-inbox-popover\.is-minimized/);
    expect(css).not.toMatch(/\.office-training-window\.is-minimized/);
    expect(css).not.toMatch(/\.office-meeting-room\.is-minimized\s*\{/);
  });

  it('keeps Headphones and Focus on one row in the Admin footer', () => {
    // A one-column override stacked them; the pack is only two short toggles.
    expect(css).not.toMatch(
      /\.desk-os-admin-footer\s+\.desk-ambience-pack\s*\{[^}]*grid-template-columns:\s*1fr;/
    );
    const body = ruleBody('.desk-ambience-pack');
    expect(body).toMatch(/grid-template-columns:\s*repeat\(2,/);
  });
});

/**
 * The bottom-nav rearrangement (docs/office-window-manager.md §11). Every fact
 * here was found by measuring a real browser, not by reading the diff — jsdom
 * has no layout engine, so each one shipped broken through a green test suite
 * first.
 */
describe('bottom nav placement', () => {
  it('lets the comms cluster escape the corner-dock positioning', () => {
    // `.desk-actions` is `position: fixed; top: 124px; right: 14px` — it began
    // life as a floating corner dock. Measured failures, in order:
    //   no reset          -> cluster painted top-right, anchor 0x0 in the bar
    //   (0,1,0) reset     -> `.desk-actions:not(.desk-actions--bottom)` (0,2,0)
    //                        still won `top`, so relative + top:7.4rem put the
    //                        cluster at y=930 inside an 844px viewport
    // Hence the doubled class: it ties the corner rules and wins on order.
    const body = ruleBody('.desk-actions.desk-actions--taskbar');
    expect(body).toBeTruthy();
    expect(body).toMatch(/position:\s*relative/);
    expect(body).toMatch(/top:\s*auto/);
    expect(body).toMatch(/right:\s*auto/);
  });

  it('runs each composer lane as a row, not a column', () => {
    // `.desk-work-order-group` is `flex-direction: column` further up — right
    // when the prompt was its only child, and the reason the notebook first
    // rendered *under* the input instead of beside it.
    const body = ruleBody('.desk-work-order-group,\n.desk-talk-group');
    expect(body).toBeTruthy();
    expect(body).toMatch(/flex-direction:\s*row/);
  });

  it('declares lane order per lane, so the flat-tool-row rules cannot reverse it', () => {
    // `.prompt-actions--mobile .desk-chrome-tool { order: 1 }` was written when
    // these tools were siblings of the lanes. Nested inside one it put the
    // roster to the RIGHT of the talk input it is supposed to address.
    const team = ruleBody('.desk-talk-group > .desk-tour-piece--team');
    expect(team).toMatch(/order:\s*0/);
    const notebook = ruleBody('.desk-work-order-group > .desk-tour-piece--notebook');
    expect(notebook).toMatch(/order:\s*2/);
    // Every child needs an explicit order or the unset ones tie at 0.
    expect(ruleBody('.desk-work-order-group > *,\n.desk-talk-group > *')).toMatch(/order:\s*1/);
  });

  it('sizes a sheet border-box so it does not hang over both edges', () => {
    // Window kinds carry a 1px border and are not border-box, so a bare
    // `width: 100%` measured 392px inside a 390px viewport.
    expect(ruleBody('.floating-window.floating-window--sheet')).toMatch(/box-sizing:\s*border-box/);
  });
});
