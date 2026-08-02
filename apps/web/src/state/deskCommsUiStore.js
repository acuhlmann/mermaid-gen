/**
 * Which taskbar comms app (mail / Slop Chat / meeting) is open, and where its
 * trigger button sits on screen. One panel at a time — toggling the same icon
 * closes it; opening another closes the rest.
 *
 * Mirrors `officeMessengerUiStore`: external surfaces (presence strip, desk
 * arrivals) call `openDeskCommsPanel` instead of prop-drilling through the shell.
 */

/** @typedef {'inbox' | 'slopChat' | 'meeting'} DeskCommsPanelId */

/** @typedef {{ left: number, top: number, width: number, height: number } | null} DeskCommsAnchorRect */

/** @type {{ activePanel: DeskCommsPanelId | null, anchorRect: DeskCommsAnchorRect }} */
let state = { activePanel: null, anchorRect: null };
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeDeskCommsUi(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDeskCommsUi() {
  return state;
}

/**
 * @param {DeskCommsPanelId} panel
 * @param {DeskCommsAnchorRect} [anchorRect]
 */
export function toggleDeskCommsPanel(panel, anchorRect = null) {
  if (state.activePanel === panel) {
    state = { activePanel: null, anchorRect: null };
  } else {
    state = { activePanel: panel, anchorRect };
  }
  emit();
}

/**
 * @param {DeskCommsPanelId} panel
 * @param {DeskCommsAnchorRect} [anchorRect]
 */
export function openDeskCommsPanel(panel, anchorRect = null) {
  state = { activePanel: panel, anchorRect };
  emit();
}

export function closeDeskCommsPanel() {
  if (!state.activePanel) return;
  state = { activePanel: null, anchorRect: null };
  emit();
}

/** @param {DOMRect | DeskCommsAnchorRect} rect */
export function serializeAnchorRect(rect) {
  if (!rect) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

/** Test helper — reset without touching localStorage. */
export function _resetDeskCommsUiForTests() {
  state = { activePanel: null, anchorRect: null };
  emit();
}
