import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_UI_LOCALE,
  normalizeUiLocale,
  resolveUiLocaleFromExplicitRequest
} from '@archislop/shared';
import { getUiLocaleBundle } from './getUiLocaleBundle.js';
import { readStoredUiLocale, writeStoredUiLocale } from './uiLocaleStorage.js';
import { setActiveControlsCopy } from './activeControlsCopy.js';
import { setActiveOfficeBundle } from '../utils/officeCast.js';
import { setActiveSlopitectBundle } from '../utils/slopitectCopy.js';
import { UiLocaleContext } from './uiLocaleContext.js';

export function UiLocaleProvider({ children, initialLocale }) {
  const [locale, setLocaleState] = useState(() => {
    if (initialLocale) return normalizeUiLocale(initialLocale);
    return readStoredUiLocale() ?? DEFAULT_UI_LOCALE;
  });

  const bundle = useMemo(() => getUiLocaleBundle(locale), [locale]);

  // Sync module singletons during render, not in an effect. Consumers like
  // FloorArrival call `officeChromeCopy()` while rendering; if the active
  // bundle only flips after paint, the NameTag / Check in labels stay in the
  // previous language until some unrelated state update re-renders them.
  setActiveControlsCopy(bundle.controls);
  setActiveSlopitectBundle(bundle.slopitect);
  setActiveOfficeBundle(bundle.office);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'en' ? 'en' : locale;
    }
  }, [locale]);

  const setLocale = useCallback((next) => {
    const normalized = normalizeUiLocale(next);
    setLocaleState(normalized);
    writeStoredUiLocale(normalized);
  }, []);

  const applyLocaleFromText = useCallback(
    (...sources) => {
      const detected = resolveUiLocaleFromExplicitRequest(...sources);
      if (detected) setLocale(detected);
    },
    [setLocale]
  );

  const value = useMemo(
    () => ({
      locale,
      bundle,
      controls: bundle.controls,
      slopitect: bundle.slopitect,
      office: bundle.office,
      setLocale,
      applyLocaleFromText
    }),
    [locale, bundle, setLocale, applyLocaleFromText]
  );

  return <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>;
}
