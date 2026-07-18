import { useState } from 'react';
import { readDayOneBadgeSeen, writeDayOneBadgeSeen } from '../utils/officeAmbienceStorage.js';

/**
 * Day One employee badge — the new-hire framing card at the top of the
 * empty-state entry cluster. Casts the user as ArchiSlop Corp.'s newest
 * architect ("New Hire — {userTitle}") and points at the two ways to start:
 * pitch your own initiative, or take an assignment from the chips below.
 *
 * Dismiss persists (officeAmbienceStorage) so the badge only greets once,
 * like the office directory tour. Pure presentational otherwise: copy comes
 * from `controls.dayOne`, the title from the gamification level.
 */
export default function DayOneBadge({ copy, userTitle }) {
  const [dismissed, setDismissed] = useState(() => readDayOneBadgeSeen());
  if (dismissed || !copy) return null;

  return (
    <div className="day-one-badge" data-testid="day-one-badge">
      <button
        type="button"
        className="day-one-badge-dismiss"
        aria-label={copy.dismissAria}
        onClick={() => {
          writeDayOneBadgeSeen();
          setDismissed(true);
        }}
      >
        ✕
      </button>
      <p className="day-one-badge-eyebrow">{copy.eyebrow}</p>
      <p className="day-one-badge-role">
        {copy.rolePrefix}
        {userTitle ? ` — ${userTitle}` : ''}
      </p>
      {copy.hrLine ? <p className="day-one-badge-line">{copy.hrLine}</p> : null}
      {copy.pitchLine ? <p className="day-one-badge-pitch">{copy.pitchLine}</p> : null}
    </div>
  );
}
