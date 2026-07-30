/**
 * A speech bubble above somebody on the floor.
 *
 * Owns the counter-scale trick: inside the scaled stage a 0.78 rem line renders
 * ~6 px tall on a phone, so the bubble scales by the inverse of the stage scale
 * and stays the same physical size however far the room is zoomed out.
 *
 * Layout width is divided by that inverse so the *on-screen* size stays
 * ~15 rem / ≤60 vw — otherwise at MIN_SCALE the balloon is twice as wide as
 * the phone and clips off the left and top edges (docs/office-isometric-mode.md
 * § 6 rule 27).
 */

/**
 * @param {{
 *   name: string,
 *   title?: string,
 *   scale?: number,
 *   align?: 'start' | 'center' | 'end',
 *   hideBody?: boolean,
 *   onDismiss?: () => void,
 *   dismissLabel?: string,
 *   children?: import('react').ReactNode,
 *   footer?: import('react').ReactNode
 * }} props
 */
export function FloorBubble({
  name,
  title,
  scale = 1,
  align = 'center',
  hideBody = false,
  onDismiss,
  dismissLabel,
  children,
  footer
}) {
  const body = hideBody ? null : children;
  // Interactive walk-bys still need the chrome (Do it / dismiss) when CC is off.
  if (!body && !footer && !onDismiss) return null;
  const inlineFooter = hideBody && footer;

  const alignClass =
    align === 'start' || align === 'end' ? ` office-floor-bubble--align-${align}` : '';

  return (
    <div
      className={`office-floor-bubble${alignClass}`}
      style={{ '--floor-inverse-scale': 1 / (scale || 1) }}
      role="status"
      aria-live="polite"
      data-align={align}
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
      <div
        className={`office-floor-bubble-meta${inlineFooter ? ' office-floor-bubble-meta--inline' : ''}`}
      >
        <div className="office-floor-bubble-name">
          {name}
          {title ? <span> · {title}</span> : null}
        </div>
        {inlineFooter ? footer : null}
      </div>
      {body ? <p className="office-floor-bubble-body">{body}</p> : null}
      {!inlineFooter ? footer : null}
    </div>
  );
}

export default FloorBubble;
