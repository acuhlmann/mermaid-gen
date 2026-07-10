// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanBeatCard from '../src/components/PlanBeatCard.tsx';

beforeEach(() => {
  // Keep the metaphor preview's lazy WebGL canvas unmounted: the observer never
  // reports intersection, so only the preview shell renders under jsdom.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const METAPHOR_DSL = {
  metaphor: 'terrain',
  scene: { theme: 'whiteboard', camera: 'cinematic', title: 'Mushroom Scores' },
  items: [
    { id: 'porcini', label: 'Porcini', elevation: 9, intensity: 4 },
    { id: 'morel', label: 'Morel', elevation: 7, intensity: 3 }
  ],
  links: []
};

describe('PlanBeatCard', () => {
  it('renders a preview shell instead of raw DSL lines for a fenced metaphor JSON beat', () => {
    const text = `Sketching the 3D terrain first.\n\n\`\`\`\n${JSON.stringify(METAPHOR_DSL, null, 2)}\n\`\`\``;
    render(
      <ul>
        <PlanBeatCard beat={{ text, source: 'agent' }} variant="goMad" index={0} />
      </ul>
    );

    const preview = screen.getByTestId('insights-embedded-diagram');
    expect(preview.getAttribute('aria-label')).toBe('3D metaphor preview (read-only)');
    expect(screen.getByText('Sketching the 3D terrain first.')).toBeTruthy();
    // The JSON body must not leak into the card as per-line "steps".
    expect(screen.queryByText(/"metaphor"/)).toBeNull();
    expect(screen.queryByText(/"whiteboard"/)).toBeNull();
  });

  it('still renders plain multi-step beats as an ordered list', () => {
    const text = '1. Inventory the services\n2. Group them by domain\n3. Draw the flows';
    render(
      <ul>
        <PlanBeatCard beat={{ text, source: 'server' }} index={1} />
      </ul>
    );

    expect(screen.queryByTestId('insights-embedded-diagram')).toBeNull();
    expect(screen.getByText('Inventory the services')).toBeTruthy();
    expect(screen.getByText('Draw the flows')).toBeTruthy();
  });

  it('renders an HTML preview instead of raw fenced markup for an anything plan beat', () => {
    const html = `<!DOCTYPE html>
<html>
<head><title>Photosynthesis</title></head>
<body><h1>Photosynthesis</h1></body>
</html>`;
    const text = `Current HTML document:\n\n\`\`\`html\n${html}\n\`\`\``;
    render(
      <ul>
        <PlanBeatCard beat={{ text, source: 'agent' }} variant="refine" index={0} />
      </ul>
    );

    const preview = screen.getByTestId('insights-embedded-diagram');
    expect(preview.getAttribute('aria-label')).toBe('Page preview (read-only)');
    expect(screen.getByText('Current HTML document:')).toBeTruthy();
    expect(screen.queryByText('```html')).toBeNull();
    expect(screen.queryByText(/<!DOCTYPE html>/)).toBeNull();
  });
});
