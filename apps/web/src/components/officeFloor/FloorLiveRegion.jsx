/**
 * The floor's one live region (docs/office-isometric-mode.md § 5 slice 10).
 *
 * Mounted for as long as the floor is, and empty until something happens. That
 * is the whole point of it existing rather than of the cards keeping their own
 * `aria-live`: a live region is only reliably announced when it is **already in
 * the document** and its contents change underneath it. The floor card slot is
 * single-occupancy, so every card arrived as a fresh node with its text already
 * inside — the one shape assistive technology is not required to speak, and in
 * practice usually doesn't. Five regions that each announced sometimes are worse
 * than one that always does.
 *
 * What it says is `floorAnnouncement` — spatial state only, in card-slot order.
 * Speech bubbles keep their own regions and are unaffected: a bubble stays
 * mounted while a scene plays its beats through it, which is the shape that
 * works.
 */

import { useEffect, useRef, useState } from 'react';

/**
 * A trailing no-break space, appended and dropped so a repeated sentence still
 * mutates the DOM. Interrupting a walk with another walk is the case that needs
 * it: free roam changes where you are going without changing the phase, so the
 * wording is identical and an unchanged text node announces nothing.
 *
 * Spelled as an escape rather than the literal character — it is invisible in
 * source, and the next reader has to be able to see that it is deliberate.
 */
const PAD = '\u00a0';

/** The sentence without the pad, whichever of its two states it is in. */
function bare(text) {
  return text.endsWith(PAD) ? text.slice(0, -PAD.length) : text;
}

/**
 * @param {{ message: string, eventKey: string }} props `eventKey` identifies the
 *   event rather than the wording — see `floorAnnouncement`.
 */
export function FloorLiveRegion({ message, eventKey }) {
  const [text, setText] = useState('');
  const announced = useRef(null);

  /*
   * An effect rather than a derivation during render, and deliberately: an
   * announcement *is* a DOM side effect, and flipping the pad while rendering
   * would re-run on every unrelated re-render and speak the same sentence
   * again. The `eventKey` guard is what keeps this to one write per event.
   */
  useEffect(() => {
    if (eventKey === announced.current) return;
    announced.current = eventKey;
    setText((current) => {
      // Nothing to say clears the region outright; padding emptiness would put
      // a stray space where a screen reader expects silence.
      if (!message) return '';
      return bare(current) === message ? `${message}${PAD}` : message;
    });
  }, [eventKey, message]);

  return (
    <p
      className="office-floor-narration"
      data-testid="office-floor-narration"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {text}
    </p>
  );
}

export default FloorLiveRegion;
