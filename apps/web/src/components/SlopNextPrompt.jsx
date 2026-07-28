import { useEffect, useRef, useState } from 'react';
import { CONTROLS_EN } from '../i18n/locales/controls.en.js';

const DEFAULT_COPY = CONTROLS_EN.prompt;

/**
 * Inline “what should we slop next?” prompt — expands in the bottom action bar or
 * beside the radial menu instead of a modal overlay. Voice + submit live in App.
 */
export default function SlopNextPrompt({
  layout = 'chrome',
  prompt,
  busy = false,
  voiceSupported = false,
  voiceListening = false,
  narrowLayout = false,
  speechRecognitionCtor = null,
  PromptIcon,
  MicIcon,
  MicActiveIcon,
  ButtonIcon,
  copy = DEFAULT_COPY,
  onPromptChange,
  onSubmit,
  onClose,
  onMicToggleClick,
  onMicPointerDown,
  onMicPointerUp,
  onMicLostPointerCapture,
  style
}) {
  const inputRef = useRef(null);
  const [inputFocused, setInputFocused] = useState(false);
  const isDesk = layout === 'desk';
  const inputId =
    layout === 'radial'
      ? 'slop-prompt-radial-input'
      : isDesk
        ? 'slop-prompt-desk-input'
        : 'slop-prompt-chrome-input';

  useEffect(() => {
    // The desk Work Order is always mounted; stealing focus (and scrolling it
    // into view) on every mount would hijack the page, so only the transient
    // popover layouts auto-focus.
    if (isDesk) return undefined;
    const id = window.setTimeout(
      () => {
        const el = inputRef.current;
        if (!el) return;
        try {
          el.focus({ preventScroll: true });
        } catch {
          el.focus();
        }
        try {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } catch {
          // ignore
        }
      },
      narrowLayout ? 80 : 30
    );
    return () => window.clearTimeout(id);
  }, [narrowLayout, isDesk]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = (prompt ?? '').trim();
    if (!trimmed || busy) return;
    onSubmit?.(trimmed);
  }

  const micProps = narrowLayout
    ? {
        onPointerUp: (event) => {
          event.preventDefault();
          event.stopPropagation();
          onMicToggleClick?.(event);
        }
      }
    : {
        onPointerDown: onMicPointerDown,
        onPointerUp: onMicPointerUp,
        onPointerCancel: onMicPointerUp,
        onLostPointerCapture: onMicLostPointerCapture
      };

  const isEmptyPrompt = !(prompt ?? '').trim();
  const hideDeskIdleChrome = isDesk && isEmptyPrompt && !busy && !inputFocused && !voiceListening;
  // Narrow desk: keep the placeholder fully visible on focus — no eyebrow /
  // primary until there's text. Mic still appears so voice-first works.
  const showDeskEyebrow = isDesk && (narrowLayout ? !isEmptyPrompt : !hideDeskIdleChrome);
  // Desk always exposes the mic; submit/eyebrow still follow idle rules.
  const showDeskActionRow = isDesk || !hideDeskIdleChrome;
  const showDeskPrimary = !isDesk || (!hideDeskIdleChrome && (!narrowLayout || !isEmptyPrompt));

  function handleDeskInputFocus(event) {
    if (!isDesk || typeof window === 'undefined') return;
    // The desk Work Order is always visible in the bottom chrome; letting the
    // browser scroll it into view on focus steals canvas space (especially on
    // mobile keyboards and foldable hinges).
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
    });
    try {
      event.target.focus({ preventScroll: true });
    } catch {
      // ignore
    }
  }

  function handleFormFocus() {
    setInputFocused(true);
  }

  function handleFormBlur(event) {
    // Keep chrome visible while focus moves to the mic/submit inside this form.
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setInputFocused(false);
  }

  return (
    <form
      className={`slop-prompt-panel slop-prompt-panel--${layout}${narrowLayout ? ' is-narrow' : ''}${hideDeskIdleChrome ? ' is-desk-idle' : ''}`}
      style={style}
      onSubmit={handleSubmit}
      onFocus={handleFormFocus}
      onBlur={handleFormBlur}
      data-testid={`slop-prompt-panel-${layout}`}
      autoComplete="off"
    >
      {isDesk ? (
        showDeskEyebrow ? (
          <span
            className="slop-prompt-panel-eyebrow slop-prompt-panel-eyebrow--desk"
            aria-hidden="true"
          >
            {PromptIcon ? <PromptIcon /> : '📝'}
          </span>
        ) : null
      ) : (
        <div className="slop-prompt-panel-head">
          <span className="slop-prompt-panel-eyebrow" aria-hidden="true">
            {PromptIcon ? <PromptIcon /> : '💬'}
          </span>
          <p className="slop-prompt-panel-title" id={`${inputId}-label`}>
            {copy.slopNextTitle}
          </p>
          <button
            type="button"
            className="slop-prompt-panel-close"
            onClick={onClose}
            aria-label={copy.closePrompt}
          >
            ×
          </button>
        </div>
      )}
      <label className="sr-only" htmlFor={inputId}>
        {isDesk ? (copy.deskLabel ?? copy.slopNextLabel) : copy.slopNextLabel}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        className="slop-prompt-panel-input"
        type="text"
        name={isDesk ? 'work-order' : 'slop-prompt'}
        value={prompt ?? ''}
        onChange={(event) => onPromptChange?.(event.target.value)}
        placeholder={
          isDesk ? (copy.deskPlaceholder ?? copy.slopNextPlaceholder) : copy.slopNextPlaceholder
        }
        disabled={busy}
        inputMode="text"
        enterKeyHint="go"
        autoComplete="on"
        autoCapitalize="sentences"
        autoCorrect="on"
        spellCheck
        onFocus={isDesk ? handleDeskInputFocus : undefined}
        // Desk layout has no title element; the sr-only <label htmlFor> names it.
        aria-labelledby={isDesk ? undefined : `${inputId}-label`}
      />
      {showDeskActionRow ? (
        <div className="slop-prompt-panel-actions">
          <button
            type="button"
            className={`overlay-button is-mic-toggle ${voiceListening ? 'is-listening' : ''}`}
            disabled={!voiceSupported || busy}
            {...micProps}
            aria-label={
              narrowLayout
                ? voiceListening
                  ? copy.tapToStop
                  : copy.tapToDictate
                : copy.holdToSpeak
            }
            aria-pressed={narrowLayout ? voiceListening : undefined}
            title={
              voiceSupported
                ? narrowLayout
                  ? voiceListening
                    ? copy.tapToStop
                    : copy.tapToDictatePrompt
                  : copy.holdToDictate
                : speechRecognitionCtor
                  ? copy.voiceNeedsHttps
                  : copy.voiceUnsupported
            }
          >
            {ButtonIcon ? (
              <ButtonIcon>{voiceListening ? <MicActiveIcon /> : <MicIcon />}</ButtonIcon>
            ) : null}
            <span className="button-label">{copy.mic}</span>
          </button>
          {showDeskPrimary ? (
            <button
              type="submit"
              className="overlay-button primary-button"
              disabled={busy || isEmptyPrompt}
            >
              {ButtonIcon ? <ButtonIcon>{'>'}</ButtonIcon> : '>'}
              <span className="button-label">{copy.doIt}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
