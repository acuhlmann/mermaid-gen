/**
 * First-run topic starters — a hint line beside the default example chip, plus
 * more tappable topic chips that float above the empty-state entry input.
 * Tapping a chip submits that topic immediately so a newcomer can see the app
 * work without having to invent a prompt from a cold blank box.
 *
 * Rendered only in the empty state (no diagram yet); the caller unmounts it once
 * a diagram exists.
 */
export default function TopicStarters({ hint, ariaLabel, starters, busy = false, onPick }) {
  const items = Array.isArray(starters) ? starters.filter((s) => s && s.label && s.prompt) : [];
  if (items.length === 0) return null;

  const [defaultStarter, ...moreStarters] = items;

  return (
    <div className="topic-starters" data-testid="topic-starters">
      <div className="topic-starters-chips" role="group" aria-label={ariaLabel}>
        <div className="topic-starters-lead">
          {hint ? <p className="topic-starters-hint">{hint}</p> : null}
          <button
            type="button"
            className="topic-starter-chip is-default"
            disabled={busy}
            onClick={() => onPick?.(defaultStarter.prompt)}
            title={defaultStarter.prompt}
            aria-pressed
          >
            {defaultStarter.label}
          </button>
        </div>
        {moreStarters.map((item) => (
          <button
            key={item.label}
            type="button"
            className="topic-starter-chip"
            disabled={busy}
            onClick={() => onPick?.(item.prompt)}
            title={item.prompt}
            aria-pressed={false}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
