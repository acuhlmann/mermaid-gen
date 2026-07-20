import { formatLocale } from '../i18n/formatLocale.js';

/**
 * Compact empty-state explainer — points newcomers at the prompt, assignment
 * chips, deliverable-format strip, and the Your desk menu without duplicating
 * those controls.
 */
export default function EntryDeskIntro({ copy, userName, role }) {
  if (!copy) return null;

  return (
    <div className="entry-desk-intro" data-testid="entry-desk-intro">
      {copy.greeting ? (
        <p className="entry-desk-intro-greeting">
          {formatLocale(copy.greeting, { name: userName })}
          {role ? <span className="entry-desk-intro-role"> · {role}</span> : null}
        </p>
      ) : null}
      {copy.body ? <p className="entry-desk-intro-body">{copy.body}</p> : null}
    </div>
  );
}
