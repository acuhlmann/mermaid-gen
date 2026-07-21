import { formatLocale } from '../i18n/formatLocale.js';

/**
 * Compact empty-state explainer — greets newcomers and, on the first-run desk
 * screen, walks through the real Your desk menu (seat / get up / under the desk)
 * instead of duplicating assignment chips or a second prompt row.
 */
export default function EntryDeskIntro({ copy, userName, role, deskCopy, showDeskGuide = false }) {
  if (!copy) return null;

  const concentrationLabel = deskCopy?.concentrationLabel ?? 'Concentration (Rush job / Deep work)';

  return (
    <div className="entry-desk-intro" data-testid="entry-desk-intro">
      {copy.greeting ? (
        <p className="entry-desk-intro-greeting">
          {formatLocale(copy.greeting, { name: userName })}
          {role ? <span className="entry-desk-intro-role"> · {role}</span> : null}
        </p>
      ) : null}
      {copy.body ? <p className="entry-desk-intro-body">{copy.body}</p> : null}
      {showDeskGuide && deskCopy ? (
        <div className="entry-desk-guide" data-testid="entry-desk-guide">
          {copy.deskGuideHeading ? (
            <p className="entry-desk-guide-heading">{copy.deskGuideHeading}</p>
          ) : null}
          {copy.deskGuideHint ? (
            <p className="entry-desk-guide-hint">{copy.deskGuideHint}</p>
          ) : null}
          <dl className="entry-desk-guide-sections">
            <div className="entry-desk-guide-section">
              <dt>{deskCopy.sectionSeat}</dt>
              <dd>
                <ul>
                  <li>{deskCopy.thinking}</li>
                  <li>{concentrationLabel}</li>
                </ul>
              </dd>
            </div>
            <div className="entry-desk-guide-section">
              <dt>{deskCopy.sectionGetUp}</dt>
              <dd>
                <ul>
                  <li>{deskCopy.inbox}</li>
                  <li>{deskCopy.slopChat}</li>
                  <li>{deskCopy.coffee}</li>
                  <li>{deskCopy.walk}</li>
                </ul>
              </dd>
            </div>
            <div className="entry-desk-guide-section">
              <dt>{deskCopy.sectionUnderDesk}</dt>
              <dd>
                <ul>
                  <li>{deskCopy.codeDrawer}</li>
                  <li>{deskCopy.onboardContractor}</li>
                  <li>{deskCopy.hrProgress}</li>
                </ul>
              </dd>
            </div>
          </dl>
          {copy.deskWorkOrderHint ? (
            <p className="entry-desk-guide-work-order">{copy.deskWorkOrderHint}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
