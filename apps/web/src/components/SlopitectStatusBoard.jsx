import { getVariantPersona, phaseCeremonyLabel } from '../utils/slopitectCopy.js';
import { PersonaFace } from './personaFaces/index.jsx';

const VARIANT_CSS_CLASS = {
  gilfoyle: 'is-variant-gilfoyle',
  dinesh: 'is-variant-dinesh',
  erlich: 'is-variant-erlich',
  russ: 'is-variant-russ',
  jared: 'is-variant-jared',
  richard: 'is-variant-richard'
};

/**
 * Headline-style "current ceremony" indicator above the phase list. Pulls the
 * latest phase from the entry's `phases` array and re-labels it with
 * Slopitect-flavored copy from `slopitectCopy.js`. Falls back to the canonical
 * server-supplied label when no override exists.
 *
 * Rendered only for actively streaming entries — once done/failed/cancelled,
 * the existing per-phase trail tells the story.
 */
export default function SlopitectStatusBoard({ variant, phases, totalSteps }) {
  if (!Array.isArray(phases) || phases.length === 0) return null;
  const latest = phases[phases.length - 1];
  if (!latest || !latest.id) return null;
  const ceremonyLabel = phaseCeremonyLabel(variant, latest.id, latest.label);
  const className = `slopitect-status-board ${VARIANT_CSS_CLASS[variant] || ''}`.trim();
  const step = phases.length;
  const stepHint = totalSteps && totalSteps > step ? ` / ${totalSteps}` : '';
  const persona = getVariantPersona(variant);

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      data-testid="slopitect-status-board"
    >
      <span className="slopitect-status-board-dot" aria-hidden="true" />
      <span className="slopitect-status-board-persona" title={persona.title}>
        <span className="slopitect-status-board-emoji" aria-hidden="true">
          <PersonaFace id={variant} size={20} />
        </span>
        {persona.name}
      </span>
      <span className="slopitect-status-board-label">{ceremonyLabel}</span>
      <span className="slopitect-status-board-step" aria-hidden="true">
        Phase {step}
        {stepHint}
      </span>
    </div>
  );
}
