import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  getDeskCommsUi,
  serializeAnchorRect,
  subscribeDeskCommsUi,
  toggleDeskCommsPanel
} from '../state/deskCommsUiStore.js';
import { getOfficeSnapshot, subscribe as subscribeOffice } from '../state/officeMomentStore.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { officeChromeCopy } from '../utils/officeCast.js';

/**
 * Corporate inbox trigger floated over the canvas, beside the fullscreen exit
 * control when native fullscreen is active. Outside fullscreen it uses fixed
 * positioning in the shell tree so it stays over the deliverable without
 * waiting on a diagram surface ref.
 *
 * @param {{
 *   host?: HTMLElement | null,
 *   visible?: boolean,
 *   isFullscreen?: boolean
 * }} props
 */
export default function DiagramCanvasMailbox({
  host = null,
  visible = false,
  isFullscreen = false
}) {
  const snapshot = useSyncExternalStore(subscribeOffice, getOfficeSnapshot, getOfficeSnapshot);
  const commsUi = useSyncExternalStore(subscribeDeskCommsUi, getDeskCommsUi, getDeskCommsUi);
  const copy = officeChromeCopy();
  const open = commsUi.activePanel === 'inbox';
  const focusTime = snapshot.focusTime;
  const unreadCount = snapshot.unreadCount;

  if (!visible) return null;

  const badge = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : null;

  const button = (
    <button
      type="button"
      className={[
        'diagram-canvas-mailbox-btn',
        open ? 'is-open' : '',
        focusTime ? 'is-focus-time' : '',
        isFullscreen ? 'is-fullscreen' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="diagram-canvas-mailbox"
      aria-label={
        unreadCount > 0
          ? formatLocale(copy.inbox.unreadAria, { count: unreadCount })
          : copy.inbox.noUnreadAria
      }
      aria-expanded={open}
      aria-pressed={open}
      title={copy.inbox.buttonTitle}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        toggleDeskCommsPanel(
          'inbox',
          serializeAnchorRect(event.currentTarget.getBoundingClientRect())
        );
      }}
    >
      <span className="diagram-canvas-mailbox-icon" aria-hidden="true">
        {focusTime ? '📪' : '📥'}
      </span>
      {badge ? (
        <span className="diagram-canvas-mailbox-badge" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </button>
  );

  if (isFullscreen && host) {
    return createPortal(button, host);
  }

  return <div className="diagram-canvas-mailbox-mount">{button}</div>;
}
