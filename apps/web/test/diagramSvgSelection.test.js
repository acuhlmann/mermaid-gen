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

  it('parses classDiagram v3 unified edge ids (#600)', () => {
    expect(parseFlowchartEdgeDataId('id_Animal_Duck_1')).toEqual({
      from: 'Animal',
      to: 'Duck',
      index: 1,
      raw: 'id_Animal_Duck_1'
    });
  });

  it('parses erDiagram v3 unified edge ids (#600)', () => {
    expect(parseFlowchartEdgeDataId('id_entity-CUSTOMER-0_entity-ORDER-1_0')).toEqual({
      from: 'CUSTOMER',
      to: 'ORDER',
      index: 0,
      raw: 'id_entity-CUSTOMER-0_entity-ORDER-1_0'
    });
  });

  it('parses requirementDiagram hyphenated edge ids (#600)', () => {
    expect(parseFlowchartEdgeDataId('test_entity-test_req-0')).toEqual({
      from: 'test_entity',
      to: 'test_req',
      index: 0,
      raw: 'test_entity-test_req-0'
    });
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
