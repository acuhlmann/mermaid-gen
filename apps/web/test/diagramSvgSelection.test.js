// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resolveSequenceActorInteractionRoot } from '../src/utils/diagramSvgSelection.js';

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
