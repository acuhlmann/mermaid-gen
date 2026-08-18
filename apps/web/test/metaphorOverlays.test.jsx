// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  MetaphorCompositeLayersOverlay,
  MetaphorKindSwitcher,
  MetaphorReadingOverlay,
  MetaphorTitleOverlay
} from '../src/components/MetaphorOverlays.jsx';
import { createMetaphorHoverStore } from '../src/components/metaphorHover.js';
import { MetaphorHoverTooltip } from '../src/components/MetaphorOverlays.jsx';

const COMPOSITE = {
  metaphor: 'composite',
  scene: {
    title: 'Commerce current',
    subtitle: 'Checkout carries the load',
    legend: {
      mass: 'domain scale',
      height: 'service importance'
    }
  },
  layers: [
    {
      id: 'domains',
      as: 'archipelago',
      label: 'Commerce domains as islands',
      items: [{ id: 'checkout', label: 'Checkout' }]
    },
    {
      id: 'services',
      as: 'city',
      label: 'Services as towers',
      items: [{ id: 'payments-api', label: 'Payments API' }]
    }
  ]
};

describe('MetaphorReadingOverlay', () => {
  it('renders title, thesis, and populated legend chips', () => {
    render(
      <MetaphorReadingOverlay
        scene={COMPOSITE.scene}
        metaphor="composite"
        legend={COMPOSITE.scene.legend}
        thesis="Checkout carries the load"
      />
    );
    expect(screen.getByText('Commerce current')).toBeTruthy();
    expect(screen.getAllByText('Checkout carries the load').length).toBeGreaterThan(0);
    expect(screen.getByText('domain scale')).toBeTruthy();
    expect(screen.getByText('service importance')).toBeTruthy();
  });
});

describe('MetaphorCompositeLayersOverlay', () => {
  it('lists each fused layer with its reading-key label and kind', () => {
    render(<MetaphorCompositeLayersOverlay dsl={COMPOSITE} />);
    expect(screen.getByText('Commerce domains as islands')).toBeTruthy();
    expect(screen.getByText('Services as towers')).toBeTruthy();
    expect(screen.getByText('Archipelago')).toBeTruthy();
    expect(screen.getByText('City')).toBeTruthy();
  });

  it('renders nothing for a base metaphor', () => {
    const { container } = render(
      <MetaphorCompositeLayersOverlay dsl={{ metaphor: 'city', items: [] }} />
    );
    expect(container.textContent).toBe('');
  });
});

describe('MetaphorTitleOverlay', () => {
  it('prints the thesis under the title', () => {
    render(
      <MetaphorTitleOverlay
        scene={{ title: 'Cost of the demo', subtitle: 'Hidden months' }}
        thesis="Never costed; it is most of the work"
      />
    );
    expect(screen.getByText('Cost of the demo')).toBeTruthy();
    expect(screen.getByText('Never costed; it is most of the work')).toBeTruthy();
  });
});

describe('MetaphorHoverTooltip', () => {
  it('names the fused layer the hovered item belongs to', () => {
    const store = createMetaphorHoverStore();
    store.set({
      item: { label: 'Payments API', height: 14 },
      metaphor: 'city',
      layerLabel: 'Services as towers',
      x: 40,
      y: 40
    });
    render(<MetaphorHoverTooltip store={store} legend={{ height: 'importance' }} />);
    expect(screen.getByText('Payments API')).toBeTruthy();
    expect(screen.getByText('Layer: Services as towers')).toBeTruthy();
    expect(screen.getByText('Importance')).toBeTruthy();
    expect(screen.getByText('14')).toBeTruthy();
  });
});

describe('MetaphorKindSwitcher', () => {
  it('is a compact select of every metaphor kind, not a wrap of pills', () => {
    const onSelectKind = vi.fn();
    const { container } = render(
      <MetaphorKindSwitcher metaphor="city" onSelectKind={onSelectKind} />
    );
    const select = container.querySelector('select');
    expect(select).toBeTruthy();
    expect(select.value).toBe('city');
    expect(select.querySelectorAll('option').length).toBeGreaterThan(10);
    expect(container.querySelector('button')).toBeNull();
    fireEvent.change(select, { target: { value: 'river' } });
    expect(onSelectKind).toHaveBeenCalledWith('river');
  });

  it('disables the select when switching is not available', () => {
    const { container } = render(<MetaphorKindSwitcher metaphor="city" disabled />);
    expect(container.querySelector('select').disabled).toBe(true);
  });
});
