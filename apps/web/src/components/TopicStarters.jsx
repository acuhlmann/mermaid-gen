/**
 * First-run topic starters — a hint line plus tappable example-topic chips that
 * float above the empty-state entry input. Tapping a chip submits that topic
 * immediately so a newcomer can see the app work without having to invent a
 * prompt from a cold blank box.
 *
 * Rendered only in the empty state (no diagram yet); the caller unmounts it once
 * a diagram exists.
 */
export default function TopicStarters({ hint, ariaLabel, starters, busy = false, onPick }) {
  const items = Array.isArray(starters) ? starters.filter((s) => s && s.label && s.prompt) : [];
  if (items.length === 0) return null;

  return (
    <div className="topic-starters" data-testid="topic-starters">
      {hint ? <p className="topic-starters-hint">{hint}</p> : null}
      <div className="topic-starters-chips" role="group" aria-label={ariaLabel}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className="topic-starter-chip"
            disabled={busy}
            onClick={() => onPick?.(item.prompt)}
            title={item.prompt}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
