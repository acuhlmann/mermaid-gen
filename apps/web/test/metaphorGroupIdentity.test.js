import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GROUP_TINT_BODY,
  GROUP_TINT_EARTH,
  GROUP_TINT_PLATE,
  PLATE_GROUND_SEPARATION,
  PLATE_LADDER_CEILING,
  groupLadderLength,
  resolveGroupPlateBase,
  tintByGroup
} from '../src/components/metaphorScenes/groupIdentity.js';
import { cityDistrictLayout } from '../src/utils/metaphorLayouts/cityDistrictLayout.js';
import { planFusedCompositeWorld } from '../src/components/metaphorScenes/fusedCompositePlanner.js';
import {
  COMPOSITE_LOD_TIERS,
  affinityGroupDetail,
  affinityGroupLayers
} from '../src/components/metaphorScenes/compositeLodDetail.js';
import { ATMOSPHERE_KINDS } from '../src/components/metaphorScenes/fusedCompositeSceneResolvers.js';
import { srgbLuma } from '../src/utils/metaphorDaylightSurfaces.js';
import { resolveMetaphorSceneTheme } from '../src/utils/metaphorSceneTheme.js';
import { METAPHOR_THEME_PRESETS } from '../src/utils/metaphorThemePresets.js';

function hsl(hex) {
  const out = { h: 0, s: 0, l: 0 };
  new THREE.Color(hex).getHSL(out, THREE.SRGBColorSpace);
  return out;
}

/** Shortest distance between two hues, in turns (0…0.5). */
function hueGap(a, b) {
  const raw = Math.abs(hsl(a).h - hsl(b).h) % 1;
  return Math.min(raw, 1 - raw);
}

describe('tintByGroup', () => {
  it('leaves the first group exactly on the theme colour', () => {
    // The contract an ungrouped scene depends on: one district, or none, and
    // nothing about the render changes.
    for (const strength of [GROUP_TINT_BODY, GROUP_TINT_EARTH, GROUP_TINT_PLATE]) {
      expect(tintByGroup('#8fb6f0', 0, strength)).toBe('#8fb6f0');
    }
  });

  it('separates every pair of groups the ladder can hold', () => {
    // The failure this module exists to fix is two groups that come out the
    // same colour, so the claim has to be over every PAIR, not over neighbours.
    const base = METAPHOR_THEME_PRESETS.whiteboard.buildingColor;
    const tints = Array.from({ length: groupLadderLength() }, (_, i) =>
      tintByGroup(base, i, GROUP_TINT_BODY)
    );
    for (let a = 0; a < tints.length; a += 1) {
      for (let b = a + 1; b < tints.length; b += 1) {
        expect(hueGap(tints[a], tints[b])).toBeGreaterThan(0.04);
      }
    }
  });

  it('separates groups on every theme, not just the one it was tuned on', () => {
    for (const [name, theme] of Object.entries(METAPHOR_THEME_PRESETS)) {
      const first = tintByGroup(theme.buildingColor, 0, GROUP_TINT_BODY);
      const second = tintByGroup(theme.buildingColor, 1, GROUP_TINT_BODY);
      expect(hueGap(first, second), `${name} districts 0 and 1`).toBeGreaterThan(0.04);
    }
  });

  it('never darkens a group below the theme colour', () => {
    // Darkening a saturated colour reads as MORE saturated, which is how the
    // first version of this ladder produced an indigo district that shouted
    // over the four it was meant to sit beside.
    const base = METAPHOR_THEME_PRESETS.whiteboard.buildingColor;
    const baseL = hsl(base).l;
    for (let i = 1; i < groupLadderLength(); i += 1) {
      expect(hsl(tintByGroup(base, i, GROUP_TINT_PLATE)).l).toBeGreaterThanOrEqual(baseL - 1e-6);
    }
  });

  it('mutes a tinted group rather than out-shouting the theme colour', () => {
    const base = METAPHOR_THEME_PRESETS.whiteboard.buildingColor;
    const baseS = hsl(base).s;
    for (let i = 1; i < groupLadderLength(); i += 1) {
      expect(hsl(tintByGroup(base, i, GROUP_TINT_BODY)).s).toBeLessThan(baseS);
    }
  });

  it('cycles past the end of the ladder instead of throwing', () => {
    const base = '#8fb6f0';
    expect(tintByGroup(base, groupLadderLength(), GROUP_TINT_BODY)).toBe(base);
    expect(tintByGroup(base, groupLadderLength() + 1, GROUP_TINT_BODY)).toBe(
      tintByGroup(base, 1, GROUP_TINT_BODY)
    );
  });

  it('is a no-op at zero strength and survives junk input', () => {
    expect(tintByGroup('#8fb6f0', 3, 0)).toBe('#8fb6f0');
    expect(tintByGroup('#8fb6f0', Number.NaN)).toBe('#8fb6f0');
    expect(tintByGroup(undefined, 2)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

/**
 * Where the ladder is STOOD, as opposed to how far apart its rungs are.
 *
 * The sweep above pins the ladder against `buildingColor` — a mid-tone on every
 * preset — which is why it stayed green through the whole of the defect below:
 * the plate's base is `districtPalette[0]`, and nothing swept that.
 */
describe('resolveGroupPlateBase', () => {
  /** Every kind whose theme a lock rewrites, plus the unlocked control. */
  const KINDS = ['city', 'tree', 'river', 'garden', 'archipelago', 'galaxy', 'orrery', 'subway'];

  function plateLadder(base) {
    return Array.from({ length: groupLadderLength() }, (_, i) =>
      tintByGroup(base, i, GROUP_TINT_PLATE)
    );
  }

  function rgbDistance(a, b) {
    const one = { r: 0, g: 0, b: 0 };
    const two = { r: 0, g: 0, b: 0 };
    new THREE.Color(a).getRGB(one, THREE.SRGBColorSpace);
    new THREE.Color(b).getRGB(two, THREE.SRGBColorSpace);
    return Math.hypot(one.r - two.r, one.g - two.g, one.b - two.b);
  }

  function everyCell() {
    const cells = [];
    for (const themeId of Object.keys(METAPHOR_THEME_PRESETS)) {
      for (const kind of KINDS) {
        cells.push({
          name: `${themeId} · ${kind}`,
          theme: resolveMetaphorSceneTheme({ themeId, kind, moodId: null })
        });
      }
    }
    return cells;
  }

  it('is the defect it was written for: the raw palette entry collapses on whiteboard', () => {
    // Kept as a test rather than as a comment because it is the only thing that
    // says WHY the plate may not read `districtPalette[0]` directly.
    // `LIGHT_LADDER` only ever lifts and whiteboard's entry 0 is luma 0.91, so
    // groups 2, 4 and 6 all clamp to pure white — pixel-identical territories.
    const raw = plateLadder(METAPHOR_THEME_PRESETS.whiteboard.districtPalette[0]);
    expect(raw[2]).toBe('#ffffff');
    expect(raw[4]).toBe('#ffffff');
    expect(raw[6]).toBe('#ffffff');
  });

  it('separates every pair of plate groups on every theme and every lock', () => {
    for (const cell of everyCell()) {
      const tints = plateLadder(resolveGroupPlateBase(cell.theme));
      for (let a = 0; a < tints.length; a += 1) {
        for (let b = a + 1; b < tints.length; b += 1) {
          expect(rgbDistance(tints[a], tints[b]), `${cell.name} groups ${a}/${b}`).toBeGreaterThan(
            0.04
          );
        }
      }
    }
  });

  it('stands the whole ladder clear of the ground it is drawn on', () => {
    // The half a lock used to break: `groundColor` is walked by the daylight
    // floor and the space ceiling, `districtPalette` is not, so a noir tree
    // composite drew its territories 0.012 of luma from the ground under them.
    for (const cell of everyCell()) {
      const ground = srgbLuma(cell.theme.groundColor);
      for (const [index, tint] of plateLadder(resolveGroupPlateBase(cell.theme)).entries()) {
        expect(
          Math.abs(srgbLuma(tint) - ground),
          `${cell.name} group ${index}`
          // The bar is `PLATE_GROUND_SEPARATION`; the slack is one hex step of
          // quantisation on the way out of the bisection.
        ).toBeGreaterThan(PLATE_GROUND_SEPARATION - 0.01);
      }
    }
  });

  it('never lets the ladder run out of headroom at the top', () => {
    for (const cell of everyCell()) {
      for (const tint of plateLadder(resolveGroupPlateBase(cell.theme))) {
        expect(srgbLuma(tint), cell.name).toBeLessThanOrEqual(PLATE_LADDER_CEILING);
      }
    }
  });

  it('keeps the theme hue — it places the palette entry, it does not replace it', () => {
    for (const cell of everyCell()) {
      const authored = cell.theme.districtPalette[0];
      expect(hueGap(resolveGroupPlateBase(cell.theme), authored), cell.name).toBeLessThan(0.02);
    }
  });

  it('leaves a theme whose plate already sits right within a hex step of itself', () => {
    // noir unlocked is the case that proves this is a placement and not a
    // repaint: its authored plate is already clear of its own near-black
    // ground, so the whole mechanism has to come back with what it was handed.
    const theme = resolveMetaphorSceneTheme({ themeId: 'noir', kind: 'city', moodId: null });
    expect(rgbDistance(resolveGroupPlateBase(theme), theme.districtPalette[0])).toBeLessThan(0.01);
  });

  it('survives a theme with no district palette at all', () => {
    const base = resolveGroupPlateBase({ groundColor: '#334155' });
    expect(base).toMatch(/^#[0-9a-f]{6}$/);
    // `resolveDistrictColor` falls back to the ground itself, which would draw
    // an invisible plate; the placement is what rescues it.
    expect(Math.abs(srgbLuma(base) - srgbLuma('#334155'))).toBeGreaterThan(
      PLATE_GROUND_SEPARATION - 0.01
    );
    expect(resolveGroupPlateBase({})).toBeUndefined();
  });
});

// The other production numbering of the same axis. `cityDistrictLayout` (below)
// and `makeGroups` in the fused planner are the two places that decide which
// ordinal a territory gets, and both feed the one `tintByGroup` ladder — so
// they live in one test file, and neither may drift into a hash.
describe('fused composite group colorIndex', () => {
  // Three territories that each hold two members, plus a fourth ("Legacy") that
  // holds only the island declaring it. Legacy is registered FIRST — the key
  // order within an item is chain ▸ district ▸ bed ▸ label — so it is the case
  // that separates "number the survivors" from "number them, then filter".
  const DSL = {
    metaphor: 'composite',
    layout: 'fused',
    seed: 'group-colour-ordinal',
    novelty: 0.4,
    motionIntensity: 0.6,
    scene: {},
    layers: [
      {
        id: 'domains',
        as: 'archipelago',
        items: [
          { id: 'checkout-domain', label: 'Checkout', mass: 12, relief: 0.8, chain: 'Legacy' },
          { id: 'catalog-domain', label: 'Catalog', mass: 9, relief: 0.5 },
          { id: 'fulfil-domain', label: 'Fulfilment', mass: 10, relief: 0.6 }
        ]
      },
      {
        id: 'services',
        as: 'city',
        items: [
          {
            id: 'payments-api',
            label: 'Payments API',
            height: 16,
            footprint: 3,
            district: 'Checkout'
          },
          { id: 'search-api', label: 'Search API', height: 10, footprint: 2, district: 'Catalog' },
          {
            id: 'ship-api',
            label: 'Shipping API',
            height: 12,
            footprint: 2,
            district: 'Fulfilment'
          }
        ]
      }
    ],
    items: [],
    links: []
  };

  it('numbers surviving territories 0..N-1 in first-declared order', () => {
    // Assigned by ORDINAL and AFTER the `memberIds.size >= 2` filter. The
    // one-member "Legacy" bucket is declared before "Checkout" and dropped, so
    // Checkout is 0 — numbering before the filter would make it 1 and leave the
    // ladder with a hole.
    const groups = planFusedCompositeWorld(DSL).groups;
    expect(groups.map((group) => [group.display, group.colorIndex])).toEqual([
      ['Checkout', 0],
      ['Catalog', 1],
      ['Fulfilment', 2]
    ]);
  });

  it('gives N surviving territories N different colours', () => {
    // The claim the ordinal exists for. The predecessor drew the slot from
    // `Math.floor(seeded(...) * 8)`, which collides about a third of the time on
    // a three-group world — and a collision does not look like a bug, it looks
    // like two territories agreeing, which is the one thing a shared grouping
    // noun is there to deny.
    const groups = planFusedCompositeWorld(DSL).groups;
    expect(groups.length).toBeGreaterThan(1);
    expect(groups.length).toBeLessThanOrEqual(groupLadderLength());
    const tints = groups.map((group) =>
      tintByGroup(
        METAPHOR_THEME_PRESETS.whiteboard.buildingColor,
        group.colorIndex,
        GROUP_TINT_PLATE
      )
    );
    expect(new Set(tints).size).toBe(groups.length);
  });
});

describe('cityDistrictLayout districtIndexOf', () => {
  const items = [
    { id: 'gw', label: 'Gateway', district: 'Edge' },
    { id: 'cat', label: 'Catalog', district: 'Catalog' },
    { id: 'ident', label: 'Identity', district: 'Edge' },
    { id: 'loose', label: 'Unassigned' }
  ];

  it('agrees with the patch order a tower stands on', () => {
    const layout = cityDistrictLayout(items);
    const slotOfName = new Map(layout.districts.map((d, idx) => [d.name, idx]));
    expect(layout.districtIndexOf.get('gw')).toBe(slotOfName.get('Edge'));
    expect(layout.districtIndexOf.get('cat')).toBe(slotOfName.get('Catalog'));
    expect(layout.districtIndexOf.get('ident')).toBe(layout.districtIndexOf.get('gw'));
  });

  it('puts an item with no district in the same bucket as its default patch', () => {
    // The tint and the patch derive from one `districtKey`, so a building with
    // no `district` cannot end up a different colour from the ground it is on.
    const layout = cityDistrictLayout(items);
    const looseSlot = layout.districtIndexOf.get('loose');
    expect(layout.districts[looseSlot]).toBeDefined();
    expect(layout.districtIndexOf.get('loose')).not.toBe(layout.districtIndexOf.get('gw'));
  });

  it('covers every item', () => {
    const layout = cityDistrictLayout(items);
    expect([...layout.districtIndexOf.keys()].sort()).toEqual(items.map((i) => i.id).sort());
  });
});

// The third place the same axis is decided, and the one that could delete it
// outright. `tintByGroup` gives a territory its colour and `makeGroups` gives it
// its ordinal; `affinityGroupDetail` decides whether it is drawn at all.
//
// It used to be decided in `FusedCompositeScene.jsx` as `lod !== 'low'`, next to
// the shore foam and the pollen — so a 12-item world that crossed the cost bar
// drew no territory ring, no placard and no flow pulse, and nothing anywhere
// said so. Measured over 1,460 planned worlds: 1,279 carry a group and 465 of
// them (36.4%) drew none of it.
describe('affinity territories under LOD', () => {
  /**
   * The ledger's own case: 6 tree + 6 city, three shared nouns, 12 items —
   * comfortably under `resolveLod`'s `itemCount > 18` bar and over its cost one.
   */
  const NOUNS = ['Memory', 'Appliance', 'Thought'];
  const lodCaseDsl = (withGroups) => ({
    metaphor: 'composite',
    layout: 'fused',
    seed: 'lod-territory-case',
    novelty: 0.65,
    motionIntensity: 0.7,
    scene: {},
    layers: ['tree', 'city'].map((as) => ({
      id: `layer-${as}`,
      as,
      items: Array.from({ length: 6 }, (_, index) => ({
        id: `${as}-${index}`,
        label: `${as} ${index}`,
        ...(as === 'tree' ? { weight: 7 } : { height: 12, footprint: 2.5 }),
        ...(withGroups ? { district: NOUNS[index % NOUNS.length] } : {})
      }))
    })),
    items: [],
    links: []
  });

  it('reaches `low` on a 12-item world, so the tier is not hypothetical', () => {
    const plan = planFusedCompositeWorld(lodCaseDsl(true));
    expect(plan.lod).toBe('low');
    expect(plan.groups.length).toBe(3);
    // The loop this test exists because of: `estimatedCost` counts
    // `groups.length`, so the third shared noun takes the world from 93 to 96,
    // crosses the 95 bar, and the gate used to remove all three territories —
    // the grouping paying for its own deletion. The cost term is not wrong;
    // what was wrong is that a tier could delete meaning.
    const ungrouped = planFusedCompositeWorld(lodCaseDsl(false));
    expect(ungrouped.groups.length).toBe(0);
    expect(plan.estimatedCost - ungrouped.estimatedCost).toBe(3);
    expect(ungrouped.lod).toBe('medium');
  });

  it('states the group at every tier', () => {
    // The contract. `low` may thin a territory and may never remove its
    // identity band, its boundary or its name — those are the one claim a fused
    // world makes across its layers.
    expect(COMPOSITE_LOD_TIERS).toContain('low');
    for (const lod of COMPOSITE_LOD_TIERS) {
      const detail = affinityGroupDetail(lod);
      expect(detail.band).toBe(true);
      expect(detail.rim).toBe(true);
      expect(detail.placard).toBe(true);
      expect(detail.segments).toBeGreaterThanOrEqual(24);
    }
    // …and it has to actually be cheaper, or the tier is a lie.
    const lean = affinityGroupDetail('low');
    expect(lean.wash).toBe(false);
    expect(lean.bulb).toBe(false);
    expect(lean.segments).toBeLessThan(affinityGroupDetail('high').segments);
  });

  // The kinds come from the resolver's own table (#729): adding an atmosphere
  // above must widen this sweep, not silently stay outside it — the hand-copy
  // this replaces held seven of ten kinds while `toHaveLength(224)` pinned
  // the copy rather than the product.
  const COMPOSITE_SCENE_KINDS = ATMOSPHERE_KINDS;

  // Every resolved cell that inverts the strict "wash is the weakest layer"
  // ordering, named (#729). The `<= 50` tolerance this replaces sat three
  // cells above the measurement and pooled two different failure shapes; a
  // NEW inversion now fails, and a fixed one must be deleted from here.
  const KNOWN_BAND_INVERSIONS = [
    'arcade/archipelago/waterColor/group 0',
    'arcade/tree/waterColor/group 1',
    'arcade/tree/waterColor/group 2',
    'blueprint/archipelago/waterColor/group 3',
    'blueprint/garden/waterColor/group 3',
    'blueprint/river/waterColor/group 3',
    'blueprint/tree/waterColor/group 1',
    'noir/archipelago/waterColor/group 3',
    'noir/garden/waterColor/group 1',
    'noir/river/waterColor/group 1',
    'whiteboard/archipelago/waterColor/group 2'
  ];
  const KNOWN_RIM_INVERSIONS = [
    'arcade/archipelago/groundColor/group 1',
    'arcade/archipelago/groundColor/group 2',
    'arcade/archipelago/groundColor/group 3',
    'arcade/garden/groundColor/group 1',
    'arcade/garden/groundColor/group 2',
    'arcade/garden/groundColor/group 3',
    'arcade/river/groundColor/group 1',
    'arcade/river/groundColor/group 2',
    'arcade/river/groundColor/group 3',
    'arcade/tree/groundColor/group 1',
    'arcade/tree/groundColor/group 2',
    'arcade/tree/groundColor/group 3',
    'blueprint/archipelago/groundColor/group 1',
    'blueprint/archipelago/groundColor/group 2',
    'blueprint/archipelago/groundColor/group 3',
    'blueprint/garden/groundColor/group 1',
    'blueprint/garden/groundColor/group 2',
    'blueprint/garden/groundColor/group 3',
    'blueprint/river/groundColor/group 1',
    'blueprint/river/groundColor/group 2',
    'blueprint/river/groundColor/group 3',
    'blueprint/tree/groundColor/group 1',
    'blueprint/tree/groundColor/group 2',
    'blueprint/tree/groundColor/group 3',
    'noir/archipelago/groundColor/group 1',
    'noir/archipelago/groundColor/group 2',
    'noir/garden/groundColor/group 1',
    'noir/garden/groundColor/group 2',
    'noir/river/groundColor/group 1',
    'noir/river/groundColor/group 2',
    'noir/tree/groundColor/group 1',
    'noir/tree/groundColor/group 2',
    'noir/tree/waterColor/group 1',
    'noir/tree/waterColor/group 2',
    'whiteboard/galaxy/groundColor/group 2',
    'whiteboard/orrery/groundColor/group 2'
  ];

  it('drops the interior wash on colours the renderer actually paints', () => {
    // Why `low` turns off `wash` only. Luma is measured on
    // `resolveMetaphorSceneTheme` output — the same rewrite MetaphorRenderer
    // applies — not raw presets. The rim can beat the wash on a few resolved
    // cells (tiny deltas); the tier still drops wash because it covers ~52% of
    // the territory's fragments for the weakest average signal (see table in
    // compositeLodDetail.js).
    const cells = [];
    const inversions = [];
    for (const themeId of Object.keys(METAPHOR_THEME_PRESETS)) {
      for (const kind of COMPOSITE_SCENE_KINDS) {
        const theme = resolveMetaphorSceneTheme({ themeId, kind, moodId: null });
        const plateBase = resolveGroupPlateBase(theme);
        for (const surfaceKey of ['waterColor', 'groundColor']) {
          const surface = theme[surfaceKey];
          if (!surface) continue;
          const surfaceLuma = srgbLuma(surface);
          const over = (hex, alpha) => {
            const fg = new THREE.Color(hex);
            const bg = new THREE.Color(surface);
            return srgbLuma(
              `#${new THREE.Color(
                fg.r * alpha + bg.r * (1 - alpha),
                fg.g * alpha + bg.g * (1 - alpha),
                fg.b * alpha + bg.b * (1 - alpha)
              ).getHexString()}`
            );
          };
          const rim = Math.abs(over(theme.labelColor, 0.22) - surfaceLuma);
          for (let index = 0; index < 4; index += 1) {
            const color = tintByGroup(plateBase, index, GROUP_TINT_PLATE);
            const wash = Math.abs(over(color, 0.1) - surfaceLuma);
            const band = Math.abs(over(color, 0.2) - surfaceLuma);
            const where = `${themeId}/${kind}/${surfaceKey}/group ${index}`;
            cells.push(where);
            if (!(wash < band && wash < rim)) {
              inversions.push({ where, wash, band, rim });
            }
          }
        }
      }
    }
    const expectedCells =
      Object.keys(METAPHOR_THEME_PRESETS).length * COMPOSITE_SCENE_KINDS.length * 2 * 4;
    expect(cells).toHaveLength(expectedCells);
    const bandInverted = inversions
      .filter((c) => !(c.wash < c.band))
      .map((c) => c.where)
      .sort();
    const rimInverted = inversions
      .filter((c) => !(c.wash < c.rim))
      .map((c) => c.where)
      .sort();
    expect(bandInverted).toEqual([...KNOWN_BAND_INVERSIONS].sort());
    expect(rimInverted).toEqual([...KNOWN_RIM_INVERSIONS].sort());
    // The two shapes stay disjoint: one cell losing BOTH content layers'
    // signal would be a different tier argument, not a bigger version of
    // this one.
    expect(bandInverted.filter((w) => rimInverted.includes(w))).toEqual([]);
    expect(affinityGroupDetail('low').wash).toBe(false);
  });

  it('layers carries finish only — and refuses a detail that lost content', () => {
    // #728. The pass-through form answered `band: false` for any malformed
    // detail, which reproduced #715's silent blank one level down: the
    // defaulting happened at the helper every render calls. Content is now
    // absent from the result and invalid input is loud — a red test run for
    // the table that broke, never a world that draws nothing. The tier truth
    // itself is swept in `states the group at every tier`, not re-run here.
    for (const lod of COMPOSITE_LOD_TIERS) {
      const layers = affinityGroupLayers(affinityGroupDetail(lod));
      expect(Object.keys(layers).sort()).toEqual(['bulb', 'segments', 'wash']);
    }
    expect(affinityGroupLayers(affinityGroupDetail('low')).wash).toBe(false);
    for (const key of ['band', 'rim', 'placard']) {
      expect(() => affinityGroupLayers({ ...affinityGroupDetail('low'), [key]: false })).toThrow(
        /budget item/
      );
      const dropped = { ...affinityGroupDetail('low') };
      delete dropped[key];
      expect(() => affinityGroupLayers(dropped)).toThrow(/budget item/);
    }
    expect(() => affinityGroupLayers(undefined)).toThrow(/budget item/);
  });

  it('never removes the territory inside AffinityGroups at low', () => {
    const source = readFileSync(
      fileURLToPath(
        new URL('../src/components/metaphorScenes/FusedCompositeScene.jsx', import.meta.url)
      ),
      'utf8'
    );
    const body = source.match(/function AffinityGroups\([^)]*\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(body.length).toBeGreaterThan(100);
    expect(body).toContain('affinityGroupLayers');
    // #728, and proven by mutation: reintroducing `{layers.band ? …}` around
    // the content mesh passed every other assertion in this file — the branch
    // only needs to exist once for a future defaulting to blank the territory.
    // `layers` does not even carry these keys any more; any JSX reaching for
    // one is the door being rebuilt.
    expect(body).not.toMatch(/layers\.(band|rim|placard)/);
    // Spelling-independent, because the previous form pinned exactly one:
    // `if (lod === 'low') return [];`, the braced variant, and
    // `const drawn = lod === 'low' ? [] : groups` all walked past it. The body
    // delegates the tier to `affinityGroupDetail(lod)` and holds no literal
    // `'low'` at all, so any reappearance is the gate coming back.
    expect(body).not.toMatch(/'low'/);
    const mount = source.match(/^.*<AffinityGroups[^]*?\/>.*$/m)?.[0] ?? '';
    expect(mount).toContain('lod={lod}');
    expect(mount).not.toMatch(/lod\s*!==\s*'low'/);
    // Both polarities, and the `===` half is the one that matters: #715's
    // actual defect was `{lod === 'low' ? null : <AffinityGroups … />}` at the
    // mount, not an early return inside the component. #722 added the body
    // guard above and dropped this line, so that exact shape passed the whole
    // file again — measured: 616/616 green with the defect reinstated. The
    // body guard cannot see it, because the gate is not in the body.
    expect(mount).not.toMatch(/lod\s*===\s*'low'/);
  });
});
