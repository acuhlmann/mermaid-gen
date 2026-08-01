/**
 * Presence strip — who is around, in the taskbar (plan slice 6;
 * docs/office-isometric-mode.md § 4).
 *
 * The diegetic half of an ADR-0011 rule-3 pair: it sits beside the labelled
 * `Stand up` button. Glancing at it tells you what the room is doing; pressing
 * it follows that presence — usually onto the floor, but unread IMs open Slop
 * Chat, and a huddle / meeting invite already on your screen stays put
 * (`presenceFollowOf`). Stand up remains the always-floor control.
 *
 * **It produces nothing.** The whole render is `officePresenceOf` over the
 * moment store — no timer, no fetch, no write. That is the carve-out it stands
 * on, and it is why a permanent taskbar resident that watches the office is
 * allowed to exist at all.
 *
 * It reads its state from the store directly, exactly as `DeskOsTray` reads the
 * overlay stack, so it costs the shell's ~150-prop wall nothing.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PersonaFace } from './personaFaces/index.jsx';
import { formatLocale } from '../i18n/formatLocale.js';
import { requestOfficeMessengerOpen } from '../state/officeMessengerUiStore.js';
import { getOfficeSnapshot, subscribe } from '../state/officeMomentStore.js';
import { standUp } from '../state/officeViewModeStore.js';
import { OFFICE_CHROME_COPY, officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { officePresenceOf, presenceFollowOf } from '../utils/officePresence.js';

/**
 * Three is what a 2.3 rem bar affords next to a window list, and it is also
 * enough to read as "a group" — the count carries the rest.
 */
const MAX_FACES = 3;

const FACE_PX = 17;

/** Peek faces can breathe a little — they are not fighting the taskbar floor. */
const PEEK_FACE_PX = 20;

/** Touch long-press before the demoted caption rises as a peek. */
const LONG_PRESS_MS = 420;

const PEEK_GAP_PX = 8;
const PEEK_SAFE_INSET_PX = 8;
const PEEK_MAX_WIDTH_PX = 280;

/** English is the only bundle guaranteed complete; a locale overrides what it has. */
const FALLBACK = OFFICE_CHROME_COPY.osTray.presence;

/** First names only. "Jack Barker is convening" does not fit; "Jack" does. */
function firstNameOf(id) {
  const name = officeSenderInfo(id)?.name ?? '';
  return name.split(' ')[0] || name;
}

/**
 * One line for the room. Every branch is a template so the whole strip
 * translates; `officePresenceOf` guarantees the ids each branch reaches for
 * (a battle always has two sides, `quiet` always has a pod).
 *
 * @param {import('../utils/officePresence.js').OfficePresence} presence
 * @param {Record<string, string>} copy
 */
function captionFor({ kind, ids }, copy) {
  switch (kind) {
    case 'pair':
      return formatLocale(copy.pair, { name: firstNameOf(ids[0]) });
    case 'mob':
      return formatLocale(copy.mob, { count: ids.length });
    case 'walkby':
      return formatLocale(copy.walkby, { name: firstNameOf(ids[0]) });
    case 'battle':
      return formatLocale(copy.battle, {
        name: firstNameOf(ids[0]),
        other: firstNameOf(ids[1])
      });
    case 'coffee':
      return copy.coffee;
    case 'meeting':
      return formatLocale(copy.meeting, { name: firstNameOf(ids[0]) });
    case 'talk':
      return ids.length > 1
        ? formatLocale(copy.talkMany, { count: ids.length })
        : formatLocale(copy.talk, { name: firstNameOf(ids[0]) });
    case 'quiet':
    default:
      return copy.quiet;
  }
}

/**
 * Rise above the strip. The taskbar clips with `overflow: hidden` +
 * `backdrop-filter`, so an absolute child never escapes — the peek has to be
 * portaled and fixed to the viewport.
 *
 * @param {DOMRect} anchorRect
 * @returns {import('react').CSSProperties}
 */
function computePeekStyle(anchorRect) {
  const maxWidth = Math.min(PEEK_MAX_WIDTH_PX, window.innerWidth - PEEK_SAFE_INSET_PX * 2);
  let left = anchorRect.left;
  left = Math.max(
    PEEK_SAFE_INSET_PX,
    Math.min(left, window.innerWidth - maxWidth - PEEK_SAFE_INSET_PX)
  );

  return {
    position: 'fixed',
    left,
    bottom: Math.max(PEEK_SAFE_INSET_PX, window.innerHeight - anchorRect.top + PEEK_GAP_PX),
    maxWidth
  };
}

/**
 * Accessible name + native title for the press — lead with the visible caption
 * (WCAG 2.5.3), then say where the press goes. Chat / stay verbs replace the
 * default "Stand up" when `presenceFollowOf` says the floor is the wrong room.
 *
 * @param {'standUp' | 'messenger' | 'stay'} action
 * @param {string} caption
 * @param {Record<string, string>} copy
 */
function pressCopy(action, caption, copy) {
  if (action === 'messenger') {
    return {
      aria: formatLocale(copy.ariaChat, { status: caption }),
      title: `${caption} — ${copy.titleChat}`
    };
  }
  if (action === 'stay') {
    return {
      aria: formatLocale(copy.ariaStay, { status: caption }),
      title: `${caption} — ${copy.titleStay}`
    };
  }
  return {
    aria: formatLocale(copy.aria, { status: caption }),
    title: `${caption} — ${copy.title}`
  };
}

function followPresence(follow) {
  if (follow.action === 'messenger') {
    requestOfficeMessengerOpen(follow.colleagueId);
    return;
  }
  if (follow.action === 'standUp') {
    standUp();
  }
}

export default function DeskOsPresenceStrip() {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const copy = { ...FALLBACK, ...(officeChromeCopy().osTray?.presence ?? {}) };

  const presence = officePresenceOf(snapshot);
  const follow = presenceFollowOf(presence);
  const caption = captionFor(presence, copy);
  const press = pressCopy(follow.action, caption, copy);
  const shown = presence.ids.slice(0, MAX_FACES);
  const overflow = presence.ids.length - shown.length;

  const buttonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const longPressTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const skipClickRef = useRef(false);
  const [peekStyle, setPeekStyle] = useState(
    /** @type {import('react').CSSProperties | null} */ (null)
  );
  const peekOpen = peekStyle != null;

  const openPeek = () => {
    const el = buttonRef.current;
    if (!el) return;
    setPeekStyle(computePeekStyle(el.getBoundingClientRect()));
  };

  const closePeek = () => setPeekStyle(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!peekOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closePeek();
    };
    const onReposition = () => {
      const el = buttonRef.current;
      if (!el) {
        closePeek();
        return;
      }
      setPeekStyle(computePeekStyle(el.getBoundingClientRect()));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [peekOpen]);

  useEffect(() => () => clearLongPress(), []);

  const peek =
    peekOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="desk-os-presence-peek"
            data-testid="desk-os-presence-peek"
            style={peekStyle}
            /* Duplicate of the visible status for eyes that cannot fit the bar;
               the button's aria-label already carries it for AT. */
            aria-hidden="true"
          >
            <span className="desk-os-presence-faces">
              {shown.map((id) => (
                <PersonaFace key={id} id={id} size={PEEK_FACE_PX} />
              ))}
              {overflow > 0 ? (
                <span className="desk-os-presence-more">
                  {formatLocale(copy.overflow, { count: overflow })}
                </span>
              ) : null}
            </span>
            <span className="desk-os-presence-peek-caption">{caption}</span>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="desk-os-presence"
        data-testid="desk-os-presence"
        data-kind={presence.kind}
        data-follow={follow.action}
        data-peek-open={peekOpen ? 'true' : undefined}
        /* The visible caption leads the accessible name (WCAG 2.5.3), then says
           where the press goes — the caption alone reads as a status, not a verb. */
        aria-label={press.aria}
        /* Native fallback when the custom peek is not up (slow hover, or a
           browser that never fires our pointer path). Leads with the status so
           a truncated or demoted caption is still recoverable. */
        title={press.title}
        onClick={() => {
          if (skipClickRef.current) {
            skipClickRef.current = false;
            return;
          }
          closePeek();
          followPresence(follow);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') openPeek();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') closePeek();
          clearLongPress();
        }}
        onFocus={() => openPeek()}
        onBlur={() => closePeek()}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse') return;
          clearLongPress();
          longPressTimerRef.current = setTimeout(() => {
            longPressTimerRef.current = null;
            skipClickRef.current = true;
            openPeek();
          }, LONG_PRESS_MS);
        }}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
      >
        <span className="desk-os-presence-faces" aria-hidden="true">
          {shown.map((id) => (
            <PersonaFace key={id} id={id} size={FACE_PX} />
          ))}
          {overflow > 0 ? (
            <span className="desk-os-presence-more">
              {formatLocale(copy.overflow, { count: overflow })}
            </span>
          ) : null}
        </span>
        <span className="desk-os-presence-caption">{caption}</span>
      </button>
      {peek}
    </>
  );
}
