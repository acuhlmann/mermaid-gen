import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { useScenePacing } from '../hooks/useScenePacing.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';
import FloatingWindow, { FloatingWindowDragHandle } from './FloatingWindow.jsx';

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
export default function CoffeeBreakOverlay({
  coffee,
  onAccept,
  onDecline,
  onDone,
  narrateLine,
  prefetchLine
}) {
  const accepted = Boolean(coffee?.accepted);
  const lineCount = coffee?.lines?.length ?? 0;
  const visibleLines = useScenePacing({
    lines: coffee?.lines ?? [],
    active: accepted && Boolean(coffee),
    narrateLine,
    prefetchLine,
    paceMs: COFFEE_LINE_PACE_MS,
    silentDurationMs: COFFEE_BREAK_DURATION_MS,
    sceneId: coffee?.id ?? null,
    onDone
  });

  if (!coffee) return null;
  const copy = officeChromeCopy();

  if (!accepted) {
    const inviter = officeSenderInfo(coffee.lines[0]?.speakerId ?? 'facilities');
    return (
      <FloatingWindow
        id="office-coffee-invite"
        open
        group="officeChrome"
        className="office-coffee-invite"
        manageable={false}
        defaultCorner="top-center"
        defaultOffsetX={16}
        defaultOffsetY={76}
        cascade={0}
        role="status"
        aria-live="polite"
      >
        <FloatingWindowDragHandle className="office-coffee-invite-head" title="Drag to move">
          <p className="office-moment-kind office-moment-kind--coffee" aria-hidden="true">
            {copy.coffee.kindLabel}
          </p>
        </FloatingWindowDragHandle>
        <span aria-hidden="true">☕</span>
        <span
          className="office-coffee-invite-text"
          title={inviter.title ? `${inviter.name} · ${inviter.title}` : inviter.name}
        >
          {formatLocale(copy.coffee.inviteLine, { name: inviter.name })}
        </span>
        <div className="office-coffee-invite-actions">
          <button type="button" className="office-coffee-accept" onClick={onAccept}>
            {copy.coffee.accept}
          </button>
          <button type="button" className="office-coffee-decline" onClick={onDecline}>
            {copy.coffee.decline}
          </button>
        </div>
      </FloatingWindow>
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
