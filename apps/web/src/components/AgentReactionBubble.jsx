export default function AgentReactionBubble({ reaction }) {
  if (!reaction) return null;
  const color = reaction.origin?.color ?? '#888';
  return (
    <span
      className="agent-reaction-bubble"
      style={{ borderColor: color }}
      aria-label={`${reaction.origin?.agentName ?? 'Agent'} reacted ${reaction.emoji}`}
    >
      <span className="agent-reaction-emoji" aria-hidden="true">
        {reaction.emoji}
      </span>
    </span>
  );
}
