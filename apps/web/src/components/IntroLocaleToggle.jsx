/** @typedef {import('@archislop/shared').UiLocale} UiLocale */
import { useEffect, useRef, useState } from 'react';

const LOCALE_OPTIONS = [
  { id: 'en', label: 'EN' },
  { id: 'zh-CN', label: '简' },
  { id: 'zh-TW', label: '繁' }
];

/**
 * Compact language picker for the empty-state intro only. Shows the active
 * locale as a single pill; other choices expand in a small menu on tap.
 */
export default function IntroLocaleToggle({ locale, copy, onSelectLocale }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const optionLabels = {
    en: copy.en,
    'zh-CN': copy.zhCn,
    'zh-TW': copy.zhTw
  };

  const current =
    LOCALE_OPTIONS.find((option) => option.id === locale) ?? LOCALE_OPTIONS[0];
  const alternatives = LOCALE_OPTIONS.filter((option) => option.id !== current.id);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const handleSelect = (/** @type {UiLocale} */ nextLocale) => {
    onSelectLocale?.(nextLocale);
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`intro-locale-toggle${open ? ' is-open' : ''}`}
      data-testid="intro-locale-toggle"
    >
      <button
        type="button"
        className="intro-locale-trigger"
        aria-label={copy.aria}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={optionLabels[current.id]}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="intro-locale-trigger-label">{current.label}</span>
        <span className="intro-locale-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="intro-locale-menu" role="listbox" aria-label={copy.aria}>
          {alternatives.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              className="intro-locale-option"
              aria-selected={false}
              aria-label={optionLabels[option.id]}
              title={optionLabels[option.id]}
              onClick={() => handleSelect(/** @type {UiLocale} */ (option.id))}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
