import { useEffect, useRef } from 'react';

const BOTTOM_SNAP_THRESHOLD_PX = 72;

export default function InsightsPane({ entries, onClose }) {
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
        <button type="button" className="insights-close overlay-button" onClick={onClose}>
          Close
        </button>
      </header>
      <div ref={bodyRef} className="insights-pane-body" onScroll={handleBodyScroll}>
        {entries.length === 0 ? (
          <p className="insights-pane-empty">Agent thoughts and critique responses appear here.</p>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className="insights-entry">
              <h3 className="insights-entry-title">{entry.title}</h3>
              <pre className="insights-entry-text">{entry.content || '(streaming…)'}</pre>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
