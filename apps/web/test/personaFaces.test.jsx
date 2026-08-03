// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { PersonaFace } from '../src/components/personaFaces/index.jsx';
import {
  PERSONA_FACE_TRAITS,
  PLAYER_FACE_ID,
  PLAYER_FACE_TRAITS
} from '../src/components/personaFaces/registry.js';
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

  // Drift guard for the actor-likeness trait space: a typo'd enum value
  // silently falls back to the default drawing, which is invisible in tests
  // that only assert "an svg rendered".
  it('draws the player too, without adding them to the cast', () => {
    /*
     * Slice 13. You used to fall through the unknown-id branch to a 🙋, which an
     * accessory cannot ride on — and "show me wearing the headphones I just
     * turned on" is the whole point of the Admin posture reaching the floor.
     * The row lives beside `PERSONA_FACE_TRAITS` rather than in it, because the
     * key-set guard above says that object is exactly the cast.
     */
    expect(Object.keys(PERSONA_FACE_TRAITS)).not.toContain(PLAYER_FACE_ID);
    const { container } = render(<PersonaFace id={PLAYER_FACE_ID} fallbackEmoji="🙋" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.textContent).not.toContain('🙋');
  });

  it('gives the player a face no colleague already has', () => {
    // Same distinctness rule the cast lives under: you are somebody in this
    // office, not a second Chad.
    const { container: player } = render(<PersonaFace id={PLAYER_FACE_ID} />);
    const mine = player.querySelector('svg').innerHTML;
    cleanup();
    for (const id of ALL_IDS) {
      const { container } = render(<PersonaFace id={id} />);
      expect(container.querySelector('svg').innerHTML, `you are drawn as ${id}`).not.toBe(mine);
      cleanup();
    }
  });

  it('keeps every trait row inside the supported enums', () => {
    const enums = {
      faceShape: ['oval', 'long', 'round', 'square'],
      brows: ['thin', 'straight', 'thick', 'bushy'],
      eyes: ['dot', 'lidded', 'round', 'deep', 'almond'],
      nose: ['button', 'straight', 'broad'],
      top: ['hoodie', 'tee', 'sweater', 'oxford', 'vneck', 'hawaiian', 'blazer'],
      build: ['slim', 'regular', 'broad']
    };
    const rows = { ...PERSONA_FACE_TRAITS, [PLAYER_FACE_ID]: PLAYER_FACE_TRAITS };
    for (const [id, row] of Object.entries(rows)) {
      for (const [field, allowed] of Object.entries(enums)) {
        expect(allowed, `${id}.${field}`).toContain(row[field]);
      }
    }
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
