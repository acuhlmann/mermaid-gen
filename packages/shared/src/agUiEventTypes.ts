/**
 * AG-UI event type strings (mirror @ag-ui/core EventType).
 * Shared between server stream emitters and web translators.
 */
export const AGUI_EVENT_TYPE = Object.freeze({
  TEXT_MESSAGE_START: 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT: 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END: 'TEXT_MESSAGE_END',
  TOOL_CALL_START: 'TOOL_CALL_START',
  TOOL_CALL_ARGS: 'TOOL_CALL_ARGS',
  TOOL_CALL_END: 'TOOL_CALL_END',
  STATE_SNAPSHOT: 'STATE_SNAPSHOT',
  STATE_DELTA: 'STATE_DELTA',
  CUSTOM: 'CUSTOM',
  RUN_STARTED: 'RUN_STARTED',
  RUN_FINISHED: 'RUN_FINISHED',
  RUN_ERROR: 'RUN_ERROR',
  STEP_STARTED: 'STEP_STARTED',
  STEP_FINISHED: 'STEP_FINISHED'
});

const AGUI_EVENT_TYPE_SET = new Set(Object.values(AGUI_EVENT_TYPE));

/** @param {unknown} evt */
export function isAgUiWireEvent(evt) {
  return Boolean(evt && typeof evt === 'object' && AGUI_EVENT_TYPE_SET.has(/** @type {{ type?: string }} */ (evt).type));
}
