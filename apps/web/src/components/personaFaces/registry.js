/**
 * Per-persona face traits for <PersonaFace> (see ./index.jsx).
 *
 * One parametric face component reads these rows, so a new cast member costs a
 * data row rather than new artwork — which matters because the roster has a
 * documented future bench (docs/office-parody.md:82-88).
 *
 * Traits are derived from each character's existing name/title/blurb in
 * officeCast.js and slopitectCopy.js, not invented: Ulrich "Staff Engineer
 * Emeritus" is the receding-grey-beard, Dave "Tier 1 (of 1)" wears the headset,
 * Sasha of "The Department of No" gets the square glasses and the flat mouth.
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
  grey: '#9aa0a6',
  white: '#dde1e6'
};

/**
 * @typedef {object} PersonaFaceTraits
 * @property {keyof typeof SKIN_TONES} skin
 * @property {'short' | 'bob' | 'bald' | 'receding' | 'ponytail' | 'buzz' | 'long'} hair
 * @property {keyof typeof HAIR_COLORS} hairColor
 * @property {'none' | 'stubble' | 'moustache' | 'beard'} facialHair
 * @property {'none' | 'round' | 'square' | 'visor'} glasses
 * @property {'none' | 'headset' | 'hardhat' | 'lanyard' | 'tie' | 'badge'} accessory
 * @property {'neutral' | 'smile' | 'smirk' | 'frown' | 'wide' | 'tired'} expression
 */

/** @type {Record<string, PersonaFaceTraits>} */
export const PERSONA_FACE_TRAITS = {
  // ── team ────────────────────────────────────────────────────────────────
  refine: {
    skin: 'olive',
    hair: 'short',
    hairColor: 'brown',
    facialHair: 'stubble',
    glasses: 'none',
    accessory: 'hardhat',
    expression: 'smile'
  },
  innovate: {
    skin: 'light',
    hair: 'buzz',
    hairColor: 'black',
    facialHair: 'none',
    glasses: 'round',
    accessory: 'none',
    expression: 'smirk'
  },
  goMad: {
    skin: 'porcelain',
    hair: 'long',
    hairColor: 'auburn',
    facialHair: 'none',
    glasses: 'none',
    accessory: 'none',
    expression: 'wide'
  },
  critique: {
    skin: 'tan',
    hair: 'bob',
    hairColor: 'black',
    facialHair: 'none',
    glasses: 'square',
    accessory: 'badge',
    expression: 'frown'
  },
  explain: {
    skin: 'porcelain',
    hair: 'long',
    hairColor: 'white',
    facialHair: 'beard',
    glasses: 'none',
    accessory: 'none',
    expression: 'smile'
  },

  // ── senior ──────────────────────────────────────────────────────────────
  exec: {
    skin: 'light',
    hair: 'receding',
    hairColor: 'grey',
    facialHair: 'none',
    glasses: 'none',
    accessory: 'tie',
    expression: 'smirk'
  },
  ciso: {
    skin: 'olive',
    hair: 'ponytail',
    hairColor: 'black',
    facialHair: 'none',
    glasses: 'square',
    accessory: 'badge',
    expression: 'frown'
  },
  cto: {
    skin: 'deep',
    hair: 'buzz',
    hairColor: 'black',
    facialHair: 'stubble',
    glasses: 'none',
    accessory: 'none',
    expression: 'smile'
  },
  cfo: {
    skin: 'porcelain',
    hair: 'bob',
    hairColor: 'auburn',
    facialHair: 'none',
    glasses: 'round',
    accessory: 'lanyard',
    expression: 'neutral'
  },
  barker: {
    skin: 'tan',
    hair: 'short',
    hairColor: 'grey',
    facialHair: 'none',
    glasses: 'none',
    accessory: 'tie',
    expression: 'smile'
  },

  // ── office floor ────────────────────────────────────────────────────────
  intern: {
    skin: 'light',
    hair: 'short',
    hairColor: 'blond',
    facialHair: 'none',
    glasses: 'none',
    accessory: 'lanyard',
    expression: 'wide'
  },
  scrumMaster: {
    skin: 'porcelain',
    hair: 'ponytail',
    hairColor: 'brown',
    facialHair: 'none',
    glasses: 'none',
    accessory: 'lanyard',
    expression: 'smile'
  },
  helpdesk: {
    skin: 'olive',
    hair: 'short',
    hairColor: 'black',
    facialHair: 'stubble',
    glasses: 'none',
    accessory: 'headset',
    expression: 'tired'
  },
  facilities: {
    skin: 'tan',
    hair: 'receding',
    hairColor: 'grey',
    facialHair: 'moustache',
    glasses: 'none',
    accessory: 'none',
    expression: 'neutral'
  },
  hr: {
    skin: 'light',
    hair: 'bob',
    hairColor: 'blond',
    facialHair: 'none',
    glasses: 'round',
    accessory: 'badge',
    expression: 'smile'
  },
  greybeard: {
    skin: 'porcelain',
    hair: 'receding',
    hairColor: 'grey',
    facialHair: 'beard',
    glasses: 'square',
    accessory: 'none',
    expression: 'tired'
  }
};

/**
 * @param {string} id
 * @returns {PersonaFaceTraits | null}
 */
export function personaFaceTraits(id) {
  return PERSONA_FACE_TRAITS[id] ?? null;
}
