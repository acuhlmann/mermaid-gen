import { useEffect, useRef } from 'react';

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
  const inputId = layout === 'radial' ? 'slop-prompt-radial-input' : 'slop-prompt-chrome-input';

  useEffect(() => {
    const id = window.setTimeout(
      () => {
        const el = inputRef.current;
        if (!el) return;
        try {
          el.focus({ preventScroll: true });
        } catch {
          el.focus();
        }
        // Keep the input inside the visual viewport after the mobile keyboard opens.
        try {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } catch {
          // ignore
        }
      },
      narrowLayout ? 80 : 30
    );
    return () => window.clearTimeout(id);
  }, [narrowLayout]);

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
          // pointerup + preventDefault keeps the tap from being eaten by input blur
          // on iOS when the virtual keyboard is open (click alone often does nothing).
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

  return (
    <form
      className={`slop-prompt-panel slop-prompt-panel--${layout}${narrowLayout ? ' is-narrow' : ''}`}
      style={style}
      onSubmit={handleSubmit}
      data-testid={`slop-prompt-panel-${layout}`}
    >
      <div className="slop-prompt-panel-head">
        <span className="slop-prompt-panel-eyebrow" aria-hidden="true">
          {PromptIcon ? <PromptIcon /> : '💬'}
        </span>
        <p className="slop-prompt-panel-title" id={`${inputId}-label`}>
          What should we slop next?
        </p>
        <button
          type="button"
          className="slop-prompt-panel-close"
          onClick={onClose}
          aria-label="Close prompt"
        >
          ×
        </button>
      </div>
      <label className="sr-only" htmlFor={inputId}>
        New prompt
      </label>
      <input
        id={inputId}
        ref={inputRef}
        className="slop-prompt-panel-input"
        value={prompt ?? ''}
        onChange={(event) => onPromptChange?.(event.target.value)}
        placeholder="Tell the agent what to change…"
        disabled={busy}
        autoComplete="off"
        autoCapitalize="sentences"
        aria-labelledby={`${inputId}-label`}
      />
      <div className="slop-prompt-panel-actions">
        <button
          type="button"
          className={`overlay-button is-mic-toggle ${voiceListening ? 'is-listening' : ''}`}
          disabled={!voiceSupported || busy}
          {...micProps}
          aria-label={
            narrowLayout
              ? voiceListening
                ? 'Tap to stop dictation'
                : 'Tap to dictate'
              : 'Hold to speak'
          }
          aria-pressed={narrowLayout ? voiceListening : undefined}
          title={
            voiceSupported
              ? narrowLayout
                ? voiceListening
                  ? 'Tap to stop dictation'
                  : 'Tap to dictate prompt'
                : 'Hold to dictate prompt'
              : speechRecognitionCtor
                ? 'Voice input needs a secure connection (HTTPS), except on localhost'
                : 'Voice input not supported in this browser'
          }
        >
          {ButtonIcon ? (
            <ButtonIcon>{voiceListening ? <MicActiveIcon /> : <MicIcon />}</ButtonIcon>
          ) : null}
          <span className="button-label">Mic</span>
        </button>
        <button
          type="submit"
          className="overlay-button primary-button"
          disabled={busy || !(prompt ?? '').trim()}
        >
          {ButtonIcon ? <ButtonIcon>{'>'}</ButtonIcon> : '>'}
          <span className="button-label">Do it</span>
        </button>
      </div>
    </form>
  );
}
