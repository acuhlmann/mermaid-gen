// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MetaphorSceneOverlay from '../src/components/MetaphorSceneOverlay.jsx';

afterEach(() => {
  cleanup();
});

function makeCity(scene = {}) {
  return JSON.stringify({
    metaphor: 'city',
    scene,
    items: [{ id: 'a', label: 'A' }],
    links: []
  });
}

describe('MetaphorSceneOverlay', () => {
  it('renders the scene title and subtitle when present', () => {
    const source = makeCity({
      title: 'Payment platform',
      subtitle: 'Production stack',
      legend: { height: 'monthly volume' }
    });
    const { container } = render(<MetaphorSceneOverlay diagramSource={source} />);
    expect(screen.getByText('Payment platform')).toBeTruthy();
    expect(screen.getByText('Production stack')).toBeTruthy();
    expect(container.querySelector('.metaphor-scene-legend')).toBeTruthy();
  });

  it('filters legend axes to those relevant for the active metaphor', () => {
    const source = makeCity({
      title: 'X',
      legend: {
        height: 'monthly volume',
        district: 'team',
        elevation: 'risk',
        weight: 'priority'
      }
    });
    render(<MetaphorSceneOverlay diagramSource={source} />);
    expect(screen.getByText('height')).toBeTruthy();
    expect(screen.getByText('district')).toBeTruthy();
    expect(screen.queryByText('elevation')).toBeNull();
    expect(screen.queryByText('weight')).toBeNull();
  });

  it('returns null when neither title, subtitle, nor relevant legend axes are present', () => {
    const source = makeCity({ legend: { elevation: 'risk' } });
    const { container } = render(<MetaphorSceneOverlay diagramSource={source} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when streaming preview is active', () => {
    const source = makeCity({ title: 'X', legend: { height: 'h' } });
    const { container } = render(
      <MetaphorSceneOverlay diagramSource={source} streamingPreview />
    );
    expect(container.firstChild).toBeNull();
  });

  it('surfaces terrain surface.metric as the elevation axis when legend is missing', () => {
    const source = JSON.stringify({
      metaphor: 'terrain',
      scene: { title: 'Risk map', surface: { metric: 'operational risk', baseline: 0 } },
      items: [{ id: 'p', label: 'Payments', elevation: 12, intensity: 4 }],
      links: []
    });
    render(<MetaphorSceneOverlay diagramSource={source} />);
    expect(screen.getByText('Risk map')).toBeTruthy();
    expect(screen.getByText('elevation')).toBeTruthy();
    expect(screen.getByText('operational risk')).toBeTruthy();
  });

  it('returns null for empty or invalid source', () => {
    const empty = render(<MetaphorSceneOverlay diagramSource="" />);
    expect(empty.container.firstChild).toBeNull();
    empty.unmount();

    const invalid = render(<MetaphorSceneOverlay diagramSource="not json" />);
    expect(invalid.container.firstChild).toBeNull();
  });
});
