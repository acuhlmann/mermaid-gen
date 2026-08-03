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
 * 34 × 48 figure whose lower half a desk hides, and a sixth would be a
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
