import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_UI_LOCALE, normalizeUiLocale, resolveUiLocaleFromText } from '@archislop/shared';
import { getUiLocaleBundle } from './getUiLocaleBundle.js';
import { readStoredUiLocale, writeStoredUiLocale } from './uiLocaleStorage.js';
import { setActiveSlopitectBundle } from '../utils/slopitectCopy.js';
import { UiLocaleContext } from './uiLocaleContext.js';

export function UiLocaleProvider({ children, initialLocale }) {
  const [locale, setLocaleState] = useState(() => {
    if (initialLocale) return normalizeUiLocale(initialLocale);
    return readStoredUiLocale() ?? DEFAULT_UI_LOCALE;
  });

  const bundle = useMemo(() => getUiLocaleBundle(locale), [locale]);

  useEffect(() => {
    setActiveSlopitectBundle(bundle.slopitect);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'en' ? 'en' : locale;
    }
  }, [bundle, locale]);

  const setLocale = useCallback((next) => {
    const normalized = normalizeUiLocale(next);
    setLocaleState(normalized);
    writeStoredUiLocale(normalized);
  }, []);

  const applyLocaleFromText = useCallback(
    (...sources) => {
      const detected = resolveUiLocaleFromText(...sources);
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
      setLocale,
      applyLocaleFromText
    }),
    [locale, bundle, setLocale, applyLocaleFromText]
  );

  return <UiLocaleContext.Provider value={value}>{children}</UiLocaleContext.Provider>;
}
