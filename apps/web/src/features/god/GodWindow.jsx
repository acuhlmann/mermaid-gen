import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { GOD_ACT_VERDICTS, GOD_HARD_LIMITS } from '@archislop/shared';
import {
  GOD_ACCESS,
  getGodWindowSnapshot,
  loadGodStatus,
  subscribeGodWindow,
  unlockGodWindow
} from './godWindowClient.js';
import { GOD_WINDOW_COPY as COPY } from './godWindowCopy.js';
import { markAppReady } from '../../utils/appReadySignal.js';
import './GodWindow.css';

const ACT_VERDICTS = new Set(GOD_ACT_VERDICTS);
const TABS = ['now', 'history', 'signals', 'settings'];

/** UTC, fixed-width, no locale surprises — this is a measurement readout, not a greeting. */
function formatUtc(iso) {
  if (typeof iso !== 'string' || !iso) return COPY.fields.unknown;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return COPY.fields.unknown;
  const pad = (n) => String(n).padStart(2, '0');
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  return `${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

/** October's real spend is $0.018813. Two decimals would print "$0.02" and round away the truth. */
function formatUsd(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return COPY.fields.unknown;
  let text = value.toFixed(value >= 1 ? 2 : 6);
  if (text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '');
  return `$${text}`;
}

function label(value) {
  return typeof value === 'string' && value ? value : COPY.fields.unknown;
}

function verdictTone(verdict) {
  if (ACT_VERDICTS.has(verdict)) return 'ok';
  if (verdict === 'noop') return 'noop';
  return 'bad';
}

/**
 * A null here means the month was never judged — the stamp is absent, not zero. "We did not measure"
 * and "we measured nothing wasted" are different answers about money, so they get different words.
 * A bare dash would read as zero, and zero reads as good news.
 */
function isUnmeasured(value) {
  return value === null || value === undefined;
}

function measuredText(value, format) {
  return isUnmeasured(value) ? COPY.fields.notMeasured : format(value);
}

function Stat({ term, value, tone = '' }) {
  return (
    <div className="god-stat">
      <dt>{term}</dt>
      <dd className={tone ? `is-${tone}` : undefined}>{value}</dd>
    </div>
  );
}

function Measured({ term, value, format }) {
  return (
    <Stat
      term={term}
      value={measuredText(value, format)}
      tone={isUnmeasured(value) ? 'unmeasured' : ''}
    />
  );
}

function TokenGate({ onUnlocked }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    const value = token.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    const result = await unlockGodWindow(value);
    setBusy(false);
    // Never held in state after the exchange: refused or not, the typed token is dropped here.
    setToken('');
    if (result.ok) {
      onUnlocked();
      return;
    }
    setError(result.message ?? COPY.access.unreachable);
  };

  return (
    <form className="god-form" onSubmit={submit}>
      <p className="god-eyebrow">{COPY.eyebrow}</p>
      <h1 className="god-title">{COPY.title}</h1>
      <p className="god-note">{COPY.access.hint}</p>
      {error ? (
        <p className="god-error" role="alert">
          {error}
        </p>
      ) : null}
      <label htmlFor="god-token">{COPY.access.label}</label>
      <input
        id="god-token"
        type="password"
        value={token}
        onChange={(event) => setToken(event.target.value)}
        autoComplete="off"
        maxLength={256}
        autoFocus
      />
      <button type="submit" className="god-button" disabled={busy || !token.trim()}>
        {busy ? COPY.access.submitting : COPY.access.submit}
      </button>
    </form>
  );
}

function MonthStats({ view }) {
  const c = COPY.now;
  return (
    <dl className="god-grid">
      <Stat term={c.spend} value={formatUsd(view.monthSpendUsd)} />
      <Stat term={c.ticks} value={view.ticks} />
      <Stat term={c.acts} value={view.acts} />
      <Measured
        term={COPY.history.unproductiveUsd}
        value={view.unproductiveUsd}
        format={formatUsd}
      />
    </dl>
  );
}

function TickStats({ tick }) {
  const reached = tick ? ACT_VERDICTS.has(tick.verdict) : false;
  return (
    <>
      <dl className="god-grid">
        <Stat
          term={COPY.fields.verdict}
          value={tick ? label(tick.verdict) : COPY.now.never}
          tone={tick ? verdictTone(tick.verdict) : ''}
        />
        <Stat term={COPY.fields.tier} value={tick ? label(tick.tier) : COPY.fields.unknown} />
        <Stat term={COPY.now.reason} value={tick ? label(tick.gateReason) : COPY.fields.unknown} />
        <Stat
          term={COPY.fields.usd}
          value={tick ? formatUsd(tick.usd) : COPY.fields.unknown}
          tone={tick && !reached && tick.usd > 0 ? 'warn' : ''}
        />
      </dl>
      <p className="god-note">
        {tick ? (reached ? COPY.now.running : COPY.now.idle) : COPY.now.never}
      </p>
    </>
  );
}

function TickLines({ view }) {
  const tick = view.lastTick;
  const unmeasured = isUnmeasured(view.unproductiveActs);
  return (
    <ul className="god-lines">
      <li>
        <b>{COPY.fields.started}</b>
        {tick ? formatUtc(tick.startedAt) : COPY.fields.unknown}
      </li>
      <li>
        <b>{COPY.now.lastAct}</b>
        {view.lastActAt ? formatUtc(view.lastActAt) : COPY.now.noAct}
      </li>
      <li>
        <b>{COPY.fields.narration}</b>
        {label(view.lastActNarration ?? tick?.narration)}
      </li>
      <li>
        <b>{COPY.history.unproductive}</b>
        <span className={unmeasured ? 'is-unmeasured' : undefined}>
          {measuredText(view.unproductiveActs, String)}
        </span>
      </li>
    </ul>
  );
}

function NowTab({ view }) {
  return (
    <section className="god-panel" role="tabpanel">
      <h2 className="god-heading">{COPY.now.heading}</h2>
      <MonthStats view={view} />
      <h3 className="god-subheading">{COPY.now.tickHeading}</h3>
      <TickStats tick={view.lastTick} />
      <TickLines view={view} />
    </section>
  );
}

function HistoryTable({ rows }) {
  return (
    <div className="god-table-wrap">
      <table className="god-table">
        <thead>
          <tr>
            <th>{COPY.fields.started}</th>
            <th>{COPY.fields.verdict}</th>
            <th>{COPY.fields.tier}</th>
            <th>{COPY.now.reason}</th>
            <th>{COPY.fields.usd}</th>
            <th>{COPY.fields.narration}</th>
            <th>{COPY.fields.run}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.runId}>
              <td>{formatUtc(row.startedAt)}</td>
              <td className={`god-verdict is-${verdictTone(row.verdict)}`}>{label(row.verdict)}</td>
              <td>{label(row.tier)}</td>
              <td>{label(row.gateReason)}</td>
              <td className="is-num">{formatUsd(row.usd)}</td>
              <td>{label(row.narration)}</td>
              <td>{label(row.runId)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReasonTally({ tally }) {
  return (
    <>
      <h3 className="god-subheading">{COPY.history.reasonTally}</h3>
      <ul className="god-tally">
        {tally.map((entry) => (
          <li key={entry.reason}>
            <span>{entry.reason}</span>
            <span className="is-num">{entry.count}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function HistoryTab({ view }) {
  const c = COPY.history;
  const rows = Array.isArray(view.recent) ? view.recent : [];
  const tally = Array.isArray(view.reasonTally) ? view.reasonTally : [];
  return (
    <section className="god-panel" role="tabpanel">
      <h2 className="god-heading">{c.heading}</h2>
      {rows.length === 0 ? <p className="god-note">{c.empty}</p> : <HistoryTable rows={rows} />}
      {/* Which the month numbers came from is the difference between "small month" and "truncated
          rollup" — the failure that hid 52 October ticks behind one surviving row. */}
      <p className={`god-note${view.numbersFrom === 'rollupRows' ? ' is-warn' : ''}`}>
        {view.numbersFrom === 'rollupRows' ? c.understated : c.fromRecords}
      </p>
      {tally.length > 0 ? <ReasonTally tally={tally} /> : null}
    </section>
  );
}

function NoDigest({ c }) {
  return (
    <section className="god-panel" role="tabpanel">
      <h2 className="god-heading">{c.heading}</h2>
      <p className="god-note">{c.noDigest}</p>
      <p className="god-note is-warn">{c.blurb}</p>
    </section>
  );
}

function SignalsTab({ view }) {
  const c = COPY.signals;
  const digest = view.lastTick?.digest;
  if (!digest) return <NoDigest c={c} />;

  const observed = (digest.agentTurns ?? 0) + (digest.uxSignals ?? 0);
  const floor = GOD_HARD_LIMITS.minNewSignals;
  const pct = floor > 0 ? Math.min(100, Math.round((observed / floor) * 100)) : 0;
  return (
    <section className="god-panel" role="tabpanel">
      <h2 className="god-heading">{c.heading}</h2>
      <p className="god-note">{c.blurb}</p>
      <dl className="god-grid">
        <Stat term={c.agentTurns} value={digest.agentTurns} />
        <Stat term={c.uxSignals} value={digest.uxSignals} />
        <Stat term={c.sessions} value={digest.sessions} />
        <Stat term={c.findings} value={digest.findings} />
        <Stat
          term={c.sufficient}
          value={digest.sufficient ? c.sufficient : c.notClear}
          tone={digest.sufficient ? 'ok' : 'bad'}
        />
      </dl>
      <p className="god-stamp">
        {observed} / {floor} {c.floor.toLowerCase()}
      </p>
      {/* Zero observed must render zero width: a minimum-width bar would show progress that does not
          exist, which is the one thing this meter is here to make honest. */}
      <div className="god-meter" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}

function SettingsTab() {
  const c = COPY.settings;
  return (
    <section className="god-panel" role="tabpanel">
      <h2 className="god-heading">{c.heading}</h2>
      <h3 className="god-subheading">{c.blockedTitle}</h3>
      <p className="god-note">{c.blockedBody}</p>
      <p className="god-note">{c.defaultsHint}</p>
    </section>
  );
}

function IssueList({ issues }) {
  if (!Array.isArray(issues) || issues.length === 0) return null;
  return (
    <p className="god-issues" role="status">
      {COPY.issuesIntro}: {issues.join(', ')}
    </p>
  );
}

function ReadError({ title, body, role = 'alert', issues, onRetry }) {
  return (
    <section className="god-panel">
      <h1 className="god-title">{title}</h1>
      <p className={role === 'alert' ? 'god-error' : 'god-note'} role={role}>
        {body}
      </p>
      <IssueList issues={issues} />
      {onRetry ? (
        <button type="button" className="god-button" onClick={onRetry}>
          {COPY.refresh}
        </button>
      ) : null}
    </section>
  );
}

function ReadyHeader({ view, onRefresh }) {
  const stale = view.source === 'stale';
  return (
    <div className="god-topline">
      <div>
        <p className="god-eyebrow">{COPY.eyebrow}</p>
        <h1 className="god-title">{COPY.title}</h1>
        <p className="god-subtitle">{COPY.subtitle}</p>
      </div>
      <div className="god-actions">
        <span className={`god-stamp${stale ? ' is-stale' : ''}`}>
          {/* The stamp is the whole defence against reading old numbers as current. */}
          {`${COPY.now.generated} ${formatUtc(view.generatedAt)}`}
          {stale ? ` — ${COPY.now.stale}` : ''}
        </span>
        <button type="button" className="god-button" onClick={onRefresh}>
          {COPY.refresh}
        </button>
      </div>
    </div>
  );
}

function ReadyTabs({ tab, setTab }) {
  return (
    <div className="god-tabs" role="tablist">
      {TABS.map((key) => (
        <button
          key={key}
          type="button"
          role="tab"
          className="god-tab"
          aria-selected={tab === key}
          onClick={() => setTab(key)}
        >
          {COPY.tabs[key]}
        </button>
      ))}
    </div>
  );
}

function ReadyTab({ tab, view }) {
  if (tab === 'history') return <HistoryTab view={view} />;
  if (tab === 'signals') return <SignalsTab view={view} />;
  if (tab === 'settings') return <SettingsTab />;
  return <NowTab view={view} />;
}

/** The five non-ready states, each naming the thing the owner actually has to fix. */
function AccessPanel({ access, view, onRetry }) {
  if (access === GOD_ACCESS.UNAUTHORIZED) {
    return <TokenGate onUnlocked={onRetry} />;
  }
  if (access === GOD_ACCESS.UNCONFIGURED) {
    return (
      <ReadError
        title={COPY.title}
        body={COPY.access.unconfigured}
        role="status"
        issues={view?.issues}
      />
    );
  }
  // Distinct from UNCONFIGURED on purpose: here the token worked and the window is open, so the owner
  // must not be told to go rotate a credential. The failed thing is a GitHub read.
  if (access === GOD_ACCESS.UNREADABLE) {
    return (
      <ReadError
        title={COPY.access.unreadableTitle}
        body={COPY.access.unreadableBody}
        role="status"
        issues={view?.issues}
        onRetry={onRetry}
      />
    );
  }
  return (
    <ReadError title={COPY.title} body={COPY.access.unreachable} role="alert" onRetry={onRetry} />
  );
}

export default function GodWindow() {
  // The store owns the request and React re-renders from the subscription. Two reasons, not style:
  // an effect that sets component state directly is what `react-hooks/set-state-in-effect` warns on,
  // and a slow first read would otherwise be able to overwrite the answer to a newer refresh.
  const { access, view } = useSyncExternalStore(
    subscribeGodWindow,
    getGodWindowSnapshot,
    getGodWindowSnapshot
  );
  const [tab, setTab] = useState('now');

  const refresh = useCallback(() => {
    loadGodStatus();
  }, []);

  // The cold-start gate waits on `archislop:app-ready`, which only the ArchiSlop tree normally fires.
  // Without this the pane paints underneath a "Spinning up the synergy plane…" cover for 45 seconds.
  useEffect(() => {
    markAppReady();
    loadGodStatus();
  }, []);

  // Only the in-flight state shows the stamp. The error states carry no view either, so folding them in
  // here would leave the owner staring at "Reading the branch…" on a 401 that will never resolve.
  if (access === GOD_ACCESS.LOADING) {
    return (
      <Shell>
        <p className="god-stamp" role="status" aria-live="polite">
          {COPY.refreshing}
        </p>
      </Shell>
    );
  }

  if (access !== GOD_ACCESS.OK || !view) {
    return (
      <Shell>
        <AccessPanel access={access} view={view} onRetry={refresh} />
      </Shell>
    );
  }

  return (
    <Shell>
      <ReadyHeader view={view} onRefresh={refresh} />
      <ReadyTabs tab={tab} setTab={setTab} />
      <ReadyTab tab={tab} view={view} />
      <IssueList issues={view.issues} />
      {view.repo ? (
        <p className="god-stamp">
          {view.repo} · {view.branch} · {view.months?.join(' ')}
        </p>
      ) : null}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="god-window">
      <div className="god-shell">{children}</div>
    </div>
  );
}
