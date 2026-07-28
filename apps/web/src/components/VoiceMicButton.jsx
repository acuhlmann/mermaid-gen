import { CONTROLS_EN } from '../i18n/locales/controls.en.js';
import { useFieldVoiceInput } from '../hooks/useFieldVoiceInput.js';
import { useUiCopy } from '../i18n/useUiLocale.js';

/**
 * Mic control for inline text fields (meeting raise-hand, Slop Chat, etc.).
 */
export default function VoiceMicButton({
  value,
  onChange,
  disabled = false,
  narrowLayout = false,
  className = 'overlay-button is-mic-toggle',
  copy = CONTROLS_EN.prompt,
  uiLocale
}) {
  const { uiLocale: locale } = useUiCopy();
  const {
    voiceListening,
    voiceSupported,
    handleMicPointerDown,
    handleMicPointerUp,
    handleMicToggleClick
  } = useFieldVoiceInput({
    value,
    onChange,
    disabled,
    uiLocale: uiLocale ?? locale
  });

  const micProps = narrowLayout
    ? {
        onPointerUp: (event) => {
          event.preventDefault();
          event.stopPropagation();
          handleMicToggleClick(event);
        }
      }
    : {
        onPointerDown: handleMicPointerDown,
        onPointerUp: handleMicPointerUp,
        onPointerCancel: handleMicPointerUp,
        onLostPointerCapture: handleMicPointerUp
      };

  return (
    <button
      type="button"
      className={`${className}${voiceListening ? ' is-listening' : ''}`}
      disabled={!voiceSupported || disabled}
      {...micProps}
      aria-label={
        narrowLayout ? (voiceListening ? copy.tapToStop : copy.tapToDictate) : copy.holdToSpeak
      }
      aria-pressed={narrowLayout ? voiceListening : undefined}
      title={
        voiceSupported
          ? narrowLayout
            ? voiceListening
              ? copy.tapToStop
              : copy.tapToDictatePrompt
            : copy.holdToDictate
          : copy.voiceUnsupported
      }
    >
      <span aria-hidden="true">{voiceListening ? '🎙️' : '🎤'}</span>
      <span className="button-label">{copy.mic}</span>
    </button>
  );
}
