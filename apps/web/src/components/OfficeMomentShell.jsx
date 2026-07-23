import { FloatingWindowDragHandle } from './FloatingWindow.jsx';

/**
 * Shared chrome for transient office moments (IM pings, walk-bys, etc.).
 * Solid card + labeled header so users know what kind of interruption landed.
 */
export default function OfficeMomentShell({
  kindClass = '',
  kindLabel,
  className = '',
  headClassName = '',
  dragHandleTitle = null,
  headExtra = null,
  children
}) {
  const shellClass = ['office-moment-shell', className].filter(Boolean).join(' ');
  const headClass = ['office-moment-shell-head', headClassName].filter(Boolean).join(' ');
  const headInner = (
    <>
      <p className={`office-moment-kind ${kindClass}`.trim()} aria-hidden="true">
        {kindLabel}
      </p>
      {headExtra}
    </>
  );

  return (
    <div className={shellClass}>
      {dragHandleTitle ? (
        <FloatingWindowDragHandle className={headClass} title={dragHandleTitle}>
          {headInner}
        </FloatingWindowDragHandle>
      ) : (
        <div className={headClass}>{headInner}</div>
      )}
      <div className="office-moment-shell-body">{children}</div>
    </div>
  );
}
