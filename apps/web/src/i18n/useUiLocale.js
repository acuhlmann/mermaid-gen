import { useContext } from 'react';
import { DEFAULT_UI_LOCALE } from '@archislop/shared';
import { getUiLocaleBundle } from './getUiLocaleBundle.js';
import { setActiveControlsCopy } from './activeControlsCopy.js';
import { UiLocaleContext } from './uiLocaleContext.js';

function buildFallbackUiLocaleValue() {
  const bundle = getUiLocaleBundle(DEFAULT_UI_LOCALE);
  setActiveControlsCopy(bundle.controls);
  return {
    locale: DEFAULT_UI_LOCALE,
    bundle,
    controls: bundle.controls,
    slopitect: bundle.slopitect,
    setLocale: () => {},
    applyLocaleFromText: () => {}
  };
}

const FALLBACK_UI_LOCALE_VALUE = buildFallbackUiLocaleValue();

export function useUiLocale() {
  const ctx = useContext(UiLocaleContext);
  return ctx ?? FALLBACK_UI_LOCALE_VALUE;
}

/** Convenience hook — returns the merged controls + slopitect copy for the active locale. */
export function useUiCopy() {
  return useUiLocale();
}
