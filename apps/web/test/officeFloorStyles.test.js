import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OFFICE_DAY_PHASES } from '../src/utils/officeCadence.js';

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

  it('keeps the held item out of the hit box the same way the chip is', () => {
    /*
     * Slice 13. The item hangs off the shoulder, past the 34 px figure — the
     * exact shape of § 6 rule 22, which cost a browser and 441 sampled points
     * to find the first time. Absolute keeps it out of the flex flow that sizes
     * the button; `pointer-events: none` keeps it from handing the oversized
     * box back through the child.
     */
    const hold = ruleBody('.office-floor-person-hold');
    expect(hold).toMatch(/position:\s*absolute/);
    expect(hold).toMatch(/pointer-events:\s*none/);
    // And the layer needs something to be absolute against, or it lands on the
    // stage instead of on the shoulder.
    expect(ruleBody('.office-floor-person-figure')).toMatch(/position:\s*relative/);
  });
});

describe('who is talking is marked quietly (slice 13)', () => {
  it('lights the speaker in the character’s own accent, not one blue for all', () => {
    const body = ruleBody(
      '.office-floor-person.is-speaking .office-floor-person-figure,\n.office-floor-walker.is-speaking .office-floor-person-figure'
    );
    expect(body, 'the two-selector speaking rule is gone').toBeTruthy();
    expect(body).toMatch(/var\(--floor-accent/);
    // The 20 px `rgba(37, 99, 235, …)` bloom was the same hue for everybody, so
    // the one thing the indicator is for — who — was what it said least.
    expect(body).not.toMatch(/37,\s*99,\s*235/);
  });

  it('animates the ring rather than the figure, which is already animating', () => {
    /*
     * The figure runs an idle or a pose, both on `transform`. A second
     * animation on the same element replaces it outright rather than composing
     * — so a speaking colleague would silently stop typing.
     */
    const ring = ruleBody(
      '.office-floor-person.is-speaking .office-floor-person-figure::before,\n.office-floor-walker.is-speaking .office-floor-person-figure::before'
    );
    expect(ring, 'the speaking ring is gone').toBeTruthy();
    expect(ring).toMatch(/animation:\s*office-floor-speaking/);
  });

  it('keeps the ring visible when it may not move', () => {
    // Reduced motion asks for less movement, not less information — and with
    // the bob switched off the ring is the only thing marking the speaker.
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/is-speaking .office-floor-person-figure::before/);
    expect(reduced).toMatch(/opacity:\s*0\.5/);
  });
});

describe('walking is a gait, not a hover', () => {
  /*
   * The cast flew until the figures grew legs: the bob animated the whole
   * person, feet included, and nothing ever stepped. These pin the shape of
   * the fix — rhythm on the upper wrapper only, antiphase stride on the two
   * legs, and the tempo read off `--walk-cycle` (measured per leg by
   * `useWalkAnimation`, which its own suite pins).
   */
  it('keeps the idle bob on the upper wrapper so the legs stay planted', () => {
    expect(ruleBody('.office-floor-person-figure')).not.toMatch(/animation:\s*office-floor-idle/);
    const upper = ruleBody('.office-floor-person-upper');
    expect(upper).toMatch(/animation:\s*office-floor-idle/);
  });

  it('rides the walk bounce on the same wrapper', () => {
    const upper = ruleBody('.office-floor-person-figure.is-walking .office-floor-person-upper');
    expect(upper, 'the walk-time bob rule is gone').toBeTruthy();
    expect(upper).toMatch(/animation:\s*office-floor-walk-bob/);
    expect(upper).toMatch(/var\(--walk-cycle/);
  });

  it('steps the two legs in antiphase at the measured tempo', () => {
    const left = ruleBody('.office-floor-person-figure.is-walking .office-floor-leg--left');
    const right = ruleBody('.office-floor-person-figure.is-walking .office-floor-leg--right');
    expect(left, 'the left-leg stride rule is gone').toBeTruthy();
    expect(right, 'the right-leg stride rule is gone').toBeTruthy();
    expect(left).toMatch(/animation:\s*office-floor-stride\s+var\(--walk-cycle/);
    expect(right).toMatch(/animation:\s*office-floor-stride\s+var\(--walk-cycle/);
    // Half a cycle behind the left leg — never mid-swing in the same direction.
    expect(right).toMatch(/animation-delay:\s*calc\(var\(--walk-cycle[^)]*\)\s*\/\s*-2\)/);
    const hip = ruleBody('.office-floor-leg');
    expect(hip).toMatch(/transform-box:\s*fill-box/);
  });

  it('grew the huddle hit box with the figure', () => {
    // § 6 rule 23: as big as it is drawn — the figure is 58 px tall now.
    const hit = ruleBody('.office-floor-huddle-hit');
    expect(hit).toMatch(/height:\s*58px/);
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

  it('lets a card’s action row wrap, now that a card can carry two', () => {
    /*
     * ADR-0012 put a Do-it beside Leave on the talk card. Measured at a 320px
     * viewport the pair needs ~229px of the ~258px the card has — it fits, with
     * nothing spare, and the labels are localized. jsdom has no layout engine,
     * so the guarantee is asserted as stylesheet text rather than geometry.
     */
    expect(ruleBody('.office-floor-card-actions')).toMatch(/flex-wrap:\s*wrap/);
  });

  it('keeps the adopt pill outlined so it does not compete with the primary', () => {
    // Send is `--primary` (filled) and is the verb you crossed the room to use;
    // two filled pills in one card would make the offer read as the next step.
    const adopt = ruleBody('.office-floor-card-action--adopt');
    expect(adopt).toMatch(/border-color:\s*var\(--accent\)/);
    expect(adopt).not.toMatch(/background:/);
  });

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

describe('the office day has a light for every phase (slice 20)', () => {
  it('tints a window for each phase the cadence can return', () => {
    // The failure this prevents is silent: an unstyled phase inherits whatever
    // the previous one set, so the room simply stops changing at that hour and
    // nothing anywhere reports it. Keyed off the cadence's own list, so adding
    // a sixth phase there fails here until it has a light.
    for (const phase of OFFICE_DAY_PHASES) {
      expect(css, `${phase} has no window tint`).toContain(`[data-day-phase='${phase}']`);
    }
  });

  it('keeps a default tint on the floor itself, for an unphased mount', () => {
    // `FloorArrival` renders its own stage without the phase attribute, and the
    // pane has to stay painted there.
    expect(ruleBody('.office-floor')).toMatch(/--office-window-tint:\s*#/);
  });

  it('never animates the light, so it owes the reduced-motion block nothing', () => {
    // A phase turns over four times a day, so a tween is something practically
    // nobody is ever looking at — and every animated selector on this floor has
    // to name itself in the reduced-motion block (see above). A hard cut buys
    // the same picture and stays out of that contract.
    const dayRules = css.match(/\[data-day-phase='[^']+'\]\s*\{[^}]*\}/g) ?? [];
    expect(dayRules.length).toBe(OFFICE_DAY_PHASES.length);
    for (const rule of dayRules) {
      expect(rule).not.toMatch(/animation:|transition:/);
    }
  });
});
