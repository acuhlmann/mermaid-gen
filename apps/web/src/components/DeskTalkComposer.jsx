import { useId, useState } from 'react';
import { PersonaFace } from './personaFaces/index.jsx';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';

/**
 * Lane 2 of the composer band: **say it out loud**.
 *
 * The desk has only ever had one prompt and it goes to the production pipeline.
 * This is the other thing you do all day at a desk — say something to the room
 * and see who picks it up. It is the same `imSomeone` verb Slop Chat sends,
 * with its own reactive budget (`TALK_LLM_CAP`), landing in the same
 * `imHistory`; the reply answers as speech at your desk (`OfficeDeskSpeech`).
 *
 * Two acts, one field, distinguished only by whether a `target` is set:
 * **undirected** (null — someone apt answers) and **directed** (you turned to
 * the person next to you). The roster's face/name sets the target; the chip on
 * the same row still delegates, which is the *other* channel — the only one
 * that spends pipeline compute (ADR-0010).
 *
 * Nothing here can produce slot content. Worst case a reply carries a pitch,
 * and a pitch is a button you press.
 *
 * @param {{
 *   target?: string | null,
 *   onClearTarget?: () => void,
 *   onSubmit: (colleagueId: string | null, text: string) => void,
 *   busy?: boolean,
 *   disabled?: boolean,
 *   disabledReason?: string | null
 * }} props
 */
export default function DeskTalkComposer({
  target = null,
  onClearTarget,
  onSubmit,
  busy = false,
  disabled = false,
  disabledReason = null
}) {
  const copy = officeChromeCopy().talk ?? {};
  const [text, setText] = useState('');
  const fieldId = useId();
  const person = target ? officeSenderInfo(target) : null;
  const canSend = text.trim().length > 0 && !busy && !disabled;

  const placeholder = person
    ? formatLocale(copy.placeholderNamed ?? 'Say something to {name}…', { name: person.name })
    : (copy.placeholder ?? 'Say it out loud…');

  const label = person
    ? formatLocale(copy.ariaNamed ?? 'Say something to {name}', { name: person.name })
    : (copy.aria ?? 'Say something out loud');

  const handleSubmit = (event) => {
    event.preventDefault();
    const body = text.trim();
    if (!body || busy || disabled) return;
    setText('');
    onSubmit?.(target ?? null, body);
  };

  return (
    <form
      className={`desk-talk-composer${person ? ' is-directed' : ''}${busy ? ' is-busy' : ''}`}
      data-testid="desk-talk-composer"
      onSubmit={handleSubmit}
    >
      {/* Who you are addressing is a *chip*, not a dropdown: the roster already
          is the picker, and duplicating it here would be a sixth surface. */}
      {person ? (
        <button
          type="button"
          className="desk-talk-target"
          data-testid="desk-talk-target"
          title={formatLocale(copy.clearTargetTitle ?? 'Say it to the room instead', {
            name: person.name
          })}
          aria-label={formatLocale(copy.clearTargetAria ?? 'Stop addressing {name}', {
            name: person.name
          })}
          onClick={() => onClearTarget?.()}
        >
          <PersonaFace id={target} size={18} />
          <span className="desk-talk-target-name">{person.name.split(' ')[0]}</span>
          <span className="desk-talk-target-clear" aria-hidden="true">
            ×
          </span>
        </button>
      ) : (
        <span className="desk-talk-room" aria-hidden="true" title={copy.roomTitle ?? label}>
          🗣️
        </span>
      )}

      <label className="sr-only" htmlFor={fieldId}>
        {label}
      </label>
      <input
        id={fieldId}
        type="text"
        className="desk-talk-input"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        title={disabled ? (disabledReason ?? undefined) : undefined}
        onChange={(event) => setText(event.target.value)}
      />
      <button
        type="submit"
        className="desk-talk-send"
        data-testid="desk-talk-send"
        disabled={!canSend}
        aria-label={copy.send ?? 'Say it'}
        title={disabled ? (disabledReason ?? undefined) : (copy.sendTitle ?? copy.send)}
      >
        {busy ? (copy.sending ?? '…') : (copy.send ?? 'Say it')}
      </button>
    </form>
  );
}
