import { useEffect, useRef, useState } from 'react';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { OFFICE_NARRATION_GAP_MS } from '../utils/officeNarration.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';

export const COFFEE_BREAK_DURATION_MS = 15_000;
/** Reading-pace gap between watercooler lines when narration is off / muted. */
export const COFFEE_LINE_PACE_MS = 2200;

/**
 * Coffee break (docs/office-parody.md). Two-phase: a small invite toast
 * ([Take 5] / [Deadline]), then a centered watercooler scene. When
 * `narrateLine` is provided, lines pace in and are spoken (overheard chat);
 * otherwise all lines show at once and the scene auto-wraps after
 * COFFEE_BREAK_DURATION_MS. Accepting is worth a small work-life-balance
 * XP nudge (wired by OfficeLayer via onAccept/onDone).
 */
export default function CoffeeBreakOverlay({ coffee, onAccept, onDecline, onDone, narrateLine }) {
  const accepted = Boolean(coffee?.accepted);
  const coffeeId = coffee?.id ?? null;
  const lineCount = coffee?.lines?.length ?? 0;
  const [visibleLines, setVisibleLines] = useState(lineCount);
  const narrateRef = useRef(narrateLine);
  useEffect(() => {
    narrateRef.current = narrateLine;
  });

  useEffect(() => {
    if (!accepted || !coffee) return undefined;
    const shouldNarrate = typeof narrateRef.current === 'function';
    if (!shouldNarrate) {
      setVisibleLines(lineCount);
      const timer = setTimeout(() => onDone?.(), COFFEE_BREAK_DURATION_MS);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    setVisibleLines(1);

    const wait = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      });

    void (async () => {
      for (let index = 0; index < lineCount; index += 1) {
        if (cancelled) return;
        setVisibleLines(index + 1);
        const line = coffee.lines[index];
        let spoken = false;
        try {
          const result = await narrateRef.current?.(line);
          spoken = Boolean(result?.spoken);
        } catch {
          spoken = false;
        }
        if (cancelled) return;
        if (index < lineCount - 1) {
          await wait(spoken ? OFFICE_NARRATION_GAP_MS : COFFEE_LINE_PACE_MS);
        }
      }
      if (!cancelled) {
        await wait(1200);
        if (!cancelled) onDone?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accepted, coffeeId, lineCount, coffee, onDone]);

  if (!coffee) return null;
  const copy = officeChromeCopy();

  if (!accepted) {
    const inviter = officeSenderInfo(coffee.lines[0]?.speakerId ?? 'facilities');
    return (
      <div className="office-coffee-invite" role="status" aria-live="polite">
        <p className="office-moment-kind office-moment-kind--coffee" aria-hidden="true">
          {copy.coffee.kindLabel}
        </p>
        <span aria-hidden="true">☕</span>
        <span
          className="office-coffee-invite-text"
          title={inviter.title ? `${inviter.name} · ${inviter.title}` : inviter.name}
        >
          {formatLocale(copy.coffee.inviteLine, { name: inviter.name })}
        </span>
        <button type="button" className="office-coffee-accept" onClick={onAccept}>
          {copy.coffee.accept}
        </button>
        <button type="button" className="office-coffee-decline" onClick={onDecline}>
          {copy.coffee.decline}
        </button>
      </div>
    );
  }

  const linesToShow = typeof narrateLine === 'function' ? visibleLines : lineCount;

  return (
    <div className="office-coffee-scene" role="dialog" aria-label={copy.coffee.sceneAria}>
      <div className="office-coffee-card">
        <div className="office-coffee-head">
          <span aria-hidden="true">☕</span> {copy.coffee.sceneTitle}
        </div>
        <ul className="office-coffee-lines">
          {coffee.lines.slice(0, linesToShow).map((line, index) => {
            const speaker = officeSenderInfo(line.speakerId);
            return (
              <li key={`${coffee.id}-${index}`} className="office-coffee-line">
                <span
                  className="office-coffee-avatar"
                  aria-hidden="true"
                  title={speaker.title ? `${speaker.name} · ${speaker.title}` : speaker.name}
                >
                  <PersonaFace id={line.speakerId} size={26} />
                </span>
                <span>
                  <span
                    className="office-coffee-speaker"
                    title={speaker.title ? `${speaker.name} · ${speaker.title}` : speaker.name}
                  >
                    {speaker.name}:
                  </span>{' '}
                  {line.text}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="office-coffee-footer">
          <span className="office-coffee-timer" aria-hidden="true" />
          <button type="button" className="office-coffee-done" onClick={onDone}>
            {copy.coffee.done}
          </button>
        </div>
      </div>
    </div>
  );
}
