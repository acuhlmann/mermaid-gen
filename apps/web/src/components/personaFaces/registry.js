/**
 * Per-persona face traits for <PersonaFace> (see ./index.jsx).
 *
 * One parametric face component reads these rows, so a new cast member costs a
 * data row rather than new artwork — which matters because the roster has a
 * documented future bench (docs/office-parody.md:82-88).
 *
 * The named Silicon Valley seats are tuned to their actors' real looks
 * (Gilfoyle's centre-part curtain and half-lidded eyes, Erlich's dirty-blond
 * shag on a round face, Jared's neat side sweep and porcelain long face,
 * Belson's slicked grey v-neck, Russ's spiky hair + gold chain, and so on).
 * The invented office staff rows are spread across the same trait space so
 * every face stays visually distinct (asserted in tests).
 *
 * Keys must match CAST_TIERS in ../../utils/castTiers.js (asserted in tests).
 */

/** Skin tones, deliberately spread so adjacent roster avatars stay distinct. */
export const SKIN_TONES = {
  porcelain: '#f4d9c3',
  light: '#e9bd97',
  olive: '#d3a06d',
  tan: '#bd8354',
  deep: '#8a5533'
};

export const HAIR_COLORS = {
  black: '#2b2b31',
  brown: '#5a3a22',
  auburn: '#8c4a2f',
  blond: '#d8b25a',
  darkBlond: '#7d6136',
  dirtyBlond: '#ad8a52',
  saltPepper: '#6e6258',
  grey: '#9aa0a6',
  white: '#dde1e6'
};

/**
 * @typedef {object} PersonaFaceTraits
 * @property {keyof typeof SKIN_TONES} skin
 * @property {'short' | 'bob' | 'bald' | 'receding' | 'ponytail' | 'buzz' | 'long' | 'sidepart' | 'crop' | 'curtain' | 'shag' | 'spiky' | 'sweep' | 'slicked'} hair
 * @property {keyof typeof HAIR_COLORS} hairColor
 * @property {'none' | 'stubble' | 'moustache' | 'beard' | 'scruff'} facialHair
 * @property {'none' | 'round' | 'square' | 'visor'} glasses
 * @property {'none' | 'headset' | 'hardhat' | 'lanyard' | 'tie' | 'badge' | 'chain'} accessory
 * @property {'neutral' | 'smile' | 'smirk' | 'frown' | 'wide' | 'tired'} expression
 * @property {'oval' | 'long' | 'round' | 'square'} faceShape — all shapes share
 *   one cranium (crown + temples) so hair/ears align; only the jaw differs.
 * @property {'thin' | 'straight' | 'thick' | 'bushy'} brows
 * @property {'dot' | 'lidded' | 'round' | 'deep' | 'almond'} eyes — the `wide`
 *   and `tired` expressions override the shape while they are active.
 * @property {'button' | 'straight' | 'broad'} nose
 * @property {'hoodie' | 'tee' | 'sweater' | 'oxford' | 'vneck' | 'hawaiian' | 'blazer'} top
 *   — garment cut drawn on the portrait shoulders and the floor torso.
 * @property {'slim' | 'regular' | 'broad'} build — floor torso width only.
 */

/** @type {Record<string, PersonaFaceTraits>} */
export const PERSONA_FACE_TRAITS = {
  // ── team ────────────────────────────────────────────────────────────────
  // Martin Starr: olive skin, black centre-part curtain, full beard, and the
  // half-lidded deadpan that IS Gilfoyle. Black band tee.
  gilfoyle: {
    skin: 'olive',
    hair: 'curtain',
    hairColor: 'black',
    facialHair: 'beard',
    glasses: 'none',
    accessory: 'none',
    expression: 'neutral',
    faceShape: 'oval',
    brows: 'straight',
    eyes: 'lidded',
    nose: 'straight',
    top: 'tee',
    build: 'regular'
  },
  // Kumail Nanjiani: tan, black textured crop, faint stubble, heavy brows,
  // almond eyes; wears patterned sweaters. Permanently put-upon.
  dinesh: {
    skin: 'tan',
    hair: 'crop',
    hairColor: 'black',
    facialHair: 'stubble',
    glasses: 'none',
    accessory: 'none',
    expression: 'tired',
    faceShape: 'oval',
    brows: 'thick',
    eyes: 'almond',
    nose: 'straight',
    top: 'sweater',
    build: 'regular'
  },
  // T.J. Miller: rounder face, dirty-blond wavy shag, scruffy beard, broad
  // nose, signature smirk; hawaiian shirt over a broad frame.
  erlich: {
    skin: 'light',
    hair: 'shag',
    hairColor: 'dirtyBlond',
    facialHair: 'scruff',
    glasses: 'none',
    accessory: 'none',
    expression: 'smirk',
    faceShape: 'round',
    brows: 'thick',
    eyes: 'dot',
    nose: 'broad',
    top: 'hawaiian',
    build: 'broad'
  },
  // Chris Diamantopoulos: square jaw, brown spiky sweep, light stubble, the
  // manic tres-commas grin, gold chain over a loud dress shirt.
  russ: {
    skin: 'tan',
    hair: 'spiky',
    hairColor: 'brown',
    facialHair: 'stubble',
    glasses: 'none',
    accessory: 'chain',
    expression: 'wide',
    faceShape: 'square',
    brows: 'straight',
    eyes: 'dot',
    nose: 'straight',
    top: 'oxford',
    build: 'broad'
  },
  // Zach Woods: porcelain, long narrow face, neat dark-blond side sweep, big
  // gentle eyes, small nose, soft anxious smile; blue oxford on a slim frame.
  jared: {
    skin: 'porcelain',
    hair: 'sweep',
    hairColor: 'darkBlond',
    facialHair: 'none',
    glasses: 'none',
    accessory: 'none',
    expression: 'smile',
    faceShape: 'long',
    brows: 'thin',
    eyes: 'round',
    nose: 'button',
    top: 'oxford',
    build: 'slim'
  },
  // Thomas Middleditch: pale, long face, dark-brown side part, deep-set tired
  // eyes, thin brows; the signature hoodie. No glasses — that was a misread.
  richard: {
    skin: 'porcelain',
    hair: 'sidepart',
    hairColor: 'brown',
    facialHair: 'none',
    glasses: 'none',
    accessory: 'none',
    expression: 'tired',
    faceShape: 'long',
    brows: 'thin',
    eyes: 'deep',
    nose: 'straight',
    top: 'hoodie',
    build: 'slim'
  },

  // ── senior ──────────────────────────────────────────────────────────────
  ciso: {
    skin: 'olive',
    hair: 'ponytail',
    hairColor: 'black',
    facialHair: 'none',
    glasses: 'square',
    accessory: 'badge',
    expression: 'frown',
    faceShape: 'oval',
    brows: 'thin',
    eyes: 'dot',
    nose: 'button',
    top: 'blazer',
    build: 'regular'
  },
  // Matt Ross: fair, slicked-back greying hair, intense deep-set stare, the
  // dark v-neck — Gavin never wears the tie the old row gave him.
  belson: {
    skin: 'light',
    hair: 'slicked',
    hairColor: 'saltPepper',
    facialHair: 'none',
    glasses: 'none',
    accessory: 'none',
    expression: 'neutral',
    faceShape: 'oval',
    brows: 'straight',
    eyes: 'deep',
    nose: 'straight',
    top: 'vneck',
    build: 'regular'
  },
  cfo: {
    skin: 'porcelain',
    hair: 'bob',
    hairColor: 'auburn',
    facialHair: 'none',
    glasses: 'round',
    accessory: 'lanyard',
    expression: 'neutral',
    faceShape: 'oval',
    brows: 'thin',
    eyes: 'dot',
    nose: 'button',
    top: 'blazer',
    build: 'regular'
  },
  // Stephen Tobolowsky: round friendly face, short grey hair, bushy grey
  // brows, broad nose, warm salesman's smile; sweater over the corporate tie.
  barker: {
    skin: 'light',
    hair: 'short',
    hairColor: 'grey',
    facialHair: 'none',
    glasses: 'none',
    accessory: 'tie',
    expression: 'smile',
    faceShape: 'round',
    brows: 'bushy',
    eyes: 'dot',
    nose: 'broad',
    top: 'sweater',
    build: 'broad'
  },

  // ── office floor ────────────────────────────────────────────────────────
  intern: {
    skin: 'light',
    hair: 'crop',
    hairColor: 'blond',
    facialHair: 'none',
    glasses: 'none',
    accessory: 'lanyard',
    expression: 'wide',
    faceShape: 'square',
    brows: 'thin',
    eyes: 'round',
    nose: 'button',
    top: 'tee',
    build: 'broad'
  },
  scrumMaster: {
    skin: 'porcelain',
    hair: 'ponytail',
    hairColor: 'brown',
    facialHair: 'none',
    glasses: 'none',
    accessory: 'lanyard',
    expression: 'smile',
    faceShape: 'round',
    brows: 'thin',
    eyes: 'dot',
    nose: 'button',
    top: 'sweater',
    build: 'regular'
  },
  helpdesk: {
    skin: 'olive',
    hair: 'buzz',
    hairColor: 'black',
    facialHair: 'stubble',
    glasses: 'none',
    accessory: 'headset',
    expression: 'tired',
    faceShape: 'round',
    brows: 'straight',
    eyes: 'deep',
    nose: 'broad',
    top: 'tee',
    build: 'regular'
  },
  facilities: {
    skin: 'tan',
    hair: 'receding',
    hairColor: 'grey',
    facialHair: 'moustache',
    glasses: 'none',
    accessory: 'none',
    expression: 'neutral',
    faceShape: 'square',
    brows: 'bushy',
    eyes: 'dot',
    nose: 'broad',
    top: 'oxford',
    build: 'regular'
  },
  hr: {
    skin: 'light',
    hair: 'bob',
    hairColor: 'blond',
    facialHair: 'none',
    glasses: 'round',
    accessory: 'badge',
    expression: 'smile',
    faceShape: 'round',
    brows: 'thin',
    eyes: 'dot',
    nose: 'button',
    top: 'sweater',
    build: 'regular'
  },
  greybeard: {
    skin: 'porcelain',
    hair: 'receding',
    hairColor: 'grey',
    facialHair: 'beard',
    glasses: 'square',
    accessory: 'none',
    expression: 'tired',
    faceShape: 'long',
    brows: 'bushy',
    eyes: 'deep',
    nose: 'broad',
    top: 'tee',
    build: 'slim'
  }
};

/**
 * @param {string} id
 * @returns {PersonaFaceTraits | null}
 */
export function personaFaceTraits(id) {
  return PERSONA_FACE_TRAITS[id] ?? null;
}
