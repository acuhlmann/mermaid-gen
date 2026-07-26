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
        <PlanBeatCard
          beat={{ text, source: 'agent' }}
          variant="goMad"
          index={0}
          contentType="metaphor3d"
        />
      </ul>
    );

    const preview = screen.getByTestId('insights-embedded-diagram');
    expect(preview.getAttribute('aria-label')).toBe('3D metaphor preview (read-only)');
    expect(screen.getByText('Sketching the 3D terrain first.')).toBeTruthy();
    // The JSON body must not leak into the card as per-line "steps".
    expect(screen.queryByText(/"metaphor"/)).toBeNull();
    expect(screen.queryByText(/"whiteboard"/)).toBeNull();
  });

  it('renders metaphor3d source context preview when converting to anything', () => {
    const metaphor = {
      metaphor: 'river',
      scene: { theme: 'whiteboard', camera: 'cinematic', title: 'OAuth 2.0' },
      items: [{ id: 'auth', label: 'Auth', elevation: 8 }],
      links: []
    };
    const text = `Emit a fresh, complete HTML document. The user is converting from metaphor3d. Use this as the subject context (do NOT translate 1:1):\n\n\`\`\`\n${JSON.stringify(metaphor, null, 2)}\n\`\`\``;
    render(
      <ul>
        <PlanBeatCard
          beat={{ text, source: 'agent' }}
          variant="refine"
          index={0}
          contentType="anything"
        />
      </ul>
    );

    const preview = screen.getByTestId('insights-embedded-diagram');
    expect(preview.getAttribute('aria-label')).toBe('3D metaphor preview (read-only)');
    expect(screen.getByTestId('plan-source-context-badge')).toBeTruthy();
    expect(screen.getByText('Source context')).toBeTruthy();
    expect(screen.queryByText(/"metaphor"/)).toBeNull();
  });

  it('renders anything source context preview when converting to chart', () => {
    const html = `<!DOCTYPE html>
<html><body><h1>Sales dashboard</h1><canvas id="chart"></canvas></body></html>`;
    const text = `Build a Vega-Lite chart from this page. Converting from anything — subject context:\n\n\`\`\`html\n${html}\n\`\`\``;
    render(
      <ul>
        <PlanBeatCard
          beat={{ text, source: 'agent' }}
          variant="barker"
          index={0}
          contentType="chart"
        />
      </ul>
    );

    const preview = screen.getByTestId('insights-embedded-diagram');
    expect(preview.getAttribute('aria-label')).toBe('Page preview (read-only)');
    expect(screen.getByTestId('plan-source-context-badge')).toBeTruthy();
    expect(screen.queryByText(/<!DOCTYPE html>/)).toBeNull();
  });

  it('renders mermaid source context preview when converting to forms', () => {
    const text = `Using the Mermaid diagram as subject context for this view.

flowchart LR
  Auth --> API
  API --> DB`;
    render(
      <ul>
        <PlanBeatCard
          beat={{ text, source: 'server' }}
          variant="intent"
          index={0}
          contentType="forms"
        />
      </ul>
    );

    expect(screen.getByTestId('insights-embedded-diagram')).toBeTruthy();
    expect(screen.getByTestId('plan-source-context-badge')).toBeTruthy();
    expect(screen.queryByText(/flowchart LR/)).toBeNull();
  });

  it('renders forms preview for a fenced forms JSON plan beat', () => {
    const forms = JSON.stringify({
      archislopFormsVersion: 1,
      formTitle: 'OAuth Intake',
      messages: [
        { createSurface: {} },
        {
          updateComponents: {
            components: [
              { id: 'root', component: 'Column', children: ['name', 'bt', 'b'] },
              { id: 'name', component: 'TextField', label: 'Name', value: { path: '/name' } },
              { id: 'bt', component: 'Text', text: 'Submit' },
              {
                id: 'b',
                component: 'Button',
                child: 'bt',
                action: { event: { name: 'archislop_submitForm' } }
              }
            ]
          }
        },
        { updateDataModel: { path: '/', value: { name: '' } } }
      ]
    });
    const text = `Drafting the intake paperwork.\n\n\`\`\`json\n${forms}\n\`\`\``;
    render(
      <ul>
        <PlanBeatCard
          beat={{ text, source: 'agent' }}
          variant="intent"
          index={0}
          contentType="forms"
        />
      </ul>
    );

    const preview = screen.getByTestId('insights-embedded-diagram');
    expect(preview.getAttribute('aria-label')).toBe('Form preview (read-only)');
    expect(screen.queryByText(/"archislopFormsVersion"/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
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
        <PlanBeatCard
          beat={{ text, source: 'agent' }}
          variant="refine"
          index={0}
          contentType="anything"
        />
      </ul>
    );

    const preview = screen.getByTestId('insights-embedded-diagram');
    expect(preview.getAttribute('aria-label')).toBe('Page preview (read-only)');
    expect(screen.getByText('Current HTML document:')).toBeTruthy();
    expect(screen.queryByText('```html')).toBeNull();
    expect(screen.queryByText(/<!DOCTYPE html>/)).toBeNull();
  });

  it('renders a mermaid preview for peer-context prose during a 3D run', () => {
    const text = `Using the Mermaid diagram as subject context for this view.

flowchart LR
  Auth --> API
  API --> DB`;
    render(
      <ul>
        <PlanBeatCard
          beat={{ text, source: 'agent' }}
          variant="goMad"
          index={0}
          contentType="metaphor3d"
        />
      </ul>
    );

    expect(screen.getByTestId('insights-embedded-diagram')).toBeTruthy();
    expect(screen.getByTestId('plan-source-context-badge')).toBeTruthy();
    expect(screen.getByText(/Using the Mermaid diagram as subject context/)).toBeTruthy();
  });

  it('syntax-highlights fenced code that is not a diagram preview', () => {
    const text = `Here is the config stub.\n\n\`\`\`json\n{"retry": true, "max": 3}\n\`\`\``;
    render(
      <ul>
        <PlanBeatCard beat={{ text, source: 'server' }} index={2} contentType="chart" />
      </ul>
    );

    expect(screen.queryByTestId('insights-embedded-diagram')).toBeNull();
    expect(screen.getByTestId('thinking-syntax-code')).toBeTruthy();
    expect(screen.getByText('Here is the config stub.')).toBeTruthy();
  });

  it('replaces a duplicate preview with a same-as-above note when reusePreview is set', () => {
    const text = `Using the Mermaid diagram as subject context for this view.

flowchart LR
  Auth --> API
  API --> DB`;
    render(
      <ul>
        <PlanBeatCard
          beat={{ text, source: 'server' }}
          variant="intent"
          index={1}
          contentType="forms"
          reusePreview
        />
      </ul>
    );

    expect(screen.queryByTestId('insights-embedded-diagram')).toBeNull();
    expect(screen.getByTestId('plan-preview-reuse')).toBeTruthy();
    expect(screen.getByText(/Same diagram as above/)).toBeTruthy();
    expect(screen.getByText(/Using the Mermaid diagram as subject context/)).toBeTruthy();
  });
});
