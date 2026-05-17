// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  resolveSequenceActorInteractionRoot,
  resolveTimelineNodeInteractionRoot
} from '../src/utils/diagramSvgSelection.js';

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
});
