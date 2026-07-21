/**
 * Slopitect Tip™ chip rendered below the brand control.
 *
 * @param {{
 *   tip: { id: string, text: string } | null;
 *   tipRef: import('react').RefObject<HTMLElement | null>;
 *   tipLabel: string;
 *   onDismiss: () => void;
 * }} props
 */
export function SlopitectTipSlot({ tip, tipRef, tipLabel, onDismiss }) {
  if (!tip) return null;

  return (
    <div
      ref={tipRef}
      className="slopitect-tip-chip"
      role="status"
      aria-live="polite"
      data-testid="slopitect-tip-chip"
      onClick={(event) => {
        event.stopPropagation();
        onDismiss();
      }}
    >
      <span className="slopitect-tip-chip-label" aria-hidden="true">
        {tipLabel}
      </span>
      <span className="slopitect-tip-chip-text">{tip.text}</span>
    </div>
  );
}
