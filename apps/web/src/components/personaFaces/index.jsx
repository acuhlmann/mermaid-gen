/**
 * <PersonaFace> — one parametric SVG face for the whole office cast.
 *
 * Replaces the raw `avatarEmoji` text nodes that used to render every
 * character (emoji vary wildly per platform and can't carry the per-persona
 * accent color the data model already has). Traits come from ./registry.js;
 * the accent ring comes from `officeSenderInfo`, which already normalizes
 * stakeholder `--vars` into usable `var()` colors.
 *
 * The named Silicon Valley seats are drawn toward their actors — face shape,
 * hair silhouette, brows, eyes, nose, facial hair and garment all come from
 * the trait row, so "more like the show" costs data, not new code paths.
 *
 * Geometry note: every face shape shares ONE cranium (crown y9.6, temples at
 * x11.8/28.2 y18.2) so hair and ears line up across shapes — only the jaw
 * below y18 differs. New hair styles must span at least x11–29 to cover the
 * round jaw's wider cheeks.
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
const GOLD = '#e3b341';

/**
 * Darken/lighten `color` toward `target` via color-mix, with the plain
 * attribute as the fallback when color-mix is unsupported (the style loses
 * and the attribute paints instead).
 */
function tint(color, percent, target = '#16202e', attr = 'fill') {
  return {
    [attr]: color,
    style: { [attr]: `color-mix(in srgb, ${color} ${percent}%, ${target})` }
  };
}

/**
 * All four shapes share the cranium curve (crown → temples at 11.8/28.2,
 * y18.2) so one set of hair paths fits every head. Only the jaw changes:
 * oval tapers, long drops a narrower chin lower, round keeps full cheeks,
 * square drops straight sides into a corner and a flatter chin.
 */
const HEAD_SHAPES = {
  oval: 'M20 9.6c5.1 0 8.2 3.4 8.2 8.6 0 6-3.5 10.5-8.2 10.5s-8.2-4.5-8.2-10.5c0-5.2 3.1-8.6 8.2-8.6Z',
  long: 'M20 9.6c4.7 0 7.4 3.4 7.4 8.6 0 3-.4 5.6-1.1 7.6-.9 2.5-2.7 4.3-6.3 4.3s-5.4-1.8-6.3-4.3c-.7-2-1.1-4.6-1.1-7.6 0-5.2 2.7-8.6 7.4-8.6Z',
  round:
    'M20 9.6c5.4 0 8.8 3.4 8.8 8.6 0 3-.5 5.2-1.6 6.8-1.3 1.9-3.8 2.9-7.2 2.9s-5.9-1-7.2-2.9c-1.1-1.6-1.6-3.8-1.6-6.8 0-5.2 3.4-8.6 8.8-8.6Z',
  square:
    'M20 9.6c5 0 7.8 3.4 7.8 8.6v4.4c0 1.6-.5 2.8-1.5 3.6-1.3 1.1-3.5 1.7-6.3 1.7s-5-.6-6.3-1.7c-1-.8-1.5-2-1.5-3.6v-4.4c0-5.2 2.8-8.6 7.8-8.6Z'
};

function Hair({ style, color, skin }) {
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
            d="M11.8 18.2c.8 0 1.5.5 1.6 1.3l.5 5.8c.1.9-.6 1.7-1.5 1.7s-1.6-.7-1.7-1.6l-.4-5.6c-.1-.9.6-1.6 1.5-1.6Z"
            fill={color}
          />
          <path
            d="M28.2 18.2c-.8 0-1.5.5-1.6 1.3l-.5 5.8c-.1.9.6 1.7 1.5 1.7s1.6-.7 1.7-1.6l.4-5.6c.1-.9-.6-1.6-1.5-1.6Z"
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
    case 'sidepart': {
      // Richard: neat dark cap, part on the viewer's left, sweep across the
      // forehead; the skin notch is the part line showing through.
      return (
        <>
          <path
            d="M11.5 18.6c-.6-6.3 3.2-9.9 8.5-9.9s9.1 3.6 8.5 9.9c-.4-.9-1-1.7-1.7-2.3.1-1.4-.8-2.6-2.2-3-2.9-.9-6.6-.6-9.1.8-1.6.9-3 2.2-4 4.5Z"
            fill={color}
          />
          <path d="M15.6 14c.3-1.1 1-2 2-2.4.1 1-.4 2-1.3 2.6-.3.2-.7 0-.7-.2Z" fill={skin} />
        </>
      );
    }
    case 'crop':
      // Short back and sides with a textured zigzag fringe (Dinesh, Chad).
      // Sides stop above the ear; deep teeth keep it from reading as a bowl.
      return (
        <path
          d="M11.6 16.2c-.3-5 3.3-7.9 8.4-7.9s8.7 2.9 8.4 7.9c-.5-.9-1.1-1.6-1.9-2.1l-.8 1.7-.9-1.9-.8 1.7-.9-1.9-.8 1.7-.9-1.9-.8 1.7-.9-1.9-.8 1.7-.9-1.9-.8 1.7-.9-1.9-.8 1.7-.9-1.9-.7 1.6c-1 .5-1.7 1.2-2.3 2Z"
          fill={color}
        />
      );
    case 'curtain': {
      // Gilfoyle: centre part, straight falls covering the ears to the jaw.
      return (
        <>
          <path
            d="M11.4 19.8C10.8 13 14.7 8.7 20 8.7s9.2 4.3 8.6 11.1c-.4-1.2-1-2.2-1.9-2.9.3-2.6-1.2-4.5-3.6-5-1.3-.3-2.6-.1-3.8.5-.2.1-.4.1-.6 0-1.1-.6-2.4-.9-3.6-.6-2.3.5-3.6 2.3-3.3 4.9-.9.7-1.5 1.7-1.9 3.1Z"
            fill={color}
          />
          <path
            d="M11 18.2c.9-.2 1.7.4 1.8 1.3l.3 8.6c.1 1-.7 1.8-1.7 1.8s-1.7-.8-1.8-1.7l-.3-8.3c-.1-1 .7-1.6 1.7-1.7Z"
            fill={color}
          />
          <path
            d="M29 18.2c-.9-.2-1.7.4-1.8 1.3l-.3 8.6c-.1 1 .7 1.8 1.7 1.8s1.7-.8 1.8-1.7l.3-8.3c.1-1-.7-1.6-1.7-1.7Z"
            fill={color}
          />
          <path
            d="M19.3 12.6c.2-1 .5-1.8 1-2.4.3.5.5 1.2.5 1.9 0 .8-.3 1.6-.8 2.2-.5-.5-.7-1-.7-1.7Z"
            fill={skin}
          />
        </>
      );
    }
    case 'shag': {
      // Erlich: messy wavy mop — scalloped hem that swallows the ears, deep
      // fringe notches, and stray tufts so it never reads as a swim cap.
      return (
        <>
          <path
            d="M10.9 20.8C10 13.2 14.1 8.4 20 8.4s10 4.8 9.1 12.4c.3 1.5 0 3-.8 4.3-.5.8-1.6.9-2.1 0-.3-.5-.6-1-1-1.4-.5.7-1.2 1.2-2 1.1-.7 0-1.4-.4-1.8-1-.4.6-1.1 1-1.8 1-.8 0-1.5-.4-2-1.1-.4.4-.7.9-1 1.4-.5.9-1.6.8-2.1 0-.8-1.3-1.1-2.8-.8-4.3Z"
            fill={color}
          />
          <path
            d="M10.5 15.2c-.7.1-1.1.8-1 1.5.1.5.7.9 1.2.7.6-.2.9-.8.8-1.4-.1-.6-.6-.9-1-.8Zm19 .2c.7.1 1.1.8 1 1.5-.1.5-.7.9-1.2.7-.6-.2-.9-.8-.8-1.4.1-.5.6-.9 1-.8Z"
            fill={color}
          />
          <path
            d="M13.2 15.9c1-.9 2.1-1.3 3.2-1.2-.6 1-1.6 1.5-2.7 1.5-.3 0-.5-.1-.5-.3Zm7-.3c1-.7 2.1-.9 3.1-.6-.7.9-1.7 1.3-2.8 1.2-.2-.1-.3-.4-.3-.6Z"
            fill={skin}
          />
        </>
      );
    }
    case 'spiky':
      // Russ: short spikes swept up off the forehead.
      return (
        <path
          d="M11.7 18.4c-.4-2.9 0-5.4 1.2-7.4l1.4 2.3 1.1-3.4 1.5 2.7 1.3-3.5 1.4 3 1.4-3 1.5 3.2 1.1-2.6c1.2 1.9 1.7 4.3 1.4 7.2-.9-1.5-2.1-2.5-3.6-3-2.7-.9-6.2-.8-8.6.2-1.3.6-2.5 1.6-3.7 4.2Z"
          fill={color}
        />
      );
    case 'sweep': {
      // Jared: tidy side comb, part on the viewer's right, high and neat.
      return (
        <>
          <path
            d="M11.7 18.4C11.2 12 15 8.7 20 8.7s8.8 3.3 8.3 9.7c-.5-1-1.2-1.8-2-2.4-.9-2-2.9-3.2-5.4-3.3-2.4-.1-4.9.6-6.8 2-1 .7-1.9 1.9-2.4 3.7Z"
            fill={color}
          />
          <path d="M24.2 13.2c.4-1 1.1-1.7 2-2 .1 1-.4 2-1.3 2.4-.3.2-.7-.1-.7-.4Z" fill={skin} />
        </>
      );
    }
    case 'slicked':
      // Belson: slicked straight back with the corners receding (M hairline).
      return (
        <path
          d="M12.1 18.8C11.5 12.7 14.8 9 20 9s8.5 3.7 7.9 9.8c-.4-1.5-1.1-2.7-2.1-3.6.4-1.3-.1-2.5-1.2-2.9-.9-.3-1.9-.2-2.8.2-.6.3-1.2.4-1.8.4s-1.2-.1-1.8-.4c-.9-.4-1.9-.5-2.8-.2-1.1.4-1.6 1.6-1.2 2.9-1 .9-1.7 2.1-2.1 3.6Z"
          fill={color}
        />
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
    case 'scruff':
      // Erlich's patchy short beard — the beard silhouette, grown thin.
      return (
        <>
          <path
            d="M12.3 20.6c.2 3.4.6 6.1 1.9 8.1 1.3 2.1 3.3 3.2 5.8 3.2s4.5-1.1 5.8-3.2c1.3-2 1.7-4.7 1.9-8.1.4 6.6-1.6 12.4-7.7 12.4s-8.1-5.8-7.7-12.4Z"
            fill={color}
            opacity="0.42"
          />
          <path
            d="M16.1 23.3c1.1-.7 2.4-.7 3.9-.3 1.5-.4 2.8-.4 3.9.3.4.3.2.9-.3.9-1.2-.1-2.4-.2-3.6-.2s-2.4.1-3.6.2c-.5 0-.7-.6-.3-.9Z"
            fill={color}
            opacity="0.65"
          />
        </>
      );
    case 'none':
    default:
      return null;
  }
}

/**
 * The trait's eye shape is the resting state; `wide` and `tired` are beats
 * that override it (the manic grin needs the wide whites, a long day needs
 * the lid lines) no matter whose face they land on.
 */
function Eyes({ shape, expression }) {
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
  switch (shape) {
    case 'lidded':
      // Gilfoyle's half-mast deadpan: a lid line heavy over each pupil.
      return (
        <>
          <circle cx="16.4" cy="18.8" r="1.05" fill={LINE} />
          <circle cx="23.6" cy="18.8" r="1.05" fill={LINE} />
          <path
            d="M15 18.1h2.9M22.1 18.1h2.9"
            stroke={LINE}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </>
      );
    case 'round':
      // Jared's big gentle eyes — visible white around the pupil.
      return (
        <>
          <circle cx="16.4" cy="18.4" r="1.75" fill="#fff" />
          <circle cx="23.6" cy="18.4" r="1.75" fill="#fff" />
          <circle cx="16.4" cy="18.5" r="1" fill={LINE} />
          <circle cx="23.6" cy="18.5" r="1" fill={LINE} />
        </>
      );
    case 'deep':
      // Deep-set (Richard, Gavin): a brow-bone shadow over each pupil.
      return (
        <>
          <circle cx="16.4" cy="18.5" r="1.1" fill={LINE} />
          <circle cx="23.6" cy="18.5" r="1.1" fill={LINE} />
          <path
            d="M15 17.2c.5-.4 1.1-.6 1.8-.5M23.2 17.2c.5-.4 1.1-.6 1.8-.5"
            stroke={LINE}
            strokeWidth="0.9"
            strokeLinecap="round"
            fill="none"
            opacity="0.45"
          />
        </>
      );
    case 'almond':
      // Dinesh: pupil with a small outer-corner flick.
      return (
        <>
          <circle cx="16.4" cy="18.4" r="1.15" fill={LINE} />
          <circle cx="23.6" cy="18.4" r="1.15" fill={LINE} />
          <path
            d="M14.8 18.2l-.8-.5M25.2 18.2l.8-.5"
            stroke={LINE}
            strokeWidth="0.9"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case 'dot':
    default:
      return (
        <>
          <circle cx="16.4" cy="18.4" r="1.15" fill={LINE} />
          <circle cx="23.6" cy="18.4" r="1.15" fill={LINE} />
        </>
      );
  }
}

/**
 * Brows are a trait now (drawn in the hair color), not an expression garnish
 * — Gilfoyle's straight bar and Dinesh's heavy brows are identity. The
 * expression only tilts them: frown pulls the inner ends down, wide lifts,
 * smirk cocks the right one.
 */
function Brows({ shape, expression, color }) {
  const width = { thin: 0.8, straight: 1.2, thick: 1.7, bushy: 2 }[shape] ?? 1.2;
  const spread = shape === 'bushy' ? 0.4 : 0;
  let d;
  if (expression === 'frown') {
    d = `M${14.7 - spread} 15.5l${3.1 + spread} .9M${25.3 + spread} 15.5l${-3.1 - spread} .9`;
  } else if (expression === 'wide') {
    d = `M${14.8 - spread} 14.9h${3.2 + spread}M${22 + 0} 14.9h${3.2 + spread}`;
  } else if (expression === 'smirk') {
    d = `M${14.8 - spread} 15.9h${3.1 + spread}M${25.3 + spread} 15.1l${-3.2 - spread} .9`;
  } else {
    d = `M${14.8 - spread} 15.8h${3.1 + spread}M${22.1} 15.8h${3.1 + spread}`;
  }
  return <path d={d} stroke={color} strokeWidth={width} strokeLinecap="round" fill="none" />;
}

/** Front-view noses: a quiet stroke between eyes and mouth, gone at low detail. */
function Nose({ style }) {
  switch (style) {
    case 'button':
      return (
        <path
          d="M19.7 20.6c-.2 1 .1 1.7.9 1.9.3.1.7 0 1-.2"
          stroke={LINE}
          strokeWidth="0.85"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
      );
    case 'broad':
      return (
        <path
          d="M19.6 19.8l-.6 2.4c-.2.7.3 1.3 1 1.3h.8"
          stroke={LINE}
          strokeWidth="0.85"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.7"
        />
      );
    case 'straight':
    default:
      return (
        <path
          d="M20 19.6v2.8c0 .5-.4.9-.9 1"
          stroke={LINE}
          strokeWidth="0.85"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
      );
  }
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
      // The manic grin (Russ, Chad): teeth showing, not an open hole.
      return (
        <path
          d="M16.9 22.7h6.2c0 2-1.4 3.4-3.1 3.4s-3.1-1.4-3.1-3.4Z"
          fill="#fff"
          stroke={LINE}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      );
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
    case 'headphones':
      // The headset above, minus the boom — which is the whole distinction, in
      // the office and in the drawing. A headset means a call is happening to
      // you; headphones mean you have decided the office is not (the Admin
      // menu's Headphones posture). Deeper cups than the headset's so the two
      // are still telling apart at 34 px, where the missing mic is two pixels.
      // The band's apex sits at y ≈ 7.6, above the shared crown at y 9.6, so it
      // clears every hair style rather than parting one (docs/office-parody.md
      // § How a character is drawn).
      return (
        <>
          <path
            d="M10.6 19.4v-2a9.4 9.4 0 0 1 18.8 0v2"
            stroke={LINE}
            strokeWidth="1.9"
            fill="none"
            strokeLinecap="round"
          />
          <rect x="8.5" y="16.6" width="4.2" height="6.4" rx="2.1" fill={LINE} />
          <rect x="27.3" y="16.6" width="4.2" height="6.4" rx="2.1" fill={LINE} />
          <rect x="11.1" y="18" width="1.6" height="3.6" rx="0.8" fill={accent} opacity="0.75" />
          <rect x="27.3" y="18" width="1.6" height="3.6" rx="0.8" fill={accent} opacity="0.75" />
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
    case 'chain':
      // Russ's gold chain, resting on the open collar.
      return (
        <>
          <path
            d="M16.7 30.6c.8 1.7 1.9 2.6 3.3 2.6s2.5-.9 3.3-2.6"
            stroke={GOLD}
            strokeWidth="1.1"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="20" cy="33.5" r="1" fill={GOLD} />
        </>
      );
    case 'none':
    default:
      return null;
  }
}

/**
 * The garment cut on the portrait's shoulders. Drawn over the accent torso
 * and under the neck, so collars tuck naturally; the floor torso
 * (FloorFigure) continues the same cut below the head. The accent stays the
 * body color — identity-by-color is the app's convention — only the shading
 * and cut change. Skin shows through the v-neck and the hawaiian's open
 * collar; the hoodie's hood sits behind the jaw.
 */
function Garment({ top, accent, skin }) {
  const dark = tint(accent, 66);
  const darkStroke = tint(accent, 62, '#16202e', 'stroke');
  switch (top) {
    case 'hoodie':
      return (
        <>
          <path
            d="M13 33.6c0-4 3.1-6.4 7-6.4s7 2.4 7 6.4c-1.8-1.5-4.2-2.3-7-2.3s-5.2.8-7 2.3Z"
            {...dark}
          />
          <path
            d="M18.5 31.2v3.8M21.5 31.2v3.8"
            stroke="#e8edf3"
            strokeWidth="0.8"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
        </>
      );
    case 'sweater':
      return (
        <path
          d="M16 30.2c1.2 1.2 2.5 1.7 4 1.7s2.8-.5 4-1.7"
          {...darkStroke}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'oxford':
      return (
        <>
          <path d="M17.3 30.1 20 31.6 18.6 33.6 16.6 31Z" fill="#eef2f7" />
          <path d="M22.7 30.1 20 31.6 21.4 33.6 23.4 31Z" fill="#eef2f7" />
          <path d="M20 31.8V41" {...darkStroke} strokeWidth="0.8" />
          <circle cx="20" cy="34.6" r="0.45" {...dark} />
          <circle cx="20" cy="37.4" r="0.45" {...dark} />
        </>
      );
    case 'vneck':
      return (
        <>
          <path d="M17.1 29.9 20 34.4 22.9 29.9Z" fill={skin} />
          <path
            d="M17.1 29.9 20 34.4 22.9 29.9"
            {...darkStroke}
            strokeWidth="1"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case 'hawaiian':
      return (
        <>
          <path d="M16.3 29.8 20 35.2 23.7 29.8Z" fill={skin} />
          <path d="M16.3 29.8 20 35.2 18.2 36.4 15.2 31.4Z" fill="#eef2f7" opacity="0.9" />
          <path d="M23.7 29.8 20 35.2 21.8 36.4 24.8 31.4Z" fill="#eef2f7" opacity="0.9" />
          <circle cx="13.6" cy="35.4" r="0.55" fill="#fff" opacity="0.3" />
          <circle cx="26.4" cy="35.4" r="0.55" fill="#fff" opacity="0.3" />
          <circle cx="15.9" cy="38.6" r="0.55" fill="#fff" opacity="0.3" />
          <circle cx="24.1" cy="38.6" r="0.55" fill="#fff" opacity="0.3" />
        </>
      );
    case 'blazer':
      return (
        <>
          <path d="M17.5 30.2 20 33.4 22.5 30.2 20 41Z" fill="#eef2f7" />
          <path d="M17.5 30.2 14.8 31.4 17.6 41h2.4Z" {...dark} />
          <path d="M22.5 30.2 25.2 31.4 22.4 41h-2.4Z" {...dark} />
        </>
      );
    case 'tee':
    default:
      return (
        <path
          d="M16.2 30.1c1.1 1.1 2.4 1.6 3.8 1.6s2.7-.5 3.8-1.6"
          {...darkStroke}
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
        />
      );
  }
}

/**
 * @param {{
 *   id: string,
 *   size?: number,
 *   className?: string,
 *   title?: string,
 *   fallbackEmoji?: string,
 *   accentRing?: boolean,
 *   accessoryOverride?: 'none' | 'headset' | 'headphones' | 'hardhat' | 'lanyard' | 'tie'
 *     | 'badge' | 'chain' | null,
 *   expressionOverride?: 'neutral' | 'smile' | 'smirk' | 'frown' | 'wide' | 'tired' | null
 * }} props `accessoryOverride` swaps the baked trait accessory for one beat
 *   (headset syncs and your own Headphones posture on the floor) without
 *   mutating the registry. `headphones` is override-only — no cast member wears
 *   a pair as a trait, because it is your preference rather than their look.
 *   `expressionOverride` does the same for mood (holy-war combatants scowl).
 */
export function PersonaFace({
  id,
  size = 40,
  className,
  title,
  fallbackEmoji,
  accentRing = true,
  accessoryOverride = null,
  expressionOverride = null
}) {
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
  const accessory = accessoryOverride ?? traits.accessory;
  const expression = expressionOverride ?? traits.expression;
  const headPath = HEAD_SHAPES[traits.faceShape] ?? HEAD_SHAPES.oval;

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
      data-accessory={accessory}
    >
      {title ? <title>{title}</title> : null}

      {accentRing ? (
        <>
          {/* Accent disc — the per-character color the emoji could never carry. */}
          <circle cx="20" cy="20" r="20" fill={accent} opacity="0.16" />
          <circle cx="20" cy="20" r="19.2" fill="none" stroke={accent} strokeWidth="1.6" />
        </>
      ) : null}

      {/* Clip the shoulders to the disc so the garment reads as a portrait crop. */}
      <clipPath id={`persona-face-clip-${id}`}>
        <circle cx="20" cy="20" r="19.2" />
      </clipPath>
      <g clipPath={`url(#persona-face-clip-${id})`}>
        <path d="M20 29c6.1 0 11 3.9 11 8.7V41H9v-3.3C9 32.9 13.9 29 20 29Z" fill={accent} />
        {!lowDetail && <Garment top={traits.top} accent={accent} skin={skin} />}
        <path d="M17.6 27.2h4.8v4.3a2.4 2.4 0 0 1-4.8 0Z" fill={skin} />

        {/* Head */}
        <ellipse cx="10.9" cy="19.4" rx="1.5" ry="1.9" fill={skin} />
        <ellipse cx="29.1" cy="19.4" rx="1.5" ry="1.9" fill={skin} />
        <path d={headPath} fill={skin} stroke={LINE} strokeWidth="0.4" strokeOpacity="0.22" />

        {/*
          Hairline outline so pale hair (white/grey/blond) still reads against
          pale skin — without it, explain/greybeard/facilities wash out into a
          featureless blob. Invisible on dark hair, so it is applied to all.
        */}
        <g stroke={LINE} strokeWidth="0.45" strokeOpacity="0.3" strokeLinejoin="round">
          {!lowDetail && <FacialHair style={traits.facialHair} color={hairColor} />}
          <Hair style={traits.hair} color={hairColor} skin={skin} />
        </g>

        <Eyes shape={traits.eyes} expression={expression} />
        {!lowDetail && <Brows shape={traits.brows} expression={expression} color={hairColor} />}
        {!lowDetail && <Nose style={traits.nose} />}
        <Mouth expression={expression} />

        {!lowDetail && <Glasses style={traits.glasses} />}
        {!lowDetail && <Accessory style={accessory} accent={accent} />}
      </g>
    </svg>
  );
}

export default PersonaFace;
// Trait data is NOT re-exported here — mixing non-component exports into a
// component module breaks Fast Refresh. Import from ./registry.js directly.
