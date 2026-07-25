/**
 * A speech bubble above somebody on the floor.
 *
 * Owns the counter-scale trick: inside the scaled stage a 0.78 rem line renders
 * ~6 px tall on a phone, so the bubble scales by the inverse of the stage scale
 * and stays the same physical size however far the room is zoomed out.
 */

/**
 * @param {{
 *   name: string,
 *   title?: string,
 *   scale?: number,
 *   onDismiss?: () => void,
 *   dismissLabel?: string,
 *   children?: import('react').ReactNode,
 *   footer?: import('react').ReactNode
 * }} props
 */
export function FloorBubble({ name, title, scale = 1, onDismiss, dismissLabel, children, footer }) {
  return (
    <div
      className="office-floor-bubble"
      style={{ '--floor-inverse-scale': 1 / (scale || 1) }}
      role="status"
      aria-live="polite"
    >
      {onDismiss ? (
        <button
          type="button"
          className="office-floor-bubble-dismiss"
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          ×
        </button>
      ) : null}
      <div className="office-floor-bubble-name">
        {name}
        {title ? <span> · {title}</span> : null}
      </div>
      <p className="office-floor-bubble-body">{children}</p>
      {footer}
    </div>
  );
}

export default FloorBubble;
