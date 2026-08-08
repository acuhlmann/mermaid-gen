/**
 * One person-shaped figure: a `PersonaFace` head over a torso in the
 * character's accent colour. Shared by the seated cast (`FloorSeat`) and the
 * colleague walking over to bother you (`FloorWalker`), so a walker is visibly
 * the same person who was sitting at that desk a moment ago.
 *
 * The torso reads the same trait row as the face: `build` sets the shoulder
 * width (Erlich and Chad are broader than Jared and Ulrich) and `top` cuts
 * the garment — placket and buttons for an oxford, kangaroo pocket for
 * Richard's hoodie, lapels for a blazer. The accent stays the body colour;
 * only shading and cut change, so identity-by-colour survives. The head's
 * own shoulders (drawn by PersonaFace) continue into this torso at the 10px
 * overlap, so collar details belong to the face and everything below the
 * collarbone belongs here.
 *
 * Slice 13 added a third layer on top of both: whatever is **in their hand**.
 * The figure draws it; it does not decide it — `floorActivityFor` does, once,
 * for every surface (see `officeFloorActivity.js`).
 *
 * The figure stands on **legs**, and the split between the layers is what
 * keeps it planted: head, torso and held item live in one `.office-floor-person-upper`
 * wrapper that carries every bob animation, while the legs sit below it and
 * stay on the floor. A bob that lifted the feet too was the old hover — a
 * figure with legs reads as standing only when the ground does not move with
 * it. Walking swaps the idle bob for a gait: the two legs swing in antiphase
 * from the hips (`office-floor-stride` in OfficeFloor.css) and the upper body
 * rides the matching bounce. The stride cadence arrives as `--walk-cycle`,
 * derived from the walk's real pacing by `useWalkAnimation`, so the feet keep
 * roughly the tempo the room is crossing at.
 */

import { PersonaFace } from '../personaFaces/index.jsx';
import { SKIN_TONES, personaFaceTraits } from '../personaFaces/registry.js';
import HeldItem from './HeldItem.jsx';

const ACCENT = 'var(--floor-accent, #64748b)';

/** Garment shading via color-mix; the attribute paints when color-mix can't. */
function tint(percent, target = '#16202e', attr = 'fill', fallback = ACCENT) {
  return {
    [attr]: fallback,
    style: { [attr]: `color-mix(in srgb, ${ACCENT} ${percent}%, ${target})` }
  };
}

/** Torso silhouettes per build, with the matching left-side shade strip. */
const BODIES = {
  slim: {
    torso: 'M5.2 24V13C5.2 7.6 10.4 3.6 17 3.6S28.8 7.6 28.8 13v11Z',
    shade: 'M5.2 24V13C5.2 10 6.8 7.4 9.4 5.6L11.6 24Z'
  },
  regular: {
    torso: 'M3.5 24V12.5C3.5 6.9 9 3 17 3s13.5 3.9 13.5 9.5V24Z',
    shade: 'M3.5 24V12.5C3.5 9.4 5.2 6.8 8 5l2.3 19Z'
  },
  broad: {
    torso: 'M1.8 24V12C1.8 6.2 7.6 2.4 17 2.4s15.2 3.8 15.2 9.6v12Z',
    shade: 'M1.8 24V12C1.8 8.8 3.6 6.2 6.6 4.4L8.8 24Z'
  }
};

/**
 * Garment detail below the collarbone (viewBox 34x24, neck at x17, collar
 * y4-6). `s` shifts side-anchored marks with the build so seams stay on the
 * shoulder instead of floating off a slim one.
 */
function TorsoGarment({ top, s }) {
  switch (top) {
    case 'hoodie':
      return (
        <>
          <path
            d="M12.5 24l1.8-5h5.4l1.8 5"
            {...tint(62, '#16202e', 'stroke')}
            strokeWidth="1"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d={`M${6 + s} 22.4h${22 - 2 * s}`}
            {...tint(62, '#16202e', 'stroke')}
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case 'sweater':
      return (
        <path
          d="M12 21.8v2.2M17 21.8v2.2M22 21.8v2.2"
          {...tint(62, '#16202e', 'stroke')}
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'oxford':
      return (
        <>
          <path d="M17 5.5V24" {...tint(62, '#16202e', 'stroke')} strokeWidth="0.9" />
          <circle cx="17" cy="9.5" r="0.55" {...tint(60)} />
          <circle cx="17" cy="13.5" r="0.55" {...tint(60)} />
          <circle cx="17" cy="17.5" r="0.55" {...tint(60)} />
        </>
      );
    case 'hawaiian':
      return (
        <>
          <path d="M17 5.5V24" {...tint(62, '#16202e', 'stroke')} strokeWidth="0.9" />
          <circle cx={10 + s} cy="11.5" r="0.6" fill="#fff" opacity="0.26" />
          <circle cx={24 - s} cy="11.5" r="0.6" fill="#fff" opacity="0.26" />
          <circle cx="13" cy="17.5" r="0.6" fill="#fff" opacity="0.26" />
          <circle cx="21" cy="17.5" r="0.6" fill="#fff" opacity="0.26" />
          <circle cx={8.4 + s} cy="15.5" r="0.6" fill="#fff" opacity="0.26" />
          <circle cx={25.6 - s} cy="15.5" r="0.6" fill="#fff" opacity="0.26" />
        </>
      );
    case 'blazer':
      return (
        <>
          <path d="M17 5.5v9.5" stroke="#dfe6ee" strokeWidth="2.4" />
          <path
            d="M14.6 5.5 12.2 12l2.4 2.2M19.4 5.5 21.8 12l-2.4 2.2"
            {...tint(58, '#16202e', 'stroke')}
            strokeWidth="1.3"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="17" cy="17.8" r="0.6" {...tint(55)} />
        </>
      );
    case 'tee':
      return (
        <path
          d={`M${6.8 + s} 6.2l3.2 3.4M${27.2 - s} 6.2l-3.2 3.4`}
          {...tint(66, '#16202e', 'stroke')}
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'vneck':
    default:
      return null;
  }
}

/**
 * The legs (viewBox 34x13): trousers cut from a darker mix of the accent, so
 * identity-by-colour survives but the legs still read as clothing, with shoes
 * a shade darker still. One `<g>` per leg — the hips are the rotation origin
 * for the stride (`transform-box: fill-box` in OfficeFloor.css), so each group
 * holds its trouser and its shoe and they swing together. Seated, this whole
 * layer sits below figure-y 46, which is behind the desk (§ 6 rule 31), so a
 * sitting figure keeps its legs without anyone seeing the detail.
 *
 * The ellipse underneath is the floor contact: deliberately **outside** both
 * bob wrappers, so the shadow stays on the ground while the body breathes or
 * bounces above it — the single cheapest anti-hover there is.
 */
function Legs() {
  const trouser = tint(46, '#0e1826');
  const shoe = tint(30, '#090f1a');
  return (
    <svg
      className="office-floor-person-legs"
      viewBox="0 0 34 13"
      width="34"
      height="13"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="17" cy="12.3" rx="9" ry="1.6" fill="rgba(15,23,42,0.16)" />
      <g className="office-floor-leg office-floor-leg--left">
        <path d="M12.2 0h3.6v9h-3.6Z" {...trouser} />
        <rect x="11.5" y="8.8" width="4.9" height="3" rx="1.3" {...shoe} />
      </g>
      <g className="office-floor-leg office-floor-leg--right">
        <path d="M18.2 0h3.6v9h-3.6Z" {...trouser} />
        <rect x="17.6" y="8.8" width="4.9" height="3" rx="1.3" {...shoe} />
      </g>
    </svg>
  );
}

/**
 * Body + side-anchor shift for a build: slim pulls side marks in, broad
 * pushes them out, anything missing gets the regular silhouette.
 */
function floorBodyFor(build) {
  if (build === 'slim') return { body: BODIES.slim, s: 1.4 };
  if (build === 'broad') return { body: BODIES.broad, s: -1.4 };
  return { body: BODIES.regular, s: 0 };
}

/**
 * Class list for the figure. A walking figure takes **no** pose class at all
 * rather than losing one to the cascade: `.is-walking` and `.is-pose-*` are both
 * single-class overrides of the same `animation`, so which wins would be decided
 * by source order in a stylesheet nobody would think to check while moving a
 * rule. Legs beat hands; a walk is the pose.
 */
function figureClassName(walking, pose) {
  const posed = !walking && pose && pose !== 'idle' ? ` is-pose-${pose}` : '';
  return `office-floor-person-figure${walking ? ' is-walking' : ''}${posed}`;
}

/**
 * Everything the three layers need, resolved once.
 *
 * A helper rather than six expressions in the component body, because every one
 * of them is a `?.`/`??` chain and § 8's standing finding is that those
 * operators are most of what puts floor modules over their complexity budget.
 * The precedence it encodes is the older one: `accessoryOverride` is a
 * single-beat escape hatch and still beats the derived headwear, so a caller
 * with a reason (the arrival ceremony, a set piece) need not fabricate an
 * activity to use it.
 */
function figureParts(id, activity, accessoryOverride) {
  const traits = personaFaceTraits(id);
  return {
    traits,
    ...floorBodyFor(traits?.build),
    hold: activity?.hold ?? null,
    accessory: accessoryOverride ?? activity?.headwear ?? null,
    skin: SKIN_TONES[traits?.skin] ?? SKIN_TONES.light
  };
}

/**
 * @param {{
 *   id: string,
 *   accent: string,
 *   isYou?: boolean,
 *   idleIndex?: number,
 *   walking?: boolean,
 *   activity?: { pose?: string, hold?: string | null, headwear?: string | null } | null,
 *   accessoryOverride?: string | null,
 *   expressionOverride?: string | null
 * }} props `activity` is `floorActivityFor` (`officeFloorActivity.js`) — what
 *   this person is visibly doing. It is one object rather than three props
 *   because its three fields are one derivation and must not be assembled
 *   per-caller: six components draw a figure, and a room where five of them
 *   agree about the headset is a bug nobody sees. `accessoryOverride` is the
 *   older single-beat escape hatch and still wins, so a caller that has a
 *   reason (an arrival ceremony, a set piece) does not have to fabricate an
 *   activity to use it.
 */
export function FloorFigure({
  id,
  accent,
  isYou = false,
  idleIndex = 0,
  walking = false,
  activity = null,
  accessoryOverride = null,
  expressionOverride = null
}) {
  const { traits, body, s, hold, accessory, skin } = figureParts(id, activity, accessoryOverride);
  return (
    <span
      className={figureClassName(walking, activity?.pose)}
      style={{ '--floor-accent': accent, '--idle-delay': `${(idleIndex % 7) * 0.53}s` }}
      data-hold={hold ?? undefined}
    >
      {/* The upper wrapper is the old 48 px figure — head, torso, held item —
          and the only part that bobs, so the legs and the floor stay planted. */}
      <span className="office-floor-person-upper">
        <PersonaFace
          id={id}
          size={34}
          accentRing={false}
          fallbackEmoji={isYou ? '🙋' : undefined}
          className="office-floor-person-head"
          accessoryOverride={accessory}
          expressionOverride={expressionOverride}
        />
        <svg
          className="office-floor-person-body"
          viewBox="0 0 34 24"
          width="34"
          height="24"
          aria-hidden="true"
          focusable="false"
        >
          <path d={body.torso} fill={ACCENT} />
          <path d={body.shade} fill="rgba(15,23,42,0.16)" />
          {traits ? <TorsoGarment top={traits.top} s={s} /> : null}
        </svg>
        {hold ? (
          <svg
            className="office-floor-person-hold"
            viewBox="0 0 16 24"
            width="16"
            height="24"
            aria-hidden="true"
            focusable="false"
          >
            <HeldItem hold={hold} skin={skin} />
          </svg>
        ) : null}
      </span>
      <Legs />
    </span>
  );
}

export default FloorFigure;
