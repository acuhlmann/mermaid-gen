import { ButtonIcon } from './AppIcons.jsx';
import { officeChromeCopy } from '../utils/officeCast.js';

const NOTEBOOK_EMOJI = '📓';

/**
 * Top-level notebook toggle — sits beside the desk tray on the bottom chrome.
 */
export default function DeskNotebookButton({
  thinkingOpen = false,
  onToggleThinking,
  disabled = false,
  disabledTitle = null,
  busy = false
}) {
  const copy = officeChromeCopy().desk;
  const label = thinkingOpen ? copy.thinkingClose : copy.thinking;
  const title = disabled
    ? (disabledTitle ?? copy.blocked?.noThinking)
    : (copy.thinkingTitle ?? label);

  const buttonClass = [
    'overlay-button',
    'compact-button',
    'slop-action-button',
    'is-desk-notebook',
    thinkingOpen ? 'is-active' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={buttonClass}
      aria-pressed={thinkingOpen}
      aria-label={label}
      title={title ?? label}
      disabled={disabled || busy}
      data-testid="desk-notebook-button"
      onClick={() => onToggleThinking?.()}
    >
      <ButtonIcon>
        <span className="action-persona-icon is-desk-notebook" aria-hidden="true">
          {NOTEBOOK_EMOJI}
        </span>
      </ButtonIcon>
      <span className="button-label">{copy.thinkingShort ?? copy.thinking}</span>
      <span className="slop-action-role">
        <span className="slop-action-role-emoji" aria-hidden="true">
          {NOTEBOOK_EMOJI}
        </span>
        {copy.thinkingRole ?? 'Notebook'}
      </span>
    </button>
  );
}
