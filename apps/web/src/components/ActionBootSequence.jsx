import { useEffect, useState } from 'react';
import { VARIANT_BOOT_HEADLINES, getVariantPersona } from '../utils/slopitectCopy.js';

const VARIANT_DURATION_MS = {
  refine: 660,
  innovate: 660,
  goMad: 820,
  critique: 700,
  explain: 700
};
const DEFAULT_DURATION_MS = 520;
const REDUCED_DURATION_MS = 200;

const VARIANT_CSS_CLASS = {
  refine: 'is-refine',
  innovate: 'is-innovate',
  goMad: 'is-go-mad',
  critique: 'is-critique',
  explain: 'is-explain'
};

/**
 * Short overlay that fires the moment a user picks an action — before any SSE
 * tokens arrive. Variant-specific animation tracks live in App.css under
 * `.boot-sequence-overlay.is-*`. Reduced-motion swaps to a quick fade.
 *
 * Driven by a `trigger` prop: every time `trigger` changes (incrementing
 * counter), a new boot animation plays. Persona name fades in below the
 * headline midway through.
 */
export default function ActionBootSequence({ trigger, variant }) {
  const [playing, setPlaying] = useState(null);

  useEffect(() => {
    if (trigger == null) return undefined;
    if (!variant || !VARIANT_CSS_CLASS[variant]) return undefined;

    const reduceMotion =
      typeof globalThis.matchMedia === 'function' &&
      globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms = reduceMotion
      ? REDUCED_DURATION_MS
      : (VARIANT_DURATION_MS[variant] ?? DEFAULT_DURATION_MS);

    const token = { variant, trigger };
    setPlaying(token);
    const handle = setTimeout(() => {
      setPlaying((current) => (current === token ? null : current));
    }, ms);
    return () => clearTimeout(handle);
  }, [trigger, variant]);

  if (!playing) return null;

  const className = `boot-sequence-overlay ${VARIANT_CSS_CLASS[playing.variant] || ''}`.trim();
  const headline = VARIANT_BOOT_HEADLINES[playing.variant] || '';
  const persona = getVariantPersona(playing.variant);

  return (
    <div className={className} aria-hidden="true" data-testid="boot-sequence">
      <div className="boot-sequence-flash" />
      {playing.variant === 'goMad' ? <div className="boot-bonk-flash" /> : null}
      {playing.variant === 'goMad' ? <div className="boot-hardhat">🪖</div> : null}
      {playing.variant === 'critique' ? <div className="boot-clipboard">📋</div> : null}
      {playing.variant === 'explain' ? <div className="boot-scroll">📜</div> : null}
      {playing.variant === 'refine' ? <div className="boot-sparkle">✨</div> : null}
      {playing.variant === 'innovate' ? <div className="boot-bolt">⚡</div> : null}
      <span className="boot-sequence-headline">{headline}</span>
      <span className="boot-sequence-persona-name">{persona.name}</span>
      <span className="boot-sequence-persona-title">{persona.title}</span>
    </div>
  );
}
