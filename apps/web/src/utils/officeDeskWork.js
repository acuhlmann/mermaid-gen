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
 * @typedef {object} DeskWork
 * @property {'terminal' | 'tabs' | 'spreadsheet' | 'slides' | 'tickets' | 'calendar'} look
 *   what is on their screen
 * @property {string} line what they say when you look over their shoulder
 */

/** @type {Record<string, DeskWork>} */
export const OFFICE_DESK_WORK = {
  // ── team ────────────────────────────────────────────────────────────────
  refine: {
    look: 'terminal',
    line: 'One useful next step. Then the next one. It does add up, eventually.'
  },
  innovate: {
    look: 'slides',
    line: 'Do not look at slide nine yet. Slide nine is a flywheel.'
  },
  goMad: {
    look: 'tabs',
    line: 'TWELVE TABS. ONE IDEA. I HAVE NEVER BEEN CLOSER.'
  },
  critique: {
    look: 'tickets',
    line: 'You are in my peripheral vision, and I am logging it as a finding.'
  },
  explain: {
    look: 'slides',
    line: 'Ah. Good. This one has a story, and the story begins in 1998.'
  },

  // ── senior ──────────────────────────────────────────────────────────────
  exec: {
    look: 'slides',
    line: 'Boiling the north star down to a single slide. It is a big slide.'
  },
  ciso: {
    look: 'terminal',
    line: 'Do not read that. You have now read it. Noted in your file.'
  },
  cto: {
    look: 'slides',
    line: 'Keynote rehearsal. Do not tell anyone the live demo is a video.'
  },
  cfo: {
    look: 'spreadsheet',
    line: 'Row 412 is your diagram. Column H is what it costs per month.'
  },
  barker: {
    look: 'slides',
    line: "The Conjoined Triangles of Success. I've taken the liberty of animating them."
  },

  // ── office floor ────────────────────────────────────────────────────────
  intern: {
    look: 'tabs',
    line: 'Forty tabs. Two of them are playing audio. I cannot find which two.'
  },
  scrumMaster: {
    look: 'calendar',
    line: 'Booking a workshop to agree the cadence of the cadence review.'
  },
  helpdesk: {
    look: 'tickets',
    line: 'Closing your ticket as a duplicate of your ticket. Works on my machine.'
  },
  facilities: {
    look: 'spreadsheet',
    line: 'THE Q3 FRIDGE AUDIT IS AT 62 PERCENT. IT IS GOING BADLY.'
  },
  hr: {
    look: 'tickets',
    line: 'Your compliance training is overdue. It was overdue when you arrived!'
  },
  greybeard: {
    look: 'terminal',
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
