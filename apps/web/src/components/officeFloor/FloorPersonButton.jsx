/**
 * A person you can click, and nothing wider than one.
 *
 * Extracted from `FloorSeat` when slice 12 gave the floor a **second** place a
 * figure can be clicked — somebody stood at the printer rather than sat at their
 * desk. § 6 rule 23 is the reason this is a component rather than copied markup:
 * a hit box bigger than what it draws steals from whatever is behind it, and the
 * fix (constrain the button to the 34 × 48 figure and hang the name chip off it
 * as an absolute overlay) is subtle enough that two copies of it would drift.
 * One definition, so "a figure's hit box is the figure" stays true of every
 * figure on the stage.
 *
 * Positioning belongs to the caller. The button places itself at its container's
 * origin (`.office-floor-person` is absolute with a −50 % / −100 % offset, so its
 * feet land on the tile centre), which is exactly what `.office-floor-seat` and
 * `.office-floor-walker` each give it — the seat by sitting on the tile, the
 * walker by being moved there by the animation.
 */

import FloorFigure from './FloorFigure.jsx';

/** Modifier soup, kept out of the JSX so the markup stays readable. */
function personClassName({ seated, selected, isYou, speaking }) {
  return [
    'office-floor-person',
    seated && 'is-seated',
    selected && 'is-selected',
    isYou && 'is-you',
    speaking && 'is-speaking'
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * @param {{
 *   id: string,
 *   name: string,
 *   label: string,
 *   accent: string,
 *   seated?: boolean,
 *   selected?: boolean,
 *   isYou?: boolean,
 *   speaking?: boolean,
 *   idleIndex?: number,
 *   disabled?: boolean,
 *   onSelect: (id: string) => void,
 *   onActivate?: ((id: string) => void) | null
 * }} props `name` is the visible chip; `label` is what it is called to anybody
 *   not looking at it, which is not always the same thing — away from their desk
 *   it carries where they are, because a target has to say what it is.
 *   `onActivate` is the point-and-click shortcut (double-click → walk and talk).
 */
export function FloorPersonButton({
  id,
  name,
  label,
  accent,
  seated = false,
  selected = false,
  isYou = false,
  speaking = false,
  idleIndex = 0,
  disabled = false,
  accessoryOverride = null,
  onSelect,
  onActivate = null
}) {
  return (
    <button
      type="button"
      className={personClassName({ seated, selected, isYou, speaking })}
      style={{ '--floor-accent': accent }}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      disabled={disabled}
      data-on-call={accessoryOverride === 'headset' ? 'true' : undefined}
      onClick={() => onSelect(id)}
      onDoubleClick={(event) => {
        if (!onActivate) return;
        event.preventDefault();
        event.stopPropagation();
        onActivate(id);
      }}
    >
      <span className="office-floor-person-name">{name}</span>
      <FloorFigure
        id={id}
        accent={accent}
        isYou={isYou}
        idleIndex={idleIndex}
        accessoryOverride={accessoryOverride}
      />
    </button>
  );
}

export default FloorPersonButton;
