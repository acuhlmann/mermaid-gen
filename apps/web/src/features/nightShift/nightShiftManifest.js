/**
 * The Night Shift manifest as this build baked it (`vite.config.js` →
 * `__ARCHISLOP_NIGHT_SHIFT__`, parsed by `utils/nightShiftLedger.js`).
 *
 * Read through a function rather than imported as a constant so tests can hand
 * the board a known shift instead of whatever the ledgers say today.
 */

/* global __ARCHISLOP_NIGHT_SHIFT__ */

/** @typedef {import('../../utils/nightShiftLedger.js').NightShiftManifest} NightShiftManifest */

/** @type {NightShiftManifest} */
const EMPTY_MANIFEST = Object.freeze({ shiftDate: null, crew: [] });

/** @type {NightShiftManifest | null} */
let override = null;

/** @returns {NightShiftManifest} */
function baked() {
  try {
    const value =
      typeof __ARCHISLOP_NIGHT_SHIFT__ === 'undefined' ? null : __ARCHISLOP_NIGHT_SHIFT__;
    return value && Array.isArray(value.crew) ? value : EMPTY_MANIFEST;
  } catch {
    return EMPTY_MANIFEST;
  }
}

/** @returns {NightShiftManifest} */
export function getNightShiftManifest() {
  return override ?? baked();
}

/**
 * @param {NightShiftManifest | null} manifest `null` restores the baked one.
 */
export function setNightShiftManifestForTests(manifest) {
  override = manifest;
}
