/**
 * The opening line somebody speaks after pulling a chair up to your desk, when
 * the LLM is unavailable.
 *
 * **Why this bank exists at all.** `POST /api/office/huddle` answers 503 with
 * no backend, and `applyHuddleResponse` (`hooks/useHuddlePlayback.js`) used to
 * call `endOfficeHuddle` on the empty script that came back — while
 * `handleStartHuddle` seats the ring *before* the call precisely so the chair
 * arriving is the feedback that the click landed. So the chair went up and was
 * taken away again inside 46 ms, `[data-testid="office-huddle"]` never painted,
 * and the Pair chip read as a **dead button**: the one surface in this office
 * that did not degrade in fiction, and the version anybody without an API key
 * presses. Every other provoked channel already had a bank for this —
 * `officeDwellFallbacks.js`, `officeImReplyFallbacks.js` (two of them),
 * `officeWalkbyFallbacks.js`, `officeEmailReplyFallbacks.js` — and a huddle was
 * the only one missing one.
 *
 * **Why a bank is honest here, when improvising one would not be.** The closed
 * argument in `officeFloorShopTalk.js` — a model asked to improvise two
 * colleagues talking about nothing writes a *scene*, and scenes are
 * `FloorScene`'s job — is about overheard chatter and does **not** transfer to a
 * conversation aimed at you. The live path stays LLM-first and unchanged
 * (`docs/office-parody.md` § 11: you started it, so the answer is generated);
 * these lines are only ever dealt when nobody was asked, which is the same
 * contract the other five banks have.
 *
 * **One line per colleague, and therefore no draw.** The other banks pick with
 * `pickUnseenTemplate` and a seeded `random`; this one indexes by
 * `colleagueId`, so there is no RNG to pin in a test and no seen-template store
 * — which the shop-talk slice declined as "the slice's first piece of state"
 * for the same reason. A mob gets each attendee's own line, which is exactly
 * the shape the server's mob script has (one remark per teammate, no beat
 * grammar, no follow-up); a pair gets the one person's.
 *
 * **Register** (`docs/automations/office-life.md` § 14): bite is capped by
 * target, never by presence. Each line aims at the architecture, the board deck
 * or Thursday — never at the user, and never at their work being blocked. These
 * are openings rather than remarks, because a pair ends up in `listening` with
 * the reply strip open: the line has to invite the next thing you say.
 *
 * **English-only, deliberately.** The four provoked banks are not mirrored into
 * `i18n/locales/office.*` (only the walk-by and ambient banks are) — that i18n
 * gap is recorded in `docs/agents/domains/office.md` and is not this bank's to
 * close on its own.
 *
 * The ids pairable today are `VARIANT_PERSONAS` (the six `CAST_TIERS.team`
 * members plus `barker`, who carries a Pair chip on his roster row); a mob
 * seats `CAST_TIERS.team`. The uncast entry is the house line for anybody who
 * reaches this surface later without one of their own.
 */

import { fillOfficeSlots } from './officeCast.js';

/** @typedef {{ id: string, colleagueId?: string, body: string }} HuddleFallback */

/** @type {HuddleFallback[]} */
export const OFFICE_HUDDLE_FALLBACKS = [
  {
    id: 'huddle-gilfoyle',
    colleagueId: 'gilfoyle',
    body: 'I pulled a chair up because {label} becomes my problem on Thursday. Start with the part that is held together with hope.'
  },
  {
    id: 'huddle-dinesh',
    colleagueId: 'dinesh',
    body: 'Fine. I will sit here and work on {label} with you, and when it ships I would like it noted somewhere durable that I was the one sitting here. Where do we start?'
  },
  {
    id: 'huddle-erlich',
    colleagueId: 'erlich',
    body: 'Sit. Breathe. {label} is not a diagram, it is a position. Tell me what it is defending and I will tell you what it should be acquiring.'
  },
  {
    id: 'huddle-russ',
    colleagueId: 'russ',
    body: 'THREE COMMAS. {label} on a screen this size is a Series B deck with extra steps. Walk me to the box where the money leaks out.'
  },
  {
    id: 'huddle-jared',
    colleagueId: 'jared',
    body: 'Sorry — I brought a chair. I did have one thought about {label}, and I would much rather say it to you than put it in a document. May I?'
  },
  {
    id: 'huddle-richard',
    colleagueId: 'richard',
    body: 'Okay so — {label}. I think this shape has a name, and I think I am going to say it wrong first and then be right. Can you talk me through the middle of it?'
  },
  {
    id: 'huddle-barker',
    colleagueId: 'barker',
    body: 'Delighted to be at your desk. Before we go deeper on {label}, I want to boil it down to the one slide that makes the board feel nothing. What are the three triangles?'
  },
  {
    id: 'huddle-generic',
    body: 'Pulled a chair up. Talk me through {label} — start wherever you got stuck.'
  }
];

/** The uncast house line, dealt to anybody with no entry of their own. */
const HOUSE = OFFICE_HUDDLE_FALLBACKS.find((entry) => !entry.colleagueId);

export function officeHuddleFallbacks() {
  return OFFICE_HUDDLE_FALLBACKS;
}

/**
 * The beats to seat when the huddle script was never written.
 *
 * Shaped exactly like a landed script's `beats` so nothing downstream can tell
 * the difference: `setOfficeHuddleBeats` takes it, `useScenePacing` walks it,
 * and `recordPartnerTurns` folds a pair's into the transcript — so the room
 * remembers the conversation it actually had rather than the one it refused.
 * No `actionPrompt`: a Do-it is a change to the user's diagram, and a canned
 * line has no business proposing one (ADR-0010).
 *
 * The house line is dealt **once**. Two unknown attendees saying the same
 * sentence to each other is a worse failure than one of them staying quiet, and
 * a mob with nothing to say dissolves on its own.
 *
 * @param {{ attendees?: string[], label?: string }} [visit]
 * @returns {Array<{ speakerId: string, text: string }>} empty when there is
 *   nobody to speak — the caller then dissolves the ring as it always did.
 */
export function huddleFallbackBeats({ attendees = [], label = '' } = {}) {
  const bank = officeHuddleFallbacks();
  const house = bank.find((entry) => !entry.colleagueId) ?? HOUSE;
  let houseSpent = false;
  const beats = [];
  for (const speakerId of Array.isArray(attendees) ? attendees : []) {
    if (typeof speakerId !== 'string' || !speakerId) continue;
    let entry = bank.find((row) => row.colleagueId === speakerId);
    if (!entry) {
      if (houseSpent || !house) continue;
      houseSpent = true;
      entry = house;
    }
    beats.push({ speakerId, text: fillOfficeSlots(entry.body, { label }) });
  }
  return beats;
}

export default officeHuddleFallbacks;
