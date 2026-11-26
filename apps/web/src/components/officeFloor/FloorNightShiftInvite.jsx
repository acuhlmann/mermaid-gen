/**
 * The morning's one offer: a pill at the foot of the floor saying the night
 * crew shipped something and the standup is on (`features/nightShift/`).
 *
 * **Offered by a render, answered by a press, and never re-offered.** It shows
 * while the newest shift on the board is newer than the one you last caught up
 * on, and either answer — join, skip, or reading the wall board directly —
 * moves that marker forward. No timer raises it and none takes it away
 * (ADR-0010 consequence #4), so a skipped standup costs nothing: the kanban on
 * the wall keeps the summary, which is the whole point of having one.
 *
 * Focus Time mutes it like every other office interruption; the board on the
 * wall is not an interruption and stays.
 */

import { useSyncExternalStore } from 'react';
import {
  hasUnseenNightShift,
  nightShiftCounts,
  shiftWhen
} from '../../features/nightShift/nightShiftBoard.js';
import { NIGHT_SHIFT_COPY as COPY } from '../../features/nightShift/nightShiftCopy.js';
import { getNightShiftManifest } from '../../features/nightShift/nightShiftManifest.js';
import {
  getNightShiftSnapshot,
  markNightShiftSeen,
  openNightShiftStandup,
  subscribeNightShift
} from '../../features/nightShift/nightShiftStore.js';
import '../../features/nightShift/NightShift.css';

/**
 * @param {{ suppressed?: boolean }} props `suppressed` is Focus Time or a
 *   glass-room chair — anywhere an invite would be an interruption.
 */
export function FloorNightShiftInvite({ suppressed = false }) {
  const { view, seenShiftDate } = useSyncExternalStore(
    subscribeNightShift,
    getNightShiftSnapshot,
    getNightShiftSnapshot
  );
  const manifest = getNightShiftManifest();
  if (suppressed || view || !hasUnseenNightShift(manifest, seenShiftDate)) return null;

  const { shipped } = nightShiftCounts(manifest);
  const text = COPY.inviteText(shipped, shiftWhen(manifest.shiftDate));
  return (
    <div className="office-floor-night-shift-invite" role="status" data-testid="night-shift-invite">
      <span aria-hidden="true">🌙</span>
      <span className="office-floor-night-shift-invite-text">{text}</span>
      <button
        type="button"
        className="office-floor-night-shift-invite-join"
        data-testid="night-shift-invite-join"
        onClick={() => openNightShiftStandup(manifest.shiftDate)}
      >
        {COPY.inviteJoin}
      </button>
      <button
        type="button"
        className="office-floor-night-shift-invite-dismiss"
        data-testid="night-shift-invite-dismiss"
        aria-label={COPY.inviteDismissAria}
        title={COPY.inviteDismissAria}
        onClick={() => markNightShiftSeen(manifest.shiftDate)}
      >
        {COPY.inviteDismiss}
      </button>
    </div>
  );
}

export default FloorNightShiftInvite;
