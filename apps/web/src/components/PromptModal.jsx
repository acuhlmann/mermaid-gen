import { useEffect, useRef } from 'react';

/**
 * Centered prompt-input dialog. Mirrors the bottom-chrome prompt form so the
 * user can dictate a new instruction at any time — including after a diagram
 * already exists. Voice + submit logic is owned by App and passed in; this
 * component only owns layout, focus, and Escape-to-close.
 */
export default function PromptModal({
  open,
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
  onMicLostPointerCapture
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = (prompt ?? '').trim();
    if (!trimmed || busy) return;
    onSubmit?.(trimmed);
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) onClose?.();
  }

  const micProps = narrowLayout
    ? { onClick: onMicToggleClick }
    : {
        onPointerDown: onMicPointerDown,
        onPointerUp: onMicPointerUp,
        onPointerCancel: onMicPointerUp,
        onLostPointerCapture: onMicLostPointerCapture
      };

  return (
    <div
      className="prompt-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-modal-title"
      onPointerDown={handleBackdropClick}
    >
      <form className="prompt-modal-card" onSubmit={handleSubmit}>
        <div className="prompt-modal-header">
          <span className="prompt-modal-eyebrow" aria-hidden="true">
            {PromptIcon ? <PromptIcon /> : '📝'}
          </span>
          <h2 id="prompt-modal-title" className="prompt-modal-title">
            What should we slop next?
          </h2>
          <button
            type="button"
            className="prompt-modal-close"
            onClick={onClose}
            aria-label="Close prompt"
          >
            ×
          </button>
        </div>
        <label className="sr-only" htmlFor="prompt-modal-input">
          New prompt
        </label>
        <input
          id="prompt-modal-input"
          ref={inputRef}
          className="prompt-modal-input"
          value={prompt ?? ''}
          onChange={(event) => onPromptChange?.(event.target.value)}
          placeholder="Tell the agent what to change…"
          disabled={busy}
          autoComplete="off"
          autoCapitalize="sentences"
        />
        <div className="prompt-modal-actions">
          <button
            type="button"
            className={`overlay-button ${voiceListening ? 'is-listening' : ''}`}
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
            <span className="button-label">Go</span>
          </button>
        </div>
      </form>
    </div>
  );
}
