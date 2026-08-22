/**
 * When the accent pin's caption is an annotation, and when it has become a
 * banner across the subject.
 *
 * A sibling module rather than a helper inside MetaphorAccents.jsx: it is pure,
 * it is the part worth pinning in a test, and a component file that also
 * exports a function loses fast refresh (ADR-0005 sibling-module pattern).
 */

/**
 * Canvas width at and below which the inline reading strip is a full-width
 * BAND rather than a centred card — the 720px phone block in App.css, and the
 * same number deliberately, because the layout is what this is a rule about.
 *
 * Below it the strip spans the canvas a hundred pixels above the scene and
 * prints this exact sentence (`accentThesisFromDsl` in metaphorReading.js), so
 * the pin's copy is the same claim twice within one glance — and the second
 * copy is drawn over the subject. Measured on the fused commerce composite: the
 * plate came out 224 CSS px wide on a 390 px phone and 220 px on a 717 px
 * foldable cover, drawn across the islands and covering two item labels and a
 * link caption on the way.
 *
 * That nothing is lost is what makes this safe rather than a compromise: the
 * sentence is already on screen, and the pin, stem and ring stay to carry the
 * part the strip cannot — WHICH item. Above the threshold the strip is a narrow
 * card in the middle of a roomy canvas, the caption sits somewhere else
 * entirely, and having the claim attached to the item is worth the ink.
 */
export const CAPTION_BAND_CANVAS_PX = 720;

/**
 * How much of the canvas HEIGHT the plate may take before it is a banner
 * rather than an annotation. This catches the case the width rule cannot: a
 * short landscape window, where the strip is still a row but a four-line note
 * is a fifth of the frame.
 *
 * There is deliberately no matching width rule. `CAPTION_MAX_WIDTH` already
 * wraps the plate at 7 world units, which is ~238 CSS px however long the note
 * is — under half of any canvas wider than the band threshold, so a width rule
 * could only ever fire where the band rule has already fired.
 */
export const CAPTION_MAX_CANVAS_HEIGHT = 0.12;

/**
 * Whether a caption of this drawn size is still an annotation on this canvas.
 *
 * A zero-size canvas answers yes: that is the first frame, and refusing to
 * draw there would flash the caption in a beat later on every mount.
 *
 * @param {{ widthPx: number, heightPx: number }} caption — drawn plate size
 * @param {{ width: number, height: number }} canvas — canvas size in CSS px
 * @returns {boolean}
 */
export function captionFitsCanvas(caption, canvas) {
  const width = canvas?.width > 0 ? canvas.width : 0;
  const height = canvas?.height > 0 ? canvas.height : 0;
  if (!width || !height) return true;
  if (width <= CAPTION_BAND_CANVAS_PX) return false;
  return caption.heightPx <= height * CAPTION_MAX_CANVAS_HEIGHT;
}
