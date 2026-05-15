function readableTextColor(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return '#fff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111' : '#fff';
}

export default function AgentBadge({ origin, size = 'sm', className = '' }) {
  if (!origin) return null;
  const color = origin.color ?? '#888';
  const emoji = origin.emoji ?? '🤖';
  const name = origin.agentName ?? 'External agent';
  const textColor = readableTextColor(color);
  return (
    <span
      className={`agent-badge agent-badge-${size} ${className}`}
      style={{ backgroundColor: color, color: textColor }}
      title={name}
    >
      <span aria-hidden="true" className="agent-badge-emoji">
        {emoji}
      </span>
      <span className="agent-badge-name">{name}</span>
    </span>
  );
}
