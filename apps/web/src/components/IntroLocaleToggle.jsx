/** @typedef {import('@archislop/shared').UiLocale} UiLocale */
import { useEffect, useRef, useState } from 'react';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';

const LOCALE_OPTIONS = [
  { id: 'en', label: 'EN' },
  { id: 'en-AU', label: 'Aussie' },
  { id: 'zh-CN', label: '简' },
  { id: 'zh-TW', label: '繁' }
];

/**
 * Compact language picker. Default: single pill that expands a menu (reception).
 * `variant="inline"`: all options laid out in a row (desk Language pack footer —
 * menu opens upward and a downward submenu would sit off-screen).
 */
export default function IntroLocaleToggle({ locale, copy, onSelectLocale, variant = 'menu' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuZIndex = useOverlayLayer('intro-locale-menu', open && variant === 'menu');

  const optionLabels = {
    en: copy.en,
    'en-AU': copy.enAu,
    'zh-CN': copy.zhCn,
    'zh-TW': copy.zhTw
  };

  const current = LOCALE_OPTIONS.find((option) => option.id === locale) ?? LOCALE_OPTIONS[0];
  const alternatives = LOCALE_OPTIONS.filter((option) => option.id !== current.id);

  useEffect(() => {
    if (!open || variant !== 'menu') return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, variant]);

  const handleSelect = (/** @type {UiLocale} */ nextLocale) => {
    onSelectLocale?.(nextLocale);
    setOpen(false);
  };

  if (variant === 'inline') {
    return (
      <div
        className="intro-locale-inline"
        role="radiogroup"
        aria-label={copy.aria}
        data-testid="intro-locale-toggle"
      >
        {LOCALE_OPTIONS.map((option) => {
          const selected = option.id === current.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              className={`intro-locale-inline-option${selected ? ' is-selected' : ''}`}
              aria-checked={selected}
              aria-label={optionLabels[option.id]}
              title={optionLabels[option.id]}
              onClick={() => handleSelect(/** @type {UiLocale} */ (option.id))}
            >
              <span className="intro-locale-inline-short">{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

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
        <div
          className="intro-locale-menu"
          style={overlayLayerStyle(menuZIndex)}
          role="listbox"
          aria-label={copy.aria}
        >
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
              <span className="intro-locale-option-short">{option.label}</span>
              <span className="intro-locale-option-name">{optionLabels[option.id]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
