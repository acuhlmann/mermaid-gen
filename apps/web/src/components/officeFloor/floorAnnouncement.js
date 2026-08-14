/**
 * The room, in one sentence (docs/office-isometric-mode.md § 5 slice 10).
 *
 * A pure projection of floor state into the line the live region reads out —
 * which makes narration a third *renderer* of the same state rather than a
 * parallel account of it, on exactly the terms ADR-0011 rule 1 sets for the
 * window and the floor. Nothing here remembers anything: the sentence is a
 * function of where everybody is standing right now, and the region announces
 * because the sentence changed, not because something told it to.
 *
 * Two rules decide what belongs here.
 *
 * **Spatial only.** Bodies and where they are going. What anybody *says* stays
 * in their speech bubble, which is a live region that works — it stays mounted
 * across a scene's beats and its text changes underneath. Narrating both would
 * read every line twice, the same double-narration the walk-by and the coffee
 * scene each had to be guarded against.
 *
 * **Card-slot order.** Ties break by how much of your body is committed, the
 * same ordering `FloorCardSlot` exists to express: a meeting has you in a
 * chair, a conversation has you stood in front of somebody, a peek and a prop
 * have you on your feet somewhere specific, and a colleague coming over ranks
 * under all of them because it commits *their* body, not yours. One ordering
 * rule, two surfaces — if a future slice adds a card, it gets a sentence in the
 * same position.
 */

import { officeSenderInfo } from '../../utils/officeCast.js';
import { formatLocale } from '../../i18n/formatLocale.js';

/** @typedef {{ key: string, text: string }} FloorAnnouncement */

/**
 * The three reasons you walk somewhere, in card-slot order, each with the line
 * for going and the line for being there.
 *
 * A table rather than three branches because the branches were identical apart
 * from their wording — and because a fourth reason to walk somewhere should
 * cost a row here, the same way slice 9 wanted it to cost one projection in
 * `useFloorActivity` rather than another state machine.
 */
const WALKED_TO = [
  { kind: 'talk', going: 'walkingTo', there: 'standingWith' },
  { kind: 'peek', going: 'walkingToDesk', there: 'standingAtDesk' },
  { kind: 'prop', going: 'walkingToProp', there: 'standingAtProp' }
];

/**
 * `key` is the identity of the *event*, not of the sentence. Free roam can walk
 * you from one tile to another with no change of phase and therefore no change
 * of wording, and a live region only speaks when its text mutates — so the
 * region needs to be told "this is a new one" independently of what it says.
 */
function announce(key, template, vars = {}) {
  return { key, text: formatLocale(template, vars) };
}

/**
 * Who or what you went there for, and how to name it in a sentence. The one
 * thing slice 9 had to generalize — an intent's subject need not be a person —
 * is the only difference between the three rows of `WALKED_TO`.
 */
function subjectOf(view, copy) {
  if (view.propKind) {
    return {
      id: view.propKind,
      vars: { prop: copy.props.items[view.propKind]?.name ?? view.propKind }
    };
  }
  return { id: view.colleagueId, vars: { name: nameOf(view.colleagueId) } };
}

function nameOf(colleagueId) {
  return officeSenderInfo(colleagueId)?.name ?? colleagueId;
}

/**
 * @param {{
 *   copy: Record<string, any>,
 *   meeting?: unknown,
 *   talk?: { colleagueId: string, phase: string } | null,
 *   peek?: { colleagueId: string, phase: string } | null,
 *   prop?: { propKind: string, phase: string } | null,
 *   presence?: { phase: string, homeward?: boolean, key: number } | null,
 *   walkBy?: { id: string, colleagueId: string } | null,
 *   walkerDeparting?: boolean,
 *   join?: { colleagueId: string, partnerId: string } | null,
 *   errand?: { colleagueId: string, fromId: string } | null
 * }} state `copy` is `officeChromeCopy().floor`; the rest is what
 *   `OfficeFloorView` already holds, passed rather than re-derived. Taken as
 *   one object and destructured without defaults on purpose: every field is
 *   read for truthiness, so turning `undefined` into `null` would buy nothing
 *   but eight more branches through a function whose whole job is to pick one.
 * @returns {FloorAnnouncement}
 */
export function floorAnnouncement(state) {
  const {
    copy,
    meeting,
    huddle,
    talk,
    peek,
    prop,
    presence,
    walkBy,
    walkerDeparting,
    join,
    errand
  } = state;
  const lines = copy.narration;

  /**
   * The at-rest line, which is the one place slice 26's errand may speak.
   *
   * Every other rung in this chain is momentary; an errand is durable and can
   * sit open for the rest of the session. Ranked among the others it would
   * silence free roam for as long as you carry one — a region that stops
   * reporting movement is worse than one that never mentioned the errand — so
   * it replaces what you are told while standing still and nothing else. That
   * still puts it exactly where `FloorCardSlot` puts its card: one rung above
   * the generic hint, and replacing it.
   */
  const atRest = (key, resting) =>
    errand
      ? announce(`${key}:errand:${errand.colleagueId}`, lines.onErrand, {
          name: nameOf(errand.colleagueId),
          from: nameOf(errand.fromId)
        })
      : announce(key, resting);

  if (meeting) return announce('meeting', lines.inMeeting);
  if (huddle) return announce(`huddle:${huddle.id}`, lines.inHuddle ?? lines.atDesk);

  for (const { kind, going, there } of WALKED_TO) {
    const view = { talk, peek, prop }[kind];
    if (!view) continue;
    const { id, vars } = subjectOf(view, copy);
    const walking = view.phase === 'walking';
    return announce(`${kind}:${id}:${view.phase}`, lines[walking ? going : there], vars);
  }

  /*
   * Their walk, not yours — the one thing on this floor that happens *to* you.
   * It ranks under your own intents because you have one body and it is busy,
   * and above bare roaming because somebody arriving at your desk outranks the
   * fact that you are between tiles.
   */
  if (walkBy) {
    return announce(
      `walkby:${walkBy.id}:${walkerDeparting ? 'out' : 'in'}`,
      walkerDeparting ? lines.leaving : lines.arriving,
      { name: nameOf(walkBy.colleagueId) }
    );
  }

  /*
   * Slice 23's rung, in the card slot's own position: below a colleague coming
   * to your desk, above the bare fact that you are stood on the floor.
   *
   * This does **not** reopen "ambient traffic is not narrated" (slice 11), and
   * the distinction is worth stating because the two look alike. That answer
   * was about trips — a region reading out every walk to the printer is one
   * people switch off, and then it is not there for the walk-by that mattered.
   * This announces an **offer**, which exists only where you are stood and at
   * most `OFFICE_SHOP_TALK_CAP` times a visit; the trips themselves are as
   * silent here as they have always been. A control that appears has to say so,
   * which is the same conclusion § 8 reached for the name on a wanderer's
   * button: narration reports what is happening, a control reports what it is.
   */
  if (join) {
    return announce(`join:${join.colleagueId}:${join.partnerId}`, lines.overhearing, {
      name: nameOf(join.colleagueId),
      partner: nameOf(join.partnerId)
    });
  }

  if (presence) {
    if (presence.phase !== 'walking') {
      return atRest(`roam:${presence.key}:standing`, lines.standingFloor);
    }
    return announce(
      `roam:${presence.key}:walking`,
      presence.homeward ? lines.walkingHome : lines.walkingFloor
    );
  }

  /*
   * No presence is your own chair, which is also the state the floor opens in —
   * so this doubles as the "you are here" a screen-reader user gets on standing
   * up, rather than being an announcement only ever heard on the way back.
   */
  return atRest('desk', lines.atDesk);
}

export default floorAnnouncement;
