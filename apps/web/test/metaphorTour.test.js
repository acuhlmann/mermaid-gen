import { describe, expect, it } from 'vitest';
import { buildMetaphorTour, MAX_TOUR_BEATS } from '../src/utils/metaphorTour.js';

const CITY = {
  metaphor: 'city',
  scene: {
    title: 'Payments platform',
    subtitle: 'Where the money actually moves',
    legend: { height: 'monthly transaction volume', district: 'owning team' }
  },
  items: [
    { id: 'ledger', label: 'Ledger', height: 18, district: 'core' },
    { id: 'refunds', label: 'Refunds', height: 4, district: 'support' },
    {
      id: 'gateway',
      label: 'Gateway',
      height: 11,
      district: 'core',
      accent: true,
      note: 'Every payment funnels through one service nobody owns.'
    }
  ],
  links: [{ from: 'gateway', to: 'ledger', label: 'settles into' }]
};

const FUSED = {
  metaphor: 'composite',
  scene: { title: 'Commerce current', legend: { mass: 'domain scale' } },
  layers: [
    {
      id: 'domains',
      as: 'archipelago',
      label: 'Domains',
      items: [
        { id: 'checkout', label: 'Checkout', mass: 9 },
        { id: 'catalog', label: 'Catalog', mass: 3 }
      ]
    },
    {
      id: 'services',
      as: 'city',
      label: 'Services',
      items: [{ id: 'payments-api', label: 'Payments API', height: 12 }]
    }
  ],
  links: []
};

const kinds = (beats) => beats.map((beat) => beat.kind);

describe('buildMetaphorTour', () => {
  it('opens on the scene and closes on the thesis', () => {
    const beats = buildMetaphorTour(CITY);
    expect(kinds(beats)[0]).toBe('overview');
    expect(kinds(beats).at(-1)).toBe('accent');
    expect(beats[0].title).toBe('Payments platform');
    expect(beats.at(-1).body).toContain('nobody owns');
  });

  it('decodes the encodings in the author’s own legend words', () => {
    const legend = buildMetaphorTour(CITY).find((beat) => beat.kind === 'legend');
    expect(legend.body).toContain('monthly transaction volume');
    expect(legend.body).toContain('owning team');
  });

  it('names the extreme item by the axis the scene actually draws large', () => {
    const peak = buildMetaphorTour(CITY).find((beat) => beat.kind === 'peak');
    // Height, not district — and phrased with the author's legend label.
    expect(peak.title).toBe('Ledger');
    expect(peak.body).toContain('monthly transaction volume');
    expect(peak.body).toContain('18');
    expect(peak.focus).toMatchObject({ id: 'ledger', metaphor: 'city' });
  });

  it('does not spend two beats on one item that is both extreme and thesis', () => {
    const tallestIsAccent = {
      ...CITY,
      items: [
        { id: 'ledger', label: 'Ledger', height: 4 },
        {
          id: 'gateway',
          label: 'Gateway',
          height: 18,
          accent: true,
          note: 'One service nobody owns.'
        }
      ]
    };
    const beats = buildMetaphorTour(tallestIsAccent);
    // No "biggest is Gateway" immediately before "the point is Gateway". The
    // link beat may still focus it — that beat is about the relationship.
    expect(kinds(beats).filter((kind) => kind === 'peak')).toHaveLength(0);
    expect(
      beats.filter((beat) => beat.focus?.id === 'gateway' && beat.kind !== 'link')
    ).toHaveLength(1);
  });

  it('reads a labelled link in the author’s words and skips unlabelled ones', () => {
    const link = buildMetaphorTour(CITY).find((beat) => beat.kind === 'link');
    expect(link.title).toBe('settles into');
    expect(link.body).toBe('Gateway → Ledger');
    const unlabelled = buildMetaphorTour({
      ...CITY,
      links: [{ from: 'gateway', to: 'ledger' }]
    });
    expect(kinds(unlabelled)).not.toContain('link');
  });

  it('narrates a fused world layer by layer instead of comparing across grammars', () => {
    const beats = buildMetaphorTour(FUSED, { kindLabel: (kind) => kind.toUpperCase() });
    const layers = beats.filter((beat) => beat.kind === 'layer');
    expect(layers.map((beat) => beat.title)).toEqual(['Domains', 'Services']);
    // Each layer's standout comes from its OWN grammar's primary metric —
    // an island's mass is never weighed against a tower's height.
    expect(layers[0].body).toContain('ARCHIPELAGO');
    expect(layers[0].body).toContain('Checkout');
    expect(layers[0].focus.id).toBe('checkout');
    expect(layers[1].focus.id).toBe('payments-api');
    expect(kinds(beats)).not.toContain('peak');
  });

  it('matches a layer to its standout by layer id, not by grammar', () => {
    const twoCities = {
      metaphor: 'composite',
      scene: { title: 'Two cities' },
      layers: [
        { id: 'a', as: 'city', label: 'Alpha', items: [{ id: 'a1', label: 'A1', height: 3 }] },
        { id: 'b', as: 'city', label: 'Beta', items: [{ id: 'b1', label: 'B1', height: 9 }] }
      ]
    };
    const layers = buildMetaphorTour(twoCities).filter((beat) => beat.kind === 'layer');
    expect(layers.map((beat) => beat.focus.id)).toEqual(['a1', 'b1']);
  });

  it('drops the ending only after the middle has yielded every beat it can', () => {
    const crowded = {
      metaphor: 'composite',
      scene: { title: 'Crowded', subtitle: 'many layers', legend: { mass: 'scale' } },
      layers: ['one', 'two', 'three', 'four', 'five'].map((id, index) => ({
        id,
        as: 'archipelago',
        label: id,
        items: [{ id: `${id}-i`, label: id, mass: index + 1 }]
      })),
      links: []
    };
    crowded.layers[0].items[0].accent = true;
    crowded.layers[0].items[0].note = 'The point survives the cap.';
    const beats = buildMetaphorTour(crowded);
    expect(beats.length).toBeLessThanOrEqual(MAX_TOUR_BEATS);
    expect(kinds(beats).at(-1)).toBe('accent');
  });

  it('says nothing rather than padding an empty document', () => {
    expect(buildMetaphorTour(null)).toEqual([]);
    expect(buildMetaphorTour({ metaphor: 'city', scene: {}, items: [], links: [] })).toEqual([]);
  });

  it('uses injected copy so every string can be localized', () => {
    const beats = buildMetaphorTour(CITY, { copy: { legend: 'Comment lire' } });
    expect(beats.find((beat) => beat.kind === 'legend').title).toBe('Comment lire');
  });
});
