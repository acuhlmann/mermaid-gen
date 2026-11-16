import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_GOD_OFFERINGS,
  GOD_ALTAR_COPY as COPY,
  GOD_MOOD_META,
  GOD_QUICK_PRAYERS
} from './godAltarCopy.js';
import { disposeGodAudioContext, playGodJudgmentCue, stopGodSpeech } from './godAltarAudio.js';
import { fetchGodCloudAudio } from './godSpeechClient.js';
import { emitGodAltarEvent } from './godAltarStore.js';
import { fetchGodCapabilities, sendGodPrayer } from './godPetitionClient.js';
import GodPrDecreeCard from './GodPrDecreeCard.jsx';
import { useGodPetitionFiling } from './useGodPetitionFiling.js';
import { getUxSessionReceipts } from '../../state/uxSignalsClient.js';
import './GodAltar.css';

const MAX_PRAYER_HISTORY_PAYLOAD = 24;
const SMITE_SHAKE_MS = 550;
const TYPEWRITER_STEPS = 8;

function prefersReducedMotion() {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

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

function GodTypewriterBody({ content, animate }) {
  const [revealed, setRevealed] = useState(() =>
    animate && !prefersReducedMotion() && typeof globalThis.requestAnimationFrame === 'function'
      ? 0
      : content.length
  );

  useEffect(() => {
    if (
      !animate ||
      prefersReducedMotion() ||
      typeof globalThis.requestAnimationFrame !== 'function'
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: immediately reveal full text when typewriter animation is disabled or reduced motion is active)
      setRevealed(content.length);
      return undefined;
    }
    let rafId = 0;
    let cursor = 0;
    const chunk = Math.max(1, Math.ceil(content.length / TYPEWRITER_STEPS));
    setRevealed(0);
    const step = () => {
      cursor = Math.min(content.length, cursor + chunk);
      setRevealed(cursor);
      if (cursor < content.length) {
        rafId = globalThis.requestAnimationFrame(step);
      }
    };
    rafId = globalThis.requestAnimationFrame(step);
    return () => {
      if (rafId) globalThis.cancelAnimationFrame(rafId);
    };
  }, [content, animate]);

  const text = animate && revealed < content.length ? content.slice(0, revealed) : content;
  const typing = animate && revealed < content.length;

  return (
    <p className="god-altar-msg-body">
      {text}
      {typing ? <span className="god-altar-typewriter-cursor" aria-hidden="true" /> : null}
    </p>
  );
}

function PrayerThread({ messages, userName, threadEndRef }) {
  const lastIndex = messages.length - 1;
  return (
    <div className="god-altar-thread" role="log" aria-live="polite">
      {messages.map((msg, index) => {
        const shouldAnimate = Boolean(msg.animate && index === lastIndex && msg.role === 'god');
        return (
          <article key={msg.id} className={`god-altar-msg is-${msg.role}`}>
            <div className="god-altar-msg-head">
              <span>{msg.role === 'god' ? 'ArchiSlop God' : userName || 'Mortal'}</span>
              {typeof msg.favorDelta === 'number' ? (
                <span className={`god-altar-delta${msg.favorDelta < 0 ? ' is-neg' : ''}`}>
                  {msg.favorDelta >= 0 ? `+${msg.favorDelta}` : msg.favorDelta} Favor
                </span>
              ) : null}
            </div>
            {msg.role === 'god' ? (
              <GodTypewriterBody content={msg.content} animate={shouldAnimate} />
            ) : (
              <p className="god-altar-msg-body">{msg.content}</p>
            )}
          </article>
        );
      })}
      <div ref={threadEndRef} />
    </div>
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

function QuickPrayersStrip({ busy, onPick, onJudgeDiagram }) {
  return (
    <div className="god-altar-offerings">
      <span className="god-altar-section-label">{COPY.quickPrayersLabel}</span>
      <div className="god-altar-chip-row">
        <button
          type="button"
          className="god-altar-chip god-altar-chip--judge"
          data-testid="god-judge-diagram-button"
          disabled={busy}
          onClick={onJudgeDiagram}
        >
          {COPY.judgeDiagramButton}
        </button>
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
  if (data.mood === 'wrathful') return 'smite';
  return 'pray';
}

function buildJudgeDiagramPrompt(diagramSource, contentType) {
  const hasSource = typeof diagramSource === 'string' && diagramSource.trim().length > 0;
  if (!hasSource) return COPY.judgeDiagramEmptyPrompt;
  return COPY.judgeDiagramPrompt.replace('{contentType}', contentType || 'diagram');
}

function buildDiagramContextPayload(diagramSource, contentType) {
  const trimmed = typeof diagramSource === 'string' ? diagramSource.trim() : '';
  return trimmed ? { contentType, diagramSource: trimmed.slice(0, 4000) } : undefined;
}

function useGodAltarAudioPrefs() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const audioContextRef = useRef({ current: null, disposed: false });
  const prefsRef = useRef({ soundEnabled, voiceEnabled });

  useEffect(() => {
    prefsRef.current = { soundEnabled, voiceEnabled };
  }, [soundEnabled, voiceEnabled]);

  useEffect(() => {
    const ref = audioContextRef.current;
    ref.disposed = false;
    return () => {
      stopGodSpeech();
      disposeGodAudioContext(ref);
    };
  }, []);

  const playCue = ({ kind, mood, hasProposal, text }) => {
    const ref = audioContextRef.current;
    if (ref.disposed) return;
    // Cloud-first voice (Chirp3-HD Charon via /api/god/petition/speak);
    // godAltarAudio falls back to Web Speech when the cloud stays silent.
    void playGodJudgmentCue({
      audioContextRef: ref,
      kind,
      mood,
      hasProposal,
      soundEnabled: prefsRef.current.soundEnabled,
      voiceEnabled: prefsRef.current.voiceEnabled,
      text,
      fetchCloudAudio: fetchGodCloudAudio
    });
  };

  return {
    soundEnabled,
    voiceEnabled,
    playCue,
    toggleSound: () =>
      setSoundEnabled((prev) => {
        const next = !prev;
        prefsRef.current.soundEnabled = next;
        if (!next) stopGodSpeech();
        return next;
      }),
    toggleVoice: () =>
      setVoiceEnabled((prev) => {
        const next = !prev;
        prefsRef.current.voiceEnabled = next;
        if (!next) stopGodSpeech();
        return next;
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
  const [dispatchWorkflow, setDispatchWorkflow] = useState(true);
  const [error, setError] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [thunderSeq, setThunderSeq] = useState(0);
  const [smiteShaking, setSmiteShaking] = useState(false);
  const smiteTimerRef = useRef(null);
  const threadEndRef = useRef(null);
  const nextMsgIdRef = useRef(1);
  const mountedRef = useRef(true);
  const prayerEpochRef = useRef(0);
  const petitionEpochRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    const prayerRef = prayerEpochRef;
    const petitionRef = petitionEpochRef;
    return () => {
      mountedRef.current = false;
      prayerRef.current += 1;
      petitionRef.current += 1;
      if (smiteTimerRef.current) clearTimeout(smiteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages.length, proposal]);

  const petition = useGodPetitionFiling({
    proposal,
    messages,
    favor,
    userName,
    dispatchWorkflow,
    mountedRef,
    petitionEpochRef,
    audio,
    setError,
    setThunderSeq
  });

  const nextId = (prefix) => {
    nextMsgIdRef.current += 1;
    return `${prefix}-${nextMsgIdRef.current}`;
  };

  const triggerSmiteShake = () => {
    if (smiteTimerRef.current) clearTimeout(smiteTimerRef.current);
    setSmiteShaking(true);
    smiteTimerRef.current = setTimeout(() => {
      setSmiteShaking(false);
      smiteTimerRef.current = null;
    }, SMITE_SHAKE_MS);
  };

  const applyPrayerSuccess = (data) => {
    if (!mountedRef.current) return;
    const nextMood = data.mood ?? mood;
    const eventKind = classifyDivineEventKind(data);
    setFavor(data.favor ?? favor);
    setMood(nextMood);
    setJudgment(data.judgment ?? judgment);
    setThunderSeq((n) => n + 1);
    if (eventKind === 'smite') triggerSmiteShake();
    if (data.prProposal) setProposal(data.prProposal);
    setMessages((prev) => [
      ...prev,
      {
        id: nextId('god'),
        role: 'god',
        content: data.reply,
        favorDelta: data.favorDelta,
        judgment: data.judgment,
        animate: true
      }
    ]);
    emitGodAltarEvent(eventKind, nextMood);
    audio.playCue({
      kind: eventKind,
      mood: nextMood,
      hasProposal: Boolean(data.prProposal),
      text: data.reply
    });
  };

  const submitPrayer = async (textOverride, offeringOverride, { mode = 'prayer' } = {}) => {
    const text = (textOverride ?? draft).trim();
    if (!text || busy) return;
    const prayerEpoch = ++prayerEpochRef.current;
    petitionEpochRef.current += 1;
    const nextMessages = [...messages, { id: nextId('user'), role: 'user', content: text }];
    setMessages(nextMessages);
    if (!textOverride) setDraft('');
    setBusy(true);
    setError(null);
    petition.resetFiling();

    const sessionReceipts = getUxSessionReceipts();
    const res = await sendGodPrayer({
      messages: nextMessages
        .slice(-MAX_PRAYER_HISTORY_PAYLOAD)
        .map((m) => ({ role: m.role, content: m.content })),
      offering: offeringOverride ?? offering,
      currentFavor: favor,
      userName,
      modelProfile,
      mode,
      ...(sessionReceipts ? { sessionReceipts } : {}),
      diagramContext: buildDiagramContextPayload(diagramSource, contentType)
    });
    if (!mountedRef.current || prayerEpoch !== prayerEpochRef.current) return;
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    applyPrayerSuccess(res.data);
  };

  const judgeCurrentDiagram = () => {
    const prompt = buildJudgeDiagramPrompt(diagramSource, contentType);
    return submitPrayer(prompt, offering, { mode: 'judge_diagram' });
  };

  const handleReset = () => {
    prayerEpochRef.current += 1;
    petitionEpochRef.current += 1;
    stopGodSpeech();
    if (smiteTimerRef.current) clearTimeout(smiteTimerRef.current);
    setSmiteShaking(false);
    setBusy(false);
    petition.resetFiling();
    setMessages(initialHistory());
    setFavor(35);
    setMood('unimpressed');
    setJudgment(COPY.openingJudgment);
    setOffering('none');
    setProposal(null);
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
    filing: petition.filing,
    dispatching: petition.dispatching,
    checkingStatus: petition.checkingStatus,
    dispatchWorkflow,
    setDispatchWorkflow,
    error,
    proposal,
    setProposal,
    prOutcome: petition.prOutcome,
    runStatus: petition.runStatus,
    thunderSeq,
    smiteShaking,
    soundEnabled: audio.soundEnabled,
    voiceEnabled: audio.voiceEnabled,
    threadEndRef,
    submitPrayer,
    judgeCurrentDiagram,
    handleFilePr: petition.handleFilePr,
    handleManualDispatch: petition.handleManualDispatch,
    handleRefreshStatus: petition.handleRefreshStatus,
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
    <div className={`god-altar${s.smiteShaking ? ' is-smite' : ''}`} data-testid="god-altar-panel">
      {s.thunderSeq > 0 ? (
        <div key={s.thunderSeq} className="god-altar-thunder-flash" aria-hidden="true" />
      ) : null}
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
        <GodPrDecreeCard
          proposal={s.proposal}
          dispatchWorkflow={s.dispatchWorkflow}
          onToggleDispatchWorkflow={s.setDispatchWorkflow}
          onTitleChange={(title) => s.setProposal((prev) => (prev ? { ...prev, title } : prev))}
          onFilePr={s.handleFilePr}
          onManualDispatch={s.handleManualDispatch}
          onRefreshStatus={s.handleRefreshStatus}
          filing={s.filing}
          dispatching={s.dispatching}
          checkingStatus={s.checkingStatus}
          runStatus={s.runStatus}
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
        onJudgeDiagram={() => void s.judgeCurrentDiagram()}
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
