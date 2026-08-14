/**
 * The floor's one card slot.
 *
 * Single-occupancy, ordered by how much of your body is committed: a meeting
 * has you in a chair, a conversation has you stood in front of somebody
 * waiting for you to say something, a peek has you on your feet at somebody
 * else's desk, using a prop has you on your feet at a machine, a person card is
 * idle curiosity, an offer to join a conversation commits nothing yet, an
 * errand is a thing you agreed to and have not done, and the hint is what is
 * left when you are doing nothing at all. That ordering is the rule § 7 asks
 * new surfaces to respect, so it lives in one place rather than as a ternary
 * chain inside the view component.
 *
 * Slice 23's rung is the first one the *room* offers rather than one you
 * opened, which is why it sits third from bottom: a person card is idle
 * curiosity you acted on, and this is a door held open.
 *
 * Slice 26's errand sits below it, immediately above the hint, and the reason
 * is **lifetime rather than commitment**. An errand is the only card here that
 * is durable: it has no timer and can sit open for the rest of the session, so
 * ranking it any higher would mean a standing errand permanently suppressing
 * every momentary offer beneath it — you would never see another Join in. Last
 * place is also the honest one: while you carry an errand, "what you are doing
 * on this floor" is the errand, and the generic hint is what deserves replacing.
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
import { FloorErrandCard } from './FloorErrand.jsx';
import { FloorHuddleCard } from './FloorHuddle.jsx';
import { FloorMeetingCard } from './FloorMeeting.jsx';
import { FloorPeekCard } from './FloorPeek.jsx';
import { FloorPropCard } from './FloorProps.jsx';
import { FloorJoinCard, FloorSceneJoinCard, FloorTalkCard } from './FloorTalk.jsx';
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
 *   join?: { colleagueId: string, partnerId: string, kind: string } | null,
 *   errand?: { colleagueId: string, fromId: string } | null,
 *   board?: import('../../utils/officeFloorBoard.js').BoardState | null,
 *   onGoHome: () => void,
 *   onMessage?: (colleagueId: string) => void,
 *   onPeek?: (colleagueId: string) => void,
 *   onTalk?: (colleagueId: string) => void,
 *   onJoin?: (colleagueId: string) => void,
 *   onErrandTalk?: (colleagueId: string) => void,
 *   onDropErrand?: () => void,
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
  // No defaults — § 8's complexity lever, and `FloorPropCard` / `FloorJoinCard`
  // / `FloorErrandCard` each guard their own.
  board,
  sceneJoin,
  join,
  errand,
  onGoHome,
  onMessage,
  onPeek,
  onTalk,
  onJoin,
  onJoinScene,
  onErrandTalk,
  onDropErrand,
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
        onAdopt={onAdoptPrompt}
        onLeave={onGoHome}
      />
    );
  }

  if (peek) return <FloorPeekCard peek={peek} copy={copy} onBack={onGoHome} />;

  if (prop)
    return (
      <FloorPropCard
        prop={prop}
        phase={propUse?.phase}
        copy={copy}
        board={board}
        onBack={onGoHome}
      />
    );

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

  /*
   * Slice 28, and it sits **above** the shop-talk join rather than beside it.
   * Both can be live at once — a wanderer can strike up an exchange at the
   * printer while a break you declined runs in the kitchen — and the scripted
   * set piece is the one with a clock on it: the break ends when its script
   * does, whereas an overheard exchange re-arms on the wanderer's next errand.
   * Offering the perishable one first is the same ranking the errand rung gets
   * for the opposite reason (durable, so it goes last).
   */
  if (sceneJoin)
    return <FloorSceneJoinCard sceneJoin={sceneJoin} copy={copy} onJoinScene={onJoinScene} />;

  if (join) return <FloorJoinCard join={join} copy={copy} onJoin={onJoin} />;

  /*
   * The handler is part of *this* branch's condition, not only of the card's
   * own guard — the one place the errand rung has to differ from the join rung
   * above it. Both cards withhold themselves when nothing is wired to honour
   * them, but a slot branch that has already been taken renders an empty box:
   * for a join that lasts seconds, and for an errand it would last the rest of
   * the session, taking the floor's only hint with it.
   */
  if (errand && typeof onErrandTalk === 'function')
    return (
      <FloorErrandCard errand={errand} copy={copy} onTalk={onErrandTalk} onDrop={onDropErrand} />
    );

  return <p className="office-floor-hint">{copy.hint}</p>;
}

export default FloorCardSlot;
