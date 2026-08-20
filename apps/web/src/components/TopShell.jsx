/**
 * Single fixed-position flex row holding the brand-control (left) and the
 * top-corner controls cluster (right). flex-wrap lets the right cluster drop
 * to a second top-right row when the logo + buttons don't fit horizontally
 * — margin-left:auto on the right child keeps it pinned to the right edge.
 * Children own their own internals (logo chip, XP, code/fullscreen buttons);
 * this component owns only the wrapper layout.
 *
 * `data-app-chrome` marks this as external chrome the metaphor camera fit must
 * reserve for. The strip paints over the top of the metaphor canvas — without
 * the marker the reading strip lands under the brand chip on phones and the
 * camera flies the accented item into the same band on foldable covers. See
 * overlaySafeArea.js for how it is consumed.
 */
export function TopShell({ children }) {
  return (
    <div className="top-shell" data-app-chrome="top">
      {children}
    </div>
  );
}
