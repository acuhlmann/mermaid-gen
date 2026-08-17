import { useEffect, useRef } from 'react';
import {
  overlayFocusHandlers,
  overlayLayerStyle,
  useOverlayLayer
} from '../hooks/useOverlayLayer.js';

function inlineLabelStyle(toolbarAnchor, labelSession) {
  if (labelSession?.kind === 'edge') {
    return {
      left: labelSession.x ?? 0,
      top: labelSession.y ?? 0,
      width: 120,
      transform: 'translate(-50%, -120%)'
    };
  }
  if (!toolbarAnchor) return null;
  const centerX =
    typeof toolbarAnchor.left === 'number'
      ? toolbarAnchor.left
      : (toolbarAnchor.nodeLeft + toolbarAnchor.nodeRight) / 2;
  const centerY =
    typeof toolbarAnchor.centerY === 'number'
      ? toolbarAnchor.centerY
      : (toolbarAnchor.nodeTop + toolbarAnchor.nodeBottom) / 2;
  const nodeLeft = toolbarAnchor.nodeLeft ?? centerX - 40;
  const nodeRight = toolbarAnchor.nodeRight ?? centerX + 40;
  const nodeWidth = Math.max(72, nodeRight - nodeLeft - 8);
  return {
    left: centerX,
    top: centerY,
    width: nodeWidth,
    transform: 'translate(-50%, -50%)'
  };
}

/**
 * Unified graph-edit overlay: connect hint, inline node label edit, undo toast.
 * Label edits anchor on the node itself (fixed viewport coords), not a distant panel.
 */
export default function GraphEditChrome({
  connectHint,
  labelSession,
  labelCopy,
  onLabelCommit,
  onLabelCancel,
  undoToast,
  undoLabel,
  onUndo,
  onDismissUndo,
  toolbarAnchor,
  isFullscreen = false
}) {
  const inputRef = useRef(null);
  const doneRef = useRef(false);
  const chromeActive = Boolean(connectHint || labelSession || undoToast?.message);
  const zIndex = useOverlayLayer('graph-edit-chrome', chromeActive, 'anchored', {
    title: 'Graph edit',
    kind: 'graph-edit'
  });
  const focusHandlers = overlayFocusHandlers('graph-edit-chrome', chromeActive);
  const inlineStyle = labelSession ? inlineLabelStyle(toolbarAnchor, labelSession) : null;
  const showInlineLabel = Boolean(labelSession && inlineStyle);

  useEffect(() => {
    doneRef.current = false;
    if (!showInlineLabel) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [
    labelSession?.logicalId,
    labelSession?.fromId,
    labelSession?.toId,
    showInlineLabel,
    inlineStyle?.left,
    inlineStyle?.top
  ]);

  if (!chromeActive) return null;

  function finishLabel(value, cancelled) {
    if (doneRef.current) return;
    doneRef.current = true;
    if (cancelled) onLabelCancel?.();
    else onLabelCommit?.(value);
  }

  return (
    <div
      className={`graph-edit-chrome${isFullscreen ? ' is-fullscreen' : ''}`}
      style={overlayLayerStyle(zIndex)}
      {...focusHandlers}
    >
      {connectHint ? (
        <p className="graph-edit-connect-hint" role="status">
          {connectHint}
        </p>
      ) : null}

      {showInlineLabel ? (
        <form
          className={`graph-edit-label-inline${labelSession.created ? ' is-new-node' : ''}`}
          style={inlineStyle}
          onSubmit={(event) => {
            event.preventDefault();
            finishLabel(inputRef.current?.value ?? labelSession.draft, false);
          }}
        >
          <input
            ref={inputRef}
            defaultValue={labelSession.draft}
            placeholder={labelCopy.renamePlaceholder}
            aria-label={
              labelSession.created ? labelCopy.nameNodeTitle : labelCopy.renamePlaceholder
            }
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                finishLabel(labelSession.draft, true);
              }
            }}
            onBlur={(event) => {
              finishLabel(event.target.value, false);
            }}
          />
        </form>
      ) : null}

      {undoToast?.message ? (
        <div className="graph-edit-undo-toast" role="status">
          <span>{undoToast.message}</span>
          <button type="button" onClick={onUndo}>
            {undoLabel}
          </button>
          <button
            type="button"
            className="graph-edit-undo-toast-dismiss"
            onClick={onDismissUndo}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
