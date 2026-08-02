import { ButtonIcon } from './AppIcons.jsx';
import { formatLocale } from '../i18n/formatLocale.js';
import { officeChromeCopy } from '../utils/officeCast.js';
import { resolveNotebookLiveCue } from '../utils/resolveNotebookLiveCue.js';

const NOTEBOOK_EMOJI = '📓';

/**
 * Top-level notebook toggle — sits beside the desk tray on the bottom chrome.
 * When a run is live and the pane is closed, shows a subtle scribble pulse plus
 * a compact status chip so canvas-focused users still know work is in flight.
 */
export default function DeskNotebookButton({
  thinkingOpen = false,
  onToggleThinking,
  disabled = false,
  disabledTitle = null,
  liveEntry = null,
  busy = false
}) {
  const copy = officeChromeCopy().desk;
  const liveCue = !thinkingOpen && !disabled ? resolveNotebookLiveCue(liveEntry, busy, copy) : null;
  const label = thinkingOpen ? copy.thinkingClose : copy.thinking;
  const liveTitle = liveCue
    ? formatLocale(copy.thinkingLiveTitle ?? 'Still scribbling under the lid · {status}', {
        status: liveCue.statusLine,
        name: liveCue.name ?? ''
      })
    : null;
  const title = disabled
    ? (disabledTitle ?? copy.blocked?.noThinking)
    : (liveTitle ?? copy.thinkingTitle ?? label);
  const ariaLabel = liveCue
    ? formatLocale(copy.thinkingLiveAria ?? 'Notebook still writing: {status}. Open to watch.', {
        status: liveCue.statusLine,
        name: liveCue.name ?? ''
      })
    : label;

  const buttonClass = [
    'overlay-button',
    'compact-button',
    'slop-action-button',
    'is-desk-notebook',
    thinkingOpen ? 'is-active' : '',
    liveCue ? 'is-live-run' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`desk-notebook-cluster${liveCue ? ' is-live' : ''}`}
      data-testid="desk-notebook-cluster"
    >
      {liveCue ? (
        <button
          type="button"
          className="desk-notebook-live-cue"
          data-testid="desk-notebook-live-cue"
          title={liveTitle ?? liveCue.statusLine}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => onToggleThinking?.()}
        >
          <span className="desk-notebook-live-dot" aria-hidden="true" />
          <span className="desk-notebook-live-who" aria-hidden="true">
            {liveCue.emoji}
          </span>
          <span className="desk-notebook-live-text">{liveCue.statusLine}</span>
        </button>
      ) : null}
      <button
        type="button"
        className={buttonClass}
        aria-pressed={thinkingOpen}
        aria-label={ariaLabel}
        title={title ?? label}
        disabled={disabled}
        data-testid="desk-notebook-button"
        onClick={() => onToggleThinking?.()}
      >
        <ButtonIcon>
          <span className="action-persona-icon is-desk-notebook" aria-hidden="true">
            {NOTEBOOK_EMOJI}
            {liveCue ? <span className="desk-notebook-scribble" aria-hidden="true" /> : null}
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
    </div>
  );
}
