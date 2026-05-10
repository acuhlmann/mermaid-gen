import { useEffect, useRef } from 'react';

const BOTTOM_SNAP_THRESHOLD_PX = 72;

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
      <header className="insights-pane-header">
        <span className="insights-pane-title">Thinking & notes</span>
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
          entries.map((entry) => (
            <article
              key={entry.id}
              className={`insights-entry ${entry.id === celebratingEntryId ? 'is-celebrating' : ''}`}
              aria-live={entry.status === 'running' ? 'polite' : 'off'}
            >
              <div className="insights-entry-top">
                <h3 className="insights-entry-title">
                  <span className="insights-entry-icon" aria-hidden="true">
                    {entry.status === 'done' ? '✨' : entry.status === 'failed' ? '⚠️' : '🧠'}
                  </span>
                  {entry.title}
                </h3>
                <span className={`insights-status-chip is-${entry.status || 'running'}`}>
                  {entry.status === 'running' ? <span className="insights-working-dot" aria-hidden="true" /> : null}
                  {statusLabel(entry)}
                </span>
              </div>

              {entry.phases?.length ? (
                <section className="insights-section is-phase-lane" aria-label="Agent phases">
                  <h4 className="insights-section-title">Agent phases</h4>
                  <ol className="insights-phase-list">
                    {entry.phases.map((phase, idx) => (
                      <li key={`${entry.id}-phase-${phase.id}-${idx}`} className="insights-phase-item">
                        <span className="insights-phase-step">{idx + 1}</span>
                        <span className="insights-phase-label">{phase.label}</span>
                        <code className="insights-phase-id">{phase.id}</code>
                      </li>
                    ))}
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
                  <div className="insights-entry-rich-text">{renderRichContent(entry.content)}</div>
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
                    {entry.streamDebugLog.map((row, i) => JSON.stringify(row)).join('\n')}
                  </pre>
                </details>
              ) : null}
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
