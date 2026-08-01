/**
 * A short cue immediately before a colleague speaks (narration roadmap Phase A).
 *
 * Deliberately **not** one sting per colleague. A cue before all sixteen voices
 * is a metronome, and a tone assigned to a persona for no reason is noise the
 * user has to learn. The map holds only the people whose *job* is the joke — a
 * calendar ding before the scrum master, a ticket tick before the helpdesk —
 * so the sting reads as the office announcing itself rather than as UI chrome.
 * Everyone else gets `null` and simply starts talking.
 *
 * Pure lookup returning an existing `agentChimes` player, so this needs no new
 * audio assets and inherits the global sound gate through `playChime`.
 */

import {
  playCalendarDing,
  playImPing,
  playMailChime,
  playPropJam,
  playSendTick
} from './agentChimes.js';

/** @type {Record<string, (audioContextRef: { current: AudioContext | null }) => void>} */
const SPEAKER_STINGS = {
  /** Pam: a meeting is about to be proposed, and it already exists. */
  scrumMaster: playCalendarDing,
  /** Dave: the ticket was closed before he finished saying it. */
  helpdesk: playSendTick,
  /** Linda: another friendly nudge is arriving. */
  hr: playMailChime,
  /** Gary: something in the building has an opinion. */
  facilities: playPropJam,
  /** Chad: types before he thinks, in both directions. */
  intern: playImPing
};

/**
 * @param {string} speakerId
 * @returns {((audioContextRef: { current: AudioContext | null }) => void) | null}
 *   The sting for this speaker, or null when they do not have one — which is
 *   most of the cast, on purpose.
 */
export function officeSpeakerSting(speakerId) {
  return SPEAKER_STINGS[speakerId] ?? null;
}

/** Ids that have a sting. Exported for tests and for the roster docs. */
export function officeSpeakerStingIds() {
  return Object.keys(SPEAKER_STINGS);
}
