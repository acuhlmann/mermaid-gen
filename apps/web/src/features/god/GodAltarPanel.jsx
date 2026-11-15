import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_GOD_OFFERINGS,
  GOD_ALTAR_COPY as COPY,
  GOD_MOOD_META,
  GOD_QUICK_PRAYERS
} from './godAltarCopy.js';
import { fetchGodCapabilities, fileGodPetitionPr, sendGodPrayer } from './godPetitionClient.js';
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

function AltarHeader({ capabilities }) {
  const llmLabel = capabilities?.llmConfigured ? COPY.llmBadge : COPY.oracleBadge;
  const ghLabel = capabilities?.githubPrConfigured ? COPY.githubReadyBadge : COPY.githubLocalBadge;

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
        <span className={`god-altar-pill${capabilities?.llmConfigured ? ' is-live' : ''}`}>
          {llmLabel}
        </span>
        <span className={`god-altar-pill${capabilities?.githubPrConfigured ? ' is-gold' : ''}`}>
          {ghLabel}
        </span>
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

function PrDecreeCard({ proposal, onTitleChange, onFilePr, filing, prOutcome }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!prOutcome?.ghCommand) return;
    try {
      await navigator.clipboard?.writeText(prOutcome.ghCommand);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
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
      {prOutcome ? (
        <div
          className={`god-altar-pr-outcome${prOutcome.filed ? '' : ' is-unconfigured'}`}
          data-testid="god-pr-outcome"
          role="status"
        >
          <strong>
            {prOutcome.filed ? COPY.prCard.filedBanner : COPY.prCard.unconfiguredTitle}
          </strong>
          <p className="god-altar-msg-body">{prOutcome.divineMessage}</p>
          {prOutcome.prUrl ? (
            <a href={prOutcome.prUrl} target="_blank" rel="noreferrer">
              {COPY.prCard.openPrLink} #{prOutcome.prNumber ?? ''} →
            </a>
          ) : null}
          {prOutcome.ghCommand ? (
            <>
              <pre className="god-altar-gh-scroll">{prOutcome.ghCommand}</pre>
              <div>
                <button type="button" className="god-altar-secondary-btn" onClick={handleCopy}>
                  {copied ? COPY.prCard.copiedGhLabel : COPY.prCard.copyGhLabel}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
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
  const capabilities = useGodCapabilities();
  const [messages, setMessages] = useState(initialHistory);
  const [favor, setFavor] = useState(35);
  const [mood, setMood] = useState('unimpressed');
  const [judgment, setJudgment] = useState(COPY.openingJudgment);
  const [offering, setOffering] = useState('none');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [filing, setFiling] = useState(false);
  const [error, setError] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [prOutcome, setPrOutcome] = useState(null);
  const [thunderSeq, setThunderSeq] = useState(0);
  const threadEndRef = useRef(null);
  const nextMsgIdRef = useRef(1);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages.length, proposal]);

  const offerings = Array.isArray(capabilities?.offerings)
    ? capabilities.offerings
    : DEFAULT_GOD_OFFERINGS;

  const nextId = (prefix) => {
    nextMsgIdRef.current += 1;
    return `${prefix}-${nextMsgIdRef.current}`;
  };

  const buildDiagramContext = () => {
    const trimmed = typeof diagramSource === 'string' ? diagramSource.trim() : '';
    return trimmed ? { contentType, diagramSource: trimmed.slice(0, 4000) } : undefined;
  };

  const submitPrayer = async (textOverride, offeringOverride) => {
    const text = (textOverride ?? draft).trim();
    if (!text || busy) return;
    const chosenOffering = offeringOverride ?? offering;
    const nextMessages = [...messages, { id: nextId('user'), role: 'user', content: text }];
    setMessages(nextMessages);
    if (!textOverride) setDraft('');
    setBusy(true);
    setError(null);
    setPrOutcome(null);

    const res = await sendGodPrayer({
      messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
      offering: chosenOffering,
      currentFavor: favor,
      userName,
      modelProfile,
      diagramContext: buildDiagramContext()
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    const data = res.data;
    setFavor(data.favor ?? favor);
    setMood(data.mood ?? mood);
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
      userName
    });
    setFiling(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setThunderSeq((n) => n + 1);
    setPrOutcome(res.data);
  };

  const handleReset = () => {
    setMessages(initialHistory());
    setFavor(35);
    setMood('unimpressed');
    setJudgment(COPY.openingJudgment);
    setOffering('none');
    setProposal(null);
    setPrOutcome(null);
    setError(null);
  };

  return (
    <div
      key={thunderSeq > 0 ? `altar-${thunderSeq}` : 'altar-0'}
      className={`god-altar${thunderSeq > 0 ? ' is-thunder' : ''}`}
      data-testid="god-altar-panel"
    >
      <AltarHeader capabilities={capabilities} />
      <DivineFavorMeter favor={favor} mood={mood} judgment={judgment} />
      <PrayerThread messages={messages} userName={userName} threadEndRef={threadEndRef} />
      {proposal ? (
        <PrDecreeCard
          proposal={proposal}
          onTitleChange={(title) => setProposal((prev) => (prev ? { ...prev, title } : prev))}
          onFilePr={handleFilePr}
          filing={filing}
          prOutcome={prOutcome}
        />
      ) : null}
      {error ? (
        <p className="god-altar-error" role="alert">
          {error}
        </p>
      ) : null}
      <OfferingsStrip
        offerings={offerings}
        offering={offering}
        busy={busy}
        onSelect={setOffering}
      />
      <QuickPrayersStrip
        busy={busy}
        onPick={(q) => {
          setOffering(q.offering);
          void submitPrayer(q.prompt, q.offering);
        }}
      />
      <PrayerComposer
        draft={draft}
        busy={busy}
        onDraftChange={setDraft}
        onSubmit={() => void submitPrayer()}
        onReset={handleReset}
        extraHeaderActions={extraHeaderActions}
      />
    </div>
  );
}
