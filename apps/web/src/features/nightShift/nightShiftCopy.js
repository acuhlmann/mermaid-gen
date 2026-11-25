/**
 * Words for the Night Shift standup and its kanban board.
 *
 * English-only and feature-local, the same posture as `godAltarCopy.js`: the
 * board's cards quote the fleet's ledgers, which are English, so a localized
 * frame around an English quote would buy little. The office locale bundles
 * swap wholesale (`docs/routines/review.md` § 2 trap list), so this copy stays
 * out of them rather than adding a key to one bundle and silently not the rest.
 */

/**
 * Who each crew id is, as the office knows them. The night crew are the
 * scheduled routines and automations (`NIGHT_SHIFT_CREW`), cast as the staff
 * who work while the day cast is asleep.
 *
 * @type {Readonly<Record<string, { emoji: string, name: string, dept: string }>>}
 */
export const NIGHT_SHIFT_CREW_COPY = Object.freeze({
  metaphor3d: { emoji: '🧊', name: 'Metaphor3D', dept: 'Facilities — 3D Wing' },
  prune: { emoji: '🧹', name: 'Prune', dept: 'Night Janitor (bins what nobody claims)' },
  'office-life': {
    emoji: '🪴',
    name: 'Office Life',
    dept: 'People & Culture — redecorates this office while you sleep'
  },
  anything: { emoji: '🧪', name: 'Anything', dept: 'Skunkworks' },
  'canvas-graph-edit': { emoji: '✏️', name: 'Canvas Graph Edit', dept: 'Drafting' },
  review: { emoji: '🔍', name: 'Review', dept: 'Internal Audit, night desk' },
  improve: { emoji: '📈', name: 'Improve', dept: 'Continuous Improvement Office' },
  resolve: { emoji: '🎫', name: 'Resolve', dept: 'Ticket Desk, graveyard shift' },
  deps: { emoji: '📦', name: 'Deps', dept: 'Supply Chain & Procurement' }
});

/** @param {string} id */
export function crewCopy(id) {
  return NIGHT_SHIFT_CREW_COPY[id] ?? { emoji: '🌙', name: id, dept: 'Nights' };
}

export const NIGHT_SHIFT_COPY = Object.freeze({
  wallLabel: 'Night shift',
  boardAria: 'Night Shift kanban board — what the night crew did',
  boardTitle: 'Night Shift kanban',
  boardSubtitle: (when) => `What the night crew did ${when}`,
  boardEmpty:
    'The board is blank. Either nobody worked nights, or this build shipped without the ledgers.',
  provenance:
    'Read from the fleet’s own ledgers (docs/routines/ledger, docs/automations/ledger) when this build was made.',
  closeLabel: 'Close',
  columns: Object.freeze({
    shipped: 'Shipped',
    checked: 'Clocked in, nothing merged',
    noShow: 'Didn’t clock in',
    onLeave: 'On leave'
  }),
  lastSeen: (date) => `Last ledger entry ${date}`,
  neverSeen: 'No ledger entries at all',
  earlier: 'Earlier',
  prLabel: (pr) => `#${pr}`,
  prAria: (pr) => `Pull request ${pr} on GitHub (opens in a new tab)`,
  standupTitle: 'Night Shift standup',
  standupStep: (index, total) => `${index} of ${total}`,
  next: 'Next',
  toBoard: 'See the board',
  skipToBoard: 'Skip to the board',
  inviteText: (shipped, when) =>
    shipped === 1
      ? `Night Shift standup — 1 thing shipped ${when}`
      : `Night Shift standup — ${shipped} things shipped ${when}`,
  inviteJoin: 'Join standup',
  inviteDismiss: 'Skip standup',
  inviteDismissAria: 'Skip the standup — the board keeps the summary',
  lastNight: 'last night',
  onDate: (date) => `on ${date}`,
  // Pam, the agile coach, hosts. Every line below is a frame around facts from
  // the board; none of them invents work the ledgers do not record.
  hostIntro: ({ present, total, shipped, when }) =>
    `Good morning!! Night-shift standup, time-boxed to ninety seconds. ${present} of ${total} of the night crew clocked in ${when}, and ${shipped} of them shipped something. Yesterday, today, blockers — go!`,
  hostIntroEmpty: ({ when }) =>
    `Good morning!! Night-shift standup… and the room is empty. Nobody clocked in ${when}. I'll just story-point the silence.`,
  crewShipped: ({ summary, prs }) =>
    `Last night: ${summary} Merged ${prs}. Today: asleep. Blockers: none, I'm a cron job.`,
  crewChecked: ({ summary }) =>
    `Last night: ${summary} Nothing merged — a clean run counts too. Blockers: none.`,
  hostNoShows: ({ names }) =>
    `${names} didn't clock in. Their last ledger entries are on the board. I'm putting it in the retro as a "learning".`,
  hostOnLeave: ({ names, count }) =>
    `${names} ${count > 1 ? 'are' : 'is'} still on leave. We're holding the desk. Probably.`,
  hostOutro:
    'Great energy, everyone!! It’s all on the kanban board by the kitchen if you missed anything. Let’s take the rest offline.'
});
