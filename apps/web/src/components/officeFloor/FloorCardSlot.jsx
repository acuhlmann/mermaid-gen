/**
 * The floor's one card slot.
 *
 * Single-occupancy, ordered by how much of your body is committed: a meeting
 * has you in a chair, a conversation has you stood in front of somebody
 * waiting for you to say something, a peek has you on your feet at somebody
 * else's desk, using a prop has you on your feet at a machine, a person card is
 * idle curiosity, and the hint is what is left when you are doing nothing at
 * all. That ordering is the rule § 7 asks new surfaces to respect, so it lives
 * in one place rather than as a ternary chain inside the view component.
 *
 * A prop ranks below a peek only because a person outranks a machine; the two
 * are mutually exclusive anyway, since you have one body and `useFloorPresence`
 * gives it one intent.
 *
 * Why a slot and not chrome pinned to the room: counter-scaled panels do not
 * fit in a small room (§ 6 rule 12) — a panel on the meeting table covered all
 * nine people sitting at it. The slot is off the stage and occludes nothing.
 */

import FloorPersonCard from './FloorPersonCard.jsx';
import { FloorHuddleCard } from './FloorHuddle.jsx';
import { FloorMeetingCard } from './FloorMeeting.jsx';
import { FloorPeekCard } from './FloorPeek.jsx';
import { FloorPropCard } from './FloorProps.jsx';
import { FloorTalkCard } from './FloorTalk.jsx';
import { sitDown } from '../../state/officeViewModeStore.js';

/**
 * @param {{
 *   copy: Record<string, any>,
 *   meeting?: any,
 *   meetingHandlers?: any,
 *   huddle?: any,
 *   huddleHandlers?: any,
 *   huddleRing?: any,
 *   talk?: { colleagueId: string, phase: string } | null,
 *   conversation?: { draft: string, setDraft: (v: string) => void, busy: boolean, send: (b: string) => void, pitch?: string | null },
 *   peek?: { colleagueId: string, phase: string } | null,
 *   prop?: { propKind: string, phase: string } | null,
 *   propUse?: { phase: 'idle' | 'working' | 'done' | 'blocked' } | null,
 *   person?: any,
 *   onGoHome: () => void,
 *   onMessage?: (colleagueId: string) => void,
 *   onPeek?: (colleagueId: string) => void,
 *   onTalk?: (colleagueId: string) => void,
 *   onAdoptPrompt?: (prompt: string, colleagueId: string) => void,
 *   onClosePerson: () => void
 * }} props `copy` is `officeChromeCopy().floor`. `onAdoptPrompt` is declared
 *   without a default deliberately: § 8's finding is that ESLint counts a
 *   default parameter as a branch apiece, and this component is already at 16
 *   against a max of 12 — nine of those points are its own `= null`s.
 */
export function FloorCardSlot({
  copy,
  meeting = null,
  meetingHandlers = {},
  huddle = null,
  huddleHandlers = {},
  huddleRing = null,
  talk = null,
  conversation = null,
  peek = null,
  prop = null,
  propUse = null,
  person = null,
  onGoHome,
  onMessage,
  onPeek,
  onTalk,
  onAdoptPrompt,
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

  if (huddle) {
    return (
      <FloorHuddleCard
        huddle={huddle}
        copy={copy}
        onHardStop={huddleHandlers.onHardStop}
        ringControls={huddleRing}
      />
    );
  }

  if (talk && conversation) {
    return (
      <FloorTalkCard
        talk={talk}
        copy={copy}
        busy={conversation.busy}
        draft={conversation.draft}
        onDraftChange={conversation.setDraft}
        onSend={conversation.send}
        pitch={conversation.pitch}
        openers={conversation.openers}
        onAdopt={onAdoptPrompt}
        onLeave={onGoHome}
      />
    );
  }

  if (peek) return <FloorPeekCard peek={peek} copy={copy} onBack={onGoHome} />;

  if (prop)
    return <FloorPropCard prop={prop} phase={propUse?.phase} copy={copy} onBack={onGoHome} />;

  if (person) {
    return (
      <FloorPersonCard
        person={person}
        copy={copy}
        canMessage={person.canMessage}
        canPeek={person.canPeek}
        canTalk={person.canTalk}
        onMessage={onMessage}
        onPeek={onPeek}
        onTalk={onTalk}
        onSitDown={() => sitDown()}
        onClose={onClosePerson}
      />
    );
  }

  return <p className="office-floor-hint">{copy.hint}</p>;
}

export default FloorCardSlot;
