import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GLYPH_ADVANCE,
  LABEL_ROLES,
  LINE_EM,
  UPPERCASE_WIDENING,
  labelLines,
  labelPlateEm,
  labelRoleStyle,
  labelRoleText,
  labelStackLiftEm
} from '../src/components/metaphorScenes/labelRoles.js';

describe('label roles', () => {
  it('draws a thing, a territory and a relation differently from each other', () => {
    // The whole point: before this, a district placard, a service and a link
    // caption were the same white chip, so a scene that encodes four metrics in
    // geometry flattened its own vocabulary in the one layer that names things.
    const { item, group, link } = LABEL_ROLES;
    // The chip is the loudest signal, and it is the one that separates all three.
    expect(new Set([item.plate, group.plate, link.plate]).size).toBe(3);
    // A territory is written across its ground, so it carries no chip at all.
    expect(group.plate).toBe(0);
    // ...which means its outline is the only thing carrying it.
    expect(group.outline).toBeGreaterThan(item.outline);
    expect(group.upper).toBe(true);
    expect(group.tracking).toBeGreaterThan(0);
    // A relation is a footnote on a line: quieter and smaller than what it joins.
    expect(link.scale).toBeLessThan(item.scale);
    expect(link.plate).toBeLessThan(item.plate);
  });

  it('leaves the item rank exactly as it was', () => {
    // Items are the subject and the overwhelming majority of labels; this change
    // is about the other two ranks, and a silent restyle of every name in every
    // scene is not what it is allowed to cost.
    expect(LABEL_ROLES.item).toEqual({
      plate: 0.58,
      scale: 1,
      tracking: 0,
      upper: false,
      outline: 0.08
    });
  });

  it('falls back to the item rank for a role nobody defined', () => {
    // A scene passing a typo gets the old behaviour, never an invisible label.
    for (const bogus of [undefined, null, '', 'District', 'group ', 42]) {
      expect(labelRoleStyle(bogus)).toBe(LABEL_ROLES.item);
    }
  });

  it('uppercases only the territory rank', () => {
    expect(labelRoleText('Checkout', LABEL_ROLES.group)).toBe('CHECKOUT');
    expect(labelRoleText('Checkout', LABEL_ROLES.item)).toBe('Checkout');
    expect(labelRoleText('authorizes', LABEL_ROLES.link)).toBe('authorizes');
    expect(labelRoleText(undefined, LABEL_ROLES.group)).toBe('');
  });

  it('carries tracking and capitals into the declutter box estimate', () => {
    // Both widen the drawn thing. Without them a group placard claims a box a
    // third narrower than it draws, and the pass then lets an item label sit on
    // top of it — the estimate is what the whole declutter pass reasons about,
    // because troika only publishes real bounds two frames later.
    const word = 'PLATFORM';
    const asItem = labelPlateEm(word, LABEL_ROLES.item);
    const asGroup = labelPlateEm(word, LABEL_ROLES.group);
    expect(asGroup.width).toBeGreaterThan(asItem.width * 1.2);
    const expected =
      word.length * (GLYPH_ADVANCE * UPPERCASE_WIDENING + LABEL_ROLES.group.tracking) + 0.9;
    expect(asGroup.width).toBeCloseTo(expected, 9);
  });

  it('still wraps a very long name rather than claiming the whole frame', () => {
    const long = labelPlateEm('X'.repeat(400), LABEL_ROLES.group);
    const short = labelPlateEm('X'.repeat(60), LABEL_ROLES.group);
    expect(long.width).toBe(short.width);
    expect(long.width).toBeLessThan(18);
  });

  it('measures a stacked sign by its tallest stack and its longest line', () => {
    // troika draws every `\n` as a real line, so a subway interchange's compound
    // name is two or three lines tall. A box that reports one line's height
    // claims half what it draws and lets a neighbour through into the half it
    // never measured — the same under-claim the tracking/capitals case above
    // exists for, on the other axis. Width must NOT grow with the extra lines:
    // measuring the joined string would have the sign claim a box three names
    // wide and drop everything beside it.
    const one = labelPlateEm('Checkout', LABEL_ROLES.item);
    const two = labelPlateEm('Checkout\nPack', LABEL_ROLES.item);
    const three = labelPlateEm('Checkout\nPack\nShip', LABEL_ROLES.item);
    expect(two.width).toBe(one.width);
    expect(three.width).toBe(one.width);
    expect(two.height - one.height).toBeCloseTo(LINE_EM, 9);
    expect(three.height - two.height).toBeCloseTo(LINE_EM, 9);
  });

  it('widens to the longest line when a later member has the longer name', () => {
    const stacked = labelPlateEm('Ship\nWhere is it?', LABEL_ROLES.item);
    const longest = labelPlateEm('Where is it?', LABEL_ROLES.item);
    expect(stacked.width).toBe(longest.width);
  });

  it('lifts a stacked sign so its first line sits where one line did', () => {
    // Anchored at the block's middle, extra lines grow DOWN as well as up — and
    // down is where the station stands. Measured on the subway: "Ship / Where is
    // it?" hangs over a platform with no glyph and the second line landed on the
    // white disc, which the probe scored buried and the screenshot showed
    // smeared across the rim.
    expect(labelStackLiftEm(1)).toBe(0);
    expect(labelStackLiftEm(2)).toBeCloseTo(LINE_EM / 2, 9);
    expect(labelStackLiftEm(3)).toBeCloseTo(LINE_EM, 9);
    // A degenerate count must not push an ordinary label off its own item.
    expect(labelStackLiftEm(0)).toBe(0);
  });

  it('reads a plain name as exactly one line', () => {
    expect(labelLines('Checkout')).toEqual(['Checkout']);
    expect(labelLines('Checkout\nPack')).toEqual(['Checkout', 'Pack']);
    expect(labelLines('')).toEqual(['']);
    expect(labelLines(undefined)).toEqual(['']);
  });
});

/**
 * Every noun in the DSL that names a GROUP of items rather than an item. Each
 * one is drawn by exactly one placard component, and a rank nothing passes is a
 * vocabulary the viewer never sees — the failure mode is silent, because the
 * placard still renders, just wearing the item rank.
 */
const GROUP_PLACARDS = [
  ['MetaphorRenderer.jsx', 'text={district.name}'],
  ['metaphorScenes/GardenScene.jsx', 'text={bed.name}'],
  ['metaphorScenes/ArchipelagoScene.jsx', 'text={chain.name}'],
  ['metaphorScenes/SubwayScene.jsx', 'text={line.name}'],
  ['metaphorScenes/IcebergScene.jsx', 'text={berg.name}'],
  ['metaphorScenes/MachineScene.jsx', 'text={axle.name}'],
  ['metaphorScenes/GalaxyScene.jsx', 'text={cluster.name}'],
  ['metaphorScenes/FusedCompositeScene.jsx', 'text={group.display}']
];

/** And every place a link caption is drawn. */
const LINK_CAPTIONS = [
  ['metaphorScenes/MetaphorSceneChrome.jsx', 'text={link.label}'],
  ['metaphorScenes/FusedCompositeScene.jsx', 'text={link.label}']
];

describe('label rank at the call sites', () => {
  const read = (file) =>
    readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8');

  it('marks every group placard as a territory', () => {
    // A sweep over a set nothing joins passes while examining nothing.
    expect(GROUP_PLACARDS.length).toBe(8);
    for (const [file, marker] of GROUP_PLACARDS) {
      const source = read(file);
      const at = source.indexOf(marker);
      expect(at, `${file}: ${marker}`).toBeGreaterThan(-1);
      expect(source.slice(at, at + 400), `${file}: role`).toContain('role="group"');
    }
  });

  it('marks every link caption as a relation', () => {
    expect(LINK_CAPTIONS.length).toBe(2);
    for (const [file, marker] of LINK_CAPTIONS) {
      const source = read(file);
      const at = source.indexOf(marker);
      expect(at, `${file}: ${marker}`).toBeGreaterThan(-1);
      expect(source.slice(at, at + 400), `${file}: role`).toContain('role="link"');
    }
  });

  it('keeps a group placard off its own members', () => {
    // Three separate versions of one bug: a district placard on the patch's FAR
    // edge is behind its own towers from the default (+x, +y, +z) view, and its
    // text is depth-tested away — which reads as "the model did not label
    // them". The city was fixed first; the garden beds and the archipelago
    // chains carried it until this pass. The tell is a MINUS on the z half-extent.
    const garden = read('metaphorScenes/GardenScene.jsx');
    const bedLabel = garden.indexOf('text={bed.name}');
    expect(bedLabel).toBeGreaterThan(-1);
    expect(garden.slice(bedLabel, bedLabel + 300)).toContain('bed.size[1] / 2 + 0.42');
    expect(garden.slice(bedLabel, bedLabel + 300)).not.toContain('-bed.size[1]');

    // The archipelago chain was the documented exception for two passes: a chain
    // circle is a poor LATERAL anchor (the chains overlap and their centres
    // cluster at the world centre), so the near-edge move put one placard in a
    // corner and the other off-canvas. It now takes the answer the fused
    // planner reached instead — the plan carries a lift and a shoulder, and the
    // scene must read them rather than re-deriving a half-extent of its own.
    const arch = read('metaphorScenes/ArchipelagoScene.jsx');
    const chainLabel = arch.indexOf('text={chain.name}');
    expect(chainLabel).toBeGreaterThan(-1);
    // Widened backwards: the offset is read into a local above the JSX.
    const chainProps = arch.slice(chainLabel - 600, chainLabel + 400);
    expect(chainProps).toContain('chain.labelLift');
    expect(chainProps).toContain('chain.labelOffset');
    expect(chainProps).not.toContain('chain.radius');
  });

  it('pins every group placard, the archipelago chain included', () => {
    // A territory's name has no second copy anywhere in the scene, which is why
    // pinning buys a laxer on-canvas bar rather than an exemption. The chain was
    // the one placard in any kind the declutter pass could drop outright — and
    // it is the noun the archipelago legend's own axis is phrased in.
    for (const [file, marker] of GROUP_PLACARDS) {
      const source = read(file);
      const at = source.indexOf(marker);
      expect(at, `${file}: ${marker}`).toBeGreaterThan(-1);
      expect(source.slice(at - 400, at + 400), `${file}: pinned`).toMatch(/\bpinned\b/);
    }
  });
});
