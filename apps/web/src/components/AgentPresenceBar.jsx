import { useEffect, useState } from 'react';
import AgentBadge from './AgentBadge.jsx';
import { MOBILE_MEDIA_QUERY } from '../utils/layoutBreakpoints.js';

const MOBILE_VISIBLE_AGENT_CAP = 3;

export default function AgentPresenceBar({ presence, onInvite }) {
  const agents = Array.isArray(presence) ? presence : [];
  const [narrowLayout, setNarrowLayout] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(MOBILE_MEDIA_QUERY).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const sync = () => setNarrowLayout(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const visibleAgents =
    narrowLayout && agents.length > MOBILE_VISIBLE_AGENT_CAP
      ? agents.slice(0, MOBILE_VISIBLE_AGENT_CAP)
      : agents;
  const overflowCount =
    narrowLayout && agents.length > MOBILE_VISIBLE_AGENT_CAP
      ? agents.length - MOBILE_VISIBLE_AGENT_CAP
      : 0;

  return (
    <div className="agent-presence-bar" aria-label="Connected external agents">
      {visibleAgents.map((agent) => (
        <AgentBadge
          key={agent.agentId}
          origin={{
            kind: 'external-agent',
            agentId: agent.agentId,
            agentName: agent.agentName,
            color: agent.color,
            emoji: agent.emoji
          }}
          size="sm"
        />
      ))}
      {overflowCount > 0 ? (
        <span className="agent-presence-overflow" aria-label={`${overflowCount} more agents`}>
          +{overflowCount}
        </span>
      ) : null}
      {typeof onInvite === 'function' ? (
        <button
          type="button"
          className="overlay-button compact-button agent-invite-button"
          onClick={onInvite}
          aria-label="Invite agent"
          title="Invite an external agent into the Co-Design session"
        >
          <span className="agent-invite-emoji" aria-hidden="true">
            🤝
          </span>
        </button>
      ) : null}
    </div>
  );
}
