/**
 * Progressive "Dumb it Down" levels for the radial explainer popover.
 * Level 0 is the default Wise Architect brief; levels 1–6 get sillier and younger;
 * level 7 is pre-verbal babble, then "I give up" decommissions the popover.
 */

export const MAX_LABEL_EXPLAIN_DUMB_LEVEL = 6;
export const LABEL_EXPLAIN_GIBBERISH_LEVEL = 7;
export const LABEL_EXPLAIN_GIVE_UP_LABEL = 'I give up';

/** @type {ReadonlyArray<{ level: number, audience: string, voice: string, emoji: string, chipLabel: string, nextChipLabel: string, loadingText: string, maxWords: number }>} */
export const LABEL_EXPLAIN_DUMB_LEVELS = [
  {
    level: 1,
    audience: 'a grown-up who wants zero jargon',
    voice: 'a friendly coworker over coffee',
    emoji: '🧑',
    chipLabel: 'Dumb it Down',
    nextChipLabel: 'Even dumber',
    loadingText: 'Dumbing it down…',
    maxWords: 25
  },
  {
    level: 2,
    audience: 'a curious 16-year-old',
    voice: 'their cool older cousin who actually gets tech',
    emoji: '🧑‍🎓',
    chipLabel: 'Even dumber',
    nextChipLabel: 'Kid mode',
    loadingText: 'Dialing back the brain cells…',
    maxWords: 22
  },
  {
    level: 3,
    audience: 'a smart 10-year-old',
    voice: 'a patient teacher on a field trip',
    emoji: '🧒',
    chipLabel: 'Kid mode',
    nextChipLabel: 'Little kid mode',
    loadingText: 'Making it kid-friendly…',
    maxWords: 20
  },
  {
    level: 4,
    audience: 'a 5-year-old',
    voice: 'a kindergarten teacher with glitter and patience',
    emoji: '👦',
    chipLabel: 'Little kid mode',
    nextChipLabel: 'Baby talk',
    loadingText: 'Shrinking the words…',
    maxWords: 18
  },
  {
    level: 5,
    audience: 'a 3-year-old',
    voice: 'a playful preschool storyteller',
    emoji: '👶',
    chipLabel: 'Baby talk',
    nextChipLabel: 'Toddler mode',
    loadingText: 'Going full preschool…',
    maxWords: 15
  },
  {
    level: 6,
    audience: 'a toddler',
    voice: 'someone explaining with toy blocks and animal noises (keep it wholesome and fun)',
    emoji: '🍼',
    chipLabel: 'Toddler mode',
    nextChipLabel: 'Babble mode',
    loadingText: 'Bababooey simplification…',
    maxWords: 12
  }
];

const GIBBERISH_META = {
  level: LABEL_EXPLAIN_GIBBERISH_LEVEL,
  audience: 'a toddler who cannot talk yet',
  voice: 'a pre-verbal baby',
  emoji: '👶',
  chipLabel: 'Babble mode',
  nextChipLabel: LABEL_EXPLAIN_GIVE_UP_LABEL,
  loadingText: 'Goo goo ga ga…',
  maxWords: 14
};

/**
 * @param {number} level 1–7
 */
export function getLabelExplainDumbLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n) || n < 1) return null;
  if (n === LABEL_EXPLAIN_GIBBERISH_LEVEL) return GIBBERISH_META;
  if (n > MAX_LABEL_EXPLAIN_DUMB_LEVEL) return null;
  return LABEL_EXPLAIN_DUMB_LEVELS[n - 1] ?? null;
}

export function isLabelExplainGibberishLevel(dumbLevel) {
  return Number(dumbLevel) === LABEL_EXPLAIN_GIBBERISH_LEVEL;
}

export function isLabelExplainGiveUpLevel(dumbLevel) {
  return Number(dumbLevel) >= LABEL_EXPLAIN_GIBBERISH_LEVEL;
}

/**
 * Label for the follow-up chip: first click vs next step vs give-up.
 * @param {number} dumbLevel 0 = brief default; 1–7 = active dumb level
 */
export function labelExplainDumbChipLabel(dumbLevel) {
  if (isLabelExplainGiveUpLevel(dumbLevel)) return LABEL_EXPLAIN_GIVE_UP_LABEL;
  if (dumbLevel <= 0) return LABEL_EXPLAIN_DUMB_LEVELS[0].chipLabel;
  const meta = getLabelExplainDumbLevel(dumbLevel);
  if (!meta) return 'Dumb it Down';
  if (dumbLevel >= MAX_LABEL_EXPLAIN_DUMB_LEVEL) return meta.nextChipLabel;
  return getLabelExplainDumbLevel(dumbLevel + 1)?.chipLabel ?? meta.nextChipLabel;
}

/**
 * @param {number} dumbLevel 0 = brief; 1–7 = dumb
 */
export function labelExplainDumbLoadingText(dumbLevel) {
  if (dumbLevel <= 0) return 'Consulting the Wise Architect…';
  return getLabelExplainDumbLevel(dumbLevel)?.loadingText ?? 'Dumbing it down…';
}

/**
 * Short badge copy shown above the answer while in dumb mode.
 * @param {number} dumbLevel 1–7
 */
export function labelExplainDumbAudienceBadge(dumbLevel) {
  const meta = getLabelExplainDumbLevel(dumbLevel);
  if (!meta) return '';
  return `For ${meta.audience}`;
}

/**
 * Offline fallback when the gibberish model call fails.
 * @param {string} [label]
 */
export function fallbackLabelGibberish(label = '') {
  const bits = ['goo', 'ga', 'ba', 'bwah', 'nya', 'bloop', 'mlem', 'wah'];
  const tail = String(label || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 4)
    .toLowerCase();
  let seed = 0;
  for (let i = 0; i < tail.length; i += 1) seed = (seed + tail.charCodeAt(i) * (i + 3)) % bits.length;
  const mash =
    tail.length >= 2
      ? `${tail.slice(0, 2)}-${bits[seed % bits.length]}`
      : bits[seed % bits.length];
  return `${bits[seed % bits.length]} ${bits[(seed + 1) % bits.length]} ${mash} ${bits[(seed + 2) % bits.length]}!!!`;
}
