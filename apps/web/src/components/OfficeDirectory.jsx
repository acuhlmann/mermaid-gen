import { useRef, useState } from 'react';
import {
  readOfficeDirectorySeen,
  writeOfficeDirectorySeen
} from '../utils/officeAmbienceStorage.js';
import { OFFICE_COLLEAGUES, officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';

const COLLEAGUE_IDS = Object.keys(OFFICE_COLLEAGUES);

/**
 * The office directory (docs/office-parody.md): entry-screen "meet the floor"
 * intro. First run walks the cast one person at a time (welcome → each
 * colleague → Clock in) so the story lands incrementally; afterwards it lives
 * as a "Meet the office" chip that reopens the full roster. Self-contained:
 * owns open/seen/step state; App only decides when the entry screen is showing.
 */
export default function OfficeDirectory() {
  const firstRunRef = useRef(!readOfficeDirectorySeen());
  const [open, setOpen] = useState(() => firstRunRef.current);
  /** `null` = full roster browse; `0` = welcome; `1..n` = colleague spotlight. */
  const [step, setStep] = useState(() => (firstRunRef.current ? 0 : null));
  const copy = officeChromeCopy().directory;
  const isTour = step !== null;

  const dismiss = () => {
    writeOfficeDirectorySeen();
    firstRunRef.current = false;
    setStep(null);
    setOpen(false);
  };

  const openRoster = () => {
    setStep(null);
    setOpen(true);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="office-directory-chip"
        title={copy.expandTitle}
        onClick={openRoster}
      >
        {copy.expandLabel}
      </button>
    );
  }

  if (isTour) {
    return (
      <div
        className="office-directory office-directory--tour"
        role="dialog"
        aria-label={copy.title}
        data-testid="office-directory-tour"
      >
        <div className="office-directory-head">
          <span className="office-directory-title">🏢 {copy.title}</span>
          <button
            type="button"
            className="office-directory-close"
            aria-label={copy.closeAria}
            onClick={dismiss}
          >
            ×
          </button>
        </div>

        {step === 0 ? (
          <div className="office-directory-welcome" data-testid="office-directory-welcome">
            <p className="office-directory-tagline">{copy.tagline}</p>
            <p className="office-directory-tour-hint">{copy.tourHint}</p>
          </div>
        ) : (
          <ColleagueSpotlight
            colleagueId={COLLEAGUE_IDS[step - 1]}
            progressLabel={formatLocale(copy.progressLabel, {
              current: String(step),
              total: String(COLLEAGUE_IDS.length)
            })}
          />
        )}

        <div className="office-directory-tour-actions">
          {step > 0 ? (
            <button
              type="button"
              className="office-directory-secondary"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              {copy.backLabel}
            </button>
          ) : (
            <button type="button" className="office-directory-secondary" onClick={dismiss}>
              {copy.skipLabel}
            </button>
          )}
          {step < COLLEAGUE_IDS.length ? (
            <button
              type="button"
              className="office-directory-dismiss"
              onClick={() => setStep((s) => s + 1)}
            >
              {step === 0 ? copy.startLabel : copy.nextLabel}
            </button>
          ) : (
            <button type="button" className="office-directory-dismiss" onClick={dismiss}>
              {copy.dismissLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="office-directory office-directory--roster"
      role="region"
      aria-label={copy.title}
      data-testid="office-directory-roster"
    >
      <div className="office-directory-head">
        <span className="office-directory-title">🏢 {copy.title}</span>
        <button
          type="button"
          className="office-directory-close"
          aria-label={copy.closeAria}
          onClick={dismiss}
        >
          ×
        </button>
      </div>
      <p className="office-directory-tagline">{copy.rosterTagline}</p>
      <ul className="office-directory-roster">
        {COLLEAGUE_IDS.map((id) => {
          const colleague = officeSenderInfo(id);
          return (
            <li key={id} className="office-directory-card">
              <PersonaFace id={id} size={38} className="office-directory-avatar" />
              <span className="office-directory-meta">
                <span className="office-directory-name">{colleague.name}</span>
                <span className="office-directory-role">{colleague.title}</span>
                {colleague.blurb ? (
                  <span className="office-directory-blurb">{colleague.blurb}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <button type="button" className="office-directory-dismiss" onClick={dismiss}>
        {copy.dismissLabel}
      </button>
    </div>
  );
}

function ColleagueSpotlight({ colleagueId, progressLabel }) {
  const colleague = officeSenderInfo(colleagueId);
  return (
    <div
      className="office-directory-spotlight"
      key={colleagueId}
      data-testid="office-directory-spotlight"
    >
      <p className="office-directory-progress">{progressLabel}</p>
      <PersonaFace
        id={colleagueId}
        size={56}
        className="office-directory-avatar office-directory-avatar--hero"
      />
      <span className="office-directory-name">{colleague.name}</span>
      <span className="office-directory-role">{colleague.title}</span>
      {colleague.blurb ? <p className="office-directory-blurb">{colleague.blurb}</p> : null}
    </div>
  );
}
