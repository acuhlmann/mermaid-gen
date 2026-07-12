/**
 * One-time first-run spotlight that frames the stakeholder mechanic. It floats
 * above the dock mascot — just above where the live advisor bubble appears — so
 * the newcomer reads the meta framing ("these are your stakeholders, mute
 * anytime") right as a real stakeholder starts weighing in below it.
 *
 * Purely presentational: the caller owns the once-ever gate and dismissal.
 */
export default function StakeholderIntroSpotlight({
  eyebrow,
  body,
  dismissLabel,
  ariaLabel,
  onDismiss
}) {
  return (
    <div
      className="stakeholder-intro-spotlight"
      role="dialog"
      aria-label={ariaLabel}
      data-testid="stakeholder-intro-spotlight"
    >
      {eyebrow ? <p className="stakeholder-intro-eyebrow">{eyebrow}</p> : null}
      {body ? <p className="stakeholder-intro-body">{body}</p> : null}
      <button
        type="button"
        className="overlay-button primary-button stakeholder-intro-dismiss"
        onClick={onDismiss}
      >
        {dismissLabel}
      </button>
    </div>
  );
}
