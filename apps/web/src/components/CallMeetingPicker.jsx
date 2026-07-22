import { useEffect, useMemo, useState } from 'react';
import {
  listMeetingDirectory,
  MEETING_FACILITATOR,
  MEETING_GROUP_PRESETS,
  MEETING_ROSTER_MAX,
  normalizeMeetingRoster,
  officeChromeCopy,
  officeSenderInfo
} from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';
import FloatingWindow, { FloatingWindowDragHandle } from './FloatingWindow.jsx';

const TIER_LABEL_KEYS = {
  team: 'tierTeam',
  senior: 'tierSenior',
  office: 'tierOffice'
};

/**
 * People/group picker for calling a meeting — like grabbing colleagues on the
 * floor. Seeded from inbox senders, a Slop Chat thread, or an empty desk grab.
 * Pam facilitates by default when the roster is a group; the user can still
 * uncheck anyone except when that would empty the room.
 */
export default function CallMeetingPicker({
  open,
  seedAttendees = [],
  topic: seedTopic = '',
  source = 'desk',
  forceFacilitator = true,
  onConfirm,
  onCancel
}) {
  const copy = officeChromeCopy().meetingPicker;
  const directory = useMemo(() => listMeetingDirectory(), []);
  const [selected, setSelected] = useState(() => new Set(seedAttendees));
  const [topic, setTopic] = useState(seedTopic ?? '');
  const [keepFacilitator, setKeepFacilitator] = useState(forceFacilitator);

  useEffect(() => {
    if (!open) return;
    const seeded = seedAttendees.filter(Boolean);
    const withFacilitator =
      forceFacilitator && !seeded.includes(MEETING_FACILITATOR)
        ? [MEETING_FACILITATOR, ...seeded]
        : seeded;
    setSelected(new Set(withFacilitator.slice(0, MEETING_ROSTER_MAX)));
    setTopic(seedTopic ?? '');
    setKeepFacilitator(forceFacilitator);
  }, [open, seedAttendees, seedTopic, forceFacilitator]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const selectedCount = selected.size;
  const atCap = selectedCount >= MEETING_ROSTER_MAX;
  const canStart = selectedCount > 0;
  const isHuddle = selectedCount <= 2;
  const sourceLine =
    source === 'email' ? copy.sourceEmail : source === 'chat' ? copy.sourceChat : copy.sourceDesk;

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MEETING_ROSTER_MAX) {
        next.add(id);
      }
      return next;
    });
  };

  const applyPreset = (preset) => {
    const members = preset.resolve?.() ?? [];
    setSelected(new Set(members.slice(0, MEETING_ROSTER_MAX)));
    if (preset.id !== 'steering' && members.length <= 2) {
      setKeepFacilitator(false);
    } else {
      setKeepFacilitator(true);
    }
  };

  const handleStart = () => {
    if (!canStart) return;
    const attendees = normalizeMeetingRoster([...selected], {
      forceFacilitator: keepFacilitator
    });
    const trimmed = String(topic ?? '').trim();
    onConfirm?.({
      attendees,
      ...(trimmed ? { topic: trimmed.slice(0, 200) } : {})
    });
  };

  const tiers = ['team', 'senior', 'office'];

  return (
    <FloatingWindow
      id="call-meeting-picker"
      open={open}
      group="officeChrome"
      className="office-meeting-picker"
      defaultCorner="top-center"
      defaultOffsetX={16}
      defaultOffsetY={72}
      cascade={2}
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
    >
      <div className="office-meeting-picker-panel">
        <FloatingWindowDragHandle
          className="office-meeting-picker-header"
          title={copy.dragHint ?? 'Drag to move'}
        >
          <div>
            <div className="office-meeting-picker-title">
              {isHuddle ? copy.titleHuddle : copy.title}
            </div>
            <p className="office-meeting-picker-tagline">{copy.tagline}</p>
            <p className="office-meeting-picker-source">{sourceLine}</p>
          </div>
          <button
            type="button"
            className="office-meeting-picker-close"
            aria-label={copy.closeAria}
            onClick={() => onCancel?.()}
          >
            ×
          </button>
        </FloatingWindowDragHandle>

        <label className="office-meeting-picker-topic">
          <span>{copy.topicLabel}</span>
          <input
            type="text"
            value={topic}
            maxLength={200}
            placeholder={copy.topicPlaceholder}
            aria-label={copy.topicAria}
            onChange={(event) => setTopic(event.target.value)}
          />
        </label>

        <div className="office-meeting-picker-groups" role="group" aria-label={copy.groupsAria}>
          {MEETING_GROUP_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="office-meeting-picker-group"
              title={copy[preset.titleKey]}
              onClick={() => applyPreset(preset)}
            >
              {copy[preset.labelKey]}
            </button>
          ))}
        </div>

        <div className="office-meeting-picker-directory" aria-label={copy.directoryAria}>
          {tiers.map((tier) => {
            const rows = directory.filter((row) => row.tier === tier);
            if (rows.length === 0) return null;
            return (
              <section key={tier} className="office-meeting-picker-tier">
                <h3 className="office-meeting-picker-tier-label">{copy[TIER_LABEL_KEYS[tier]]}</h3>
                <ul className="office-meeting-picker-people">
                  {rows.map(({ id }) => {
                    const sender = officeSenderInfo(id);
                    const checked = selected.has(id);
                    const disabled = !checked && atCap;
                    return (
                      <li key={id}>
                        <label
                          className={`office-meeting-picker-person${checked ? ' is-selected' : ''}${
                            disabled ? ' is-disabled' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggle(id)}
                          />
                          <PersonaFace id={id} size={28} />
                          <span className="office-meeting-picker-person-meta">
                            <span className="office-meeting-picker-person-name">{sender.name}</span>
                            {sender.title ? (
                              <span className="office-meeting-picker-person-title">
                                {sender.title}
                              </span>
                            ) : null}
                          </span>
                          {id === MEETING_FACILITATOR ? (
                            <span className="office-meeting-picker-facilitator">
                              {copy.facilitatorBadge}
                            </span>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="office-meeting-picker-footer">
          <span className="office-meeting-picker-count" role="status">
            {!canStart
              ? copy.needSomeone
              : atCap
                ? formatLocale(copy.maxHint, { max: MEETING_ROSTER_MAX })
                : selectedCount === 1
                  ? copy.selectedCountOne
                  : formatLocale(copy.selectedCount, { count: selectedCount })}
          </span>
          <div className="office-meeting-picker-actions">
            <button
              type="button"
              className="office-meeting-picker-cancel"
              onClick={() => onCancel?.()}
            >
              {copy.cancel}
            </button>
            <button
              type="button"
              className="office-meeting-picker-start"
              disabled={!canStart}
              onClick={handleStart}
            >
              {isHuddle ? copy.startHuddle : copy.start}
            </button>
          </div>
        </div>
      </div>
    </FloatingWindow>
  );
}
