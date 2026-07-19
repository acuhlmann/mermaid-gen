/**
 * <PersonaFace> — one parametric SVG face for the whole office cast.
 *
 * Replaces the raw `avatarEmoji` text nodes that used to render every
 * character (emoji vary wildly per platform and can't carry the per-persona
 * accent color the data model already has). Traits come from ./registry.js;
 * the accent ring comes from `officeSenderInfo`, which already normalizes
 * stakeholder `--vars` into usable `var()` colors.
 *
 * Like ActionPersonaIcon, this looks its own data up by id — callers pass an
 * id, not a persona object — so `officeSenderInfo`'s return shape is unchanged
 * and no data-layer call site had to move.
 *
 * Kept `aria-hidden`: every call site pairs the avatar with the visible name.
 */

import { officeSenderInfo } from '../../utils/officeCast.js';
import { HAIR_COLORS, SKIN_TONES, personaFaceTraits } from './registry.js';

/** Below this rendered size, fine detail turns to mud — draw the silhouette only. */
const LOW_DETAIL_MAX_PX = 24;

const LINE = '#2f2a28';

function Hair({ style, color }) {
  switch (style) {
    case 'bald':
      return null;
    case 'buzz':
      return <path d="M11 16.4a9 9 0 0 1 18 0 12 12 0 0 0-18 0Z" fill={color} />;
    case 'receding':
      return (
        <path
          d="M11.2 15.8c1.4-1.1 3-1.4 4.3-.6-.5-1.6.2-2.9 1.6-3.5 2.6-1.1 6.6-.6 8.5 1.4 1.3 1.4 1.6 3 1.4 4.6-1.2-3.2-4.2-4.6-7.8-4.2-3 .3-5.6 1.1-8 2.3Z"
          fill={color}
        />
      );
    case 'bob':
      return (
        <>
          <path
            d="M10.4 20.5c-.6-6 3.6-10.4 9.6-10.4s10.2 4.4 9.6 10.4c-.6-.3-1.2-.6-1.7-1.1.3-3.9-3-6.4-7.9-6.4s-8.2 2.5-7.9 6.4c-.5.5-1.1.8-1.7 1.1Z"
            fill={color}
          />
          <path
            d="M10.5 18.6c.8 0 1.5.5 1.6 1.3l.5 4.6c.1.9-.6 1.6-1.5 1.6s-1.6-.6-1.7-1.5l-.4-4.4c-.1-.9.6-1.6 1.5-1.6Z"
            fill={color}
          />
          <path
            d="M29.5 18.6c.9 0 1.6.7 1.5 1.6l-.4 4.4c-.1.9-.8 1.5-1.7 1.5s-1.6-.7-1.5-1.6l.5-4.6c.1-.8.8-1.3 1.6-1.3Z"
            fill={color}
          />
        </>
      );
    case 'ponytail':
      return (
        <>
          <path
            d="M10.6 18.6c-.3-5.4 3.7-9.3 9.4-9.3s9.7 3.9 9.4 9.3c-1-3.9-4.5-6.2-9.4-6.2s-8.4 2.3-9.4 6.2Z"
            fill={color}
          />
          <path
            d="M29.4 17.6c2.3.5 3.8 2.4 3.9 4.9.1 2.2-.9 4.1-2.5 5.1-.7.4-1.5-.5-1.1-1.2.8-1.3 1.1-2.6 1-4-.1-1.5-.6-2.8-1.6-3.8-.5-.4-.3-1.1.3-1Z"
            fill={color}
          />
        </>
      );
    case 'long':
      return (
        <>
          <path
            d="M10.4 20c-.6-6 3.6-10.7 9.6-10.7s10.2 4.7 9.6 10.7c-1.1-4.4-4.6-7-9.6-7s-8.5 2.6-9.6 7Z"
            fill={color}
          />
          <path
            d="M10.6 18.4c.9-.1 1.7.6 1.7 1.5v10.4c0 .9-.7 1.6-1.6 1.6s-1.6-.7-1.6-1.6l-.1-10.2c0-.9.7-1.6 1.6-1.7Z"
            fill={color}
          />
          <path
            d="M29.4 18.4c.9.1 1.6.8 1.6 1.7l-.1 10.2c0 .9-.7 1.6-1.6 1.6s-1.6-.7-1.6-1.6V19.9c0-.9.8-1.6 1.7-1.5Z"
            fill={color}
          />
        </>
      );
    case 'short':
    default:
      return (
        <path
          d="M10.6 19.2c-.4-6 3.6-10.1 9.4-10.1s9.8 4.1 9.4 10.1c-.5-1-1.1-1.8-1.8-2.5-1-2.6-3.6-3.9-7.6-3.9s-6.6 1.3-7.6 3.9c-.7.7-1.3 1.5-1.8 2.5Z"
          fill={color}
        />
      );
  }
}

function FacialHair({ style, color }) {
  switch (style) {
    case 'stubble':
      return (
        <path
          d="M12.6 21.5c.6 4.1 3.5 6.6 7.4 6.6s6.8-2.5 7.4-6.6c.5 5.6-2.6 9.4-7.4 9.4s-7.9-3.8-7.4-9.4Z"
          fill={color}
          opacity="0.28"
        />
      );
    case 'moustache':
      return (
        <path
          d="M16.1 23.4c1.1-.7 2.4-.7 3.9-.3 1.5-.4 2.8-.4 3.9.3.4.3.2.9-.3.9-1.2-.1-2.4-.2-3.6-.2s-2.4.1-3.6.2c-.5 0-.7-.6-.3-.9Z"
          fill={color}
        />
      );
    case 'beard':
      return (
        <>
          <path
            d="M12.3 20.6c.2 3.4.6 6.1 1.9 8.1 1.3 2.1 3.3 3.2 5.8 3.2s4.5-1.1 5.8-3.2c1.3-2 1.7-4.7 1.9-8.1.4 6.6-1.6 12.4-7.7 12.4s-8.1-5.8-7.7-12.4Z"
            fill={color}
          />
          <path
            d="M16.1 23.3c1.1-.7 2.4-.7 3.9-.3 1.5-.4 2.8-.4 3.9.3.4.3.2.9-.3.9-1.2-.1-2.4-.2-3.6-.2s-2.4.1-3.6.2c-.5 0-.7-.6-.3-.9Z"
            fill={color}
          />
        </>
      );
    case 'none':
    default:
      return null;
  }
}

function Eyes({ expression }) {
  if (expression === 'tired') {
    return (
      <>
        <circle cx="16.4" cy="18.6" r="1.05" fill={LINE} />
        <circle cx="23.6" cy="18.6" r="1.05" fill={LINE} />
        <path
          d="M14.7 17.5h3.4M21.9 17.5h3.4"
          stroke={LINE}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </>
    );
  }
  if (expression === 'wide') {
    return (
      <>
        <circle cx="16.4" cy="18.3" r="2.1" fill="#fff" />
        <circle cx="23.6" cy="18.3" r="2.1" fill="#fff" />
        <circle cx="16.4" cy="18.5" r="1.15" fill={LINE} />
        <circle cx="23.6" cy="18.5" r="1.15" fill={LINE} />
      </>
    );
  }
  return (
    <>
      <circle cx="16.4" cy="18.4" r="1.15" fill={LINE} />
      <circle cx="23.6" cy="18.4" r="1.15" fill={LINE} />
    </>
  );
}

function Brows({ expression }) {
  const d = {
    frown: 'M14.6 15.6 18.1 16.6M25.4 15.6 21.9 16.6',
    smirk: 'M14.6 16.1h3.3M25.4 15.3l-3.3.9',
    wide: 'M14.5 14.9h3.5M22 14.9h3.5',
    tired: 'M14.6 15.9h3.3M22.1 15.9h3.3'
  }[expression];
  if (!d) return null;
  return <path d={d} stroke={LINE} strokeWidth="1.1" strokeLinecap="round" fill="none" />;
}

function Mouth({ expression }) {
  switch (expression) {
    case 'smile':
      return (
        <path
          d="M17.2 23.4c.9 1.1 1.8 1.6 2.8 1.6s1.9-.5 2.8-1.6"
          stroke={LINE}
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'smirk':
      return (
        <path
          d="M17.4 24.1c1.6.6 3.2.4 4.8-.9"
          stroke={LINE}
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'frown':
      return (
        <path
          d="M17.4 24.6c.8-1 1.7-1.5 2.6-1.5s1.8.5 2.6 1.5"
          stroke={LINE}
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'wide':
      return <ellipse cx="20" cy="24.1" rx="1.6" ry="1.9" fill={LINE} />;
    case 'tired':
    case 'neutral':
    default:
      return (
        <path d="M17.8 24h4.4" stroke={LINE} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      );
  }
}

function Glasses({ style }) {
  if (style === 'none' || !style) return null;
  if (style === 'visor') {
    return (
      <path d="M12.6 16.9h14.8v3.3a2 2 0 0 1-2 2h-10.8a2 2 0 0 1-2-2Z" fill={LINE} opacity="0.75" />
    );
  }
  const lens =
    style === 'square' ? (
      <>
        <rect x="13.2" y="16.3" width="5.6" height="4.4" rx="0.8" />
        <rect x="21.2" y="16.3" width="5.6" height="4.4" rx="0.8" />
      </>
    ) : (
      <>
        <circle cx="16.2" cy="18.5" r="2.9" />
        <circle cx="23.8" cy="18.5" r="2.9" />
      </>
    );
  return (
    <g fill="none" stroke={LINE} strokeWidth="1.05">
      {lens}
      <path d="M18.9 18.4h2.2" strokeLinecap="round" />
    </g>
  );
}

function Accessory({ style, accent }) {
  switch (style) {
    case 'hardhat':
      return (
        <>
          <path d="M9.6 15.2a10.4 10.4 0 0 1 20.8 0Z" fill="#f4a723" />
          <path d="M8.6 15.2h22.8a.9.9 0 0 1 0 1.8H8.6a.9.9 0 0 1 0-1.8Z" fill="#d98c12" />
          <path d="M18.6 6.4h2.8v7.6h-2.8Z" fill="#d98c12" opacity="0.8" />
        </>
      );
    case 'headset':
      return (
        <>
          <path
            d="M11.4 18.4v-1.8a8.6 8.6 0 0 1 17.2 0v1.8"
            stroke={LINE}
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <rect x="9.6" y="17.4" width="3" height="4.6" rx="1.4" fill={LINE} />
          <rect x="27.4" y="17.4" width="3" height="4.6" rx="1.4" fill={LINE} />
          <path
            d="M11.1 22c0 2.4 1.6 4 4 4.2"
            stroke={LINE}
            strokeWidth="1.1"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="15.4" cy="26.4" r="1.1" fill={LINE} />
        </>
      );
    case 'tie':
      return (
        <>
          <path d="M20 31.4 18.4 34l1.6 4.2 1.6-4.2Z" fill="#c0392b" />
          <path d="M20 30.6 18.3 32l1.7 1.6 1.7-1.6Z" fill="#96281b" />
        </>
      );
    case 'lanyard':
      return (
        <>
          <path
            d="M16.8 30.6 19.4 35M23.2 30.6 20.6 35"
            stroke={accent}
            strokeWidth="1.3"
            fill="none"
            strokeLinecap="round"
          />
          <rect x="18.2" y="34.6" width="3.6" height="4.4" rx="0.7" fill="#f7f7f8" />
          <path d="M18.9 36h2.2M18.9 37.4h1.5" stroke={LINE} strokeWidth="0.7" opacity="0.6" />
        </>
      );
    case 'badge':
      return (
        <>
          <rect x="24.4" y="33.4" width="4.2" height="5" rx="0.8" fill="#f7f7f8" />
          <path d="M25.2 35h2.6M25.2 36.4h1.8" stroke={LINE} strokeWidth="0.7" opacity="0.6" />
          <path d="M26.5 33.4v-1.2" stroke={accent} strokeWidth="1.1" strokeLinecap="round" />
        </>
      );
    case 'none':
    default:
      return null;
  }
}

/**
 * @param {{
 *   id: string,
 *   size?: number,
 *   className?: string,
 *   title?: string,
 *   fallbackEmoji?: string
 * }} props
 */
export function PersonaFace({ id, size = 40, className, title, fallbackEmoji }) {
  const traits = personaFaceTraits(id);
  const sender = officeSenderInfo(id);

  // Unknown ids — the meeting's "you" seat, or a future roster member without
  // a trait row yet — degrade to the emoji they already had rather than
  // rendering a blank box.
  if (!traits) {
    return (
      <span className={className} aria-hidden="true" style={{ fontSize: size * 0.72 }}>
        {fallbackEmoji || sender?.avatarEmoji || '👤'}
      </span>
    );
  }

  const accent = sender?.accentColor || 'var(--accent)';
  const skin = SKIN_TONES[traits.skin] ?? SKIN_TONES.light;
  const hairColor = HAIR_COLORS[traits.hairColor] ?? HAIR_COLORS.brown;
  const lowDetail = size <= LOW_DETAIL_MAX_PX;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      data-persona-face={id}
      data-detail={lowDetail ? 'low' : 'full'}
    >
      {title ? <title>{title}</title> : null}

      {/* Accent disc — the per-character color the emoji could never carry. */}
      <circle cx="20" cy="20" r="20" fill={accent} opacity="0.16" />
      <circle cx="20" cy="20" r="19.2" fill="none" stroke={accent} strokeWidth="1.6" />

      {/* Clip the shoulders to the disc so the garment reads as a portrait crop. */}
      <clipPath id={`persona-face-clip-${id}`}>
        <circle cx="20" cy="20" r="19.2" />
      </clipPath>
      <g clipPath={`url(#persona-face-clip-${id})`}>
        <path d="M20 29c6.1 0 11 3.9 11 8.7V41H9v-3.3C9 32.9 13.9 29 20 29Z" fill={accent} />
        <path d="M17.6 27.2h4.8v4.3a2.4 2.4 0 0 1-4.8 0Z" fill={skin} />

        {/* Head */}
        <ellipse cx="10.9" cy="19.4" rx="1.5" ry="1.9" fill={skin} />
        <ellipse cx="29.1" cy="19.4" rx="1.5" ry="1.9" fill={skin} />
        <path
          d="M20 9.6c5.1 0 8.2 3.4 8.2 8.6 0 6-3.5 10.5-8.2 10.5s-8.2-4.5-8.2-10.5c0-5.2 3.1-8.6 8.2-8.6Z"
          fill={skin}
          stroke={LINE}
          strokeWidth="0.4"
          strokeOpacity="0.22"
        />

        {/*
          Hairline outline so pale hair (white/grey/blond) still reads against
          pale skin — without it, explain/greybeard/facilities wash out into a
          featureless blob. Invisible on dark hair, so it is applied to all.
        */}
        <g stroke={LINE} strokeWidth="0.45" strokeOpacity="0.3" strokeLinejoin="round">
          {!lowDetail && <FacialHair style={traits.facialHair} color={hairColor} />}
          <Hair style={traits.hair} color={hairColor} />
        </g>

        <Eyes expression={traits.expression} />
        {!lowDetail && <Brows expression={traits.expression} />}
        <Mouth expression={traits.expression} />

        {!lowDetail && <Glasses style={traits.glasses} />}
        {!lowDetail && <Accessory style={traits.accessory} accent={accent} />}
      </g>
    </svg>
  );
}

export default PersonaFace;
// Trait data is NOT re-exported here — mixing non-component exports into a
// component module breaks Fast Refresh. Import from ./registry.js directly.
