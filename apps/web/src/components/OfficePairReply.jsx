/**
 * Your side of a pairing conversation.
 *
 * Shared by both huddle renderers rather than written twice: the desk overlay
 * and the floor card are two drawings of one state (ADR-0011 rule 1), and a
 * reply strip that existed in only one of them would be the fork that rule
 * exists to prevent. The strip is local-state only — what you have typed is not
 * a fact about the office, so it does not belong in `officeMomentStore`.
 *
 * Three chips sit next to the input because a real answer to somebody at your
 * shoulder is usually two words. They send immediately: the point of a chip is
 * that it is faster than typing, so making one focus the box first would defeat
 * it.
 */

import { useCallback, useState } from 'react';
import { formatLocale } from '../i18n/formatLocale.js';

/**
 * English fallbacks. The huddle bundle normally supplies all of these; the
 * defaults exist because `officeChromeCopy()` swaps whole locale bundles rather
 * than merging, so a bundle that predates the reply strip must still render one.
 */
const REPLY_COPY = {
  label: 'Answer {name}',
  placeholder: 'Say something back…',
  send: 'Say it',
  chips: [
    { id: 'show', key: 'pairReplyChipShow', label: 'Show me' },
    { id: 'why', key: 'pairReplyChipWhy', label: 'Why that?' },
    { id: 'agree', key: 'pairReplyChipAgree', label: 'Yeah, agreed' }
  ]
};

/**
 * Resolve the strip's copy once, up front. Keeping the fallbacks out of the
 * component is what keeps it readable: a render body that is mostly `??` chains
 * is doing translation work, not drawing anything.
 *
 * @param {Record<string, any> | null | undefined} copy
 */
function resolveReplyCopy(copy) {
  const source = copy ?? {};
  return {
    label: source.pairReplyLabel ?? REPLY_COPY.label,
    placeholder: source.pairReplyPlaceholder ?? REPLY_COPY.placeholder,
    send: source.pairReplySend ?? REPLY_COPY.send,
    chips: REPLY_COPY.chips.map((chip) => ({
      id: chip.id,
      label: source[chip.key] ?? chip.label
    }))
  };
}

/**
 * @param {{
 *   partnerName?: string | null,
 *   copy?: Record<string, any> | null,
 *   busy?: boolean,
 *   onReply?: (text: string) => void,
 *   testIdPrefix?: string
 * }} props `busy` is true between sending and their answer landing, which is
 *   also when the strip must not accept a second question.
 */
export default function OfficePairReply({
  partnerName = '',
  copy = null,
  busy = false,
  onReply = null,
  testIdPrefix = 'office-pair-reply'
}) {
  const [text, setText] = useState('');
  const resolved = resolveReplyCopy(copy);
  const inputId = `${testIdPrefix}-input`;

  const send = useCallback(
    (line) => {
      const trimmed = typeof line === 'string' ? line.trim() : '';
      if (!trimmed || busy) return;
      onReply?.(trimmed);
      setText('');
    },
    [busy, onReply]
  );

  return (
    <div
      className="office-pair-reply"
      data-testid={testIdPrefix}
      data-busy={busy ? 'true' : undefined}
    >
      <label className="sr-only" htmlFor={inputId}>
        {formatLocale(resolved.label, { name: partnerName ?? '' })}
      </label>
      <input
        id={inputId}
        className="office-pair-reply-input"
        type="text"
        value={text}
        disabled={busy}
        placeholder={resolved.placeholder}
        autoComplete="off"
        autoCapitalize="sentences"
        autoCorrect="on"
        enterKeyHint="send"
        onChange={(event) => setText(event.target.value)}
        // Enter sends rather than submitting: there is no form here, and the
        // overlay's Escape-to-end listener is on window, so an implicit submit
        // would have nowhere useful to go.
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          send(text);
        }}
      />
      <div className="office-pair-reply-chips" role="group">
        {resolved.chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="office-pair-reply-chip"
            disabled={busy}
            data-testid={`${testIdPrefix}-chip-${chip.id}`}
            onClick={() => send(chip.label)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="office-pair-reply-send"
        disabled={busy || !text.trim()}
        data-testid={`${testIdPrefix}-send`}
        onClick={() => send(text)}
      >
        {resolved.send}
      </button>
    </div>
  );
}
