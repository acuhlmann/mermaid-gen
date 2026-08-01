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

/**
 * Which line of a **growing** transcript is being spoken right now — "caption
 * karaoke" (narration roadmap Phase A).
 *
 * A meeting reveals one beat at a time, so the newest line is by construction
 * the one in the air; there is no separate index to track. Returns -1 whenever
 * nothing is actually being voiced, which is the case that matters: with
 * narration off, or after the meeting ends, every line is equally past and
 * highlighting one of them would be a lie about what the user is hearing.
 *
 * Deliberately NOT applied to the coffee/battle cards — those reveal all their
 * lines at once by design (they have no narrator), so there is no "current"
 * line to mark. See the `useScenePacing` note in CLAUDE.md.
 *
 * @param {{ lineCount?: number, playing?: boolean, voiceActive?: boolean }} opts
 * @returns {number} 0-based index of the spoken line, or -1 for none.
 */
export function activeCaptionIndex({ lineCount = 0, playing = false, voiceActive = false } = {}) {
  if (!playing || !voiceActive) return -1;
  if (!Number.isFinite(lineCount) || lineCount <= 0) return -1;
  return lineCount - 1;
}
