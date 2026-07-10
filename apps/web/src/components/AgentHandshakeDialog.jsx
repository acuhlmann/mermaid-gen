import { useState } from 'react';
import AgentBadge from './AgentBadge.jsx';

export default function AgentHandshakeDialog({ request, onApprove, onDeny }) {
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-handshake-title"
    >
      <div className="agent-handshake-card">
        <h2 id="agent-handshake-title" className="agent-handshake-title">
          An external agent wants to join your session
        </h2>
        <div className="agent-handshake-identity">
          <AgentBadge origin={previewOrigin} size="lg" />
        </div>
        {request.clientInfo ? (
          <p className="agent-handshake-client">
            Reported client: <code>{request.clientInfo}</code>
          </p>
        ) : null}
        <p className="agent-handshake-explainer">
          If you allow this, the agent can read your diagram, propose edits (you approve each one),
          drop attributed notes, and react to revisions. It cannot apply edits directly.
        </p>
        <div className="agent-handshake-actions">
          <button
            type="button"
            className="overlay-button"
            disabled={Boolean(submitting)}
            onClick={() => handle('deny', onDeny)}
          >
            {submitting === 'deny' ? 'Denying…' : 'Deny'}
          </button>
          <button
            type="button"
            className="overlay-button primary-button"
            disabled={Boolean(submitting)}
            onClick={() => handle('approve', onApprove)}
          >
            {submitting === 'approve' ? 'Allowing…' : 'Allow agent'}
          </button>
        </div>
      </div>
    </div>
  );
}
