/**
 * Spoken-text captions for the office layer (orientation CC + floor bubbles).
 *
 * Voice-first by default: when narration / intro TTS is actually speaking,
 * hide the duplicate text bubble unless the user turns captions on. When
 * nothing is speaking aloud, text stays visible so the line is never lost.
 */

/**
 * @param {{ captions?: boolean, voiceActive?: boolean }} opts
 * @returns {boolean}
 */
export function shouldShowSpokenText({ captions = false, voiceActive = false } = {}) {
  return Boolean(captions) || !voiceActive;
}
