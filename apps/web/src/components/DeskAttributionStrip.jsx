/**
 * Subtle third-party acknowledgments at the bottom of the desk actions menu.
 * ElevenLabs attribution is required for the baked office SFX license; Silicon
 * Valley is named because the cast is deliberate fan homage.
 */
export default function DeskAttributionStrip({ copy }) {
  if (!copy?.links?.length) return null;

  return (
    <div
      className="desk-attribution-strip"
      role="contentinfo"
      aria-label={copy.aria}
      data-testid="desk-attribution-strip"
    >
      <p className="desk-attribution-strip-heading">
        <span className="desk-attribution-strip-label">{copy.label}</span>
        {copy.tag ? (
          <span className="desk-attribution-strip-tag" aria-hidden="true">
            {copy.tag}
          </span>
        ) : null}
      </p>
      {copy.disclaimer ? (
        <p className="desk-attribution-strip-disclaimer">{copy.disclaimer}</p>
      ) : null}
      <p className="desk-attribution-strip-links">
        {copy.links.map((link, index) => (
          <span key={link.id} className="desk-attribution-strip-link-wrap">
            {index > 0 ? (
              <span className="desk-attribution-strip-sep" aria-hidden="true">
                ·
              </span>
            ) : null}
            <a
              className="desk-attribution-strip-link"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              title={link.title ?? link.label}
            >
              {link.label}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}
