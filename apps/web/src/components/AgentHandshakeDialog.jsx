import { useState } from 'react';
import AgentBadge from './AgentBadge.jsx';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { overlayLayerStyle, useOverlayLayer } from '../hooks/useOverlayLayer.js';

export default function AgentHandshakeDialog({ request, onApprove, onDeny }) {
  const modalZIndex = useOverlayLayer('agent-handshake', Boolean(request), 'modal');
  const { controls } = useUiCopy();
  const handshakeCopy = controls.handshake;
  const [submitting, setSubmitting] = useState(null);
  if (!request) return null;

  const previewOrigin = {
    kind: 'external-agent',
    agentName: request.proposedName,
    color: request.proposedColor ?? '#888',
    emoji: request.proposedEmoji ?? '🤖'
  };

  async function handle(action, fn) {
    setSubmitting(action);
    try {
      await fn();
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div
      className="agent-handshake-overlay"
      style={overlayLayerStyle(modalZIndex)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-handshake-title"
    >
      <div className="agent-handshake-card">
        <h2 id="agent-handshake-title" className="agent-handshake-title">
          {handshakeCopy.title}
        </h2>
        <div className="agent-handshake-identity">
          <AgentBadge origin={previewOrigin} size="lg" />
        </div>
        {request.clientInfo ? (
          <p className="agent-handshake-client">
            {handshakeCopy.reportedClient} <code>{request.clientInfo}</code>
          </p>
        ) : null}
        <p className="agent-handshake-explainer">{handshakeCopy.explainer}</p>
        <div className="agent-handshake-actions">
          <button
            type="button"
            className="overlay-button"
            disabled={Boolean(submitting)}
            onClick={() => handle('deny', onDeny)}
          >
            {submitting === 'deny' ? handshakeCopy.denying : handshakeCopy.deny}
          </button>
          <button
            type="button"
            className="overlay-button primary-button"
            disabled={Boolean(submitting)}
            onClick={() => handle('approve', onApprove)}
          >
            {submitting === 'approve' ? handshakeCopy.allowing : handshakeCopy.allow}
          </button>
        </div>
      </div>
    </div>
  );
}
