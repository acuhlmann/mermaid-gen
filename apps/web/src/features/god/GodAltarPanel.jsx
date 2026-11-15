import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_GOD_OFFERINGS,
  GOD_ALTAR_COPY as COPY,
  GOD_MOOD_META,
  GOD_QUICK_PRAYERS
} from './godAltarCopy.js';
import { playGodJudgmentCue, stopGodSpeech } from './godAltarAudio.js';
import { emitGodAltarEvent } from './godAltarStore.js';
import {
  dispatchGodWorkflow,
  fetchGodCapabilities,
  fileGodPetitionPr,
  sendGodPrayer
} from './godPetitionClient.js';
import './GodAltar.css';

function CelestialHaloIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle
        cx="24"
        cy="24"
        r="19"
        fill="none"
        stroke="#e5c158"
        strokeWidth="1.6"
        strokeDasharray="4 3"
      />
      <ellipse cx="24" cy="11" rx="11" ry="3.2" fill="none" stroke="#fde68a" strokeWidth="1.8" />
      <path
        d="M11 26c4-6.5 9-9.5 13-9.5s9 3 13 9.5c-4 6.5-9 9.5-13 9.5s-9-3-13-9.5Z"
        fill="rgba(229, 193, 88, 0.14)"
        stroke="#e5c158"
        strokeWidth="1.8"
      />
      <circle cx="24" cy="26" r="4.2" fill="#e5c158" />
      <path
        d="M26 19l-4 7h4l-2 6"
        fill="none"
        stroke="#111521"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function initialHistory() {
  return [
    {
      id: 'god-opener',
      role: 'god',
      content: COPY.openingDecree,
      judgment: COPY.openingJudgment,
      favorDelta: null
    }
  ];
}

function AudioToggles({ soundEnabled, voiceEnabled, onToggleSound, onToggleVoice }) {
  return (
    <>
      <button
        type="button"
        className={`god-altar-audio-toggle${soundEnabled ? ' is-on' : ''}`}
        data-testid="god-altar-sfx-toggle"
        aria-pressed={soundEnabled}
        onClick={onToggleSound}
      >
        {soundEnabled ? `🔊 ${COPY.audio.sfxOn}` : `🔇 ${COPY.audio.sfxOff}`}
      </button>
      <button
        type="button"
        className={`god-altar-audio-toggle${soundEnabled && voiceEnabled ? ' is-on' : ''}`}
        data-testid="god-altar-voice-toggle"
        aria-pressed={voiceEnabled}
        disabled={!soundEnabled}
        onClick={onToggleVoice}
      >
        {voiceEnabled ? `🗣️ ${COPY.audio.voiceOn}` : `🤫 ${COPY.audio.voiceOff}`}
      </button>
    </>
  );
}

function AltarHeader({ capabilities, soundEnabled, voiceEnabled, onToggleSound, onToggleVoice }) {
  const llmLive = Boolean(capabilities?.llmConfigured);
  const ghReady = Boolean(capabilities?.githubPrConfigured);

  return (
    <header className="god-altar-header">
      <div className="god-altar-identity">
        <div className="god-altar-halo">
          <CelestialHaloIcon />
        </div>
        <div>
          <p className="god-altar-eyebrow">{COPY.eyebrow}</p>
          <h2 className="god-altar-title">{COPY.title}</h2>
          <p className="god-altar-subtitle">{COPY.subtitle}</p>
        </div>
      </div>
      <div className="god-altar-badges">
        <span className={`god-altar-pill${llmLive ? ' is-live' : ''}`}>
          {llmLive ? COPY.llmBadge : COPY.oracleBadge}
        </span>
        <span className={`god-altar-pill${ghReady ? ' is-gold' : ''}`}>
          {ghReady ? COPY.githubReadyBadge : COPY.githubLocalBadge}
        </span>
        <AudioToggles
          soundEnabled={soundEnabled}
          voiceEnabled={voiceEnabled}
          onToggleSound={onToggleSound}
          onToggleVoice={onToggleVoice}
        />
      </div>
    </header>
  );
}

function DivineFavorMeter({ favor, mood, judgment }) {
  const moodMeta = GOD_MOOD_META[mood] ?? GOD_MOOD_META.amused;
  const pct = Math.max(0, Math.min(100, Math.round(favor)));

  return (
    <div className="god-altar-meter-card" data-testid="god-favor-meter">
      <div className="god-altar-meter-top">
        <span className="god-altar-meter-label">
          {COPY.favorLabel}: {pct} / 100
        </span>
        <span className={`god-altar-mood is-${mood}`} title={moodMeta.hint}>
          {moodMeta.glyph} {moodMeta.label}
        </span>
      </div>
      <span className="god-altar-judgment">{judgment}</span>
      <div className="god-altar-meter-bar" aria-hidden="true">
        <span className="god-altar-meter-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="god-altar-meter-hint">{COPY.favorHint}</p>
    </div>
  );
}

function PrayerThread({ messages, userName, threadEndRef }) {
  return (
    <div className="god-altar-thread" role="log" aria-live="polite">
      {messages.map((msg) => (
        <article key={msg.id} className={`god-altar-msg is-${msg.role}`}>
          <div className="god-altar-msg-head">
            <span>{msg.role === 'god' ? 'ArchiSlop God' : userName || 'Mortal'}</span>
            {typeof msg.favorDelta === 'number' ? (
              <span className={`god-altar-delta${msg.favorDelta < 0 ? ' is-neg' : ''}`}>
                {msg.favorDelta >= 0 ? `+${msg.favorDelta}` : msg.favorDelta} Favor
              </span>
            ) : null}
          </div>
          <p className="god-altar-msg-body">{msg.content}</p>
        </article>
      ))}
      <div ref={threadEndRef} />
    </div>
  );
}

function WorkflowDispatchStatus({
  dispatchInfo,
  dispatching,
  onManualDispatch,
  copiedWorkflow,
  onCopyWorkflow
}) {
  if (!dispatchInfo) return null;
  const dispatched = Boolean(dispatchInfo.dispatched);
  return (
    <div className="god-altar-dispatch-box" data-testid="god-workflow-dispatch">
      <div className="god-altar-dispatch-head">
        <strong>
          {dispatched
            ? `⚙️ ${COPY.prCard.dispatchDispatched}`
            : `🛠️ ${COPY.prCard.dispatchFallback}`}
        </strong>
        <span className="god-altar-pill">
          focus: {dispatchInfo.focus} · ref: {dispatchInfo.ref}
        </span>
      </div>
      <p className="god-altar-msg-body">{dispatchInfo.message}</p>
      <div className="god-altar-pr-actions">
        {dispatched && dispatchInfo.workflowUrl ? (
          <a href={dispatchInfo.workflowUrl} target="_blank" rel="noreferrer">
            {COPY.prCard.openWorkflowLink} →
          </a>
        ) : null}
        {!dispatched ? (
          <button
            type="button"
            className="god-altar-secondary-btn"
            data-testid="god-dispatch-workflow-button"
            disabled={dispatching}
            onClick={onManualDispatch}
          >
            {dispatching ? COPY.prCard.dispatchingButton : COPY.prCard.dispatchButton}
          </button>
        ) : null}
      </div>
      {!dispatched && dispatchInfo.ghWorkflowCommand ? (
        <>
          <pre className="god-altar-gh-scroll">{dispatchInfo.ghWorkflowCommand}</pre>
          <div>
            <button type="button" className="god-altar-secondary-btn" onClick={onCopyWorkflow}>
              {copiedWorkflow ? COPY.prCard.copiedWorkflowLabel : COPY.prCard.copyWorkflowLabel}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function PrDecreeOutcome({
  prOutcome,
  dispatching,
  onManualDispatch,
  copiedGh,
  copiedWorkflow,
  onCopyGh,
  onCopyWorkflow
}) {
  if (!prOutcome) return null;
  return (
    <div
      className={`god-altar-pr-outcome${prOutcome.filed ? '' : ' is-unconfigured'}`}
      data-testid="god-pr-outcome"
      role="status"
    >
      <strong>{prOutcome.filed ? COPY.prCard.filedBanner : COPY.prCard.unconfiguredTitle}</strong>
      <p className="god-altar-msg-body">{prOutcome.divineMessage}</p>
      {prOutcome.prUrl ? (
        <a href={prOutcome.prUrl} target="_blank" rel="noreferrer">
          {COPY.prCard.openPrLink} #{prOutcome.prNumber ?? ''} →
        </a>
      ) : null}
      {prOutcome.ghCommand && !prOutcome.filed ? (
        <>
          <pre className="god-altar-gh-scroll">{prOutcome.ghCommand}</pre>
          <div>
            <button type="button" className="god-altar-secondary-btn" onClick={onCopyGh}>
              {copiedGh ? COPY.prCard.copiedGhLabel : COPY.prCard.copyGhLabel}
            </button>
          </div>
        </>
      ) : null}
      <WorkflowDispatchStatus
        dispatchInfo={prOutcome.workflowDispatch}
        dispatching={dispatching}
        onManualDispatch={onManualDispatch}
        copiedWorkflow={copiedWorkflow}
        onCopyWorkflow={onCopyWorkflow}
      />
    </div>
  );
}

function PrDecreeCard({
  proposal,
  dispatchWorkflow,
  onToggleDispatchWorkflow,
  onTitleChange,
  onFilePr,
  onManualDispatch,
  filing,
  dispatching,
  prOutcome
}) {
  const [copiedGh, setCopiedGh] = useState(false);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);

  const copyText = async (text, setter) => {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      setter(true);
      window.setTimeout(() => setter(false), 2000);
    } catch {
      setter(false);
    }
  };

  return (
    <section className="god-altar-pr-card" data-testid="god-pr-decree">
      <p className="god-altar-eyebrow">{COPY.prCard.eyebrow}</p>
      <input
        type="text"
        className="god-altar-pr-title-input"
        aria-label="Pull Request Title"
        value={proposal.title}
        onChange={(event) => onTitleChange(event.target.value)}
        maxLength={120}
      />
      <p className="god-altar-msg-body">{proposal.summary}</p>
      <div className="god-altar-pr-meta">
        <span>
          {COPY.prCard.branchLabel}: <code>god-petition/{proposal.branchSlug}</code>
        </span>
        <span>
          {COPY.prCard.targetLabel}: <code>{proposal.targetArea}</code>
        </span>
      </div>
      <div>
        <span className="god-altar-section-label">{COPY.prCard.planLabel}</span>
        <ol className="god-altar-pr-plan">
          {proposal.implementationPlan.map((step, idx) => (
            <li key={`${idx}-${step}`}>{step}</li>
          ))}
        </ol>
      </div>
      <p className="god-altar-pr-blessing">“{proposal.divineBlessing}”</p>
      <label className="god-altar-dispatch-opt">
        <input
          type="checkbox"
          data-testid="god-dispatch-checkbox"
          checked={dispatchWorkflow}
          onChange={(event) => onToggleDispatchWorkflow(event.target.checked)}
        />
        <span>{COPY.prCard.dispatchCheckbox}</span>
      </label>
      <div className="god-altar-pr-actions">
        <button
          type="button"
          className="god-altar-strike-btn"
          data-testid="god-file-pr-button"
          disabled={filing}
          onClick={onFilePr}
        >
          {filing ? COPY.prCard.filingButton : COPY.prCard.fileButton}
        </button>
      </div>
      <PrDecreeOutcome
        prOutcome={prOutcome}
        dispatching={dispatching}
        onManualDispatch={onManualDispatch}
        copiedGh={copiedGh}
        copiedWorkflow={copiedWorkflow}
        onCopyGh={() => void copyText(prOutcome?.ghCommand, setCopiedGh)}
        onCopyWorkflow={() =>
          void copyText(prOutcome?.workflowDispatch?.ghWorkflowCommand, setCopiedWorkflow)
        }
      />
    </section>
  );
}

function OfferingsStrip({ offerings, offering, busy, onSelect }) {
  return (
    <div className="god-altar-offerings">
      <span className="god-altar-section-label">{COPY.offeringLabel}</span>
      <div className="god-altar-chip-row" role="group" aria-label={COPY.offeringLabel}>
        {offerings.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`god-altar-chip${offering === item.id ? ' is-selected' : ''}`}
            aria-pressed={offering === item.id}
            disabled={busy}
            title={item.sacredNote}
            onClick={() => onSelect(item.id)}
          >
            {item.emoji} {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickPrayersStrip({ busy, onPick }) {
  return (
    <div className="god-altar-offerings">
      <span className="god-altar-section-label">{COPY.quickPrayersLabel}</span>
      <div className="god-altar-chip-row">
        {GOD_QUICK_PRAYERS.map((q) => (
          <button
            key={q.id}
            type="button"
            className="god-altar-chip"
            disabled={busy}
            onClick={() => onPick(q)}
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PrayerComposer({ draft, busy, onDraftChange, onSubmit, onReset, extraHeaderActions }) {
  return (
    <form
      className="god-altar-composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="god-altar-section-label" htmlFor="god-altar-input">
        {COPY.inputLabel}
      </label>
      <textarea
        id="god-altar-input"
        data-testid="god-altar-input"
        className="god-altar-textarea"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={COPY.inputPlaceholder}
        maxLength={2000}
        disabled={busy}
      />
      <div className="god-altar-composer-actions">
        <div className="god-altar-chip-row">
          <button
            type="button"
            className="god-altar-secondary-btn"
            onClick={onReset}
            disabled={busy}
          >
            {COPY.resetButton}
          </button>
          {extraHeaderActions}
        </div>
        <button
          type="submit"
          className="god-altar-strike-btn"
          data-testid="god-altar-submit"
          disabled={busy || !draft.trim()}
        >
          {busy ? COPY.sending : COPY.submit}
        </button>
      </div>
    </form>
  );
}

function useGodCapabilities() {
  const [capabilities, setCapabilities] = useState(null);
  useEffect(() => {
    let active = true;
    void fetchGodCapabilities().then((caps) => {
      if (active && caps) setCapabilities(caps);
    });
    return () => {
      active = false;
    };
  }, []);
  return capabilities;
}

function classifyDivineEventKind(data) {
  if (data.prProposal || data.mood === 'benevolent' || data.mood === 'smitten') return 'bless';
  if (data.mood === 'wrathful' || data.mood === 'unimpressed') return 'smite';
  return 'pray';
}

function buildDiagramContextPayload(diagramSource, contentType) {
  const trimmed = typeof diagramSource === 'string' ? diagramSource.trim() : '';
  return trimmed ? { contentType, diagramSource: trimmed.slice(0, 4000) } : undefined;
}

function useGodAltarAudioPrefs() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const audioContextRef = useRef(null);
  useEffect(() => () => stopGodSpeech(), []);
  return {
    soundEnabled,
    voiceEnabled,
    audioContextRef,
    toggleSound: () =>
      setSoundEnabled((prev) => {
        if (prev) stopGodSpeech();
        return !prev;
      }),
    toggleVoice: () =>
      setVoiceEnabled((prev) => {
        if (prev) stopGodSpeech();
        return !prev;
      })
  };
}

function useGodAltarState({ diagramSource, contentType, userName, modelProfile }) {
  const capabilities = useGodCapabilities();
  const audio = useGodAltarAudioPrefs();
  const [messages, setMessages] = useState(initialHistory);
  const [favor, setFavor] = useState(35);
  const [mood, setMood] = useState('unimpressed');
  const [judgment, setJudgment] = useState(COPY.openingJudgment);
  const [offering, setOffering] = useState('none');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [filing, setFiling] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchWorkflow, setDispatchWorkflow] = useState(true);
  const [error, setError] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [prOutcome, setPrOutcome] = useState(null);
  const [thunderSeq, setThunderSeq] = useState(0);
  const threadEndRef = useRef(null);
  const nextMsgIdRef = useRef(1);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages.length, proposal]);

  const nextId = (prefix) => {
    nextMsgIdRef.current += 1;
    return `${prefix}-${nextMsgIdRef.current}`;
  };

  const applyPrayerSuccess = (data) => {
    const nextMood = data.mood ?? mood;
    const eventKind = classifyDivineEventKind(data);
    setFavor(data.favor ?? favor);
    setMood(nextMood);
    setJudgment(data.judgment ?? judgment);
    setThunderSeq((n) => n + 1);
    if (data.prProposal) setProposal(data.prProposal);
    setMessages((prev) => [
      ...prev,
      {
        id: nextId('god'),
        role: 'god',
        content: data.reply,
        favorDelta: data.favorDelta,
        judgment: data.judgment
      }
    ]);
    emitGodAltarEvent(eventKind, nextMood);
    playGodJudgmentCue({
      audioContextRef: audio.audioContextRef,
      kind: eventKind,
      mood: nextMood,
      hasProposal: Boolean(data.prProposal),
      soundEnabled: audio.soundEnabled,
      voiceEnabled: audio.voiceEnabled,
      text: data.reply
    });
  };

  const submitPrayer = async (textOverride, offeringOverride) => {
    const text = (textOverride ?? draft).trim();
    if (!text || busy) return;
    const nextMessages = [...messages, { id: nextId('user'), role: 'user', content: text }];
    setMessages(nextMessages);
    if (!textOverride) setDraft('');
    setBusy(true);
    setError(null);
    setPrOutcome(null);

    const res = await sendGodPrayer({
      messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
      offering: offeringOverride ?? offering,
      currentFavor: favor,
      userName,
      modelProfile,
      diagramContext: buildDiagramContextPayload(diagramSource, contentType)
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    applyPrayerSuccess(res.data);
  };

  const handleFilePr = async () => {
    if (!proposal || filing) return;
    setFiling(true);
    setError(null);
    const lastPrayer = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const res = await fileGodPetitionPr({
      proposal,
      prayerSummary: lastPrayer,
      favor,
      userName,
      dispatchWorkflow
    });
    setFiling(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setThunderSeq((n) => n + 1);
    setPrOutcome(res.data);
    emitGodAltarEvent('bless', 'smitten');
    playGodJudgmentCue({
      audioContextRef: audio.audioContextRef,
      kind: 'file-pr',
      mood: 'smitten',
      hasProposal: true,
      soundEnabled: audio.soundEnabled,
      voiceEnabled: audio.voiceEnabled,
      text: res.data.divineMessage
    });
  };

  const handleManualDispatch = async () => {
    if (!prOutcome || dispatching) return;
    setDispatching(true);
    const res = await dispatchGodWorkflow({
      ref: prOutcome.branch,
      focus: prOutcome.workflowDispatch?.focus,
      proposal
    });
    setDispatching(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPrOutcome((prev) => (prev ? { ...prev, workflowDispatch: res.data } : prev));
  };

  const handleReset = () => {
    stopGodSpeech();
    setMessages(initialHistory());
    setFavor(35);
    setMood('unimpressed');
    setJudgment(COPY.openingJudgment);
    setOffering('none');
    setProposal(null);
    setPrOutcome(null);
    setError(null);
  };

  return {
    capabilities,
    messages,
    favor,
    mood,
    judgment,
    offering,
    setOffering,
    draft,
    setDraft,
    busy,
    filing,
    dispatching,
    dispatchWorkflow,
    setDispatchWorkflow,
    error,
    proposal,
    setProposal,
    prOutcome,
    thunderSeq,
    soundEnabled: audio.soundEnabled,
    voiceEnabled: audio.voiceEnabled,
    threadEndRef,
    submitPrayer,
    handleFilePr,
    handleManualDispatch,
    handleReset,
    toggleSound: audio.toggleSound,
    toggleVoice: audio.toggleVoice
  };
}

/**
 * Interactive prayer & Wish-to-PR sanctuary for ArchiSlop God.
 * Shared by the Studio/Office `GodAltarModal` and the standalone `/god` window.
 */
export default function GodAltarPanel({
  diagramSource = '',
  contentType = 'mermaid',
  userName = '',
  modelProfile = 'fast',
  extraHeaderActions = null
}) {
  const s = useGodAltarState({ diagramSource, contentType, userName, modelProfile });
  const offerings = Array.isArray(s.capabilities?.offerings)
    ? s.capabilities.offerings
    : DEFAULT_GOD_OFFERINGS;

  return (
    <div
      key={s.thunderSeq > 0 ? `altar-${s.thunderSeq}` : 'altar-0'}
      className={`god-altar${s.thunderSeq > 0 ? ' is-thunder' : ''}`}
      data-testid="god-altar-panel"
    >
      <AltarHeader
        capabilities={s.capabilities}
        soundEnabled={s.soundEnabled}
        voiceEnabled={s.voiceEnabled}
        onToggleSound={s.toggleSound}
        onToggleVoice={s.toggleVoice}
      />
      <DivineFavorMeter favor={s.favor} mood={s.mood} judgment={s.judgment} />
      <PrayerThread messages={s.messages} userName={userName} threadEndRef={s.threadEndRef} />
      {s.proposal ? (
        <PrDecreeCard
          proposal={s.proposal}
          dispatchWorkflow={s.dispatchWorkflow}
          onToggleDispatchWorkflow={s.setDispatchWorkflow}
          onTitleChange={(title) => s.setProposal((prev) => (prev ? { ...prev, title } : prev))}
          onFilePr={s.handleFilePr}
          onManualDispatch={s.handleManualDispatch}
          filing={s.filing}
          dispatching={s.dispatching}
          prOutcome={s.prOutcome}
        />
      ) : null}
      {s.error ? (
        <p className="god-altar-error" role="alert">
          {s.error}
        </p>
      ) : null}
      <OfferingsStrip
        offerings={offerings}
        offering={s.offering}
        busy={s.busy}
        onSelect={s.setOffering}
      />
      <QuickPrayersStrip
        busy={s.busy}
        onPick={(q) => {
          s.setOffering(q.offering);
          void s.submitPrayer(q.prompt, q.offering);
        }}
      />
      <PrayerComposer
        draft={s.draft}
        busy={s.busy}
        onDraftChange={s.setDraft}
        onSubmit={() => void s.submitPrayer()}
        onReset={s.handleReset}
        extraHeaderActions={extraHeaderActions}
      />
    </div>
  );
}
