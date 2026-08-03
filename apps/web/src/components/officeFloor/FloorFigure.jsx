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
 */

import { PersonaFace } from '../personaFaces/index.jsx';
import { personaFaceTraits } from '../personaFaces/registry.js';

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
 * Body + side-anchor shift for a build: slim pulls side marks in, broad
 * pushes them out, anything missing gets the regular silhouette.
 */
function floorBodyFor(build) {
  if (build === 'slim') return { body: BODIES.slim, s: 1.4 };
  if (build === 'broad') return { body: BODIES.broad, s: -1.4 };
  return { body: BODIES.regular, s: 0 };
}

/**
 * @param {{
 *   id: string,
 *   accent: string,
 *   isYou?: boolean,
 *   idleIndex?: number,
 *   walking?: boolean,
 *   accessoryOverride?: string | null,
 *   expressionOverride?: string | null
 * }} props
 */
export function FloorFigure({
  id,
  accent,
  isYou = false,
  idleIndex = 0,
  walking = false,
  accessoryOverride = null,
  expressionOverride = null
}) {
  const traits = personaFaceTraits(id);
  const { body, s } = floorBodyFor(traits?.build);
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
    </span>
  );
}

export default FloorFigure;
