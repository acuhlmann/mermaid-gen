import { DEFAULT_UI_LOCALE } from '@archislop/shared';
import { getUiLocaleBundle } from './getUiLocaleBundle.js';

let activeControls = getUiLocaleBundle(DEFAULT_UI_LOCALE).controls;

/** @param {import('./locales/controls.en.js').CONTROLS_EN} controls */
export function setActiveControlsCopy(controls) {
  activeControls = controls;
}

/** Active UI chrome copy for non-React modules (stream handlers, status helpers). */
export function getActiveControlsCopy() {
  return activeControls;
}
