/**
 * The Night Shift window: the morning standup, and the kanban board that keeps
 * its summary for anyone who missed it.
 *
 * One window with two faces rather than two windows, because the standup ends
 * by pointing at the board — "See the board" swaps the face in place, so the
 * record is one press from the moment and you never lose your place.
 *
 * Both faces read `nightShiftBoard.js`, so the standup can never mention a
 * card the board does not show.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { officeSenderInfo } from '../../utils/officeCast.js';
import { nightShiftPrUrl } from '../../utils/nightShiftLedger.js';
import {
  nightShiftColumns,
  nightShiftStandupBeats,
  shiftWhen,
  shortDate
} from './nightShiftBoard.js';
import { NIGHT_SHIFT_COPY as COPY } from './nightShiftCopy.js';
import { getNightShiftManifest } from './nightShiftManifest.js';
import {
  closeNightShift,
  getNightShiftSnapshot,
  openNightShiftBoard,
  subscribeNightShift
} from './nightShiftStore.js';
import './NightShift.css';

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const FOCUSABLE = 'a[href], button:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Cycle Tab / Shift+Tab within the dialog (the `GodAltarModal` pattern).
 *
 * @param {KeyboardEvent} event
 * @param {HTMLElement | null} dialog
 */
function trapTab(event, dialog) {
  if (!dialog) return;
  const items = [...dialog.querySelectorAll(FOCUSABLE)];
  if (items.length === 0) {
    event.preventDefault();
    dialog.focus({ preventScroll: true });
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = dialog.contains(active);
  if (event.shiftKey && (active === first || active === dialog || !inside)) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

/** @param {{ prs?: number[] }} props */
function PrLinks({ prs = [] }) {
  if (prs.length === 0) return null;
  return (
    <span className="night-shift-prs">
      {prs.map((pr) => (
        <a
          key={pr}
          className="night-shift-pr"
          href={nightShiftPrUrl(pr)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={COPY.prAria(pr)}
        >
          {COPY.prLabel(pr)}
        </a>
      ))}
    </span>
  );
}

/** @param {{ card: import('./nightShiftBoard.js').NightShiftCard }} props */
function BoardCard({ card }) {
  const present = card.column === 'shipped' || card.column === 'checked';
  return (
    <li className={`night-shift-card night-shift-card--${card.column}`} data-crew={card.id}>
      <div className="night-shift-card-who">
        <span className="night-shift-card-emoji" aria-hidden="true">
          {card.emoji}
        </span>
        <span>
          <strong className="night-shift-card-name">{card.name}</strong>
          <span className="night-shift-card-dept">{card.dept}</span>
        </span>
      </div>
      {present ? (
        card.tonight.map((entry, index) => (
          <p key={`${entry.date}-${index}`} className="night-shift-card-summary">
            {entry.summary}
          </p>
        ))
      ) : (
        <p className="night-shift-card-lastseen">
          {card.lastSeen ? COPY.lastSeen(shortDate(card.lastSeen)) : COPY.neverSeen}
        </p>
      )}
      <PrLinks prs={card.prs} />
      {card.earlier.length > 0 ? (
        <details className="night-shift-card-earlier">
          <summary>{COPY.earlier}</summary>
          <ul>
            {card.earlier.map((entry, index) => (
              <li key={`${entry.date}-${index}`}>
                <span className="night-shift-card-date">{shortDate(entry.date)}</span>{' '}
                {entry.summary} <PrLinks prs={entry.prs} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

/** @param {{ manifest: import('../../utils/nightShiftLedger.js').NightShiftManifest }} props */
function BoardFace({ manifest }) {
  const columns = useMemo(() => nightShiftColumns(manifest), [manifest]);
  if (!manifest.shiftDate) {
    return <p className="night-shift-empty">{COPY.boardEmpty}</p>;
  }
  return (
    <div className="night-shift-board" data-testid="night-shift-board">
      {columns.map((column) => (
        <section
          key={column.id}
          className={`night-shift-column night-shift-column--${column.id}`}
          aria-label={column.title}
        >
          <h3 className="night-shift-column-title">
            {column.title} <span className="night-shift-column-count">{column.cards.length}</span>
          </h3>
          <ul className="night-shift-column-cards">
            {column.cards.map((card) => (
              <BoardCard key={card.id} card={card} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** @param {{ beat: import('./nightShiftBoard.js').NightShiftBeat, host: { name: string, title: string, emoji: string }, current: boolean }} props */
function Beat({ beat, host, current }) {
  const isHost = beat.speaker === 'host';
  const emoji = isHost ? host.emoji : beat.emoji;
  const name = isHost ? host.name : beat.name;
  const dept = isHost ? host.title : beat.dept;
  return (
    <li
      className={`night-shift-beat${isHost ? ' night-shift-beat--host' : ''}${current ? ' is-current' : ''}`}
      data-beat={beat.key}
    >
      <span className="night-shift-beat-avatar" aria-hidden="true">
        {emoji}
      </span>
      <div className="night-shift-beat-body">
        <div className="night-shift-beat-who">
          <strong>{name}</strong> <span className="night-shift-beat-dept">{dept}</span>
        </div>
        <p className="night-shift-beat-text">{beat.text}</p>
        <PrLinks prs={beat.prs} />
      </div>
    </li>
  );
}

/**
 * @param {{
 *   manifest: import('../../utils/nightShiftLedger.js').NightShiftManifest,
 *   now: number
 * }} props
 */
function StandupFace({ manifest, now }) {
  const beats = useMemo(() => nightShiftStandupBeats(manifest, { now }), [manifest, now]);
  const [index, setIndex] = useState(0);
  const transcriptRef = useRef(null);
  const host = useMemo(() => {
    const pam = officeSenderInfo('scrumMaster');
    return {
      name: pam?.name ?? 'Pam',
      title: pam?.title ?? 'Agile Coach',
      emoji: pam?.avatarEmoji ?? '📅'
    };
  }, []);

  useEffect(() => {
    const list = transcriptRef.current;
    const last = list?.lastElementChild;
    if (last && typeof last.scrollIntoView === 'function') {
      last.scrollIntoView({ block: 'nearest' });
    }
  }, [index]);

  const atEnd = index >= beats.length - 1;
  return (
    <div className="night-shift-standup" data-testid="night-shift-standup">
      <ol className="night-shift-transcript" ref={transcriptRef} aria-live="polite">
        {beats.slice(0, index + 1).map((beat, i) => (
          <Beat key={beat.key} beat={beat} host={host} current={i === index} />
        ))}
      </ol>
      <div className="night-shift-standup-controls">
        <span className="night-shift-step">{COPY.standupStep(index + 1, beats.length)}</span>
        {atEnd ? null : (
          <button
            type="button"
            className="night-shift-btn night-shift-btn--quiet"
            onClick={() => openNightShiftBoard(manifest.shiftDate)}
          >
            {COPY.skipToBoard}
          </button>
        )}
        <button
          type="button"
          className="night-shift-btn"
          data-testid={atEnd ? 'night-shift-to-board' : 'night-shift-next'}
          onClick={() => (atEnd ? openNightShiftBoard(manifest.shiftDate) : setIndex((i) => i + 1))}
        >
          {atEnd ? COPY.toBoard : COPY.next}
        </button>
      </div>
    </div>
  );
}

/**
 * @param {{ view: null | 'standup' | 'board', onClose: () => void, now?: number }} props
 */
export function NightShiftWindow({ view, onClose, now: nowProp }) {
  // The host passes the store's `openedAt`, captured on each closed → open
  // transition, so a reopened window reads a fresh clock. The lazy fallback is
  // for a bare mount (tests); reading the clock during render is the impurity
  // react-hooks/purity flags.
  const [mountedAt] = useState(() => Date.now());
  const now = nowProp ?? mountedAt;
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const manifest = getNightShiftManifest();
  const open = Boolean(view);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      // aria-modal promises the background is unreachable; keep Tab inside.
      if (event.key === 'Tab') trapTab(event, dialogRef.current);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  // On opening, and on every face swap: "See the board" / "Skip to the board"
  // unmount the button that was pressed, which would drop focus to <body>.
  useEffect(() => {
    if (view) dialogRef.current?.focus?.({ preventScroll: true });
  }, [view]);

  if (!view) return null;
  const title = view === 'standup' ? COPY.standupTitle : COPY.boardTitle;

  return (
    <div
      className="night-shift-backdrop"
      data-testid="night-shift-window"
      data-view={view}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      // The floor walks you with the arrow keys from a window listener
      // (`useFloorKeyboard`). Stop them here so reading the board does not
      // walk you around the room behind it; Escape still reaches the window.
      onKeyDown={(event) => {
        if (ARROW_KEYS.has(event.key)) event.stopPropagation();
      }}
    >
      <div
        ref={dialogRef}
        className="night-shift"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="night-shift-header">
          <div>
            <h2 className="night-shift-title">
              <span aria-hidden="true">🌙 </span>
              {title}
            </h2>
            {manifest.shiftDate ? (
              <p className="night-shift-subtitle">
                {COPY.boardSubtitle(shiftWhen(manifest.shiftDate, now))}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="night-shift-btn night-shift-btn--quiet"
            data-testid="night-shift-close"
            onClick={onClose}
          >
            × {COPY.closeLabel}
          </button>
        </header>
        {view === 'standup' ? (
          <StandupFace manifest={manifest} now={now} />
        ) : (
          <BoardFace manifest={manifest} />
        )}
        <footer className="night-shift-provenance">{COPY.provenance}</footer>
      </div>
    </div>
  );
}

/** Subscribes to `nightShiftStore` so the floor's wall board and invite can open it. */
export default function NightShiftHost() {
  const { view, openedAt } = useSyncExternalStore(
    subscribeNightShift,
    getNightShiftSnapshot,
    getNightShiftSnapshot
  );
  return <NightShiftWindow view={view} onClose={closeNightShift} now={openedAt ?? undefined} />;
}
