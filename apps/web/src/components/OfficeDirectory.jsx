import { useState } from 'react';
import {
  readOfficeDirectorySeen,
  writeOfficeDirectorySeen
} from '../utils/officeAmbienceStorage.js';
import { OFFICE_COLLEAGUES, officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';

/**
 * The office directory (docs/office-parody.md): an entry-screen "meet the
 * floor" card that introduces the six colleagues — name, role, and their bit —
 * before the first email lands. Opens once on first run ("Clock in" collapses
 * it, persisted), then lives on as a small "Meet the office" chip so the
 * roster stays one tap away. Self-contained: owns its open/seen state; App
 * only decides when the entry screen is showing.
 */
export default function OfficeDirectory() {
  const [open, setOpen] = useState(() => !readOfficeDirectorySeen());
  const copy = officeChromeCopy().directory;

  const dismiss = () => {
    writeOfficeDirectorySeen();
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="office-directory-chip"
        title={copy.expandTitle}
        onClick={() => setOpen(true)}
      >
        {copy.expandLabel}
      </button>
    );
  }

  return (
    <div className="office-directory" role="region" aria-label={copy.title}>
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
      <p className="office-directory-tagline">{copy.tagline}</p>
      <ul className="office-directory-roster">
        {Object.keys(OFFICE_COLLEAGUES).map((id) => {
          const colleague = officeSenderInfo(id);
          return (
            <li key={id} className="office-directory-card">
              <span
                className="office-directory-avatar"
                aria-hidden="true"
                style={{ borderColor: colleague.accentColor }}
              >
                {colleague.avatarEmoji}
              </span>
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
