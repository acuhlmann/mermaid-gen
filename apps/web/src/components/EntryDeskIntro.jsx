import { formatLocale } from '../i18n/formatLocale.js';

/**
 * Compact empty-state explainer — greets newcomers after the office voice intro.
 * The real Your desk menu opens beside the Work order; brief pointers (not a
 * second menu listing) cover where to look.
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
