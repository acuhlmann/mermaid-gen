import { useEffect, useRef, useState } from 'react';
import { getVariantPersona } from '../utils/slopitectCopy.js';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';

const VARIANT_CLASS = {
  gilfoyle: 'is-gilfoyle',
  dinesh: 'is-dinesh',
  erlich: 'is-erlich',
  goMad: 'is-go-mad',
  jared: 'is-jared',
  explain: 'is-explain'
};

function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Top-right live-run indicator. Visible only while a variant is actively
 * streaming. App passes `streamSession` (a counter that bumps each new run);
 * we use it as a React `key` source so a fresh mount resets the clock without
 * needing in-effect setState.
 */
export default function LiveRunHud({ variant, streaming = false, streak = 0 }) {
  const { controls } = useUiCopy();
  const startRef = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!streaming) return undefined;
    startRef.current = Date.now();
    const handle = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 500);
    return () => clearInterval(handle);
  }, [streaming]);

  if (!streaming || !variant || !VARIANT_CLASS[variant]) return null;
  const persona = getVariantPersona(variant);
  const variantLabel = controls.actions[variant] ?? persona.name;

  return (
    <div
      className={`live-run-hud ${VARIANT_CLASS[variant]}`}
      role="status"
      aria-live="off"
      data-testid="live-run-hud"
    >
      <span className="live-run-hud-emoji" aria-hidden="true">
        <PersonaFace id={variant} size={22} />
      </span>
      <span className="live-run-hud-label">{variantLabel}</span>
      <span className="live-run-hud-clock">{formatElapsed(elapsedMs)}</span>
      {streak >= 2 ? (
        <span
          className="live-run-hud-streak"
          title={`${variantLabel} ${controls.gamificationHud.streak}`}
        >
          🔥 ×{streak}
        </span>
      ) : null}
    </div>
  );
}
