/**
 * Parody-OS task strip — lists open manageable floating windows so desktop
 * screen mode feels like a workstation (docs/office-isometric-mode.md §4).
 * Diegesis duplicates focus; the windows keep their own titlebars.
 */

import { useSyncExternalStore } from 'react';
import {
  bringOverlayToFront,
  getFocusedOverlayId,
  getOpenOverlays,
  subscribe
} from '../state/overlayStack.js';
import { officeChromeCopy } from '../utils/officeCast.js';

const KIND_GLYPH = {
  inbox: '✉️',
  messenger: '💬',
  meeting: '📅',
  battle: '🥊'
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
    (entry) => entry.manageable && entry.group === 'officeChrome' && entry.title
  );
  if (windows.length === 0) return null;

  return (
    <div className="desk-os-tray" data-testid="desk-os-tray" role="toolbar" aria-label={copy.aria}>
      <span className="desk-os-tray-brand" aria-hidden="true">
        {copy.brand ?? 'ArchiSlop OS'}
      </span>
      <ul className="desk-os-tray-list">
        {windows.map((entry) => {
          const glyph = KIND_GLYPH[entry.kind] ?? '▢';
          const focused = entry.id === focusedId;
          return (
            <li key={entry.id}>
              <button
                type="button"
                className={`desk-os-tray-item${focused ? ' is-focused' : ''}`}
                data-kind={entry.kind || undefined}
                aria-pressed={focused}
                title={entry.title}
                onClick={() => bringOverlayToFront(entry.id)}
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
