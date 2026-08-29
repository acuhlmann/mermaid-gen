import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GROUP_TINT_BODY,
  GROUP_TINT_EARTH,
  GROUP_TINT_PLATE,
  groupLadderLength,
  groupSlots,
  tintByGroup
} from '../src/components/metaphorScenes/groupIdentity.js';
import { cityDistrictLayout } from '../src/utils/metaphorLayouts/cityDistrictLayout.js';
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

describe('groupSlots', () => {
  it('numbers groups in first-declared order and ignores empty keys', () => {
    const slots = groupSlots(['Edge', 'Catalog', 'Edge', undefined, '  ', 'Checkout']);
    expect([...slots]).toEqual([
      ['Edge', 0],
      ['Catalog', 1],
      ['Checkout', 2]
    ]);
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
