/**
 * Window list for the parody-OS taskbar (docs/office-isometric-mode.md §4) —
 * the open, manageable floating windows. Diegesis duplicates focus; the
 * windows keep their own titlebars.
 *
 * A pill now **restores** rather than merely re-focusing: minimize sends a
 * window here (docs/office-window-manager.md §5B), so this is the only way back
 * for one. That also makes the strip the phone's window switcher, which is what
 * the one-window-at-a-time rule leans on.
 *
 * Rendered inside `DeskOsTaskbar`, which owns the position; this collapses to
 * nothing when no window is open so the bar's permanent residents close up.
 *
 * Brand wordmark and "Tidy up" deliberately omitted — desk Mail / Chat / Meeting
 * now rise from their taskbar icons (no stranded free-float to recover), and
 * the wordmark cost width the presence caption needs more.
 */

import { useSyncExternalStore } from 'react';
import {
  SWITCHABLE_GROUPS,
  getFocusedOverlayId,
  getOpenOverlays,
  restoreOverlay,
  subscribe
} from '../state/overlayStack.js';
import { officeChromeCopy } from '../utils/officeCast.js';

const KIND_GLYPH = {
  inbox: '✉️',
  messenger: '💬',
  meeting: '📅',
  'meeting-picker': '📅',
  battle: '🥊',
  training: '🎓'
};

/**
 * @param {{ open?: boolean }} props
 */
export default function DeskOsTray({ open = true }) {
  const overlays = useSyncExternalStore(subscribe, getOpenOverlays, getOpenOverlays);
  const focusedId = useSyncExternalStore(subscribe, getFocusedOverlayId, getFocusedOverlayId);
  const copy = officeChromeCopy().osTray ?? {};

  if (!open) return null;

  const windows = overlays.filter(
    (entry) => entry.manageable && SWITCHABLE_GROUPS.has(entry.group) && entry.title
  );
  if (windows.length === 0) return null;

  return (
    <div className="desk-os-tray" data-testid="desk-os-tray" role="toolbar" aria-label={copy.aria}>
      <ul className="desk-os-tray-list">
        {windows.map((entry) => {
          const glyph = KIND_GLYPH[entry.kind] ?? '▢';
          const focused = entry.id === focusedId;
          return (
            <li key={entry.id}>
              <button
                type="button"
                className={`desk-os-tray-item${focused ? ' is-focused' : ''}${
                  entry.minimized ? ' is-minimized' : ''
                }`}
                data-kind={entry.kind || undefined}
                aria-pressed={focused}
                title={
                  entry.minimized ? `${entry.title} — ${copy.restore ?? 'Restore'}` : entry.title
                }
                onClick={() => restoreOverlay(entry.id)}
              >
                <span aria-hidden="true">{glyph}</span>
                <span className="desk-os-tray-label">{entry.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
