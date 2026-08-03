/**
 * What is in a floor figure's hand (docs/office-isometric-mode.md § 5 slice 13).
 *
 * Its own module rather than a branch inside `FloorFigure`, on the same grounds
 * `isoArt.jsx` is: this is a switch over a closed vocabulary that will grow when
 * somebody thinks of a fifth thing to hold, and growing it should not push the
 * component that positions it over a threshold. `FloorFigure` keeps the
 * geometry; this keeps the drawings.
 *
 * Local frame is **16 × 24 over the figure's own x18–34 / y16–40** — see § 6
 * rule 31 for why the layer sits over the head instead of inside the torso.
 * Local y 0 is ear height (so a phone reaches one) and local y 19 is the last
 * row a seated figure's desk does not hide, which is the whole design envelope.
 */

const ACCENT = 'var(--floor-accent, #64748b)';

/** Paper, porcelain and plastic — three neutrals the accent never eats. */
const PAPER = '#f4f6fa';
const SHADOW = 'rgba(15, 23, 42, 0.22)';
const DEVICE = '#26303f';

/**
 * @param {{ hold: string | null, skin: string }} props `hold` is one of
 *   `FLOOR_HOLDS` (`officeFloorActivity.js`); anything else draws nothing.
 */
export function HeldItem({ hold, skin }) {
  switch (hold) {
    case 'coffee':
      // Takeaway cup: what the machine hands you, and what a coffee break is
      // holding. Tapered body, lid, and a sleeve in the character's accent so a
      // cup at 34 px still says who is carrying it.
      return (
        <>
          <path d="M3.2 12.4h6.6l-.9 7.2H4.1Z" fill={PAPER} />
          <path d="M3.2 12.4h6.6l-.2 1.6H3.4Z" fill={SHADOW} />
          <rect x="2.6" y="10.7" width="7.8" height="2" rx="0.8" fill={PAPER} />
          <rect x="2.6" y="10.7" width="7.8" height="2" rx="0.8" fill={SHADOW} opacity="0.45" />
          <path d="M3.6 15.1h5.9l-.4 3H4Z" fill={ACCENT} opacity="0.85" />
          <circle cx="6.4" cy="19.6" r="2.2" fill={skin} />
        </>
      );
    case 'mug':
      // Ceramic, with a handle — the one you keep at your desk, as opposed to
      // the one the machine gave you. Erlich, Gary and Ulrich are never without.
      return (
        <>
          <path
            d="M10.2 13.4a2 2 0 0 1 0 3.4"
            stroke={PAPER}
            strokeWidth="1.3"
            fill="none"
            strokeLinecap="round"
          />
          <rect x="3" y="11.6" width="7.2" height="8" rx="1.2" fill={PAPER} />
          <rect x="3" y="11.6" width="1.8" height="8" fill={SHADOW} opacity="0.5" />
          <rect x="3" y="13.8" width="7.2" height="2.2" fill={ACCENT} opacity="0.85" />
          <circle cx="6.4" cy="19.8" r="2.2" fill={skin} />
        </>
      );
    case 'papers':
      // The finding, the agenda, the overdue training. Held up rather than laid
      // down, because a desk hides anything laid down.
      return (
        <g transform="rotate(-7 6 15)">
          <rect x="1.4" y="9.6" width="9.6" height="10.4" rx="0.7" fill={PAPER} />
          <path
            d="M3.2 12.2h6M3.2 14.2h6M3.2 16.2h4.2"
            stroke={SHADOW}
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <circle cx="6" cy="20.2" r="2.2" fill={skin} />
        </g>
      );
    case 'phone':
      // Against the ear, which is the only placement that reads at this size —
      // a phone held at chest height is a dark rectangle of no opinion.
      return (
        <>
          <rect x="5.4" y="0.2" width="4.6" height="8.4" rx="1.3" fill={DEVICE} />
          <rect x="6.3" y="1.3" width="2.8" height="5.4" rx="0.6" fill={PAPER} opacity="0.35" />
          <circle cx="8.2" cy="9.2" r="2.1" fill={skin} />
        </>
      );
    default:
      return null;
  }
}

export default HeldItem;
