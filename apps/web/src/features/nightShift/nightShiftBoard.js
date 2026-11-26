/**
 * The Night Shift, derived once for both of its surfaces: the kanban board on
 * the office wall (and the card it opens) and the morning standup.
 *
 * Two surfaces that each sorted the crew into columns could disagree, and the
 * one that was wrong would be the one you were not looking at — so the standup
 * reads its beats off the same columns the board draws (the reason
 * `officeFloorBoard.js` exists, applied to the fleet instead of your diagram).
 *
 * Pure: everything is a function of the baked manifest and a clock.
 */

import { NIGHT_SHIFT_COPY, crewCopy } from './nightShiftCopy.js';

/** @typedef {import('../../utils/nightShiftLedger.js').NightShiftManifest} NightShiftManifest */
/** @typedef {import('../../utils/nightShiftLedger.js').NightShiftCrewRecord} NightShiftCrewRecord */
/** @typedef {import('../../utils/nightShiftLedger.js').NightShiftEntry} NightShiftEntry */

/** Column order, left to right — also the order the standup calls on people. */
export const NIGHT_SHIFT_COLUMNS = Object.freeze(['shipped', 'checked', 'noShow', 'onLeave']);

/**
 * @typedef {{
 *   id: string,
 *   emoji: string,
 *   name: string,
 *   dept: string,
 *   column: 'shipped' | 'checked' | 'noShow' | 'onLeave',
 *   tonight: NightShiftEntry[],
 *   prs: number[],
 *   lastSeen: string | null,
 *   earlier: NightShiftEntry[]
 * }} NightShiftCard
 */

/**
 * @param {NightShiftCrewRecord} record
 * @returns {NightShiftCard['column']}
 */
function columnFor(record) {
  if (record.tonight.length > 0) {
    return record.tonight.some((entry) => entry.shipped) ? 'shipped' : 'checked';
  }
  return record.parked ? 'onLeave' : 'noShow';
}

/**
 * Every crew member as a card, in crew (night-ladder) order.
 *
 * A parked crew member who nonetheless clocked in is sorted by what they did,
 * not by the parking — the ledger outranks the roster.
 *
 * @param {NightShiftManifest} manifest
 * @returns {NightShiftCard[]}
 */
export function nightShiftCards(manifest) {
  return (manifest?.crew ?? []).map((record) => {
    const who = crewCopy(record.id);
    return {
      id: record.id,
      emoji: who.emoji,
      name: who.name,
      dept: who.dept,
      column: columnFor(record),
      tonight: record.tonight,
      prs: [...new Set(record.tonight.flatMap((entry) => entry.prs))],
      lastSeen: record.lastSeen,
      earlier: record.earlier
    };
  });
}

/**
 * Cards grouped by column, columns in board order. Empty columns stay, so the
 * board's shape does not change from one night to the next.
 *
 * @param {NightShiftManifest} manifest
 * @returns {Array<{ id: NightShiftCard['column'], title: string, cards: NightShiftCard[] }>}
 */
export function nightShiftColumns(manifest) {
  const cards = nightShiftCards(manifest);
  return NIGHT_SHIFT_COLUMNS.map((id) => ({
    id,
    title: NIGHT_SHIFT_COPY.columns[id],
    cards: cards.filter((card) => card.column === id)
  }));
}

/**
 * How many cards each column holds — what the wall art draws as sticky notes.
 *
 * @param {NightShiftManifest} manifest
 * @returns {Record<NightShiftCard['column'], number>}
 */
export function nightShiftCounts(manifest) {
  const counts = { shipped: 0, checked: 0, noShow: 0, onLeave: 0 };
  for (const card of nightShiftCards(manifest)) counts[card.column] += 1;
  return counts;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * `2026-11-24` → `24 Nov`. Built by hand rather than with `Intl` so the
 * board reads the same in every locale and in every test environment.
 *
 * @param {string | null} isoDate
 * @returns {string}
 */
export function shortDate(isoDate) {
  const match = String(isoDate ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(isoDate ?? '');
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1] ?? match[2]}`;
}

/**
 * "last night" when the shift is the newest one you could have missed, a date
 * otherwise. The ledgers date a firing by its UTC day, and the ladder runs from
 * 15:00 UTC, so a shift dated yesterday (UTC) is last night; so is one dated
 * today, which is what a viewer east of UTC sees on the morning after.
 *
 * @param {string | null} shiftDate
 * @param {number} [now]
 * @returns {string}
 */
export function shiftWhen(shiftDate, now = Date.now()) {
  if (!shiftDate) return NIGHT_SHIFT_COPY.lastNight;
  const shift = Date.parse(`${shiftDate}T00:00:00Z`);
  if (Number.isNaN(shift)) return NIGHT_SHIFT_COPY.onDate(shiftDate);
  const today = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  const days = Math.round((today - shift) / 86_400_000);
  return days >= 0 && days <= 1
    ? NIGHT_SHIFT_COPY.lastNight
    : NIGHT_SHIFT_COPY.onDate(shortDate(shiftDate));
}

/** @param {string[]} names */
function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** @param {string} text */
function asSentence(text) {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

/** @param {number[]} prs */
function listPrs(prs) {
  return listNames(prs.map((pr) => NIGHT_SHIFT_COPY.prLabel(pr)));
}

/**
 * @typedef {{ key: string, speaker: 'host' | string, emoji?: string, name?: string, dept?: string, text: string, prs?: number[] }} NightShiftBeat
 */

/**
 * The standup, as a list of beats. The host opens, everyone who clocked in
 * reports in board order, the host reads out who did not, then closes by
 * pointing at the board — which is the point of the board: the standup is the
 * moment, the board is the record of it.
 *
 * @param {NightShiftManifest} manifest
 * @param {{ now?: number }} [options]
 * @returns {NightShiftBeat[]}
 */
export function nightShiftStandupBeats(manifest, { now = Date.now() } = {}) {
  const cards = nightShiftCards(manifest);
  if (cards.length === 0) return [];
  const when = shiftWhen(manifest.shiftDate, now);
  const present = cards.filter((card) => card.column === 'shipped' || card.column === 'checked');
  const shipped = cards.filter((card) => card.column === 'shipped');
  const noShows = cards.filter((card) => card.column === 'noShow');
  const onLeave = cards.filter((card) => card.column === 'onLeave');

  /** @type {NightShiftBeat[]} */
  const beats = [
    {
      key: 'intro',
      speaker: 'host',
      text:
        present.length > 0
          ? NIGHT_SHIFT_COPY.hostIntro({
              present: present.length,
              total: cards.length,
              shipped: shipped.length,
              when
            })
          : NIGHT_SHIFT_COPY.hostIntroEmpty({ when })
    }
  ];

  for (const card of [...shipped, ...present.filter((c) => c.column === 'checked')]) {
    const summary = card.tonight
      .map((entry) => entry.summary)
      .filter(Boolean)
      .map(asSentence)
      .join(' ');
    // Only PRs from runs that shipped are spoken as "merged": a quiet run's
    // ledger-only PR still links from the board card, but it is not work.
    const shippedPrs = [
      ...new Set(card.tonight.filter((entry) => entry.shipped).flatMap((entry) => entry.prs))
    ];
    const text =
      card.column === 'shipped'
        ? NIGHT_SHIFT_COPY.crewShipped({ when, summary, prs: listPrs(shippedPrs) })
        : NIGHT_SHIFT_COPY.crewChecked({ when, summary });
    beats.push({
      key: `crew-${card.id}`,
      speaker: card.id,
      emoji: card.emoji,
      name: card.name,
      dept: card.dept,
      text,
      prs: card.column === 'shipped' ? shippedPrs : []
    });
  }

  if (noShows.length > 0) {
    beats.push({
      key: 'no-shows',
      speaker: 'host',
      text: NIGHT_SHIFT_COPY.hostNoShows({ names: listNames(noShows.map((card) => card.name)) })
    });
  }
  if (onLeave.length > 0) {
    beats.push({
      key: 'on-leave',
      speaker: 'host',
      text: NIGHT_SHIFT_COPY.hostOnLeave({
        names: listNames(onLeave.map((card) => card.name)),
        count: onLeave.length
      })
    });
  }
  beats.push({ key: 'outro', speaker: 'host', text: NIGHT_SHIFT_COPY.hostOutro });
  return beats;
}

/**
 * Is there a shift on the board you have not been to the standup for (or
 * skipped)? The seen marker is the shift date you last acknowledged.
 *
 * @param {NightShiftManifest} manifest
 * @param {string | null} seenShiftDate
 * @returns {boolean}
 */
export function hasUnseenNightShift(manifest, seenShiftDate) {
  const shiftDate = manifest?.shiftDate;
  if (!shiftDate) return false;
  return !seenShiftDate || seenShiftDate < shiftDate;
}
