/** @typedef {import('@archislop/shared').UiLocale} UiLocale */

const LOCALE_OPTIONS = [
  { id: 'en', label: 'EN' },
  { id: 'zh-CN', label: '简' },
  { id: 'zh-TW', label: '繁' }
];

/**
 * Compact three-way language picker for the empty-state intro only. English
 * default; simplified and traditional Chinese via short script labels so the
 * control stays unobtrusive beside the brand chrome.
 */
export default function IntroLocaleToggle({ locale, copy, onSelectLocale }) {
  const optionLabels = {
    en: copy.en,
    'zh-CN': copy.zhCn,
    'zh-TW': copy.zhTw
  };

  return (
    <div
      className="intro-locale-toggle"
      role="group"
      aria-label={copy.aria}
      data-testid="intro-locale-toggle"
    >
      {LOCALE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`intro-locale-option${option.id === locale ? ' is-selected' : ''}`}
          aria-pressed={option.id === locale}
          aria-label={optionLabels[option.id]}
          title={optionLabels[option.id]}
          onClick={() => onSelectLocale?.(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
