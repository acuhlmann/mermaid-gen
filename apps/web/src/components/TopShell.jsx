/**
 * Single fixed-position flex row holding the brand-control (left) and the
 * top-corner controls cluster (right). flex-wrap lets the right cluster drop
 * to a second top-right row when the logo + buttons don't fit horizontally
 * — margin-left:auto on the right child keeps it pinned to the right edge.
 * Children own their own internals (logo chip, XP, code/fullscreen buttons);
 * this component owns only the wrapper layout.
 */
export function TopShell({ children }) {
  return <div className="top-shell">{children}</div>;
}
