import { describe, expect, it } from 'vitest';
import { graphEditAdapterFor, graphEditIdFromDescriptor } from '../src/utils/canvasGraphEdit.js';

const FLOWCHART = `flowchart TD
  A[Start] --> B[End]
`;

const TREE = `infographic hierarchy-tree-curved-line-rounded-rect-node
data
  root
    label Company
    children
      - label Engineering
`;

const DAGRE = `infographic relation-dagre-flow-tb-simple-circle-node
data
  nodes
    - label API
    - label DB
  relations
    API -> DB
`;

const LIST = `infographic list-grid-simple
data
  lists
    - label A
`;

const MINDMAP = `mindmap
  root((Root Topic))
    Child1
`;

const STATE = `stateDiagram-v2
  [*] --> Draft
  Draft --> PendingReview : submit
`;

const SEQUENCE = `sequenceDiagram
  participant Alice
  participant Bob
  Alice->>Bob: Hello
`;

const METAPHOR_TREE = JSON.stringify(
  {
    metaphor: 'tree',
    scene: { theme: 'whiteboard', camera: 'orbit' },
    items: [
      { id: 'ceo', label: 'CEO', weight: 8 },
      { id: 'cto', label: 'CTO', parent: 'ceo', weight: 6 }
    ],
    links: []
  },
  null,
  2
);

const METAPHOR_CITY = JSON.stringify(
  {
    metaphor: 'city',
    scene: { theme: 'whiteboard', camera: 'orbit' },
    items: [
      { id: 'auth', label: 'Auth', height: 10, footprint: 2 },
      { id: 'api', label: 'API', height: 14, footprint: 3 }
    ],
    links: []
  },
  null,
  2
);

const METAPHOR_GARDEN = JSON.stringify(
  {
    metaphor: 'garden',
    scene: { theme: 'whiteboard', camera: 'orbit' },
    items: [
      { id: 'signup', label: 'Signup', maturity: 0.6, impact: 4, health: 'steady' },
      { id: 'checkout', label: 'Checkout', maturity: 0.4, impact: 3, health: 'steady' }
    ],
    links: []
  },
  null,
  2
);

const CHART_VALUES = JSON.stringify(
  {
    archislopVersion: 1,
    theme: 'whiteboard',
    spec: {
      mark: 'bar',
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'amount', type: 'quantitative' }
      },
      data: {
        values: [
          { category: 'Widgets', amount: 42 },
          { category: 'Gadgets', amount: 28 }
        ]
      }
    }
  },
  null,
  2
);

describe('graphEditAdapterFor', () => {
  it('returns the flowchart adapter for mermaid flowcharts only', () => {
    const adapter = graphEditAdapterFor('mermaid', FLOWCHART);
    expect(adapter?.contentType).toBe('mermaid');
    expect(adapter?.canLink).toBe(true);
    expect(graphEditAdapterFor('mermaid', 'classDiagram\n  A --> B')).toMatchObject({
      contentType: 'mermaid',
      canLink: true
    });
    expect(
      graphEditAdapterFor('mermaid', 'classDiagram\n  Animal <|-- Duck')?.addLinked(
        'classDiagram\n  Animal <|-- Duck',
        'Animal',
        'Goose'
      )
    ).toMatchObject({ ok: true, newId: 'Class1' });
  });

  it('returns the sequence adapter with Link for sequenceDiagram', () => {
    const adapter = graphEditAdapterFor('mermaid', SEQUENCE);
    expect(adapter?.contentType).toBe('mermaid');
    expect(adapter?.canLink).toBe(true);
    expect(adapter?.connect(SEQUENCE, 'Alice', 'Bob')).toMatchObject({ ok: true });
    expect(adapter?.addLinked(SEQUENCE, 'Alice', 'Charlie')).toMatchObject({
      ok: true,
      newId: 'p1'
    });
  });

  it('returns the mindmap adapter without Link', () => {
    const adapter = graphEditAdapterFor('mermaid', MINDMAP);
    expect(adapter?.contentType).toBe('mermaid');
    expect(adapter?.canLink).toBe(false);
    expect(adapter?.addLinked(MINDMAP, '~node:1', 'New')).toMatchObject({
      ok: true,
      newId: '0,0,0'
    });
  });

  it('returns the state adapter with Link for stateDiagram-v2', () => {
    const adapter = graphEditAdapterFor('mermaid', STATE);
    expect(adapter?.contentType).toBe('mermaid');
    expect(adapter?.canLink).toBe(true);
    expect(adapter?.connect(STATE, 'Draft', 'PendingReview')).toEqual({
      ok: false,
      reason: 'duplicate'
    });
    expect(adapter?.addLinked(STATE, 'Draft', 'Revision')).toMatchObject({
      ok: true,
      newId: 'n1'
    });
  });

  it('enables infographic trees without Link, dagre with Link, and flat lists', () => {
    const tree = graphEditAdapterFor('infographic', TREE);
    expect(tree?.contentType).toBe('infographic');
    expect(tree?.canLink).toBe(false);
    const dagre = graphEditAdapterFor('infographic', DAGRE);
    expect(dagre?.canLink).toBe(true);
    const list = graphEditAdapterFor('infographic', LIST);
    expect(list?.contentType).toBe('infographic');
    expect(list?.canLink).toBe(false);
    expect(list?.addLinked(LIST, '0', 'New')).toMatchObject({ ok: true });
  });

  it('returns the metaphor tree adapter without Link', () => {
    const adapter = graphEditAdapterFor('metaphor3d', METAPHOR_TREE);
    expect(adapter?.contentType).toBe('metaphor3d');
    expect(adapter?.canLink).toBe(false);
    expect(adapter?.addLinked(METAPHOR_TREE, 'ceo', 'Branch')).toMatchObject({
      ok: true,
      newId: 'n1'
    });
    expect(graphEditAdapterFor('metaphor3d', METAPHOR_CITY)?.canLink).toBe(true);
    expect(graphEditAdapterFor('metaphor3d', METAPHOR_GARDEN)?.canLink).toBe(false);
    expect(
      graphEditAdapterFor(
        'metaphor3d',
        JSON.stringify({
          metaphor: 'machine',
          items: [{ id: 'a', label: 'A', size: 3 }]
        })
      )?.canLink
    ).toBe(true);
    expect(graphEditAdapterFor('metaphor3d', '{"metaphor":"composite","layers":[]}')).toBeNull();
    const loneComposite = JSON.stringify({
      metaphor: 'composite',
      scene: {},
      layout: 'fused',
      layers: [
        {
          id: 'platform',
          as: 'city',
          items: [{ id: 'auth', label: 'Auth', height: 10, footprint: 2 }]
        }
      ],
      items: [],
      links: []
    });
    expect(graphEditAdapterFor('metaphor3d', loneComposite)?.canLink).toBe(false);
  });

  it('returns the metaphor composite adapter with cross-layer Link', () => {
    const composite = JSON.stringify({
      metaphor: 'composite',
      scene: { theme: 'whiteboard', camera: 'orbit' },
      layout: 'fused',
      layers: [
        {
          id: 'platform',
          as: 'city',
          items: [
            { id: 'auth', label: 'Auth', height: 12, footprint: 3 },
            { id: 'api', label: 'API', height: 10, footprint: 2 }
          ]
        },
        {
          id: 'domains',
          as: 'garden',
          items: [{ id: 'signup', label: 'Signup', maturity: 0.5, impact: 0.5, health: 0.5 }]
        }
      ],
      items: [],
      links: []
    });
    const adapter = graphEditAdapterFor('metaphor3d', composite);
    expect(adapter?.contentType).toBe('metaphor3d');
    expect(adapter?.canLink).toBe(true);
    expect(adapter?.addLinked(composite, 'auth', 'Billing')).toMatchObject({
      ok: true,
      newId: 'n1'
    });
    expect(adapter?.connect(composite, 'api', 'signup')).toMatchObject({ ok: true });
  });

  it('returns the metaphor city adapter with Link', () => {
    const adapter = graphEditAdapterFor('metaphor3d', METAPHOR_CITY);
    expect(adapter?.contentType).toBe('metaphor3d');
    expect(adapter?.canLink).toBe(true);
    expect(adapter?.addLinked(METAPHOR_CITY, 'auth', 'Billing')).toMatchObject({
      ok: true,
      newId: 'n1'
    });
    expect(adapter?.connect(METAPHOR_CITY, 'auth', 'api')).toMatchObject({ ok: true });
  });

  it('returns the metaphor garden adapter without Link', () => {
    const adapter = graphEditAdapterFor('metaphor3d', METAPHOR_GARDEN);
    expect(adapter?.contentType).toBe('metaphor3d');
    expect(adapter?.canLink).toBe(false);
    expect(adapter?.addLinked(METAPHOR_GARDEN, 'signup', 'Referrals')).toMatchObject({
      ok: true,
      newId: 'n1'
    });
  });

  it('returns flat metaphor adapters for machine and galaxy scenes', () => {
    const machine = JSON.stringify({
      metaphor: 'machine',
      scene: { theme: 'whiteboard', camera: 'orbit' },
      items: [
        { id: 'drive', label: 'Drive', size: 4, speed: 5 },
        { id: 'idle', label: 'Idle', size: 2, speed: 1 }
      ],
      links: []
    });
    const machineAdapter = graphEditAdapterFor('metaphor3d', machine);
    expect(machineAdapter?.contentType).toBe('metaphor3d');
    expect(machineAdapter?.canLink).toBe(true);
    expect(machineAdapter?.addLinked(machine, 'drive', 'Reducer')).toMatchObject({
      ok: true,
      newId: 'n1'
    });

    const galaxy = JSON.stringify({
      metaphor: 'galaxy',
      scene: { theme: 'whiteboard', camera: 'orbit' },
      items: [{ id: 'sol', label: 'Sol', magnitude: 8 }],
      links: []
    });
    const galaxyAdapter = graphEditAdapterFor('metaphor3d', galaxy);
    expect(galaxyAdapter?.canLink).toBe(true);
    expect(galaxyAdapter?.addLinked(galaxy, 'sol', 'Proxima')).toMatchObject({ ok: true });
  });

  it('returns flat metaphor adapters without Link for river and archipelago', () => {
    const river = JSON.stringify({
      metaphor: 'river',
      items: [
        { id: 'head', label: 'Headwaters', stage: 0, flow: 4 },
        { id: 'mouth', label: 'Mouth', stage: 90, flow: 12 }
      ],
      links: []
    });
    const riverAdapter = graphEditAdapterFor('metaphor3d', river);
    expect(riverAdapter?.canLink).toBe(false);
    expect(riverAdapter?.addLinked(river, 'head', 'Rapids')).toMatchObject({ ok: true });

    const archipelago = JSON.stringify({
      metaphor: 'archipelago',
      items: [
        { id: 'alpha', label: 'Alpha', mass: 5, relief: 0.6 },
        { id: 'beta', label: 'Beta', mass: 3, relief: 0.3 }
      ],
      links: []
    });
    expect(graphEditAdapterFor('metaphor3d', archipelago)?.canLink).toBe(false);
  });

  it('returns the chart values adapter without Link', () => {
    const adapter = graphEditAdapterFor('chart', CHART_VALUES);
    expect(adapter?.contentType).toBe('chart');
    expect(adapter?.canLink).toBe(false);
    expect(adapter?.addLinked(CHART_VALUES, '0', 'New')).toMatchObject({
      ok: true,
      newId: '1'
    });
    expect(
      graphEditAdapterFor(
        'chart',
        JSON.stringify({
          archislopVersion: 1,
          theme: 'whiteboard',
          spec: { mark: 'bar', data: { url: 'https://example.com/data.json' } }
        })
      )
    ).toBeNull();
  });
});

describe('graphEditIdFromDescriptor', () => {
  it('prefers AntV indexes, then ~label:, then mermaid id', () => {
    expect(
      graphEditIdFromDescriptor({ kind: 'infographic-item', indexes: '0,0', label: 'Eng' })
    ).toBe('0,0');
    expect(graphEditIdFromDescriptor({ kind: 'metaphor-item', dataId: 'ceo', label: 'CEO' })).toBe(
      'ceo'
    );
    expect(
      graphEditIdFromDescriptor({
        kind: 'chart-mark',
        indexes: '2',
        label: 'Widgets',
        elementType: 'mark'
      })
    ).toBe('2');
    expect(
      graphEditIdFromDescriptor({ kind: 'chart-mark', elementType: 'axis-title', label: 'Revenue' })
    ).toBeNull();
    expect(graphEditIdFromDescriptor({ kind: 'infographic-item', label: 'Eng' })).toBe(
      '~label:Eng'
    );
    expect(graphEditIdFromDescriptor({ dataId: 'A', partName: 'Start' })).toBe('A');
    expect(
      graphEditIdFromDescriptor({ id: 'node_0', partName: 'Root Topic', label: 'Root Topic' })
    ).toBe('~node:0');
    expect(graphEditIdFromDescriptor({ kind: 'edge', dataId: 'A_B' })).toBeNull();
  });
});
