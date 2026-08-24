import { describe, expect, it } from 'vitest';
import { METAPHOR_LINK_KINDS } from '@archislop/shared';
import {
  LINK_CORE_PX,
  MIN_LINK_CONTRAST,
  MIN_LINK_CORE_OPACITY,
  arrowFromRoute,
  fusedLinkPresentation,
  linkCoreOpacity,
  linkCrowding,
  linkInk,
  linkMetricsFor
} from '../src/components/metaphorScenes/linkRoutes.js';
import {
  contrastRatio,
  resolveLinkAppearance
} from '../src/components/metaphorScenes/sceneUtils.js';
import { METAPHOR_THEME_PRESETS } from '../src/utils/metaphorThemePresets.js';

const THEME_NAMES = Object.keys(METAPHOR_THEME_PRESETS);

describe('link contrast', () => {
  it('sweeps every shipped theme, and the sweep is not empty', () => {
    // The companion assertion: a loop over a set nothing joins passes while
    // examining nothing, which is how two probes shipped green in this repo.
    expect(THEME_NAMES.length).toBeGreaterThanOrEqual(4);
    expect(METAPHOR_LINK_KINDS.length).toBeGreaterThanOrEqual(3);
  });

  it('every theme × link-kind clears the bar its own captions clear', () => {
    for (const name of THEME_NAMES) {
      const theme = METAPHOR_THEME_PRESETS[name];
      const casing = theme.labelOutline;
      expect(casing, `${name} must declare labelOutline`).toBeTruthy();
      for (const kind of [...METAPHOR_LINK_KINDS, undefined]) {
        const { lineColor } = resolveLinkAppearance(kind, theme);
        const ink = linkInk(lineColor, casing);
        expect(
          contrastRatio(ink, casing),
          `${name}/${kind ?? 'default'} link ink against its casing`
        ).toBeGreaterThanOrEqual(MIN_LINK_CONTRAST - 0.01);
      }
    }
  });

  it('leaves a colour that already clears the bar alone', () => {
    // Nudging a link that is already legible would drift the theme's identity
    // for nothing — `ensureReadableInk` stops at the first passing step, and a
    // passing colour takes no step at all.
    expect(linkInk('#64748b', '#ffffff')).toBe('#64748b');
  });

  it('walks a colour that does not clear it, and keeps the hue', () => {
    // Whiteboard's flow links are drawn in `binaryGlowColor` — a pale yellow at
    // 1.2:1 against a white casing, i.e. the invisible link this module exists
    // to retire. It must come back darker and still yellow.
    const walked = linkInk('#fef08a', '#ffffff');
    expect(walked).not.toBe('#fef08a');
    expect(contrastRatio(walked, '#ffffff')).toBeGreaterThanOrEqual(MIN_LINK_CONTRAST - 0.01);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(walked.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(b);
  });

  it('passes a missing colour through rather than inventing one', () => {
    expect(linkInk(undefined, '#ffffff')).toBeUndefined();
    expect(linkInk('#64748b', undefined)).toBe('#64748b');
  });
});

describe('link core opacity', () => {
  it('floors a theme that asks for a softer link', () => {
    expect(linkCoreOpacity(0.6)).toBe(MIN_LINK_CORE_OPACITY);
    expect(linkCoreOpacity(undefined)).toBe(1);
  });

  it('lets a theme ask for a more solid one', () => {
    expect(linkCoreOpacity(0.95)).toBeCloseTo(0.95, 5);
    expect(linkCoreOpacity(4)).toBe(1);
  });
});

describe('link crowding', () => {
  it('does not taper a scene a reader can follow', () => {
    expect(linkCrowding(0)).toBe(1);
    expect(linkCrowding(24)).toBe(1);
  });

  it('tapers past that and floors, never back to the hairline', () => {
    expect(linkCrowding(50)).toBeLessThan(1);
    expect(linkCrowding(80)).toBeLessThan(linkCrowding(50));
    // The whole point: even the most crowded scene the schema allows draws a
    // line wider than the 1 px one this replaced.
    expect(linkMetricsFor(80).corePx).toBeGreaterThan(1);
    expect(linkMetricsFor(500).corePx).toBe(linkMetricsFor(80).corePx);
  });

  it('keeps the casing wider than the core at every count', () => {
    for (const count of [0, 12, 24, 40, 80, 500]) {
      const m = linkMetricsFor(count);
      expect(m.casingPx, `casing at ${count}`).toBeGreaterThan(m.corePx);
      expect(m.arrowPx, `arrow at ${count}`).toBeGreaterThan(0);
    }
    expect(linkMetricsFor(0).corePx).toBe(LINK_CORE_PX);
  });
});

describe('fused link presentation', () => {
  it('draws a resting scene at full strength', () => {
    const p = fusedLinkPresentation({ related: false, muted: false, activeId: null });
    expect(p).toMatchObject({ cased: true, dimmed: false, emphasis: 1 });
    expect(p.opacity).toBeGreaterThanOrEqual(MIN_LINK_CORE_OPACITY);
  });

  it('gives the hovered item’s own links more line, not less', () => {
    const related = fusedLinkPresentation({ related: true, muted: false, activeId: 'a' });
    const other = fusedLinkPresentation({ related: false, muted: false, activeId: 'a' });
    expect(related.emphasis).toBeGreaterThan(1);
    expect(related.opacity).toBeGreaterThan(other.opacity);
    expect(related.cased).toBe(true);
  });

  it('takes the halo away from anything that is meant to recede', () => {
    // The whole point of the casing is to be loud; a receding link must not get
    // one, or pressing a layer away makes the layers you dismissed louder.
    expect(fusedLinkPresentation({ related: false, muted: true, activeId: null }).cased).toBe(
      false
    );
    expect(fusedLinkPresentation({ related: false, muted: false, activeId: 'a' }).cased).toBe(
      false
    );
    expect(fusedLinkPresentation({ related: true, muted: true, activeId: 'a' }).cased).toBe(false);
  });
});

describe('arrow placement', () => {
  it('points along the final leg of an elbow route, tip on the target', () => {
    // The shape `elbowRoute` produces: up, across, down onto the `to` anchor.
    const arrow = arrowFromRoute([
      [-8, 16, -10],
      [-8, 17.5, -10],
      [-4, 17.5, -10],
      [-4, 11, -10]
    ]);
    expect(arrow.position).toEqual([-4, 11, -10]);
    expect(arrow.direction).toEqual([0, -1, 0]);
  });

  it('skips a zero-length trailing segment rather than dividing by it', () => {
    const arrow = arrowFromRoute([
      [0, 0, 0],
      [3, 0, 0],
      [3, 0, 0]
    ]);
    expect(arrow.direction).toEqual([1, 0, 0]);
    expect(arrow.position).toEqual([3, 0, 0]);
  });

  it('states no direction rather than an arbitrary one', () => {
    expect(arrowFromRoute([[1, 2, 3]])).toBeNull();
    expect(arrowFromRoute(null)).toBeNull();
    expect(
      arrowFromRoute([
        [1, 2, 3],
        [1, 2, 3]
      ])
    ).toBeNull();
  });

  it('returns a unit direction', () => {
    const { direction } = arrowFromRoute([
      [0, 0, 0],
      [3, 4, 0]
    ]);
    expect(Math.hypot(...direction)).toBeCloseTo(1, 10);
  });
});
