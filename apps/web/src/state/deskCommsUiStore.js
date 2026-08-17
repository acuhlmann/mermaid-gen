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

/** @type {{ activePanel: DeskCommsPanelId | null, anchorRect: DeskCommsAnchorRect, inboxEmailId: string | null }} */
let state = { activePanel: null, anchorRect: null, inboxEmailId: null };
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
    state = { activePanel: null, anchorRect: null, inboxEmailId: null };
  } else {
    state = { activePanel: panel, anchorRect, inboxEmailId: null };
  }
  emit();
}

/**
 * @param {DeskCommsPanelId} panel
 * @param {DeskCommsAnchorRect} [anchorRect]
 * @param {{ emailId?: string }} [opts]
 */
export function openDeskCommsPanel(panel, anchorRect = null, { emailId } = {}) {
  state = {
    activePanel: panel,
    anchorRect,
    inboxEmailId: emailId ? String(emailId) : null
  };
  emit();
}

export function closeDeskCommsPanel() {
  if (!state.activePanel && !state.inboxEmailId) return;
  state = { activePanel: null, anchorRect: null, inboxEmailId: null };
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

const PANEL_TEST_ID = {
  inbox: 'desk-comms-inbox',
  slopChat: 'desk-comms-slopChat',
  meeting: 'desk-comms-meeting'
};

/**
 * Measure the taskbar button for a panel when the opener did not pass a rect
 * (presence strip, desk arrivals). Falls back to the whole comms cluster.
 * @param {DeskCommsPanelId} panel
 * @returns {DeskCommsAnchorRect}
 */
export function readDeskCommsAnchorRect(panel) {
  if (typeof document === 'undefined') return null;
  const testId = PANEL_TEST_ID[panel];
  const node =
    (testId && document.querySelector(`[data-testid="${testId}"]`)) ||
    document.querySelector('[data-testid="desk-comms-cluster"]') ||
    document.getElementById('office-desk-bottom-slot');
  if (!node) return null;
  return serializeAnchorRect(node.getBoundingClientRect());
}

/** Test helper — reset without touching localStorage. */
export function _resetDeskCommsUiForTests() {
  state = { activePanel: null, anchorRect: null, inboxEmailId: null };
  emit();
}
