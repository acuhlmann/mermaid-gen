import { useState } from 'react';
import { GOD_ALTAR_COPY as COPY } from './godAltarCopy.js';

function formatWorkflowBadgeText(runStatus) {
  if (!runStatus) return '';
  const num = runStatus.runNumber ? `#${runStatus.runNumber} ` : '';
  const tail = runStatus.conclusion ? ` · ${runStatus.conclusion}` : '';
  return `god.yml ${num}${runStatus.status}${tail}`;
}

function workflowBadgeTone(runStatus) {
  if (!runStatus) return '';
  if (runStatus.conclusion === 'success') return ' is-live';
  if (runStatus.conclusion === 'failure' || runStatus.status === 'error') return ' is-bad';
  if (runStatus.status === 'queued' || runStatus.status === 'in_progress') return ' is-gold';
  return '';
}

function WorkflowRunBadge({ runStatus }) {
  if (!runStatus) return null;
  return (
    <span
      className={`god-altar-pill${workflowBadgeTone(runStatus)}`}
      data-testid="god-workflow-run-badge"
    >
      {formatWorkflowBadgeText(runStatus)}
    </span>
  );
}

function WorkflowDispatchActions({
  dispatched,
  runHref,
  checkingStatus,
  dispatching,
  onRefreshStatus,
  onManualDispatch
}) {
  if (!dispatched) {
    return (
      <div className="god-altar-pr-actions">
        <button
          type="button"
          className="god-altar-secondary-btn"
          data-testid="god-dispatch-workflow-button"
          disabled={dispatching}
          onClick={onManualDispatch}
        >
          {dispatching ? COPY.prCard.dispatchingButton : COPY.prCard.dispatchButton}
        </button>
      </div>
    );
  }
  return (
    <div className="god-altar-pr-actions">
      {runHref ? (
        <a href={runHref} target="_blank" rel="noreferrer">
          {COPY.prCard.openWorkflowLink} →
        </a>
      ) : null}
      <button
        type="button"
        className="god-altar-secondary-btn"
        data-testid="god-workflow-refresh"
        disabled={checkingStatus}
        onClick={onRefreshStatus}
      >
        {checkingStatus ? COPY.prCard.checkingStatusLabel : COPY.prCard.refreshStatusLabel}
      </button>
    </div>
  );
}

function WorkflowDispatchStatus({
  dispatchInfo,
  runStatus,
  checkingStatus,
  dispatching,
  onManualDispatch,
  onRefreshStatus,
  copiedWorkflow,
  onCopyWorkflow
}) {
  if (!dispatchInfo) return null;
  const dispatched = Boolean(dispatchInfo.dispatched);
  const runHref = runStatus?.htmlUrl || dispatchInfo.workflowUrl;
  const heading = dispatched
    ? `⚙️ ${COPY.prCard.dispatchDispatched}`
    : `🛠️ ${COPY.prCard.dispatchFallback}`;
  const statusCopy = runStatus?.message || dispatchInfo.message;

  return (
    <div className="god-altar-dispatch-box" data-testid="god-workflow-dispatch">
      <div className="god-altar-dispatch-head">
        <strong>{heading}</strong>
        <div className="god-altar-chip-row">
          <span className="god-altar-pill">
            focus: {dispatchInfo.focus} · ref: {dispatchInfo.ref}
          </span>
          <WorkflowRunBadge runStatus={runStatus} />
        </div>
      </div>
      <p className="god-altar-msg-body">{statusCopy}</p>
      <WorkflowDispatchActions
        dispatched={dispatched}
        runHref={runHref}
        checkingStatus={checkingStatus}
        dispatching={dispatching}
        onRefreshStatus={onRefreshStatus}
        onManualDispatch={onManualDispatch}
      />
      {!dispatched && dispatchInfo.ghWorkflowCommand ? (
        <>
          <pre className="god-altar-gh-scroll">{dispatchInfo.ghWorkflowCommand}</pre>
          <div>
            <button type="button" className="god-altar-secondary-btn" onClick={onCopyWorkflow}>
              {copiedWorkflow ? COPY.prCard.copiedWorkflowLabel : COPY.prCard.copyWorkflowLabel}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function PrDecreeOutcome({
  prOutcome,
  runStatus,
  checkingStatus,
  dispatching,
  onManualDispatch,
  onRefreshStatus,
  copiedGh,
  copiedWorkflow,
  onCopyGh,
  onCopyWorkflow
}) {
  if (!prOutcome) return null;
  return (
    <div
      className={`god-altar-pr-outcome${prOutcome.filed ? '' : ' is-unconfigured'}`}
      data-testid="god-pr-outcome"
      role="status"
    >
      <strong>{prOutcome.filed ? COPY.prCard.filedBanner : COPY.prCard.unconfiguredTitle}</strong>
      <p className="god-altar-msg-body">{prOutcome.divineMessage}</p>
      {prOutcome.prUrl ? (
        <a href={prOutcome.prUrl} target="_blank" rel="noreferrer">
          {COPY.prCard.openPrLink} #{prOutcome.prNumber ?? ''} →
        </a>
      ) : null}
      {prOutcome.ghCommand && !prOutcome.filed ? (
        <>
          <pre className="god-altar-gh-scroll">{prOutcome.ghCommand}</pre>
          <div>
            <button type="button" className="god-altar-secondary-btn" onClick={onCopyGh}>
              {copiedGh ? COPY.prCard.copiedGhLabel : COPY.prCard.copyGhLabel}
            </button>
          </div>
        </>
      ) : null}
      <WorkflowDispatchStatus
        dispatchInfo={prOutcome.workflowDispatch}
        runStatus={runStatus}
        checkingStatus={checkingStatus}
        dispatching={dispatching}
        onManualDispatch={onManualDispatch}
        onRefreshStatus={onRefreshStatus}
        copiedWorkflow={copiedWorkflow}
        onCopyWorkflow={onCopyWorkflow}
      />
    </div>
  );
}

export default function GodPrDecreeCard({
  proposal,
  dispatchWorkflow,
  onToggleDispatchWorkflow,
  onTitleChange,
  onFilePr,
  onManualDispatch,
  onRefreshStatus,
  filing,
  dispatching,
  checkingStatus,
  runStatus,
  prOutcome
}) {
  const [copiedGh, setCopiedGh] = useState(false);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);

  const copyText = async (text, setter) => {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      setter(true);
      window.setTimeout(() => setter(false), 2000);
    } catch {
      setter(false);
    }
  };

  return (
    <section className="god-altar-pr-card" data-testid="god-pr-decree">
      <p className="god-altar-eyebrow">{COPY.prCard.eyebrow}</p>
      <input
        type="text"
        className="god-altar-pr-title-input"
        aria-label="Pull Request Title"
        value={proposal.title}
        onChange={(event) => onTitleChange(event.target.value)}
        maxLength={120}
      />
      <p className="god-altar-msg-body">{proposal.summary}</p>
      <div className="god-altar-pr-meta">
        <span>
          {COPY.prCard.branchLabel}: <code>god-petition/{proposal.branchSlug}</code>
        </span>
        <span>
          {COPY.prCard.targetLabel}: <code>{proposal.targetArea}</code>
        </span>
      </div>
      <div>
        <span className="god-altar-section-label">{COPY.prCard.planLabel}</span>
        <ol className="god-altar-pr-plan">
          {proposal.implementationPlan.map((step, idx) => (
            <li key={`${idx}-${step}`}>{step}</li>
          ))}
        </ol>
      </div>
      <p className="god-altar-pr-blessing">“{proposal.divineBlessing}”</p>
      <label className="god-altar-dispatch-opt">
        <input
          type="checkbox"
          data-testid="god-dispatch-checkbox"
          checked={dispatchWorkflow}
          onChange={(event) => onToggleDispatchWorkflow(event.target.checked)}
        />
        <span>{COPY.prCard.dispatchCheckbox}</span>
      </label>
      <div className="god-altar-pr-actions">
        <button
          type="button"
          className="god-altar-strike-btn"
          data-testid="god-file-pr-button"
          disabled={filing}
          onClick={onFilePr}
        >
          {filing ? COPY.prCard.filingButton : COPY.prCard.fileButton}
        </button>
      </div>
      <PrDecreeOutcome
        prOutcome={prOutcome}
        runStatus={runStatus}
        checkingStatus={checkingStatus}
        dispatching={dispatching}
        onManualDispatch={onManualDispatch}
        onRefreshStatus={onRefreshStatus}
        copiedGh={copiedGh}
        copiedWorkflow={copiedWorkflow}
        onCopyGh={() => void copyText(prOutcome?.ghCommand, setCopiedGh)}
        onCopyWorkflow={() =>
          void copyText(prOutcome?.workflowDispatch?.ghWorkflowCommand, setCopiedWorkflow)
        }
      />
    </section>
  );
}
