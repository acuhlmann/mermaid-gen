// Re-export AG-UI builders and the agent stream emitter from shared so server code
// keeps stable import paths. Implementation lives in @archislop/shared.

export { AGUI_EVENT_TYPE } from '@archislop/shared';
export {
  createAgentStreamEmitter,
  createAgUiEmit,
  customEvent,
  newRunIds,
  runError,
  runFinished,
  runStarted,
  stateDelta,
  stateSnapshot,
  stepFinished,
  stepStarted,
  textMessageContent,
  textMessageEnd,
  textMessageStart,
  toolCallArgs,
  toolCallEnd,
  toolCallStart
} from '@archislop/shared';
