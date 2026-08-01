import { formatLocale } from '../i18n/formatLocale.js';

/**
 * Compact empty-state explainer — greets newcomers after the office voice intro.
 * The stepped desk tour then reveals the real bottom chrome (Work order, Mail / Chat / Meeting,
 * Your Team, Notebook) instead of a duplicate format strip.
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
