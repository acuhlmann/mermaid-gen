// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { PersonaFace } from '../src/components/personaFaces/index.jsx';
import { PERSONA_FACE_TRAITS } from '../src/components/personaFaces/registry.js';
import { CAST_TIERS } from '../src/utils/castTiers.js';

afterEach(cleanup);

const ALL_IDS = [...CAST_TIERS.team, ...CAST_TIERS.senior, ...CAST_TIERS.office];

describe('PersonaFace', () => {
  // Drift guard: a cast member without a trait row silently falls back to
  // emoji, which is exactly the thing this component replaced.
  it('has a trait row for every cast member', () => {
    expect(Object.keys(PERSONA_FACE_TRAITS).sort()).toEqual([...ALL_IDS].sort());
  });

  it('renders an svg face for every cast member', () => {
    for (const id of ALL_IDS) {
      const { container } = render(<PersonaFace id={id} />);
      const svg = container.querySelector('svg');
      expect(svg, `${id} should render an svg`).toBeTruthy();
      expect(svg.getAttribute('data-persona-face')).toBe(id);
      cleanup();
    }
  });

  it('gives each cast member a visually distinct face', () => {
    const shapes = new Set();
    for (const id of ALL_IDS) {
      const { container } = render(<PersonaFace id={id} />);
      shapes.add(container.querySelector('svg').innerHTML);
      cleanup();
    }
    expect(shapes.size).toBe(ALL_IDS.length);
  });

  it('falls back to emoji for an unknown id rather than rendering blank', () => {
    const { container } = render(<PersonaFace id="not-a-colleague" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent.trim().length).toBeGreaterThan(0);
  });

  it('drops fine detail at small sizes', () => {
    const { container: big } = render(<PersonaFace id="greybeard" size={56} />);
    const bigMarkup = big.querySelector('svg').innerHTML;
    cleanup();
    const { container: small } = render(<PersonaFace id="greybeard" size={20} />);
    const smallSvg = small.querySelector('svg');
    expect(smallSvg.getAttribute('data-detail')).toBe('low');
    // Silhouette survives, ornament does not.
    expect(smallSvg.innerHTML.length).toBeLessThan(bigMarkup.length);
  });

  it('stays aria-hidden unless given a title', () => {
    const { container } = render(<PersonaFace id="hr" />);
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
    cleanup();
    const { container: titled } = render(<PersonaFace id="hr" title="Linda" />);
    expect(titled.querySelector('svg').getAttribute('aria-hidden')).toBeNull();
    expect(titled.querySelector('title').textContent).toBe('Linda');
  });

  it('can omit the accent ring when an outer frame already provides one', () => {
    const { container: ringed } = render(<PersonaFace id="hr" />);
    const ringedCircles = ringed.querySelectorAll('svg > circle').length;
    cleanup();
    const { container: plain } = render(<PersonaFace id="hr" accentRing={false} />);
    expect(plain.querySelectorAll('svg > circle').length).toBeLessThan(ringedCircles);
    expect(plain.querySelectorAll('svg > circle').length).toBe(0);
  });
});
