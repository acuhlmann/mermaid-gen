// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  MetaphorCompositeLayersOverlay,
  MetaphorKindSwitcher,
  MetaphorReadingOverlay,
  MetaphorTitleOverlay,
  MetaphorTourButton,
  MetaphorTourPanel
} from '../src/components/MetaphorOverlays.jsx';
import {
  CHROME_ATTR,
  measureOverlaySafeArea
} from '../src/components/metaphorScenes/overlaySafeArea.js';
import { createMetaphorHoverStore } from '../src/components/metaphorHover.js';
import { createMetaphorSelectionStore } from '../src/components/metaphorSelection.js';
import { createMetaphorTourStore } from '../src/components/metaphorTourStore.js';
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

const TOUR_CITY = {
  metaphor: 'city',
  scene: {
    title: 'Payments platform',
    subtitle: 'Where the money moves',
    legend: { height: 'monthly volume' }
  },
  items: [
    { id: 'ledger', label: 'Ledger', height: 18 },
    { id: 'gateway', label: 'Gateway', height: 6, accent: true, note: 'Nobody owns it.' }
  ],
  links: []
};

function renderTour(dsl = TOUR_CITY) {
  const store = createMetaphorTourStore();
  const selectionStore = createMetaphorSelectionStore();
  const view = render(
    <>
      <MetaphorTourPanel store={store} selectionStore={selectionStore} legend={dsl.scene?.legend} />
      <MetaphorTourButton store={store} dsl={dsl} />
    </>
  );
  return { store, selectionStore, view };
}

describe('MetaphorTourButton', () => {
  it('offers a read, and offers nothing for a scene with nothing to say', () => {
    const { view } = renderTour();
    expect(view.container.querySelector('.metaphor-tour-start')).toBeTruthy();
    view.unmount();
    const empty = renderTour({ metaphor: 'city', scene: {}, items: [], links: [] });
    expect(empty.view.container.querySelector('.metaphor-tour-start')).toBeNull();
  });

  it('yields to the read once it has started', () => {
    const { view } = renderTour();
    fireEvent.click(view.container.querySelector('.metaphor-tour-start'));
    expect(view.container.querySelector('.metaphor-tour-start')).toBeNull();
    expect(screen.getByText('Payments platform')).toBeTruthy();
  });
});

describe('MetaphorTourPanel', () => {
  it('steps forward through the beats and ends on the last one', () => {
    const { store, view } = renderTour();
    fireEvent.click(view.container.querySelector('.metaphor-tour-start'));
    const total = store.get().beats.length;
    expect(total).toBeGreaterThan(2);
    for (let i = 0; i < total; i += 1) {
      fireEvent.click(view.container.querySelector('.metaphor-tour-nav-btn.is-primary'));
    }
    // Past the last beat the read ENDS rather than wrapping — the start pill
    // is back and the panel is gone.
    expect(view.container.querySelector('.metaphor-tour')).toBeNull();
    expect(view.container.querySelector('.metaphor-tour-start')).toBeTruthy();
  });

  it('rings the beat’s item, and lets go of the ring when the read ends', () => {
    const { store, selectionStore, view } = renderTour();
    fireEvent.click(view.container.querySelector('.metaphor-tour-start'));
    // Beat 1 is the overview and focuses nothing; stepping to the peak rings it.
    while (!selectionStore.get() && store.get().index >= 0) {
      fireEvent.click(view.container.querySelector('.metaphor-tour-nav-btn.is-primary'));
    }
    expect(selectionStore.get()?.item?.id).toBe('ledger');
    fireEvent.click(view.container.querySelector('.metaphor-tour-close'));
    expect(selectionStore.get()).toBeNull();
  });

  it('hands over to a viewer who picks something else, keeping their pick', () => {
    const { store, selectionStore, view } = renderTour();
    fireEvent.click(view.container.querySelector('.metaphor-tour-start'));
    act(() => {
      selectionStore.set({ item: { id: 'gateway', label: 'Gateway' }, metaphor: 'city' });
    });
    expect(store.get().index).toBe(-1);
    // The pick they just made must survive the tour tearing down its own ring.
    expect(selectionStore.get()?.item?.id).toBe('gateway');
  });
});

describe('persistent chrome is measurable', () => {
  // The camera fits the scene into what the panels leave (overlaySafeArea.js).
  // That measurement sweeps `[data-metaphor-chrome]`, and a sweep over a set
  // nothing joins passes while examining nothing — so pin the marking itself,
  // panel by panel, rather than only pinning the maths.
  it.each([
    ['reading strip', <MetaphorReadingOverlay key="r" scene={COMPOSITE.scene} metaphor="city" />],
    ['title card', <MetaphorTitleOverlay key="t" scene={COMPOSITE.scene} />],
    ['layer key', <MetaphorCompositeLayersOverlay key="l" dsl={COMPOSITE} />],
    ['kind switcher', <MetaphorKindSwitcher key="k" metaphor="city" onSelectKind={() => {}} />]
  ])('marks the %s', (_name, element) => {
    const { container } = render(element);
    expect(container.querySelector(`[${CHROME_ATTR}]`)).not.toBeNull();
  });

  it('leaves transient panels out of it', () => {
    // The read and the pick are user-raised and already own the screen through
    // the one-panel CSS rule. Refitting the camera when one opens would slide
    // the scene sideways at the moment the viewer is reading about one item.
    const tourStore = createMetaphorTourStore();
    act(() => tourStore.start([{ id: 'a', title: 'Beat', body: 'Body', focus: null }]));
    const { container } = render(
      <MetaphorTourPanel
        store={tourStore}
        selectionStore={createMetaphorSelectionStore()}
        legend={{}}
      />
    );
    expect(container.querySelector('.metaphor-tour')).not.toBeNull();
    expect(container.querySelector(`[${CHROME_ATTR}]`)).toBeNull();
  });

  it('reports nothing for a container with no measurable box', () => {
    expect(measureOverlaySafeArea(null)).toBeNull();
  });
});
