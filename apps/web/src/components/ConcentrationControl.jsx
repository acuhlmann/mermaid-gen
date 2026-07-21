import { useUiCopy } from '../i18n/useUiLocale.js';

/**
 * Fast / quality model profile toggle — shared by the desk menu footer and the
 * Thinking pane header.
 */
export default function ConcentrationControl({
  modelProfile = 'fast',
  onSelectModelProfile = null,
  variant = 'footer',
  compact = false,
  className = ''
}) {
  const { controls } = useUiCopy();
  const settingsCopy = controls.settings;
  const rootClass = ['concentration-control', `concentration-control--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClass}
      role="group"
      aria-label={settingsCopy.brain}
      title={settingsCopy.concentrationTitle ?? settingsCopy.brain}
      data-testid="concentration-control"
    >
      {compact ? null : (
        <span className="concentration-control-label">
          <span className="concentration-control-emoji" aria-hidden="true">
            🎚️
          </span>
          {settingsCopy.brain}
        </span>
      )}
      <div className="concentration-control-segment">
        <button
          type="button"
          className={`concentration-control-option${modelProfile === 'fast' ? ' is-selected' : ''}`}
          aria-pressed={modelProfile === 'fast'}
          onClick={() => onSelectModelProfile?.('fast')}
        >
          {settingsCopy.fast}
        </button>
        <button
          type="button"
          className={`concentration-control-option${modelProfile === 'quality' ? ' is-selected' : ''}`}
          aria-pressed={modelProfile === 'quality'}
          onClick={() => onSelectModelProfile?.('quality')}
        >
          {settingsCopy.quality}
        </button>
      </div>
    </div>
  );
}
