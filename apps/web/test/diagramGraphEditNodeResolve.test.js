// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  diagramDomAnchor,
  diagramSelectedWrap,
  findFlowchartNodeWrapByLogicalId,
  findInfographicConnectSource,
  findMindmapConnectSource,
  findSequenceParticipantByLogicalId,
  logicalIdFromNodeWrap,
  resolveDiagramNodeWrap
} from '../src/utils/diagramGraphEditNodeResolve.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs = {}, text = '') {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  if (text) el.textContent = text;
  return el;
}

function flowchartFixture() {
  const root = svgEl('svg');
  const nodeGroup = svgEl('g', { class: 'node' });
  const rect = svgEl('rect', {
    id: 'flowchart-Alpha-0',
    x: '0',
    y: '0',
    width: '40',
    height: '20'
  });
  nodeGroup.setAttribute('data-id', 'Alpha');
  nodeGroup.appendChild(rect);
  root.appendChild(nodeGroup);
  return { root, nodeGroup, rect };
}

describe('diagramDomAnchor', () => {
  it('returns the group when it already carries an id', () => {
    const group = svgEl('g', { id: 'flowchart-B-1' });
    expect(diagramDomAnchor(group)).toBe(group);
  });

  it('prefers a direct child id over a deeper nested id', () => {
    const group = svgEl('g', { class: 'node' });
    const direct = svgEl('rect', { id: 'flowchart-A-0' });
    const nested = svgEl('circle', { id: 'flowchart-nested-9' });
    group.appendChild(direct);
    direct.appendChild(nested);
    expect(diagramDomAnchor(group)).toBe(direct);
  });

  it('falls back to the group when no id is present', () => {
    const group = svgEl('g', { class: 'node' });
    group.appendChild(svgEl('rect'));
    expect(diagramDomAnchor(group)).toBe(group);
  });
});

describe('diagramSelectedWrap', () => {
  it('wraps an inner shape id in its parent g.node', () => {
    const { root, nodeGroup, rect } = flowchartFixture();
    expect(diagramSelectedWrap(root, rect.id)).toBe(nodeGroup);
  });

  it('wraps sequence participants by data-et', () => {
    const root = svgEl('svg');
    const participant = svgEl('g', {
      'data-et': 'participant',
      'data-id': 'Alice',
      id: 'seq-participant-Alice-0'
    });
    root.appendChild(participant);
    expect(diagramSelectedWrap(root, participant.id)).toBe(participant);
  });

  it('returns null for missing ids', () => {
    const { root } = flowchartFixture();
    expect(diagramSelectedWrap(root, 'missing-id')).toBeNull();
    expect(diagramSelectedWrap(null, 'flowchart-A-0')).toBeNull();
  });
});

describe('logicalIdFromNodeWrap', () => {
  it('prefers data-id over the rendered element id', () => {
    const { nodeGroup } = flowchartFixture();
    expect(logicalIdFromNodeWrap(nodeGroup)).toBe('Alpha');
  });

  it('normalizes mermaid element ids when data-id is absent', () => {
    const node = svgEl('g', { class: 'node' });
    node.appendChild(svgEl('rect', { id: 'flowchart-Beta-3' }));
    expect(logicalIdFromNodeWrap(node)).toBe('Beta');
  });
});

describe('findInfographicConnectSource', () => {
  it('finds a shape by data-indexes', () => {
    const root = svgEl('svg');
    const shape = svgEl('rect', {
      'data-element-type': 'shape',
      'data-indexes': '2'
    });
    root.appendChild(shape);
    expect(findInfographicConnectSource(root, '2')).toBe(shape);
  });

  it('finds a shape by ~label: title text', () => {
    const root = svgEl('svg');
    const shape = svgEl('rect', { 'data-element-type': 'shape' });
    shape.appendChild(svgEl('title', {}, 'Checkout'));
    root.appendChild(shape);
    expect(findInfographicConnectSource(root, '~label:Checkout')).toBe(shape);
  });
});

describe('findMindmapConnectSource', () => {
  it('matches a mindmap node by visible text', () => {
    const root = svgEl('svg');
    const node = svgEl('g', { class: 'node' }, 'Root Topic');
    root.appendChild(node);
    expect(findMindmapConnectSource(root, 'Root Topic')).toBe(node);
    expect(findMindmapConnectSource(root, '~label:Root Topic')).toBe(node);
  });

  it('matches a mindmap node by its title child', () => {
    const root = svgEl('svg');
    const node = svgEl('g', { class: 'section-root' });
    node.appendChild(svgEl('title', {}, 'Planning'));
    root.appendChild(node);
    expect(findMindmapConnectSource(root, 'Planning')).toBe(node);
  });
});

describe('findFlowchartNodeWrapByLogicalId', () => {
  it('returns the node group for a logical id', () => {
    const { root, nodeGroup } = flowchartFixture();
    expect(findFlowchartNodeWrapByLogicalId(root, 'Alpha')).toBe(nodeGroup);
    expect(findFlowchartNodeWrapByLogicalId(root, 'Missing')).toBeNull();
  });
});

describe('findSequenceParticipantByLogicalId', () => {
  it('finds participants by data-id', () => {
    const root = svgEl('svg');
    const participant = svgEl('g', { 'data-et': 'participant', 'data-id': 'Bob' });
    root.appendChild(participant);
    expect(findSequenceParticipantByLogicalId(root, 'Bob')).toBe(participant);
    expect(findSequenceParticipantByLogicalId(root, 'Carol')).toBeNull();
  });
});

describe('resolveDiagramNodeWrap', () => {
  it('resolves by dom id when descriptor.id is set', () => {
    const { root, nodeGroup, rect } = flowchartFixture();
    expect(resolveDiagramNodeWrap(root, { id: rect.id })).toBe(nodeGroup);
  });

  it('resolves by logical dataId for flowchart and sequence families', () => {
    const flow = flowchartFixture();
    expect(resolveDiagramNodeWrap(flow.root, { dataId: 'Alpha' })).toBe(flow.nodeGroup);

    const seqRoot = svgEl('svg');
    const participant = svgEl('g', { 'data-et': 'participant', 'data-id': 'Alice' });
    seqRoot.appendChild(participant);
    expect(resolveDiagramNodeWrap(seqRoot, { dataId: 'Alice' })).toBe(participant);
  });
});
