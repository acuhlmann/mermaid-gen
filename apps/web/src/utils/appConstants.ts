/** Grace period before the radial menu closes after pointer leave. */
export const RADIAL_MENU_CLOSE_GRACE_MS = 450;

/** Auto-show diagram diff highlights after the final SVG for an agent-applied revision is on screen. */
export const AUTO_DIAGRAM_CHANGE_HIGHLIGHT_MS = 7000;

/** Minimal surface the voice-input hooks use from the browser SpeechRecognition API. */
export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const speechGlobal = globalThis as typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export const SpeechRecognitionCtor: SpeechRecognitionConstructor | undefined =
  speechGlobal.SpeechRecognition ?? speechGlobal.webkitSpeechRecognition;
