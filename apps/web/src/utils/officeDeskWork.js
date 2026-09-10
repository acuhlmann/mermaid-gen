/**
 * *Their own work* — the fiction on everybody else's monitor
 * (docs/office-isometric-mode.md § 5 slice 6, `GLOSSARY.md`).
 *
 * Each character carries a slowly-evolving fictional workload they reference in
 * ambient moments. Until this slice it was never written down; desk peeking is
 * the first surface that has to *show* it, so it gets the same parametric
 * treatment as `personaFaceTraits` and the floor's seat rows: one row per cast
 * id, and a test fails until a new colleague has one.
 *
 * **Sign-off rule (ADR-0010) applies literally here.** What you see over
 * somebody's shoulder is set dressing: a `look` picks a handful of coloured
 * rectangles, and `line` is something they say. No slot content, no artifacts,
 * no implication that the cast produced anything — the human's own pipeline
 * stays the only producer.
 *
 * Traits are read off each character's existing prose in `officeCast.js` /
 * `slopitectCopy.js`, never invented: Ulrich "maintains the mainframe" gets the
 * terminal, Chad who replies-all gets the forty tabs, Diane the CFO gets the
 * spreadsheet, Jack Barker gets the Conjoined Triangles on a slide.
 *
 * Slice 13 added `doing`, which is the same fiction seen from the front: `look`
 * is what the monitor shows and `doing` is what their hands are up to while it
 * shows it. They are two fields rather than one derivation because they do not
 * follow each other — Erlich and Richard are both on slides, and only one of
 * them is working.
 */

/**
 * The six screen looks `MonitorScreen` can draw. Deliberately a closed set:
 * a look is a handful of rectangles (§ 3 — a new prop costs a component, not an
 * art pipeline), and seven of them would not be more legible at 34 px.
 *
 * @type {readonly string[]}
 */
export const DESK_WORK_LOOKS = Object.freeze([
  'terminal',
  'tabs',
  'spreadsheet',
  'slides',
  'tickets',
  'calendar'
]);

/**
 * What they are visibly doing at that screen. Closed for the same reason
 * `DESK_WORK_LOOKS` is: each value is one held item plus one idle rhythm on a
 * 34 × 58 figure whose legs a desk hides, and a sixth would be a
 * distinction nobody could see. `officeFloorActivity.js` owns the mapping to
 * art; this file owns only which one each character is.
 *
 * @type {readonly string[]}
 */
export const DESK_WORK_DOING = Object.freeze(['typing', 'phone', 'headset', 'papers', 'mug']);

/**
 * @typedef {object} DeskWork
 * @property {'terminal' | 'tabs' | 'spreadsheet' | 'slides' | 'tickets' | 'calendar'} look
 *   what is on their screen
 * @property {'typing' | 'phone' | 'headset' | 'papers' | 'mug'} doing
 *   what their hands are doing in front of it
 * @property {string} line what they say when you look over their shoulder
 */

/** @type {Record<string, DeskWork>} */
export const OFFICE_DESK_WORK = {
  // ── team ────────────────────────────────────────────────────────────────
  gilfoyle: {
    look: 'terminal',
    doing: 'typing',
    line: 'I already fixed it. I have not told anyone. It has been a good day.'
  },
  dinesh: {
    look: 'tabs',
    doing: 'typing',
    line: 'I fixed the thing from Tuesday. Nobody has mentioned it. It has been days.'
  },
  erlich: {
    look: 'slides',
    // Slide nine is not being worked on. Erlich is holding a mug.
    doing: 'mug',
    line: 'Do not look at slide nine yet. Slide nine is where I change everything.'
  },
  russ: {
    look: 'tabs',
    // Russ conducts business by phone, loudly, at everybody.
    doing: 'phone',
    line: 'TWELVE TABS. ONE IDEA. I HAVE NEVER BEEN CLOSER.'
  },
  jared: {
    look: 'tickets',
    doing: 'papers',
    line: 'Sorry — I saw you walk by and now I have to raise the open finding.'
  },
  richard: {
    look: 'slides',
    doing: 'typing',
    line: 'Okay — so if I’m reading this right, this box is doing two jobs.'
  },

  // ── senior ──────────────────────────────────────────────────────────────
  ciso: {
    look: 'terminal',
    doing: 'typing',
    line: 'Do not read that. You have now read it. Noted in your file.'
  },
  belson: {
    look: 'slides',
    doing: 'phone',
    line: 'Keynote rehearsal. Softly: the live demo is a video. That is the vision.'
  },
  cfo: {
    look: 'spreadsheet',
    doing: 'typing',
    line: 'Row 412 is your diagram. Column H is what it costs per month.'
  },
  barker: {
    look: 'slides',
    doing: 'papers',
    line: "The Conjoined Triangles of Success. I've taken the liberty of animating them."
  },

  // ── office floor ────────────────────────────────────────────────────────
  intern: {
    look: 'tabs',
    doing: 'typing',
    line: 'Forty tabs. Two of them are playing audio. I cannot find which two.'
  },
  scrumMaster: {
    look: 'calendar',
    doing: 'papers',
    line: 'Booking a workshop to agree the cadence of the cadence review.'
  },
  helpdesk: {
    // The one row whose `doing` matches a baked face trait: Dave's headset is
    // in `PERSONA_FACE_TRAITS`, so this asks for no override, it agrees with one.
    look: 'tickets',
    doing: 'headset',
    line: 'Closing your ticket as a duplicate of your ticket. Works on my machine.'
  },
  facilities: {
    look: 'spreadsheet',
    doing: 'mug',
    line: 'THE Q3 FRIDGE AUDIT IS AT 62 PERCENT. IT IS GOING BADLY.'
  },
  hr: {
    look: 'tickets',
    doing: 'papers',
    line: 'Your compliance training is overdue. It was overdue when you arrived!'
  },
  greybeard: {
    look: 'terminal',
    doing: 'mug',
    line: 'Mainframe migration. Year eleven. We are, broadly, ahead of schedule.'
  }
};

/**
 * @param {string} id
 * @returns {DeskWork | null}
 */
export function deskWorkFor(id) {
  return OFFICE_DESK_WORK[id] ?? null;
}

/**
 * What each `look` reads like to the model — their own workload, in their own
 * words, for `/moment`'s `officeDeskWork` field.
 *
 * **Durative on purpose.** A moment is delivered from one funnel and the
 * speaker is not always in their chair when it fires: they may be walking to
 * the coffee machine, or standing beside you when a dwell remark lands. "Your
 * screen has had a spreadsheet on it all morning" survives all of those;
 * "you are sitting at a spreadsheet" is a claim about a chair the prompt
 * cannot see.
 *
 * @type {Readonly<Record<string, string>>}
 */
const LOOK_PROMPT_LINES = Object.freeze({
  terminal: 'your own screen has been a wall of terminal output all morning',
  tabs: 'your own screen has had far too many tabs open on it all morning',
  spreadsheet: 'your own screen has had a spreadsheet open on it all morning',
  slides: 'your own screen has had a slide deck open on it all morning',
  tickets: 'your own screen has had a ticket queue open on it all morning',
  calendar: 'your own screen has had a calendar open on it all morning'
});

/**
 * What each `doing` reads like. Same durative rule as `LOOK_PROMPT_LINES`, and
 * the same reason: these are read as a state you have been in, not a pose you
 * are struck in at the instant the moment fires.
 *
 * @type {Readonly<Record<string, string>>}
 */
const DOING_PROMPT_LINES = Object.freeze({
  typing: 'you have been heads-down typing',
  phone: 'you keep getting pulled onto phone calls',
  headset: 'you have been in and out of calls with your headset on',
  papers: 'you have a stack of printouts you are working through',
  mug: 'you are mostly holding a mug'
});

/**
 * Prompt lines for `/moment`'s `officeDeskWork` field — the speaker's own
 * fiction, which until this slice was written down and fed to nothing
 * (`docs/office-parody.md` § 11 named it as its own open context hole).
 *
 * This file owns every sentence, the same split
 * `officeWorkingMemoryStore.js`'s `INTERRUPTION_PROMPT_LINES` uses: the row
 * carries the *fact* (`look` / `doing`, both closed sets), and the sentence for
 * it lives beside the row rather than in the floor or on the server. A value
 * with no sentence contributes nothing instead of leaking an enum name into a
 * system prompt.
 *
 * `line` is deliberately **not** here. It is what they say when you peek over
 * their shoulder, and handing the model its own canned answer is an invitation
 * to recite it back.
 *
 * Empty for the player and for anyone with no row, so the server drops the
 * heading rather than announcing an absence.
 *
 * @param {string} colleagueId
 * @returns {string[]}
 */
export function deskWorkPromptLines(colleagueId) {
  const work = deskWorkFor(colleagueId);
  if (!work) return [];
  return [LOOK_PROMPT_LINES[work.look], DOING_PROMPT_LINES[work.doing]].filter(Boolean);
}
