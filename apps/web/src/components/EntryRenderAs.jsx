/**
 * Empty-state "Render as" mode strip. Surfaces the headline differentiator
 * (Diagram / Infographic / 3D / Chart / Anything / Forms) before the user has
 * to open Settings — pick a mode, then generate into it.
 *
 * Presentational only: the caller owns mode state and selection.
 */
export default function EntryRenderAs({
  label,
  hint,
  hintId = 'entry-formats-hint',
  ariaLabel,
  ariaDescribedBy,
  modes,
  currentMode,
  onPickMode,
  pickPrefix,
  disabled = false
}) {
  const options = Array.isArray(modes) ? modes.filter((m) => m && m.id && m.shortLabel) : [];
  if (options.length === 0) return null;

  return (
    <div className="entry-render-as" data-testid="entry-render-as">
      <div className="entry-render-as-copy">
        {label ? <p className="entry-render-as-label">{label}</p> : null}
        {hint ? (
          <p className="entry-render-as-hint" id={hintId}>
            {hint}
          </p>
        ) : null}
      </div>
      <div
        className="entry-render-as-chips"
        role="group"
        aria-label={ariaLabel || label}
        aria-describedby={ariaDescribedBy ?? (hint ? hintId : undefined)}
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`entry-render-as-chip${option.id === currentMode ? ' is-current' : ''}`}
            disabled={disabled}
            onClick={() => onPickMode?.(option.id)}
            title={option.subtitle || option.label}
            aria-pressed={option.id === currentMode}
            aria-label={
              pickPrefix
                ? `${pickPrefix} ${option.shortLabel}${option.techLabel ? ` (${option.techLabel})` : ''}`
                : undefined
            }
          >
            <span className="entry-render-as-chip-label">{option.shortLabel}</span>
            {option.techLabel ? (
              <span className="entry-render-as-chip-tech" aria-hidden="true">
                {option.techLabel}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
