/**
 * One-time first-run spotlight that promotes the render modes out of the
 * Settings drawer. It fires once a newcomer has generated their first diagram —
 * the moment they have something worth re-rendering — and names the headline
 * feature: the same topic, shown as a 3D scene, a chart, an infographic, or a
 * freeform page. Picking a mode chip switches the canvas immediately (the same
 * action the buried Settings switcher performs), so discovery and use are one
 * tap apart.
 *
 * Purely presentational: the caller owns the once-ever gate, the mode list, and
 * dismissal.
 */
export default function ModeRevealSpotlight({
  eyebrow,
  body,
  modes,
  currentMode,
  onPickMode,
  pickPrefix,
  dismissLabel,
  ariaLabel,
  onDismiss
}) {
  const options = Array.isArray(modes) ? modes.filter((m) => m && m.id && m.shortLabel) : [];
  if (options.length === 0) return null;

  return (
    <div
      className="mode-reveal-spotlight"
      role="dialog"
      aria-label={ariaLabel}
      data-testid="mode-reveal-spotlight"
    >
      {eyebrow ? <p className="mode-reveal-eyebrow">{eyebrow}</p> : null}
      {body ? <p className="mode-reveal-body">{body}</p> : null}
      <div className="mode-reveal-chips" role="group" aria-label={ariaLabel}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`mode-reveal-chip${option.id === currentMode ? ' is-current' : ''}`}
            onClick={() => onPickMode?.(option.id)}
            title={option.subtitle || option.label}
            aria-label={pickPrefix ? `${pickPrefix} ${option.shortLabel}` : undefined}
          >
            {option.shortLabel}
          </button>
        ))}
      </div>
      <button type="button" className="overlay-button mode-reveal-dismiss" onClick={onDismiss}>
        {dismissLabel}
      </button>
    </div>
  );
}
