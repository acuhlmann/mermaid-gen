import { useSyncExternalStore } from 'react';
import { getOpenOverlays, bringOverlayToFront, subscribe } from '../state/overlayStack.js';
import { resetAllFloatingWindows, resetFloatingWindow } from '../state/floatingWindowControl.js';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';

/**
 * The office window bar (docs/office-parody.md §Window management) — a taskbar
 * for the floating office surfaces. Working on a real office computer you have a
 * strip that shows every open window and lets you bring one forward; this is
 * that, for the desk parody. Every colleague-opened surface (inbox, Slop Chat,
 * a walk-by, the meeting picker) shows up here with who it is from, so nothing
 * ever gets buried or stranded off-screen: click a chip to raise it, or ↺ to
 * snap it back to its default spot after a drag / device fold left it out of
 * reach. Transient toasts (coffee/battle invites, meeting invite) opt out via
 * `manageable={false}` — they are momentary, not windows you arrange.
 *
 * Pure store subscription; no props. Renders nothing until a manageable window
 * is actually open, so it never adds chrome to an empty desk.
 */

/** Emoji glyph per window kind — mirrors the surface's own kind label. */
const KIND_ICON = {
  inbox: '📥',
  messenger: '💬',
  walkby: '🚶',
  'meeting-picker': '📅'
};

function windowLabel(entry, copy) {
  switch (entry.kind) {
    case 'inbox':
      return copy.kindInbox;
    case 'messenger':
      return copy.kindMessenger;
    case 'meeting-picker':
      return copy.kindMeetingPicker;
    case 'walkby':
      return entry.senderId ? officeSenderInfo(entry.senderId).name : copy.kindWalkby;
    default:
      return entry.title || copy.label;
  }
}

export default function OfficeWindowBar() {
  const overlays = useSyncExternalStore(subscribe, getOpenOverlays, getOpenOverlays);
  const managed = overlays.filter((entry) => entry.manageable);
  const copy = officeChromeCopy().windows;

  if (managed.length === 0) return null;

  return (
    <div className="office-window-bar" role="toolbar" aria-label={copy.barAria}>
      <span className="office-window-bar-label" aria-hidden="true">
        {copy.label}
        <span className="office-window-bar-count">{managed.length}</span>
      </span>
      <ul className="office-window-bar-list">
        {managed.map((entry) => {
          const label = windowLabel(entry, copy);
          const showFace = Boolean(
            entry.senderId && (entry.kind === 'walkby' || entry.kind === 'messenger')
          );
          return (
            <li key={entry.id} className="office-window-bar-item">
              <button
                type="button"
                className={`office-window-chip${entry.focused ? ' is-focused' : ''}`}
                aria-pressed={entry.focused}
                title={formatLocale(copy.focusTitle, { name: label })}
                onClick={() => bringOverlayToFront(entry.id)}
              >
                {showFace ? (
                  <PersonaFace id={entry.senderId} size={18} className="office-window-chip-face" />
                ) : (
                  <span className="office-window-chip-icon" aria-hidden="true">
                    {KIND_ICON[entry.kind] ?? '🗔'}
                  </span>
                )}
                <span className="office-window-chip-label">{label}</span>
              </button>
              <button
                type="button"
                className="office-window-recall"
                title={formatLocale(copy.recallTitle, { name: label })}
                aria-label={formatLocale(copy.recallTitle, { name: label })}
                onClick={() => {
                  resetFloatingWindow(entry.id);
                  bringOverlayToFront(entry.id);
                }}
              >
                ↺
              </button>
            </li>
          );
        })}
      </ul>
      {managed.length > 1 ? (
        <button
          type="button"
          className="office-window-bar-tidy"
          title={copy.tidyTitle}
          onClick={resetAllFloatingWindows}
        >
          {copy.tidyLabel}
        </button>
      ) : null}
    </div>
  );
}
