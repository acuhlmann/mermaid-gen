// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  resolveSequenceActorInteractionRoot,
  resolveSequenceMessageInteractionRoot,
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
