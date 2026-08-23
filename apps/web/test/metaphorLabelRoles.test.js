import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GLYPH_ADVANCE,
  LABEL_ROLES,
  UPPERCASE_WIDENING,
  labelPlateEm,
  labelRoleStyle,
  labelRoleText
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

    // The archipelago chain is the documented exception, and the comment is the
    // deliverable: a chain circle is a poor anchor (the chains overlap and their
    // centres cluster at the world centre), so the same move put one placard in
    // a corner and the other off-canvas — strictly worse than hidden. Pinned so
    // the next pass finds the reasoning instead of re-running the experiment.
    const arch = read('metaphorScenes/ArchipelagoScene.jsx');
    const chainLabel = arch.indexOf('text={chain.name}');
    expect(chainLabel).toBeGreaterThan(-1);
    expect(arch.slice(chainLabel, chainLabel + 1400)).toContain('assignSiteLabelOffsets');
  });
});
