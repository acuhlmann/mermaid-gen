// @vitest-environment jsdom
/**
 * The pair's hands as mounted: one per pointed box, beside it rather than on
 * it, and inside the fullscreen element when there is one — native fullscreen
 * paints nothing outside it, so a hand portaled to <body> would vanish exactly
 * when someone is working full-screen.
 */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfficePairPointer } from '../src/components/OfficePairPointer.jsx';

const RECTS = {
  'flowchart-Auth-0': { left: 200, top: 80, width: 96, height: 40 },
  'flowchart-Billing-1': { left: 600, top: 80, width: 96, height: 40 }
};

function mountCanvas() {
  const canvas = document.createElement('div');
  canvas.className = 'diagram-zoom-layer';
  canvas.innerHTML = `<svg>
    <g class="node" id="flowchart-Auth-0"><rect></rect></g>
    <g class="node" id="flowchart-Billing-1"><rect></rect></g>
  </svg>`;
  document.body.appendChild(canvas);
  for (const [id, rect] of Object.entries(RECTS)) {
    canvas.querySelector(`#${id}`).getBoundingClientRect = () => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top
    });
  }
  return canvas;
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20);
  });
}

describe('OfficePairPointer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mountCanvas();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('draws one hand per box, each outside its box on the far side', async () => {
    render(<OfficePairPointer focusIds={['flowchart-Auth-0', 'flowchart-Billing-1']} />);
    await settle();
    const hands = [...document.querySelectorAll('[data-testid="office-pair-pointer"]')];
    expect(hands.map((h) => [h.dataset.focusId, h.dataset.side])).toEqual([
      ['flowchart-Auth-0', 'left'],
      ['flowchart-Billing-1', 'right']
    ]);
    // Fingertips sit outside the boxes, so neither label is covered.
    expect(parseFloat(hands[0].style.left)).toBeLessThan(RECTS['flowchart-Auth-0'].left);
    expect(parseFloat(hands[1].style.left)).toBeGreaterThan(
      RECTS['flowchart-Billing-1'].left + RECTS['flowchart-Billing-1'].width
    );
  });

  it('portals into the fullscreen host instead of <body>', async () => {
    const host = document.createElement('div');
    host.className = 'diagram-output';
    document.body.appendChild(host);
    render(<OfficePairPointer focusIds={['flowchart-Auth-0']} host={host} />);
    await settle();
    expect(host.querySelector('[data-testid="office-pair-pointer"]')).toBeTruthy();
  });

  it('draws nothing when nothing is pointed at', async () => {
    render(<OfficePairPointer focusIds={[]} />);
    await settle();
    expect(document.querySelector('[data-testid="office-pair-pointer"]')).toBeNull();
  });
});
