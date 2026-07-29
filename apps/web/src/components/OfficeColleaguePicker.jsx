import { useMemo } from 'react';
import { listMeetingDirectory, officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { PersonaFace } from './personaFaces/index.jsx';

const TIER_LABEL_KEYS = {
  team: 'tierTeam',
  senior: 'tierSenior',
  office: 'tierOffice'
};

/**
 * Compact single-select directory for composing mail or starting a new IM thread.
 */
export default function OfficeColleaguePicker({
  selectedId = null,
  onSelect,
  ariaLabel,
  className = ''
}) {
  const copy = officeChromeCopy().colleaguePicker;
  const directory = useMemo(() => listMeetingDirectory(), []);
  const tiers = ['team', 'senior', 'office'];

  return (
    <div
      className={`office-colleague-picker${className ? ` ${className}` : ''}`}
      role="listbox"
      aria-label={ariaLabel ?? copy.directoryAria}
    >
      {tiers.map((tier) => {
        const rows = directory.filter((row) => row.tier === tier);
        if (rows.length === 0) return null;
        return (
          <section key={tier} className="office-colleague-picker-tier">
            <h3 className="office-colleague-picker-tier-label">{copy[TIER_LABEL_KEYS[tier]]}</h3>
            <ul className="office-colleague-picker-people">
              {rows.map(({ id }) => {
                const sender = officeSenderInfo(id);
                const selected = selectedId === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`office-colleague-picker-person${selected ? ' is-selected' : ''}`}
                      title={sender.title ? `${sender.name} · ${sender.title}` : sender.name}
                      onClick={() => onSelect?.(id)}
                    >
                      <PersonaFace id={id} size={24} fallbackEmoji={sender.avatarEmoji} />
                      <span className="office-colleague-picker-person-meta">
                        <span className="office-colleague-picker-person-name">{sender.name}</span>
                        {sender.title ? (
                          <span className="office-colleague-picker-person-title">
                            {sender.title}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
