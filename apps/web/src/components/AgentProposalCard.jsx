import { useState } from 'react';
import AgentBadge from './AgentBadge.jsx';
import InsightsEmbeddedDiagram from './InsightsEmbeddedDiagram.jsx';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { isConcreteContentType } from '@archislop/shared';

function formatRelative(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const deltaSec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (deltaSec < 5) return 'just now';
  if (deltaSec < 60) return `${deltaSec}s ago`;
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  return `${Math.floor(deltaSec / 3600)}h ago`;
}

export default function AgentProposalCard({
  proposal,
  onAccept,
  onReject,
  onOpenFullPreview,
  openFullPreviewDisabled = false,
  status = 'pending'
}) {
  const { controls } = useUiCopy();
  const proposalCopy = controls.proposal;
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);
  if (!proposal) return null;
  const origin = proposal.origin ?? {
    kind: 'external-agent',
    agentName: 'External agent',
    color: '#888',
    emoji: '🤖'
  };

  async function go(action, fn) {
    if (typeof fn !== 'function') {
      setActionError('Action unavailable — reload the page and try again.');
      return;
    }
    setActionError(null);
    setBusy(action);
    try {
      await fn();
    } catch (error) {
      const message = error?.message ?? 'Request failed.';
      setActionError(message);
      console.error('agent proposal action failed', error);
    } finally {
      setBusy(null);
    }
  }

  const diagramSource = typeof proposal.diagramSource === 'string' ? proposal.diagramSource : '';
  const canOpenFullPreview =
    Boolean(diagramSource.trim()) &&
    isConcreteContentType(proposal.contentType) &&
    typeof onOpenFullPreview === 'function';

  return (
    <article
      className={`agent-proposal-card agent-proposal-status-${status}`}
      aria-label={formatLocale(proposalCopy.proposedAria, {
        type: proposal.contentType,
        name: origin.agentName ?? 'external agent'
      })}
    >
      <header className="agent-proposal-head">
        <AgentBadge origin={origin} size="sm" />
        <span className="agent-proposal-target">
          {formatLocale(proposalCopy.proposedEdit, { type: proposal.contentType })}
        </span>
        <span className="agent-proposal-time">{formatRelative(proposal.createdAt)}</span>
      </header>
      {proposal.reason ? <p className="agent-proposal-reason">{proposal.reason}</p> : null}
      {proposal.diffSummary ? (
        <p className="agent-proposal-diff-stats" data-testid="proposal-diff-stats">
          {proposal.diffSummary.linesAdded > 0 || proposal.diffSummary.linesRemoved > 0 ? (
            <>
              <span className="agent-proposal-diff-add">+{proposal.diffSummary.linesAdded}</span>
              <span className="agent-proposal-diff-del">−{proposal.diffSummary.linesRemoved}</span>
              <span className="agent-proposal-diff-changed"> lines</span>
            </>
          ) : null}
          {proposal.diffSummary.graphDiff?.nodesAdded?.length ? (
            <span className="agent-proposal-diff-nodes">
              {' '}
              nodes +{proposal.diffSummary.graphDiff.nodesAdded.length}
            </span>
          ) : null}
          {proposal.diffSummary.graphDiff?.nodesRemoved?.length ? (
            <span className="agent-proposal-diff-nodes">
              {' '}
              nodes −{proposal.diffSummary.graphDiff.nodesRemoved.length}
            </span>
          ) : null}
        </p>
      ) : null}
      {diagramSource ? (
        <div className="agent-proposal-preview-wrap">
          <div className="agent-proposal-preview">
            <InsightsEmbeddedDiagram
              source={diagramSource}
              kind={proposal.contentType}
              idPrefix={`proposal-${proposal.proposalId}`}
            />
          </div>
          {canOpenFullPreview ? (
            <div className="insights-embedded-diagram-restore-row agent-proposal-restore-row">
              <button
                type="button"
                className="insights-entry-undo-btn agent-proposal-open-preview-btn"
                disabled={openFullPreviewDisabled || Boolean(busy)}
                title={proposalCopy.loadPreviewTitle}
                onClick={() =>
                  onOpenFullPreview({
                    diagramSource,
                    contentType: proposal.contentType
                  })
                }
              >
                {proposalCopy.openFullPreview}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <details className="agent-proposal-source-details">
        <summary>{proposalCopy.showSource}</summary>
        <pre className="agent-proposal-source">
          <code>{diagramSource}</code>
        </pre>
      </details>
      {actionError ? (
        <p className="agent-proposal-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {status === 'pending' ? (
        <div className="agent-proposal-actions">
          <button
            type="button"
            className="overlay-button"
            disabled={Boolean(busy)}
            onClick={() => go('reject', onReject)}
          >
            {busy === 'reject' ? proposalCopy.rejecting : proposalCopy.reject}
          </button>
          <button
            type="button"
            className="overlay-button primary-button"
            disabled={Boolean(busy)}
            onClick={() => go('accept', onAccept)}
          >
            {busy === 'accept' ? proposalCopy.applying : proposalCopy.accept}
          </button>
        </div>
      ) : (
        <p className="agent-proposal-resolved">
          {proposalCopy.statusPrefix} {status}
        </p>
      )}
    </article>
  );
}
