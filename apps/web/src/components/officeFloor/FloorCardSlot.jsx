/**
 * The floor's one card slot.
 *
 * Single-occupancy, ordered by how much of your body is committed: a meeting
 * has you in a chair, a peek has you on your feet at somebody else's desk, a
 * person card is idle curiosity, and the hint is what is left when you are
 * doing nothing at all. That ordering is the rule § 7 asks new surfaces to
 * respect, so it lives in one place rather than as a ternary chain inside the
 * view component.
 *
 * Why a slot and not chrome pinned to the room: counter-scaled panels do not
 * fit in a small room (§ 6 rule 12) — a panel on the meeting table covered all
 * nine people sitting at it. The slot is off the stage and occludes nothing.
 */

import FloorPersonCard from './FloorPersonCard.jsx';
import { FloorMeetingCard } from './FloorMeeting.jsx';
import { FloorPeekCard } from './FloorPeek.jsx';
import { sitDown } from '../../state/officeViewModeStore.js';

/**
 * @param {{
 *   copy: Record<string, any>,
 *   meeting?: any,
 *   meetingHandlers?: any,
 *   peek?: { colleagueId: string, phase: string } | null,
 *   person?: any,
 *   onGoHome: () => void,
 *   onMessage?: (colleagueId: string) => void,
 *   onPeek?: (colleagueId: string) => void,
 *   onClosePerson: () => void
 * }} props `copy` is `officeChromeCopy().floor`.
 */
export function FloorCardSlot({
  copy,
  meeting = null,
  meetingHandlers = {},
  peek = null,
  person = null,
  onGoHome,
  onMessage,
  onPeek,
  onClosePerson
}) {
  if (meeting) {
    return (
      <FloorMeetingCard
        meeting={meeting}
        copy={copy}
        onInterject={meetingHandlers.onInterject}
        onLeave={meetingHandlers.onLeave}
        onSitDown={() => sitDown()}
      />
    );
  }

  if (peek) return <FloorPeekCard peek={peek} copy={copy} onBack={onGoHome} />;

  if (person) {
    return (
      <FloorPersonCard
        person={person}
        copy={copy}
        canMessage={person.canMessage}
        canPeek={person.canPeek}
        onMessage={onMessage}
        onPeek={onPeek}
        onSitDown={() => sitDown()}
        onClose={onClosePerson}
      />
    );
  }

  return <p className="office-floor-hint">{copy.hint}</p>;
}

export default FloorCardSlot;
