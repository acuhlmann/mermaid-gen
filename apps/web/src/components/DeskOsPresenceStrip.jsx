/**
 * Presence strip — who is around, in the taskbar (plan slice 6;
 * docs/office-isometric-mode.md § 4).
 *
 * The diegetic half of an ADR-0011 rule-3 pair: it sits beside the labelled
 * `Stand up` button and does the same thing, so the OS-flavoured affordance
 * duplicates the conventional control rather than replacing it. Glancing at it
 * tells you what the room is doing; pressing it puts you on the floor.
 *
 * **It produces nothing.** The whole render is `officePresenceOf` over the
 * moment store — no timer, no fetch, no write. That is the carve-out it stands
 * on, and it is why a permanent taskbar resident that watches the office is
 * allowed to exist at all.
 *
 * It reads its state from the store directly, exactly as `DeskOsTray` reads the
 * overlay stack, so it costs the shell's ~150-prop wall nothing.
 */

import { useSyncExternalStore } from 'react';
import { PersonaFace } from './personaFaces/index.jsx';
import { formatLocale } from '../i18n/formatLocale.js';
import { getOfficeSnapshot, subscribe } from '../state/officeMomentStore.js';
import { standUp } from '../state/officeViewModeStore.js';
import { OFFICE_CHROME_COPY, officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { officePresenceOf } from '../utils/officePresence.js';

/**
 * Three is what a 2.3 rem bar affords next to a window list, and it is also
 * enough to read as "a group" — the count carries the rest.
 */
const MAX_FACES = 3;

const FACE_PX = 17;

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

export default function DeskOsPresenceStrip() {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const copy = { ...FALLBACK, ...(officeChromeCopy().osTray?.presence ?? {}) };

  const presence = officePresenceOf(snapshot);
  const caption = captionFor(presence, copy);
  const shown = presence.ids.slice(0, MAX_FACES);
  const overflow = presence.ids.length - shown.length;

  return (
    <button
      type="button"
      className="desk-os-presence"
      data-testid="desk-os-presence"
      data-kind={presence.kind}
      /* The visible caption leads the accessible name (WCAG 2.5.3), then says
         where the press goes — the caption alone reads as a status, not a verb. */
      aria-label={formatLocale(copy.aria, { status: caption })}
      title={copy.title}
      onClick={() => standUp()}
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
  );
}
