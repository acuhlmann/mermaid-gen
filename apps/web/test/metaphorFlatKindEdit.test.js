import { describe, expect, it } from 'vitest';
import { sanitizeMetaphorDsl } from '@archislop/shared';
import {
  METAPHOR_FLAT_GRAPH_EDIT_KINDS,
  metaphorFlatGraphEditForSource
} from '../src/utils/metaphorFlatKindEdit.js';

function sample(kind, items, links = []) {
  return JSON.stringify(
    {
      metaphor: kind,
      scene: { theme: 'whiteboard', camera: 'orbit' },
      items,
      links
    },
    null,
    2
  );
}

describe('metaphorFlatGraphEditForSource', () => {
  it('returns edit helpers for registered flat kinds only', () => {
    expect(
      metaphorFlatGraphEditForSource(sample('machine', [{ id: 'a', label: 'A', size: 3 }]))
    ).toBe(METAPHOR_FLAT_GRAPH_EDIT_KINDS.machine);
    expect(metaphorFlatGraphEditForSource(sample('city', [{ id: 'a', label: 'A' }]))).toBeNull();
    expect(metaphorFlatGraphEditForSource('not json')).toBeNull();
  });
});

describe('metaphor machine graph edit', () => {
  const MACHINE = sample(
    'machine',
    [
      { id: 'drive', label: 'Drive', size: 4, speed: 5, axle: 'main' },
      { id: 'idle', label: 'Idle', size: 2, speed: 1, axle: 'main' }
    ],
    [{ from: 'drive', to: 'idle' }]
  );
  const edit = METAPHOR_FLAT_GRAPH_EDIT_KINDS.machine;

  it('adds a sibling gear cloning encoding defaults', () => {
    const result = edit.addLinked(MACHINE, 'drive', 'Reducer');
    expect(result).toMatchObject({ ok: true, newId: 'n1', newLabel: 'Reducer' });
    const parsed = JSON.parse(result.source);
    expect(parsed.items.map((item) => item.id)).toEqual(['drive', 'n1', 'idle']);
    expect(parsed.items[1]).toMatchObject({
      id: 'n1',
      label: 'Reducer',
      size: 4,
      speed: 5,
      axle: 'main'
    });
    expect(sanitizeMetaphorDsl(result.source).dsl).toBeTruthy();
  });

  it('connects two gears and refuses duplicate links', () => {
    expect(edit.connect(MACHINE, 'idle', 'drive')).toMatchObject({ ok: true });
    expect(edit.connect(MACHINE, 'drive', 'idle')).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('purges links when a gear is deleted', () => {
    const linked = sample(
      'machine',
      [
        { id: 'drive', label: 'Drive', size: 4, speed: 5 },
        { id: 'idle', label: 'Idle', size: 2, speed: 1 }
      ],
      [{ from: 'drive', to: 'idle' }]
    );
    const removed = edit.deleteNode(linked, 'drive');
    expect(removed.ok).toBe(true);
    expect(JSON.parse(removed.source).links).toEqual([]);
    expect(JSON.parse(removed.source).items.map((item) => item.id)).toEqual(['idle']);
  });

  it('removes one directed link without touching the nodes', () => {
    const linked = sample(
      'machine',
      [
        { id: 'drive', label: 'Drive', size: 4, speed: 5 },
        { id: 'idle', label: 'Idle', size: 2, speed: 1 }
      ],
      [{ from: 'drive', to: 'idle' }]
    );
    const result = edit.deleteEdge(linked, 'drive', 'idle');
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.source).links).toEqual([]);
    expect(JSON.parse(result.source).items).toHaveLength(2);
  });

  it('refuses self-links and missing endpoints', () => {
    expect(edit.connect(MACHINE, 'drive', 'drive')).toEqual({ ok: false, reason: 'self' });
    expect(edit.connect(MACHINE, 'drive', 'missing')).toEqual({ ok: false, reason: 'missing' });
  });

  it('refuses deleting the last gear', () => {
    const lone = sample('machine', [{ id: 'only', label: 'Only', size: 3 }]);
    expect(edit.deleteNode(lone, 'only')).toEqual({ ok: false, reason: 'last' });
  });
});

describe('metaphor layercake graph edit', () => {
  const LAYERCAKE = sample('layercake', [
    { id: 'ui', label: 'UI', thickness: 2, components: ['React'] },
    { id: 'api', label: 'API', thickness: 3, components: ['Gateway'] }
  ]);
  const edit = METAPHOR_FLAT_GRAPH_EDIT_KINDS.layercake;

  it('adds a sibling layer with Link enabled', () => {
    expect(edit.canLink).toBe(true);
    const result = edit.addLinked(LAYERCAKE, 'ui', 'Cache');
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.source).items[1]).toMatchObject({
      id: 'n1',
      label: 'Cache',
      thickness: 2,
      components: ['React']
    });
  });
});

describe('metaphor ordered flat kinds without Link', () => {
  it('archipelago clones island defaults without Link', () => {
    const edit = METAPHOR_FLAT_GRAPH_EDIT_KINDS.archipelago;
    expect(edit.canLink).toBe(false);
    const source = sample('archipelago', [
      { id: 'alpha', label: 'Alpha', mass: 5, relief: 0.6, chain: 'North' },
      { id: 'beta', label: 'Beta', mass: 3, relief: 0.3, chain: 'North' }
    ]);
    const result = edit.addLinked(source, 'alpha', 'Gamma');
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.source).items[1]).toMatchObject({
      id: 'n1',
      label: 'Gamma',
      mass: 5,
      relief: 0.6,
      chain: 'North'
    });
    expect(edit.connect(source, 'alpha', 'beta')).toEqual({ ok: false, reason: 'no-link' });
  });

  it('river clones stage and flow without Link', () => {
    const edit = METAPHOR_FLAT_GRAPH_EDIT_KINDS.river;
    const source = sample('river', [
      { id: 'head', label: 'Headwaters', stage: 0, flow: 4 },
      { id: 'mouth', label: 'Mouth', stage: 90, flow: 12 }
    ]);
    const result = edit.addLinked(source, 'head', 'Rapids');
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.source).items[1]).toMatchObject({
      id: 'n1',
      label: 'Rapids',
      stage: 0,
      flow: 4
    });
  });

  it('subway clones line metadata without Link', () => {
    const edit = METAPHOR_FLAT_GRAPH_EDIT_KINDS.subway;
    const source = sample('subway', [
      {
        id: 'central',
        label: 'Central',
        line: 'Red',
        stop: 10,
        traffic: 8,
        interchange: ['hub']
      },
      { id: 'east', label: 'East', line: 'Red', stop: 40, traffic: 5 }
    ]);
    const result = edit.addLinked(source, 'central', 'Midtown');
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.source).items[1]).toMatchObject({
      id: 'n1',
      label: 'Midtown',
      line: 'Red',
      stop: 10,
      traffic: 8,
      interchange: ['hub']
    });
  });

  it('refuses empty rename labels across flat kinds', () => {
    const source = sample('iceberg', [{ id: 'tip', label: 'Tip', depth: 0.8, mass: 4 }]);
    const edit = METAPHOR_FLAT_GRAPH_EDIT_KINDS.iceberg;
    expect(edit.renameNode(source, 'tip', '   ')).toEqual({ ok: false, reason: 'empty' });
    expect(edit.renameNode(source, 'tip', 'Visible')).toMatchObject({ ok: true });
  });
});

describe('metaphor flat kind guards', () => {
  it('rejects the wrong metaphor kind', () => {
    const edit = METAPHOR_FLAT_GRAPH_EDIT_KINDS.galaxy;
    const wrong = sample('machine', [{ id: 'a', label: 'A', size: 3 }]);
    expect(edit.addLinked(wrong, 'a')).toEqual({ ok: false, reason: 'not-galaxy' });
  });
});
