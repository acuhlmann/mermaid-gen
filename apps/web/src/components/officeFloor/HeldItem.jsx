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

import { PRINTOUT_MAX_ROWS } from '../../utils/officeFloorBoard.js';

const ACCENT = 'var(--floor-accent, #64748b)';

/** Paper, porcelain and plastic — three neutrals the accent never eats. */
const PAPER = '#f4f6fa';
const SHADOW = 'rgba(15, 23, 42, 0.22)';
const DEVICE = '#26303f';

/**
 * The readable band of the `papers` sheet, in this module's local units.
 *
 * The sheet is `x 1.4` over `9.6` wide and `y 9.6` over `10.4` tall, and the
 * hand drawn across its foot (a `2.2 r` circle centred at `y 20.2`) covers
 * everything below `y 18`. These four numbers are the band that is left, and
 * three of them are the generic sheet's own: its rules start at `x 3.2`, run 6
 * units, and the first sits at `y 12.2`. So the first line of a printed page
 * lands exactly where a blank one has always had it, and only the pitch
 * changes — `2.0` over three rules becomes `1.8` over four, which is the
 * tightest that still clears the hand.
 */
const PAGE_X = 3.2;
const PAGE_W = 6;
const PAGE_TOP = 12.2;
const PAGE_H = 7.2;

/**
 * Two decimals of a local unit, which at this scale is a hundredth of a pixel.
 * Fractions of the band multiply out to sixteen-digit floats otherwise, and a
 * `d` nobody can read is a `d` nobody checks.
 *
 * @param {number} n
 * @returns {number}
 */
function unit(n) {
  return Math.round(n * 100) / 100;
}

/**
 * The ink on a held sheet of paper.
 *
 * Two cases and they are a pair rather than a default and an override. Without
 * a `sheet` this is the three rules the generic sheet has always carried — the
 * finding, the agenda, the overdue training, and what every colleague on this
 * floor is holding. With one it is `printoutFrom`'s rows: the page came off the
 * printer and it has what you printed on it (§ 6b).
 *
 * The rules are drawn as one `path` either way, so the two cases are the same
 * amount of DOM and a capture can read the difference off the geometry rather
 * than off an element count.
 *
 * @param {{ sheet: import('../../utils/officeFloorBoard.js').PrintoutState | null }} props
 */
function PrintedInk({ sheet }) {
  const rows = sheet?.rows?.length
    ? sheet.rows.map(
        (row) => `M${PAGE_X} ${unit(PAGE_TOP + row.y * PAGE_H)}h${unit(row.w * PAGE_W)}`
      )
    : [`M${PAGE_X} 12.2h6`, `M${PAGE_X} 14.2h6`, `M${PAGE_X} 16.2h4.2`];
  return (
    <>
      <path d={rows.join('')} stroke={SHADOW} strokeWidth="0.8" strokeLinecap="round" />
      {/* Whatever was on the page was joined up — the one mark that tells a
          printed routing from a printed list at this size. It hangs off the
          left margin between the first two rules, where a connector would be
          if the page were big enough to draw one. */}
      {sheet?.joined ? (
        <path
          d={`M${PAGE_X - 1} ${PAGE_TOP}v${PAGE_H / PRINTOUT_MAX_ROWS}`}
          stroke={ACCENT}
          strokeWidth="0.8"
          strokeLinecap="round"
          opacity="0.85"
        />
      ) : null}
    </>
  );
}

/**
 * @param {{
 *   hold: string | null,
 *   skin: string,
 *   sheet?: import('../../utils/officeFloorBoard.js').PrintoutState | null
 * }} props `hold` is one of `FLOOR_HOLDS` (`officeFloorActivity.js`); anything
 *   else draws nothing. `sheet` is what is printed on a `papers` hold and is
 *   ignored by every other case — `FloorFigure` only ever passes it for you
 *   (ADR-0010: your work is not in somebody else's hand).
 */
export function HeldItem({ hold, skin, sheet = null }) {
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
          <PrintedInk sheet={sheet} />
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
