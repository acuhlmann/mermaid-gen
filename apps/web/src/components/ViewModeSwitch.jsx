import './ViewModeSwitch.css';

/**
 * The two screens a person can be on, as one labelled switch.
 *
 * Rendered in the same top-bar spot on both screens (simple studio and desk)
 * so switching is a habit, not a hunt: the current screen is pressed, the
 * other is one click. Copy arrives from the bundle; the office side falls
 * back to the studio strings so there is exactly one set of labels to learn.
 *
 * @param {{
 *   current: 'simple' | 'office',
 *   label?: string,
 *   simpleLabel?: string,
 *   officeLabel?: string,
 *   officeHint?: string,
 *   onSelectSimple?: () => void,
 *   onSelectOffice?: () => void
 * }} props
 */
export default function ViewModeSwitch({
  current,
  label,
  simpleLabel,
  officeLabel,
  officeHint,
  onSelectSimple,
  onSelectOffice
}) {
  return (
    <div
      className="view-mode-switch"
      role="group"
      aria-label={label ?? 'Screen'}
      data-testid="view-mode-switch"
    >
      <button
        type="button"
        className={`view-mode-switch-option${current === 'simple' ? ' is-current' : ''}`}
        aria-pressed={current === 'simple'}
        aria-current={current === 'simple' ? 'page' : undefined}
        data-testid="view-mode-simple"
        onClick={() => {
          if (current !== 'simple') onSelectSimple?.();
        }}
      >
        {simpleLabel ?? 'Simple'}
      </button>
      <button
        type="button"
        className={`view-mode-switch-option${current === 'office' ? ' is-current' : ''}`}
        aria-pressed={current === 'office'}
        aria-current={current === 'office' ? 'page' : undefined}
        title={officeHint}
        data-testid="view-mode-office"
        onClick={() => {
          if (current !== 'office') onSelectOffice?.();
        }}
      >
        {officeLabel ?? 'Office'}
      </button>
    </div>
  );
}
