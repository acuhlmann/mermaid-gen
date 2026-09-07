/**
 * How big the accent callout's rod is drawn on THIS canvas.
 *
 * A pure sibling module rather than numbers inside `MetaphorAccents.jsx`, for
 * the reason `metaphorDrawOrder.js` and `accentCaptionFit.js` are ones
 * (ADR-0005): these are the bounds of a visual contract, every one of them came
 * from a measured render, and they have to be testable without mounting a
 * renderer. Keeping them in the component file also trips
 * `react-refresh/only-export-components`, which is the lint saying the same
 * thing.
 */
import { screenConstantScale, screenMinimumScale } from './metaphorScreenScale.js';

/**
 * The smallest the pin head may look, in CSS pixels.
 *
 * The marker's whole job is to say "read this one", and it was the last thing
 * in the callout still authored purely in world units — the caption above it
 * has been screen-constant since it shipped, for the reason this file already
 * states in `CAPTION_TARGET_PX`: these scenes run from a 14-unit cake to a
 * 60-unit bridge, so one world size cannot serve both.
 *
 * Measured across three fixtures at the three standing viewports, the pin head
 * came out **8 px wide on a 717x512 foldable cover** and 10 px on a 390x844
 * phone for a nine-service city, against 59 px for a subway network on desktop
 * — a 7.4x spread for one fixed piece of geometry. At the small end it is not a
 * marker at all: the phone city's callout reads as an amber speck on a roof,
 * which is indistinguishable from a rooftop light.
 *
 * 22 px is the pin HEAD's width, chosen so the cell that already read best on a
 * phone (the layercake, 12 px) is lifted to about the height of an item label's
 * plate rather than past it: a marker that outgrows the names competes with
 * them, and the ladder in `metaphorDrawOrder.js` exists precisely because the
 * marker must not.
 */
const PIN_MIN_WIDTH_PX = 22;

/**
 * How tall the stem should look, in CSS pixels, anchor to pin base.
 *
 * The floor above is only half the answer, because the same world-size spread
 * that shrinks a city's marker to a speck blows a subway's up: measured on a
 * 1440x900 desktop the rod stood **168 px** before any of this, and once the
 * callout left the camera fit (see `FRAME_IGNORE_DATA` below) the scene came
 * closer and the rod ran clean off the top of the canvas, pin and all. A leader
 * line whose head is off-screen is worse than no marker: the amber stripe still
 * crosses the picture and now points at nothing.
 *
 * The stem's length and the pin's width are **separate** scales, which cost a
 * round to learn. Driving both from one uniform number makes them fight — the
 * galaxy wants a wider head and a shorter stem at the same time, and one scalar
 * satisfying `min(grow, cap)` gave it the short stem AND a head shrunk to 3 px,
 * worse than where it started. They are different questions: the head's size is
 * legibility, the stem's is how far the pin stands off the item.
 *
 * 80 px sits inside the band of cells that already read well unaided (a city's
 * 65 px desktop rod, a layercake's 116 px) and well under the 168 px that ran
 * off frame.
 */
const STEM_TARGET_HEIGHT_PX = 80;

/**
 * Pathological-case bounds on the stem's length, in the spirit of
 * `metaphorScreenScale.js`'s own `MIN_SCALE`/`MAX_SCALE`: tight clamps here
 * quietly re-create the bug. The lower one matters most — the stem exists to
 * clear whatever a scene stacks above its own anchor, a city's roof, fixtures
 * and spire, and shortening it too far re-creates the defect this file's header
 * records, the marker rendered *inside* the tower it marked.
 */
const MIN_STEM_SCALE = 0.5;
const MAX_STEM_SCALE = 4;

/**
 * The two scales the callout is drawn at on this canvas.
 *
 * Pure and exported so the pair is testable without a renderer, and returned
 * together because the caption's height depends on both: it rides the pin's
 * tip, which is the stem's top plus the pin's own half-height, and those are
 * now scaled by different numbers.
 *
 * @param {object} args
 * @param {number} args.distance — camera to the rod's anchor, world units
 * @param {number} args.fovDegrees
 * @param {number} args.viewportHeightPx
 * @param {number} args.pinWidth — authored width of the pin head, world units
 * @param {number} args.stemHeight — authored anchor-to-pin height, world units
 * @returns {{ pin: number, stem: number }}
 */
export function accentRodScale({ distance, fovDegrees, viewportHeightPx, pinWidth, stemHeight }) {
  const view = { distance, fovDegrees, viewportHeightPx };
  return {
    // A floor, never a cap: a head already big enough to read is emphasis, and
    // shrinking it buys uniformity nobody asked for.
    pin: screenMinimumScale({ ...view, worldSize: pinWidth, minPx: PIN_MIN_WIDTH_PX }),
    // Constant both ways: a stem is a standoff distance, and one that is too
    // long is the failure that put the pin off the canvas.
    stem: Math.min(
      MAX_STEM_SCALE,
      Math.max(
        MIN_STEM_SCALE,
        screenConstantScale({ ...view, worldSize: stemHeight, targetPx: STEM_TARGET_HEIGHT_PX })
      )
    )
  };
}
