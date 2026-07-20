/** Grace period before the radial menu closes after pointer leave. */
export const RADIAL_MENU_CLOSE_GRACE_MS = 450;

/** Auto-show diagram diff highlights after the final SVG for an agent-applied revision is on screen. */
export const AUTO_DIAGRAM_CHANGE_HIGHLIGHT_MS = 7000;

export const SpeechRecognitionCtor =
  globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
