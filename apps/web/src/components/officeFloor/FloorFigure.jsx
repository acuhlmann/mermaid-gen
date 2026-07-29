/**
 * One person-shaped figure: a `PersonaFace` head over a simple torso in the
 * character's accent colour. Shared by the seated cast (`FloorSeat`) and the
 * colleague walking over to bother you (`FloorWalker`), so a walker is visibly
 * the same person who was sitting at that desk a moment ago.
 */

import { PersonaFace } from '../personaFaces/index.jsx';

/**
 * @param {{
 *   id: string,
 *   accent: string,
 *   isYou?: boolean,
 *   idleIndex?: number,
 *   walking?: boolean,
 *   accessoryOverride?: string | null
 * }} props
 */
export function FloorFigure({
  id,
  accent,
  isYou = false,
  idleIndex = 0,
  walking = false,
  accessoryOverride = null
}) {
  return (
    <span
      className={`office-floor-person-figure${walking ? ' is-walking' : ''}`}
      style={{ '--floor-accent': accent, '--idle-delay': `${(idleIndex % 7) * 0.53}s` }}
    >
      <PersonaFace
        id={id}
        size={34}
        accentRing={false}
        fallbackEmoji={isYou ? '🙋' : undefined}
        className="office-floor-person-head"
        accessoryOverride={accessoryOverride}
      />
      <svg
        className="office-floor-person-body"
        viewBox="0 0 34 24"
        width="34"
        height="24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M3.5 24V12.5C3.5 6.9 9 3 17 3s13.5 3.9 13.5 9.5V24Z"
          fill="var(--floor-accent, #64748b)"
        />
        <path d="M3.5 24V12.5C3.5 9.4 5.2 6.8 8 5l2.3 19Z" fill="rgba(15,23,42,0.16)" />
      </svg>
    </span>
  );
}

export default FloorFigure;
