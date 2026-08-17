/**
 * Presence strip — what expects you next, in the taskbar (plan slice 6;
 * docs/office-isometric-mode.md § 4).
 *
 * Sits beside the labelled `Stand up` button. Only mounts when
 * `officeNextOf` finds an obligation; otherwise absent so the bar does not
 * pretend the pod is "around" you when nothing is waiting.
 *
 * **It produces nothing.** The whole render is `officeNextOf` over the moment
 * store — no timer, no fetch, no write.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PersonaFace } from './personaFaces/index.jsx';
import { formatLocale } from '../i18n/formatLocale.js';
import { openDeskCommsPanel, readDeskCommsAnchorRect } from '../state/deskCommsUiStore.js';
import { requestFloorSceneJoin, requestFloorShopJoin } from '../state/officeFloorActionStore.js';
import { getOfficeFloorNext, subscribeOfficeFloorNext } from '../state/officeFloorNextStore.js';
import { requestOfficeMessengerOpen } from '../state/officeMessengerUiStore.js';
import { getOfficeSnapshot, subscribe } from '../state/officeMomentStore.js';
import {
  getOfficeViewMode,
  standUp,
  subscribe as subscribeOfficeViewMode
} from '../state/officeViewModeStore.js';
import { OFFICE_CHROME_COPY, officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { officeNextOf, presenceFollowOf } from '../utils/officePresence.js';

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
 * One line for the obligation. Every branch is a template so the whole strip
 * translates.
 *
 * @param {import('../utils/officePresence.js').OfficeNext} next
 * @param {Record<string, string>} copy
 */
function captionFor({ kind, ids, meta }, copy) {
  switch (kind) {
    case 'walkby':
      return formatLocale(copy.walkby, { name: firstNameOf(ids[0]) });
    case 'meeting':
      return formatLocale(copy.meeting, { name: firstNameOf(ids[0]) });
    case 'talk':
      return ids.length > 1
        ? formatLocale(copy.talkMany, { count: ids.length })
        : formatLocale(copy.talk, { name: firstNameOf(ids[0]) });
    case 'errand':
      return formatLocale(copy.errand, {
        name: firstNameOf(ids[0]),
        from: firstNameOf(meta?.fromId ?? '')
      });
    case 'email':
      return formatLocale(copy.email, { name: firstNameOf(ids[0]) });
    case 'shopJoin':
      return formatLocale(copy.shopJoin, {
        name: firstNameOf(ids[0]),
        partner: firstNameOf(meta?.partnerId ?? ids[1] ?? '')
      });
    case 'sceneJoin':
      return meta?.sceneKind === 'battle'
        ? formatLocale(copy.sceneJoinBattle, { name: firstNameOf(ids[0]) })
        : formatLocale(copy.sceneJoin, { name: firstNameOf(ids[0]) });
    default:
      return '';
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
 * (WCAG 2.5.3), then say where the press goes.
 *
 * @param {ReturnType<typeof presenceFollowOf>} follow
 * @param {string} caption
 * @param {Record<string, string>} copy
 */
function pressCopy(follow, caption, copy) {
  switch (follow.action) {
    case 'messenger':
      return {
        aria: formatLocale(copy.ariaChat, { status: caption }),
        title: `${caption} — ${copy.titleChat}`
      };
    case 'inbox':
      return {
        aria: formatLocale(copy.ariaInbox, { status: caption }),
        title: `${caption} — ${copy.titleInbox}`
      };
    case 'invite':
      return {
        aria: formatLocale(copy.ariaInvite, { status: caption }),
        title: `${caption} — ${copy.titleInvite}`
      };
    case 'floorTalk':
      return {
        aria: formatLocale(copy.ariaFloorTalk, { status: caption }),
        title: `${caption} — ${copy.titleFloorTalk}`
      };
    case 'floorSceneJoin':
      return {
        aria: formatLocale(copy.ariaFloorSceneJoin, { status: caption }),
        title: `${caption} — ${copy.titleFloorSceneJoin}`
      };
    default:
      return {
        aria: formatLocale(copy.aria, { status: caption }),
        title: `${caption} — ${copy.title}`
      };
  }
}

function followPresence(follow) {
  if (follow.action === 'messenger') {
    requestOfficeMessengerOpen(follow.colleagueId);
    return;
  }
  if (follow.action === 'inbox') {
    openDeskCommsPanel('inbox', readDeskCommsAnchorRect('inbox'), {
      emailId: follow.emailId
    });
    return;
  }
  if (follow.action === 'invite') {
    document.querySelector('.office-meeting-invite .office-meeting-accept')?.focus();
    return;
  }
  if (follow.action === 'floorTalk' && follow.colleagueId && follow.mark) {
    requestFloorShopJoin(follow.colleagueId, follow.mark);
    return;
  }
  if (follow.action === 'floorSceneJoin' && follow.sceneKind) {
    requestFloorSceneJoin(follow.sceneKind);
    return;
  }
  standUp();
}

export default function DeskOsPresenceStrip() {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const viewMode = useSyncExternalStore(
    subscribeOfficeViewMode,
    getOfficeViewMode,
    getOfficeViewMode
  );
  const floorNext = useSyncExternalStore(
    subscribeOfficeFloorNext,
    getOfficeFloorNext,
    getOfficeFloorNext
  );
  const copy = { ...FALLBACK, ...(officeChromeCopy().osTray?.presence ?? {}) };

  const next = officeNextOf(snapshot, { viewMode, floorNext });

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
    if (!next) {
      setPeekStyle(null);
    }
  }, [next]);

  useEffect(() => {
    if (!peekOpen || !next) return undefined;

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
  }, [peekOpen, next]);

  useEffect(() => () => clearLongPress(), []);

  if (!next) return null;

  const follow = presenceFollowOf(next);
  const caption = captionFor(next, copy);
  const press = pressCopy(follow, caption, copy);
  const shown = next.ids.slice(0, MAX_FACES);
  const overflow = next.ids.length - shown.length;

  const peek =
    peekOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="desk-os-presence-peek"
            data-testid="desk-os-presence-peek"
            style={peekStyle}
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
        data-kind={next.kind}
        data-follow={follow.action}
        data-peek-open={peekOpen ? 'true' : undefined}
        aria-label={press.aria}
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
