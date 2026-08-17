/**
 * Transient undo affordance after Connect / Delete. Not an error toast.
 */
export default function GraphEditUndoToast({ message, undoLabel, onUndo, onDismiss }) {
  if (!message) return null;
  return (
    <div className="graph-edit-undo-toast" role="status">
      <span>{message}</span>
      <button type="button" onClick={onUndo}>
        {undoLabel}
      </button>
      <button
        type="button"
        className="graph-edit-undo-toast-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
