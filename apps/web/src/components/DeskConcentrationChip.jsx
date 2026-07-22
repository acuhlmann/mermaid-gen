import { useUiCopy } from '../i18n/useUiLocale.js';

/**
 * Rush job / Deep work toggle on the bottom chrome — same row as the notebook.
 */
export default function DeskConcentrationChip({
  modelProfile = 'fast',
  onSelectModelProfile,
  disabled = false
}) {
  const { controls } = useUiCopy();
  const settingsCopy = controls.settings;

  return (
    <div
      className="desk-concentration-chip"
      role="group"
      aria-label={settingsCopy.brain}
      title={settingsCopy.concentrationTitle ?? settingsCopy.brain}
      data-testid="desk-concentration-chip"
    >
      <button
        type="button"
        className={`desk-concentration-chip-option${modelProfile === 'fast' ? ' is-selected' : ''}`}
        aria-pressed={modelProfile === 'fast'}
        aria-label={settingsCopy.fast}
        title={settingsCopy.fast}
        disabled={disabled}
        onClick={() => onSelectModelProfile?.('fast')}
      >
        <span className="desk-concentration-chip-emoji" aria-hidden="true">
          ⚡
        </span>
        <span className="desk-concentration-chip-label">
          {settingsCopy.fastShort ?? settingsCopy.fast}
        </span>
      </button>
      <button
        type="button"
        className={`desk-concentration-chip-option${modelProfile === 'quality' ? ' is-selected' : ''}`}
        aria-pressed={modelProfile === 'quality'}
        aria-label={settingsCopy.quality}
        title={settingsCopy.quality}
        disabled={disabled}
        onClick={() => onSelectModelProfile?.('quality')}
      >
        <span className="desk-concentration-chip-emoji" aria-hidden="true">
          🧠
        </span>
        <span className="desk-concentration-chip-label">
          {settingsCopy.qualityShort ?? settingsCopy.quality}
        </span>
      </button>
    </div>
  );
}
