/**
 * The arrival ceremony in one sentence (docs/office-isometric-mode.md § 8 debt).
 *
 * Same rules as `floorAnnouncement`: spatial state only — who is where, not what
 * they said. Speech stays in bubbles and TTS; narrating both would read every
 * line twice.
 */

import { officeSenderInfo } from '../../utils/officeCast.js';
import { formatLocale } from '../../i18n/formatLocale.js';

/** @typedef {{ key: string, text: string }} FloorAnnouncement */

function announce(key, template, vars = {}) {
  return { key, text: formatLocale(template ?? '', vars) };
}

/**
 * @param {{
 *   copy: Record<string, any>,
 *   phase: string,
 *   colleagueIndex: number,
 *   speakingId: string | null,
 *   walkingToId?: string | null,
 *   atId?: string | null
 * }} state
 * @returns {FloorAnnouncement}
 */
export function floorArrivalAnnouncement(state) {
  const { copy, phase, colleagueIndex, speakingId, walkingToId = null, atId = null } = state;
  const lines = copy.arrival.narration;

  if (phase === 'reception') {
    return announce('arrival:reception', lines.atReception);
  }
  if (phase === 'walking-home' || phase === 'walking') {
    return announce('arrival:walking', lines.walkingToDesk);
  }
  if (phase === 'welcome') {
    return announce('arrival:welcome', lines.welcome);
  }
  if (phase === 'touring') {
    if (walkingToId) {
      const name = officeSenderInfo(walkingToId)?.name ?? walkingToId;
      return announce(
        `arrival:walking:${walkingToId}`,
        lines.walkingToColleague ?? lines.colleagueIntroducing,
        {
          name
        }
      );
    }
    if (speakingId === 'hr' || atId === 'hr') {
      return announce('arrival:welcome', lines.welcome);
    }
    if (speakingId || atId) {
      const id = speakingId || atId;
      const name = officeSenderInfo(id)?.name ?? id;
      return announce(
        `arrival:colleague:${id}:${colleagueIndex}`,
        lines.standingWithColleague ?? lines.colleagueIntroducing,
        { name }
      );
    }
  }
  if (phase === 'colleagues' && speakingId) {
    const name = officeSenderInfo(speakingId)?.name ?? speakingId;
    return announce(
      `arrival:colleague:${speakingId}:${colleagueIndex}`,
      lines.colleagueIntroducing,
      { name }
    );
  }
  return { key: 'arrival:idle', text: '' };
}

export default floorArrivalAnnouncement;
