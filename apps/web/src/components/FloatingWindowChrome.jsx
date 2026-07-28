/**
 * Shared title-bar controls for draggable office windows — minimize, restore,
 * close. Keeps messenger, inbox, and meeting chrome aligned like desktop windows.
 */

export function FloatingWindowMinimizeButton({
  minimized = false,
  minimizeLabel = 'Minimize',
  restoreLabel = 'Restore',
  minimizeTitle,
  restoreTitle,
  onToggle,
  className = 'floating-window-minimize'
}) {
  if (typeof onToggle !== 'function') return null;
  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-pressed={minimized}
      title={minimized ? (restoreTitle ?? restoreLabel) : (minimizeTitle ?? minimizeLabel)}
      aria-label={minimized ? restoreLabel : minimizeLabel}
    >
      {minimized ? '▢' : '—'}
    </button>
  );
}

export function FloatingWindowCloseButton({
  label = 'Close',
  title,
  onClose,
  className = 'floating-window-close'
}) {
  if (typeof onClose !== 'function') return null;
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={title ?? label}
      onClick={onClose}
    >
      ×
    </button>
  );
}
