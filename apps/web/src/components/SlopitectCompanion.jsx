import { useEffect, useRef, useState } from 'react';
import { getVariantPersona, quoteForRotation } from '../utils/slopitectCopy.js';
import { PersonaFace } from './personaFaces/index.jsx';

const VARIANT_CLASS = {
  gilfoyle: 'is-gilfoyle',
  dinesh: 'is-dinesh',
  erlich: 'is-erlich',
  goMad: 'is-go-mad',
  critique: 'is-critique',
  explain: 'is-explain'
};

const QUOTE_ROTATION_MS = 3200;
const EXIT_LINGER_MS = 1100;

/**
 * Floating mascot in the bottom-left during an active run. Shows the persona
 * (name + title + emoji) and a speech bubble that rotates random quotes.
 *
 * App owns lifecycle by passing a fresh `streamSession` key — the component
 * is mounted while a run is active, and on `streaming === false` it plays a
 * brief exit animation before returning null. Timer state lives in async
 * setTimeout/setInterval to avoid synchronous setState within useEffect bodies.
 */
export default function SlopitectCompanion({ variant, streaming = false }) {
  const [rotationIndex, setRotationIndex] = useState(() => Math.floor(Math.random() * 100));
  const [exitDone, setExitDone] = useState(false);
  const exitTimerRef = useRef(null);

  useEffect(() => {
    // Quote rotation only ticks while streaming. setInterval callbacks are async
    // (not flagged as in-effect setState).
    if (!streaming) return undefined;
    const handle = setInterval(() => setRotationIndex((n) => n + 1), QUOTE_ROTATION_MS);
    return () => clearInterval(handle);
  }, [streaming]);

  useEffect(() => {
    // Exit timer fires only when streaming flips false. setState is inside the
    // async setTimeout callback, which is allowed.
    if (streaming) return undefined;
    if (exitDone) return undefined;
    if (exitTimerRef.current) return undefined;
    exitTimerRef.current = setTimeout(() => {
      setExitDone(true);
      exitTimerRef.current = null;
    }, EXIT_LINGER_MS);
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [streaming, exitDone]);

  if (!variant || !VARIANT_CLASS[variant]) return null;
  if (!streaming && exitDone) return null;

  const persona = getVariantPersona(variant);
  const isExiting = !streaming;
  const speechLine = isExiting
    ? persona.exitLine || persona.name
    : quoteForRotation(variant, rotationIndex) || persona.entryLine || '';

  const className = [
    'slopitect-companion',
    VARIANT_CLASS[variant],
    isExiting ? 'is-exiting' : 'is-active'
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} role="status" aria-live="polite" data-testid="slopitect-companion">
      <div className="slopitect-companion-bubble">
        <span className="slopitect-companion-bubble-text">{speechLine}</span>
      </div>
      <div className="slopitect-companion-avatar" aria-hidden="true">
        <PersonaFace id={variant} size={52} className="slopitect-companion-face" />
      </div>
      <div className="slopitect-companion-name-block">
        <span className="slopitect-companion-name">{persona.name}</span>
        <span className="slopitect-companion-title">{persona.title}</span>
      </div>
    </div>
  );
}
