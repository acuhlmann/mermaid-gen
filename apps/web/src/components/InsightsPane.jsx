import { useEffect, useRef } from 'react';

const BOTTOM_SNAP_THRESHOLD_PX = 72;

function IconThinking() {
  return (
    <svg className="insights-svg-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 10 21 11 21z"
      />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg className="insights-svg-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="m11 6.5 1.43 3.24L15.77 11l-3.34 1.26L11 15.5 9.57 12.26 6.23 11l3.34-1.26L11 6.5zm7-2 1 2.25L21.25 8 19 10.25 18 8l-2.25-1.75L18 4.75l1-2.25zm0 11 1 2.25L21.25 19 19 21.25 18 19l-2.25-1.75L18 15.75l1-2.25zM6 16l.85 1.92L8.77 19l-1.92.92L6 21.84l-.85-1.92L3.23 19l1.92-.92L6 16z"
      />
    </svg>
  );
}

function IconAlert({ small }) {
  const cls = small ? 'insights-svg-icon insights-svg-icon-sm' : 'insights-svg-icon';
  const dim = small ? 13 : 16;
  return (
    <svg className={cls} viewBox="0 0 24 24" width={dim} height={dim} aria-hidden="true">
      <path
        fill="currentColor"
        d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
      />
    </svg>
  );
}

function IconPhaseCheck() {
  return (
    <svg className="insights-phase-glyph" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );
}

function IconPhasePulse() {
  return <span className="insights-phase-glyph insights-phase-pulse-dot" aria-hidden="true" />;
}

function EntryStatusIcon({ status }) {
  if (status === 'done') return <IconSparkles />;
  if (status === 'failed') return <IconAlert />;
  return <IconThinking />;
}

function parseInline(text) {
  const fragments = [];
  let rest = text;
  let keyIndex = 0;
  const tokenPattern = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/;
  while (rest.length > 0) {
    const match = rest.match(tokenPattern);
    if (!match || match.index == null) {
      fragments.push(rest);
      break;
    }
    if (match.index > 0) fragments.push(rest.slice(0, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      fragments.push(<strong key={`s-${keyIndex++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('_')) {
      fragments.push(<em key={`e-${keyIndex++}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`')) {
      fragments.push(
        <code key={`c-${keyIndex++}`} className="insights-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    rest = rest.slice(match.index + token.length);
  }
  return fragments;
}

function renderRichContent(content) {
  const lines = content.split('\n');
  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={`gap-${index}`} className="insights-content-gap" />;
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={`h-${index}`} className="insights-content-heading">
          {parseInline(trimmed.slice(4))}
        </h4>
      );
    }
    if (trimmed.startsWith('- ')) {
      return (
        <p key={`b-${index}`} className="insights-content-bullet">
          <span aria-hidden="true">•</span> {parseInline(trimmed.slice(2))}
        </p>
      );
    }
    return (
      <p key={`p-${index}`} className="insights-content-line">
        {parseInline(line)}
      </p>
    );
  });
}

function statusLabel(entry) {
  if (entry.status === 'failed') return 'Issue';
  if (entry.status === 'done') return 'Done';
  return 'Working';
}

export default function InsightsPane({
  entries,
  soundEnabled,
  onSoundEnabledChange,
  celebratingEntryId,
  streamDebugEnabled = false
}) {
  const bodyRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const hasLiveAgent = entries.some((e) => (e.status ?? 'running') === 'running');

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [entries]);

  function handleBodyScroll(event) {
    const el = event.currentTarget;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    stickToBottomRef.current = distanceFromBottom <= BOTTOM_SNAP_THRESHOLD_PX;
  }

  return (
    <aside className="insights-pane" aria-label="Thoughts and analysis">
      <header className={`insights-pane-header ${hasLiveAgent ? 'is-live' : ''}`}>
        <div className="insights-pane-title-row">
          <span className="insights-pane-title">Thinking & notes</span>
          {hasLiveAgent ? (
            <span className="insights-live-badge" aria-live="polite">
              <span className="insights-live-dot" aria-hidden="true" />
              Live
            </span>
          ) : null}
        </div>
        <div className="insights-pane-controls">
          <label className="insights-sound-toggle">
            <input
              type="checkbox"
              checked={Boolean(soundEnabled)}
              onChange={(event) => onSoundEnabledChange?.(event.target.checked)}
            />
            <span>{soundEnabled ? 'Sound on' : 'Sound off'}</span>
          </label>
        </div>
      </header>
      <div ref={bodyRef} className="insights-pane-body" onScroll={handleBodyScroll}>
        {entries.length === 0 ? (
          <p className="insights-pane-empty">Agent thoughts and critique responses appear here.</p>
        ) : (
          entries.map((entry) => {
            const rawStatus = entry.status ?? 'running';
            const isRunning = rawStatus === 'running';
            const isStreaming = isRunning && Boolean(entry.content?.trim());
            const statusStrip =
              entry.statusText &&
              (rawStatus === 'running' || rawStatus === 'failed') &&
              entry.statusText.trim();

            return (
              <article
                key={entry.id}
                className={[
                  'insights-entry',
                  entry.id === celebratingEntryId ? 'is-celebrating' : '',
                  isRunning ? 'is-running' : '',
                  isStreaming ? 'is-streaming' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="insights-entry-top">
                  <h3 className="insights-entry-title">
                    <span className="insights-entry-icon" aria-hidden="true">
                      <EntryStatusIcon status={rawStatus} />
                    </span>
                    {entry.title}
                  </h3>
                  <span className={`insights-status-chip is-${rawStatus}`}>
                    {rawStatus === 'running' ? <span className="insights-working-dot" aria-hidden="true" /> : null}
                    {statusLabel(entry)}
                  </span>
                </div>

                {statusStrip ? (
                  <p
                    className={`insights-status-strip is-${rawStatus}`}
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <span className="insights-status-strip-pulse" aria-hidden="true" />
                    <span className="insights-status-strip-label">Now</span>
                    <span className="insights-status-strip-text">{entry.statusText}</span>
                  </p>
                ) : null}

                {entry.phases?.length ? (
                  <section className="insights-section is-phase-lane" aria-label="Agent phases">
                    <h4 className="insights-section-title">Agent phases</h4>
                    <ol className="insights-phase-list">
                      {entry.phases.map((phase, idx) => {
                        const phases = entry.phases;
                        const isLast = idx === phases.length - 1;
                        const isFailed = rawStatus === 'failed';
                        const phaseComplete = rawStatus === 'done' || (!isLast && (isRunning || isFailed));
                        const phaseActive = isRunning && isLast && !isFailed;
                        const phaseFailedLast = isFailed && isLast;
                        return (
                          <li
                            key={`${entry.id}-phase-${phase.id}-${idx}`}
                            className={`insights-phase-item ${phaseActive ? 'is-active' : ''} ${phaseComplete ? 'is-complete' : ''} ${phaseFailedLast ? 'is-failed-at' : ''}`}
                          >
                            <span className="insights-phase-glyph-wrap" aria-hidden="true">
                              {phaseComplete ? (
                                <IconPhaseCheck />
                              ) : phaseFailedLast ? (
                                <IconAlert small />
                              ) : (
                                <IconPhasePulse />
                              )}
                            </span>
                            <span className="insights-phase-step">{idx + 1}</span>
                            <span className="insights-phase-label">{phase.label}</span>
                            <code className="insights-phase-id">{phase.id}</code>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ) : null}

                {entry.artifacts?.some((a) => a.kind === 'patch_summary') ? (
                  <section className="insights-section is-artifacts" aria-label="Patch summary">
                    <h4 className="insights-section-title">Diagram patch</h4>
                    <ul className="insights-artifact-list">
                      {entry.artifacts
                        .filter((a) => a.kind === 'patch_summary')
                        .map((a, idx) => (
                          <li key={`${entry.id}-patch-${a.revisionId}-${idx}`} className="insights-patch-summary">
                            <span>
                              Revision <strong>{a.revisionId}</strong>
                            </span>
                            <span className="insights-patch-stats">
                              +{a.linesAdded ?? 0} / −{a.linesRemoved ?? 0} lines
                            </span>
                          </li>
                        ))}
                    </ul>
                  </section>
                ) : null}

                <section className="insights-section">
                  <h4 className="insights-section-title">Content updates</h4>
                  {entry.content ? (
                    <div className="insights-entry-rich-text-wrap">
                      <div className="insights-entry-rich-text">{renderRichContent(entry.content)}</div>
                      {isRunning && entry.content.trim() ? (
                        <span className="insights-stream-caret" aria-hidden="true" />
                      ) : null}
                    </div>
                  ) : (
                    <p className="insights-waiting-text">Working on your request...</p>
                  )}
                </section>

                <section className="insights-section is-tech">
                  <h4 className="insights-section-title">Technical actions</h4>
                  {entry.technicalActions?.length ? (
                    <ul className="insights-tech-list">
                      {entry.technicalActions.map((action) => (
                        <li key={action.id} className={`insights-tech-item is-${action.status}`}>
                          <span className="insights-tech-icon" aria-hidden="true">
                            {action.status === 'done' ? '✓' : '…'}
                          </span>
                          <span>{action.label}</span>
                          <code>{action.name}</code>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="insights-tech-empty">No technical actions yet.</p>
                  )}
                </section>

                {streamDebugEnabled && entry.streamDebugLog?.length ? (
                  <details className="insights-stream-debug">
                    <summary>Raw stream events ({entry.streamDebugLog.length})</summary>
                    <pre className="insights-stream-debug-pre">
                      {entry.streamDebugLog.map((row) => JSON.stringify(row)).join('\n')}
                    </pre>
                  </details>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
