/**
 * Visual plan-beat card for the Thinking pane Plan lane.
 */

import { enrichInline } from '../utils/thinkingProseEnrich';

const VARIANT_ICONS: Record<string, string> = {
  refine: '✨',
  innovate: '💡',
  goMad: '🎲',
  critique: '🔍',
  explain: '📖',
  exec: '📊',
  style: '🎨',
  intent: '➡️',
  general: '▸'
};

type PlanBeat = {
  text?: string;
  source?: 'agent' | 'server';
};

export default function PlanBeatCard({
  beat,
  variant = 'general',
  index = 0
}: {
  beat?: PlanBeat;
  variant?: string;
  index?: number;
}) {
  const source = beat?.source === 'agent' ? 'agent' : 'server';
  const text = String(beat?.text ?? '').trim();
  if (!text) return null;

  const icon = VARIANT_ICONS[variant] ?? VARIANT_ICONS.general;

  return (
    <li
      className={`insights-plan-card is-${source}`}
      data-testid="plan-beat-card"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <span className="insights-plan-card-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="insights-plan-card-body">
        <span className={`insights-plan-card-badge is-${source}`}>
          {source === 'agent' ? 'Agent' : 'Plan'}
        </span>
        <p className="insights-plan-card-text">{enrichInline(text, `plan-${index}`)}</p>
      </div>
    </li>
  );
}
