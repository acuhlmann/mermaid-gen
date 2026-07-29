import { useEffect, useMemo, useState } from 'react';
import {
  listMeetingDirectory,
  MEETING_FACILITATOR,
  MEETING_GROUP_PRESETS,
  MEETING_MODALITY_PHYSICAL,
  MEETING_MODALITY_REMOTE,
  MEETING_ROSTER_MAX,
  normalizeMeetingModality,
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
 * People/group picker for summoning a sync — glass room or headsets.
 * Seeded from inbox senders, a Slop Chat thread, or an empty desk grab.
 * Pam is available in the directory but is not auto-added — only scheduled
 * invites and the steering preset include her by default.
 *
 * Inbox / Slop Chat default to headsets; desk defaults to the glass room.
 */
export default function CallMeetingPicker({
  open,
  seedAttendees = [],
  topic: seedTopic = '',
  source = 'desk',
  forceFacilitator = false,
  defaultModality,
  onConfirm,
  onCancel
}) {
  const copy = officeChromeCopy().meetingPicker;
  const directory = useMemo(() => listMeetingDirectory(), []);
  const [selected, setSelected] = useState(() => new Set(seedAttendees));
  const [topic, setTopic] = useState(seedTopic ?? '');
  const [keepFacilitator, setKeepFacilitator] = useState(forceFacilitator);
  const [modality, setModality] = useState(() =>
    normalizeMeetingModality(defaultModality, { source })
  );

  useEffect(() => {
    if (!open) return;
    const seeded = seedAttendees.filter(Boolean);
    setSelected(new Set(seeded.slice(0, MEETING_ROSTER_MAX)));
    setTopic(seedTopic ?? '');
    setKeepFacilitator(forceFacilitator);
    setModality(normalizeMeetingModality(defaultModality, { source }));
  }, [open, seedAttendees, seedTopic, forceFacilitator, defaultModality, source]);

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
  // One or two seats is a quick sync, not the full room — different title.
  // Deliberately not called a huddle: that word means the desk verb that pulls
  // your whole team over your monitor, with no picker and no room.
  const isQuickSync = selectedCount <= 2;
  const sourceLine =
    source === 'email' ? copy.sourceEmail : source === 'chat' ? copy.sourceChat : copy.sourceDesk;
  const startLabel = isQuickSync
    ? copy.startHuddle
    : modality === MEETING_MODALITY_REMOTE
      ? copy.startRemote
      : copy.startPhysical;

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
    setKeepFacilitator(preset.id === 'steering');
  };

  const handleStart = () => {
    if (!canStart) return;
    const attendees = normalizeMeetingRoster([...selected], {
      forceFacilitator: keepFacilitator
    });
    const trimmed = String(topic ?? '').trim();
    onConfirm?.({
      attendees,
      modality,
      ...(trimmed ? { topic: trimmed.slice(0, 200) } : {})
    });
  };

  const tiers = ['team', 'senior', 'office'];

  return (
    <FloatingWindow
      id="call-meeting-picker"
      open={open}
      group="officeModal"
      className="office-meeting-picker"
      kind="meeting-picker"
      defaultCorner="center"
      defaultOffsetX={0}
      defaultOffsetY={0}
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
              {isQuickSync ? copy.titleHuddle : copy.title}
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

        <div className="office-meeting-picker-toolbar">
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
              {startLabel}
            </button>
          </div>
        </div>

        <div className="office-meeting-picker-modality" role="group" aria-label={copy.modalityAria}>
          <button
            type="button"
            className={`office-meeting-picker-modality-btn${
              modality === MEETING_MODALITY_PHYSICAL ? ' is-selected' : ''
            }`}
            aria-pressed={modality === MEETING_MODALITY_PHYSICAL}
            title={copy.modalityPhysicalTitle}
            onClick={() => setModality(MEETING_MODALITY_PHYSICAL)}
          >
            <span aria-hidden="true">🏢</span>
            {copy.modalityPhysical}
          </button>
          <button
            type="button"
            className={`office-meeting-picker-modality-btn${
              modality === MEETING_MODALITY_REMOTE ? ' is-selected' : ''
            }`}
            aria-pressed={modality === MEETING_MODALITY_REMOTE}
            title={copy.modalityRemoteTitle}
            onClick={() => setModality(MEETING_MODALITY_REMOTE)}
          >
            <span aria-hidden="true">🎧</span>
            {copy.modalityRemote}
          </button>
        </div>

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

        {selectedCount > 0 ? (
          <div className="office-meeting-picker-selected-strip" role="status" aria-live="polite">
            <span className="office-meeting-picker-selected-label">{copy.selectedStripLabel}</span>
            <div className="office-meeting-picker-selected-avatars">
              {[...selected].map((id) => {
                const sender = officeSenderInfo(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className="office-meeting-picker-selected-chip"
                    title={sender.name}
                    aria-label={sender.name}
                    onClick={() => toggle(id)}
                  >
                    <PersonaFace id={id} size={22} fallbackEmoji={sender.avatarEmoji} />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

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
                            className="office-meeting-picker-checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggle(id)}
                          />
                          <span className="office-meeting-picker-checkmark" aria-hidden="true">
                            {checked ? '✓' : ''}
                          </span>
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
      </div>
    </FloatingWindow>
  );
}
