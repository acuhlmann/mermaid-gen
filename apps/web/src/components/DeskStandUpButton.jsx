import { ButtonIcon } from './AppIcons.jsx';
import { useCoarsePointer } from '../hooks/useAppLayoutMedia.js';
import { officeChromeCopy } from '../utils/officeCast.js';
import { OFFICE_VIEW_HOTKEY_LABEL } from '../hooks/useOfficeViewHotkey.js';

const STAND_EMOJI = '🚶';
const SIT_EMOJI = '🪑';

/**
 * Primary bottom-nav control for leaving (or returning to) your screen —
 * isometric floor entry. Lives beside the desk stamp, not buried in the menu.
 */
export default function DeskStandUpButton({
  standing = false,
  onStandUp,
  onSitDown,
  disabled = false,
  busy = false
}) {
  const touchUi = useCoarsePointer();
  const desk = officeChromeCopy().desk;
  const floor = officeChromeCopy().floor;
  const label = standing ? (desk.sitDown ?? floor.back) : desk.standUp;
  const shortLabel = standing
    ? (desk.sitDownShort ?? desk.sitDown ?? 'Sit down')
    : (desk.standUpShort ?? 'Stand up');
  const shortcutHint = touchUi ? null : (desk.officeViewShortcut ?? OFFICE_VIEW_HOTKEY_LABEL);
  const title = standing
    ? (desk.sitDownTitle ?? floor.backTitle ?? label)
    : [desk.standUpTitle ?? label, shortcutHint].filter(Boolean).join(' · ');
  const emoji = standing ? SIT_EMOJI : STAND_EMOJI;

  const buttonClass = [
    'overlay-button',
    'compact-button',
    'slop-action-button',
    'is-desk-standup',
    standing ? 'is-active' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={buttonClass}
      aria-pressed={standing}
      aria-label={label}
      title={title}
      disabled={disabled || busy}
      data-testid="desk-standup-button"
      onClick={() => (standing ? onSitDown?.() : onStandUp?.())}
    >
      <ButtonIcon>
        <span className="action-persona-icon is-desk-standup" aria-hidden="true">
          {emoji}
        </span>
      </ButtonIcon>
      <span className="button-label">{shortLabel}</span>
      <span className="slop-action-role">{desk.standUpRole ?? 'Floor'}</span>
    </button>
  );
}
