// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  parseFlowchartEdgeDataId,
  parseSequenceMessageDataId,
  resolveSequenceActorInteractionRoot,
  resolveSequenceMessageInteractionRoot,
  resolveTimelineNodeInteractionRoot
} from '../src/utils/diagramSvgSelection.js';

describe('parseFlowchartEdgeDataId', () => {
  it('parses Mermaid L_from_to_index ids', () => {
    expect(parseFlowchartEdgeDataId('L_A_B_0')).toEqual({
      from: 'A',
      to: 'B',
      index: 0,
      raw: 'L_A_B_0'
    });
    expect(parseFlowchartEdgeDataId('L_Draft_PendingReview_1')).toEqual({
      from: 'Draft',
      to: 'PendingReview',
      index: 1,
      raw: 'L_Draft_PendingReview_1'
    });
  });

  it('returns null for non-edge ids', () => {
    expect(parseFlowchartEdgeDataId('flowchart-A-0')).toBeNull();
    expect(parseFlowchartEdgeDataId('')).toBeNull();
    expect(parseFlowchartEdgeDataId(null)).toBeNull();
  });

  it('parses classDiagram v3 unified edge ids without a per-pair index (#613)', () => {
    expect(parseFlowchartEdgeDataId('id_Animal_Duck_1')).toEqual({
      from: 'Animal',
      to: 'Duck',
      raw: 'id_Animal_Duck_1'
    });
    expect(parseFlowchartEdgeDataId('id_Animal_Duck_1')).not.toHaveProperty('index');
  });

  it('parses erDiagram v3 unified edge ids without a per-pair index (#613)', () => {
    expect(parseFlowchartEdgeDataId('id_entity-CUSTOMER-0_entity-ORDER-1_0')).toEqual({
      from: 'CUSTOMER',
      to: 'ORDER',
      raw: 'id_entity-CUSTOMER-0_entity-ORDER-1_0'
    });
    expect(parseFlowchartEdgeDataId('id_entity-CUSTOMER-0_entity-ORDER-1_0')).not.toHaveProperty(
      'index'
    );
  });

  it('parses requirementDiagram hyphenated edge ids without a per-pair index (#613)', () => {
    expect(parseFlowchartEdgeDataId('test_entity-test_req-0')).toEqual({
      from: 'test_entity',
      to: 'test_req',
      raw: 'test_entity-test_req-0'
    });
    expect(parseFlowchartEdgeDataId('test_entity-test_req-0')).not.toHaveProperty('index');
  });
});

describe('parseFlowchartEdgeDataId — stateDiagram-v2 rendered edges (#600)', () => {
  const STATE_EDGE_SVG = `
<svg>
  <g class="node default" id="diagram-1-state-root_start-0">
    <circle cx="32" cy="19" r="4" class="start-state" />
  </g>
  <g class="node statediagram-state" id="diagram-1-state-Still-1">
    <rect x="12" y="54" width="40" height="20" />
    <text>Still</text>
  </g>
  <path
    data-et="edge"
    data-id="edge0"
    class="transition"
    data-points="${btoa(
      JSON.stringify([
        { x: 32, y: 19 },
        { x: 32, y: 54 },
        { x: 32, y: 86 }
      ])
    )}"
  />
</svg>`;

  it('resolves edge0 endpoints from layout geometry', () => {
    document.body.innerHTML = STATE_EDGE_SVG;
    const edge0 = document.querySelector('path[data-id="edge0"]');
    expect(edge0).toBeTruthy();
    expect(parseFlowchartEdgeDataId('edge0', edge0)).toEqual({
      from: '[*]',
      to: 'Still',
      index: 0,
      raw: 'edge0'
    });
  });

  it('returns null for edgeN without the path element', () => {
    expect(parseFlowchartEdgeDataId('edge0')).toBeNull();
  });
});

/*
 * The same four transitions, but as mermaid 11.17.2 actually renders them —
 * captured from `mermaid.render('diagram-1', …)` in this workspace's own
 * jsdom+vitest environment, not drawn by hand. The block above is drawn by
 * hand, and the difference between them is the whole point: mermaid positions
 * every state node with a `transform="translate(x, y)"` on the `g.node` and
 * draws the shape inside it centred on the group's own origin
 * (`rect x="-28" y="-15"`, and the start marker is a bare `<circle r="7">`
 * carrying no `cx`/`cy` at all). Read the shape attributes alone, as the
 * hand-written fixture invites you to, and every node in the diagram reports
 * centre (0, 0), every candidate ties, and the strict `<` in `nearestNode`
 * hands both endpoints to whichever node is first in document order.
 *
 * `data-points` is in dagre layout space — the same space as the translate —
 * so the two only line up once the translate is read.
 *
 * The end marker is elided to `d="M7 0"`: it is four `<path>` bezier blobs of
 * ~2 kB each, and this parser never looks at a `d`. Everything it does look at
 * — ids, the transform, `data-points`, shape attributes — is verbatim.
 */
describe('parseFlowchartEdgeDataId — stateDiagram-v2 as mermaid really renders it (#600)', () => {
  /**
   * stateDiagram-v2
   *   [*] --> Still
   *   Still --> Moving
   *   Moving --> Still
   *   Moving --> [*]
   */
  const REAL_STATE_SVG = `<svg id="diagram-1" class="statediagram"><g><g class="root"><g class="edgePaths">
<path d="M32,19L32,86" id="diagram-1-edge0" data-et="edge" data-id="edge0" data-points="W3sieCI6MzIsInkiOjE5fSx7IngiOjMyLCJ5Ijo1NH0seyJ4IjozMiwieSI6ODZ9XQ=="></path>
<path d="M29.487,100L29.487,164" id="diagram-1-edge1" data-et="edge" data-id="edge1" data-points="W3sieCI6MjkuNDg3MTc5NDg3MTc5NDksInkiOjEwMH0seyJ4IjoxOCwieSI6MTMyfSx7IngiOjI5LjQ4NzE3OTQ4NzE3OTQ5LCJ5IjoxNjR9XQ=="></path>
<path d="M34.513,164L34.513,100" id="diagram-1-edge2" data-et="edge" data-id="edge2" data-points="W3sieCI6MzQuNTEyODIwNTEyODIwNTEsInkiOjE2NH0seyJ4Ijo0NiwieSI6MTMyfSx7IngiOjM0LjUxMjgyMDUxMjgyMDUxLCJ5IjoxMDB9XQ=="></path>
<path d="M32,178L32,245" id="diagram-1-edge3" data-et="edge" data-id="edge3" data-points="W3sieCI6MzIsInkiOjE3OH0seyJ4IjozMiwieSI6MjEwfSx7IngiOjMyLCJ5IjoyNDV9XQ=="></path>
</g><g class="nodes">
<g class="node default" id="diagram-1-state-root_start-0" transform="translate(32, 15)"><circle class="state-start" r="7" width="14" height="14"></circle></g>
<g class="node  statediagram-state " id="diagram-1-state-Still-2" transform="translate(32, 93)"><rect class="basic label-container" rx="5" ry="5" x="-28" y="-15" width="56" height="30"></rect><g class="label" transform="translate(-20, -7)"><text>Still</text></g></g>
<g class="node  statediagram-state " id="diagram-1-state-Moving-3" transform="translate(32, 171)"><rect class="basic label-container" rx="5" ry="5" x="-32" y="-15" width="64" height="30"></rect><g class="label" transform="translate(-24, -7)"><text>Moving</text></g></g>
<g class="node default" id="diagram-1-state-root_end-3" transform="translate(32, 249)"><g class="outer-path"><path d="M7 0" stroke="none" fill="#ECECFF"></path><path d="M7 0" stroke="#333333" fill="none"></path><g><path d="M7 0" stroke="none" fill="#9370DB"></path><path d="M7 0" stroke="#9370DB" fill="none"></path></g></g></g>
</g></g></g></svg>`;

  /** @param {string} dataId */
  function parseRendered(dataId) {
    document.body.innerHTML = REAL_STATE_SVG;
    const pathEl = document.querySelector(`path[data-id="${dataId}"]`);
    expect(pathEl).toBeTruthy();
    return parseFlowchartEdgeDataId(dataId, pathEl);
  }

  it('resolves every transition to the pair the source actually declares', () => {
    // Four distinct edges, four distinct answers. Before the transform was
    // read these all came back `[*] -> [*]` — `root_start` is first in
    // document order and won every tie — so Delete and Rename on any state
    // transition addressed the wrong one, or answered `missing`.
    expect(parseRendered('edge0')).toEqual({ from: '[*]', to: 'Still', index: 0, raw: 'edge0' });
    expect(parseRendered('edge1')).toEqual({
      from: 'Still',
      to: 'Moving',
      index: 1,
      raw: 'edge1'
    });
    expect(parseRendered('edge2')).toEqual({
      from: 'Moving',
      to: 'Still',
      index: 2,
      raw: 'edge2'
    });
    expect(parseRendered('edge3')).toEqual({
      from: 'Moving',
      to: '[*]',
      index: 3,
      raw: 'edge3'
    });
  });

  it('reads the terminal marker as `[*]`, the token the source writes', () => {
    // `state-root_end-N` is a different id from `state-root_start-N`, and only
    // the start form was mapped — so a transition into the final state named a
    // state called `root_end` that appears nowhere in the user's source.
    expect(parseRendered('edge3')?.to).toBe('[*]');
  });

  it('gives the two `[*]` markers of one diagram the same name', () => {
    // Both terminals collapse to the same source token on purpose: `[*]` is
    // what `mermaidStateEdit.js` matches against, and its meaning is fixed by
    // which side of the arrow it sits on.
    expect(parseRendered('edge0')?.from).toBe(parseRendered('edge3')?.to);
  });
});

describe('parseSequenceMessageDataId', () => {
  it('parses Mermaid iN message ids', () => {
    expect(parseSequenceMessageDataId('i0')).toEqual({
      messageId: 0,
      raw: 'i0'
    });
    expect(parseSequenceMessageDataId('i12')).toEqual({
      messageId: 12,
      raw: 'i12'
    });
  });

  it('returns null for non-message ids', () => {
    expect(parseSequenceMessageDataId('L_A_B_0')).toBeNull();
    expect(parseSequenceMessageDataId('')).toBeNull();
    expect(parseSequenceMessageDataId(null)).toBeNull();
  });
});

const SEQUENCE_SVG = `
<svg>
  <g>
    <line data-et="life-line" data-id="Ingestion" class="actor-line" />
    <g data-et="participant" data-type="participant" data-id="Ingestion" id="root-1">
      <rect class="actor actor-top" width="80" height="40" />
      <text class="actor actor-box">Ingestion</text>
    </g>
  </g>
</svg>
`;

const TIMELINE_SVG = `
<svg>
  <g class="timeline-node section-0">
    <g>
      <path id="diagram-1-node-0" class="node-bkg" d="M0 0" />
    </g>
    <g>
      <text><tspan>Dev Types</tspan></text>
    </g>
  </g>
</svg>
`;

describe('resolveTimelineNodeInteractionRoot', () => {
  it('resolves clicks on timeline node background path', () => {
    document.body.innerHTML = TIMELINE_SVG;
    const path = document.querySelector('path.node-bkg');
    const hit = resolveTimelineNodeInteractionRoot(path);
    expect(hit?.groupEl?.classList.contains('timeline-node')).toBe(true);
  });

  it('resolves clicks on timeline node label text', () => {
    document.body.innerHTML = TIMELINE_SVG;
    const tspan = document.querySelector('tspan');
    const hit = resolveTimelineNodeInteractionRoot(tspan);
    expect(hit?.groupEl?.classList.contains('timeline-node')).toBe(true);
  });
});

describe('resolveSequenceActorInteractionRoot', () => {
  it('resolves participant box clicks via data-et group', () => {
    document.body.innerHTML = SEQUENCE_SVG;
    const rect = document.querySelector('rect.actor-top');
    const hit = resolveSequenceActorInteractionRoot(rect);
    expect(hit?.dataId).toBe('Ingestion');
    expect(hit?.groupEl?.getAttribute('data-et')).toBe('participant');
  });

  it('resolves lifeline clicks to the participant group', () => {
    document.body.innerHTML = SEQUENCE_SVG;
    const line = document.querySelector('[data-et="life-line"]');
    const hit = resolveSequenceActorInteractionRoot(line);
    expect(hit?.dataId).toBe('Ingestion');
    expect(hit?.groupEl?.getAttribute('data-et')).toBe('participant');
  });

  it('resolves bottom actor boxes via name attribute (no data-et on footer actors)', () => {
    document.body.innerHTML = `
<svg>
  <g class="actor actor-bottom" name="Storage">
    <rect class="actor actor-bottom" width="80" height="40" />
    <text class="actor actor-box">Storage</text>
  </g>
</svg>`;
    const rect = document.querySelector('rect.actor-bottom');
    const hit = resolveSequenceActorInteractionRoot(rect);
    expect(hit?.dataId).toBe('Storage');
    expect(hit?.groupEl?.getAttribute('name')).toBe('Storage');
  });
});

describe('resolveSequenceMessageInteractionRoot', () => {
  const MESSAGE_SVG = `
<svg>
  <g>
    <text class="messageText" x="10" y="10">Hello world</text>
    <line data-et="message" data-id="i1" data-from="Alice" data-to="Bob" class="messageLine0" x1="0" y1="0" x2="100" y2="0" />
  </g>
</svg>`;

  it('resolves clicks on message labels', () => {
    document.body.innerHTML = MESSAGE_SVG;
    const text = document.querySelector('text.messageText');
    const hit = resolveSequenceMessageInteractionRoot(text);
    expect(hit?.dataId).toBe('i1');
    expect(hit?.from).toBe('Alice');
    expect(hit?.to).toBe('Bob');
    expect(hit?.label).toBe('Hello world');
  });

  it('resolves clicks on message arrow lines', () => {
    document.body.innerHTML = MESSAGE_SVG;
    const line = document.querySelector('[data-et="message"]');
    const hit = resolveSequenceMessageInteractionRoot(line);
    expect(hit?.dataId).toBe('i1');
    expect(hit?.from).toBe('Alice');
    expect(hit?.to).toBe('Bob');
  });
});
