import { useEffect } from 'react';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';

export const COFFEE_BREAK_DURATION_MS = 15_000;

/**
 * Coffee break (docs/office-parody.md). Two-phase: a small invite toast
 * ([Take 5] / [Deadline]), then a centered watercooler scene that auto-wraps
 * after COFFEE_BREAK_DURATION_MS. Accepting is worth a small work-life-balance
 * XP nudge (wired by OfficeLayer via onAccept/onDone).
 */
export default function CoffeeBreakOverlay({ coffee, onAccept, onDecline, onDone }) {
  const accepted = Boolean(coffee?.accepted);

  useEffect(() => {
    if (!accepted) return undefined;
    const timer = setTimeout(() => onDone?.(), COFFEE_BREAK_DURATION_MS);
    return () => clearTimeout(timer);
  }, [accepted, onDone]);

  if (!coffee) return null;
  const copy = officeChromeCopy();

  if (!accepted) {
    const inviter = officeSenderInfo(coffee.lines[0]?.speakerId ?? 'facilities');
    return (
      <div className="office-coffee-invite" role="status" aria-live="polite">
        <span aria-hidden="true">☕</span>
        <span className="office-coffee-invite-text">
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

  return (
    <div className="office-coffee-scene" role="dialog" aria-label={copy.coffee.sceneAria}>
      <div className="office-coffee-card">
        <div className="office-coffee-head">
          <span aria-hidden="true">☕</span> {copy.coffee.sceneTitle}
        </div>
        <ul className="office-coffee-lines">
          {coffee.lines.map((line, index) => {
            const speaker = officeSenderInfo(line.speakerId);
            return (
              <li key={`${coffee.id}-${index}`} className="office-coffee-line">
                <span className="office-coffee-avatar" aria-hidden="true">
                  {speaker.avatarEmoji}
                </span>
                <span>
                  <span className="office-coffee-speaker">{speaker.name}:</span> {line.text}
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
