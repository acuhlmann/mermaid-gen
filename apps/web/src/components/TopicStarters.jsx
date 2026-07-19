import { officeSenderInfo } from '../utils/officeCast.js';
import { PersonaFace } from './personaFaces/index.jsx';

/**
 * First-run assignment chips — a hint line beside the default chip, plus more
 * tappable chips that float above the empty-state entry input. Tapping a chip
 * submits that topic immediately so a newcomer can see the app work without
 * having to invent a prompt from a cold blank box.
 *
 * Starters may carry the Day One fiction: `fromId` attributes the request to a
 * cast member (resolved via officeSenderInfo) and `ask` is their one-line
 * justification. Entries without those fields (e.g. locale bundles that ship
 * plain {label, prompt} starters) render as plain chips.
 *
 * Rendered only in the empty state (no diagram yet); the caller unmounts it once
 * a diagram exists.
 */

function StarterChipContent({ item }) {
  if (!item.fromId) return item.label;
  const sender = officeSenderInfo(item.fromId);
  return (
    <>
      <span className="topic-starter-from">
        <PersonaFace id={item.fromId} size={16} className="topic-starter-face" />
        {sender.name}
      </span>
      <span className="topic-starter-label">{item.label}</span>
      {item.ask ? <span className="topic-starter-ask">{item.ask}</span> : null}
    </>
  );
}

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
            className={`topic-starter-chip is-default ${defaultStarter.fromId ? 'has-from' : ''}`}
            disabled={busy}
            onClick={() => onPick?.(defaultStarter.prompt)}
            title={defaultStarter.prompt}
            aria-pressed
          >
            <StarterChipContent item={defaultStarter} />
          </button>
        </div>
        {moreStarters.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`topic-starter-chip ${item.fromId ? 'has-from' : ''}`}
            disabled={busy}
            onClick={() => onPick?.(item.prompt)}
            title={item.prompt}
            aria-pressed={false}
          >
            <StarterChipContent item={item} />
          </button>
        ))}
      </div>
    </div>
  );
}
