/**
 * Words for the elevator and the Machine Room.
 *
 * English-only and feature-local, the same posture as `nightShiftCopy.js`: the
 * racks quote the fleet's English ledgers, and the office locale bundles swap
 * wholesale, so a key added to one bundle would silently be missing from the
 * rest.
 */

export const BUILDING_COPY = Object.freeze({
  floors: Object.freeze({
    basement: 'Machine Room',
    office: 'Open plan',
    leadership: 'Leadership'
  }),
  elevatorAria: (floorName) => `Elevator — call it to leave ${floorName}`,
  elevatorTitle: 'Elevator',
  elevatorEyebrow: 'Going somewhere?',
  elevatorWaiting: 'Walking to the elevator…',
  elevatorPick: 'Doors open. Which floor?',
  buttonAria: ({ button, name, state, minLevel }) => {
    if (state === 'current') return `${button}, ${name} — you are here`;
    if (state === 'locked') return `${button}, ${name} — locked until level ${minLevel}`;
    if (state === 'fitOut') return `${button}, ${name} — still being fitted out`;
    return `${button}, ${name}`;
  },
  buttonNote: ({ state, minLevel }) => {
    if (state === 'current') return 'You are here';
    if (state === 'locked') return `Badge access from Lvl ${minLevel}`;
    if (state === 'fitOut') return 'Fit-out in progress. Facilities says Q3.';
    return '';
  },
  closeDoors: 'Close doors',
  riding: (button) => `Going to ${button}…`,
  basementTopBar: Object.freeze({
    eyebrow: 'ARCHISLOP CORP. · B1',
    title: 'The Machine Room',
    subtitle:
      'No windows, no meetings. One rack per routine that works nights so the floor upstairs does not have to.'
  }),
  basementEyebrow: 'B1 · Machine Room',
  basementTitle: 'Where the night crew works',
  basementBody:
    'One rack per scheduled routine. The lights are last night, read from their own ledgers when this build was made. Press a rack to see what it did.',
  basementLeave: 'Call the elevator',
  signage: 'Authorized cron jobs only',
  rackAria: (name, column) => `${name} rack — ${column}. Walk over and read it.`,
  rackColumn: Object.freeze({
    shipped: 'Shipped last night',
    checked: 'Ran, nothing merged',
    noShow: 'Did not clock in',
    onLeave: 'Parked'
  }),
  rackNothing: 'Nothing in the ledger for this run.',
  rackOpenBoard: 'Open the kanban',
  rackClose: 'Step back',
  props: Object.freeze({
    mainframe: 'The legacy box. Label reads DO NOT UNPLUG — nobody knows what it does.',
    crac: 'The air conditioning. It is the loudest member of staff.',
    cot: 'The on-call cot. Nobody has slept here since the routines took the night shift.'
  })
});
