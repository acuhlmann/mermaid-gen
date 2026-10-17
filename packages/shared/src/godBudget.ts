/**
 * ArchiSlop God's money-and-time policy (ADR-0019), as pure functions. The hard limits here bound
 * every setting the owner can change from the God window — and every value a compromised server
 * could write to the repo variables — so this file sits in `routine-guard`'s `ALWAYS_FORBIDDEN`:
 * no routine, God included, may edit the ceiling it runs under.
 *
 * `decideGodRun` is shared by the workflow gate (`scripts/god/`) and the server's status view, so
 * "why isn't God running?" has exactly one answer.
 */
import {
  GOD_TIERS,
  GodTierSchema,
  GodWindowUtcSchema,
  type GodConfig,
  type GodGateReason,
  type GodTier
} from './godSchemas.js';

export const GOD_HARD_LIMITS = Object.freeze({
  minEveryHours: 1,
  maxEveryHours: 168,
  minMinutes: 10,
  maxMinutes: 90,
  minUsdPerRun: 0.05,
  maxUsdPerRun: 5,
  maxUsdPerMonth: 100,
  /** Below this a run cannot do useful work; the gate waits for a top-up. */
  minBalanceUsd: 0.1,
  /** Fewer new signals than this since the last run is noise, not evidence. */
  minNewSignals: 30,
  /** An hourly tick lands a few seconds either side of the due time; don't lose an hour to it. */
  dueSlackMinutes: 10
});

export const GOD_CONFIG_DEFAULTS: Readonly<GodConfig> = Object.freeze({
  enabled: false,
  autonomy: 'propose',
  everyHours: 24,
  windowUtc: '06-12',
  maxMinutes: 45,
  maxUsdPerRun: 1,
  maxUsdPerMonth: 20
});

/** GitHub Actions repository variable that stores each setting. */
export const GOD_CONFIG_VARIABLES = Object.freeze({
  enabled: 'GOD_ENABLED',
  autonomy: 'GOD_AUTONOMY',
  everyHours: 'GOD_EVERY_HOURS',
  windowUtc: 'GOD_WINDOW_UTC',
  maxMinutes: 'GOD_MAX_MINUTES',
  maxUsdPerRun: 'GOD_MAX_USD_PER_RUN',
  maxUsdPerMonth: 'GOD_MAX_USD_PER_MONTH'
} as const satisfies Record<keyof GodConfig, string>);

export type GodWindow = { startHour: number; endHour: number };

/** Parse `HH-HH` (start inclusive, end exclusive). Equal ends are an empty window → null. */
export function parseGodWindow(raw: unknown): GodWindow | null {
  if (!GodWindowUtcSchema.safeParse(raw).success) return null;
  const [start, end] = String(raw).split('-').map(Number);
  if (start === end) return null;
  return { startHour: start, endHour: end };
}

/** Whether a UTC hour (0–23) falls inside the window; `22-04` wraps midnight. */
export function isHourInGodWindow(hourUtc: number, windowUtc: unknown): boolean {
  const window = parseGodWindow(windowUtc);
  if (!window || !Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) return false;
  const { startHour, endHour } = window;
  if (startHour < endHour) return hourUtc >= startHour && hourUtc < endHour;
  return hourUtc >= startHour || hourUtc < endHour;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampUsd(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const cents = Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;
  return Math.max(min, cents);
}

/**
 * Coerce anything into a valid config: each well-typed field is clamped to the hard limits, each
 * missing or malformed one falls back to its default. Never throws.
 */
export function clampGodConfig(input: unknown): GodConfig {
  const src: Record<string, unknown> =
    input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const d = GOD_CONFIG_DEFAULTS;
  const L = GOD_HARD_LIMITS;
  const maxUsdPerMonth = clampUsd(
    src.maxUsdPerMonth,
    L.minUsdPerRun,
    L.maxUsdPerMonth,
    d.maxUsdPerMonth
  );
  const maxUsdPerRun = Math.min(
    clampUsd(src.maxUsdPerRun, L.minUsdPerRun, L.maxUsdPerRun, d.maxUsdPerRun),
    maxUsdPerMonth
  );
  const autonomy = GodTierSchema.safeParse(src.autonomy);
  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : d.enabled,
    autonomy: autonomy.success ? autonomy.data : d.autonomy,
    everyHours: clampInt(src.everyHours, L.minEveryHours, L.maxEveryHours, d.everyHours),
    windowUtc: parseGodWindow(src.windowUtc) ? String(src.windowUtc) : d.windowUtc,
    maxMinutes: clampInt(src.maxMinutes, L.minMinutes, L.maxMinutes, d.maxMinutes),
    maxUsdPerRun,
    maxUsdPerMonth
  };
}

function parseBoolVar(raw: string | undefined): boolean | undefined {
  if (raw == null) return undefined;
  const s = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return undefined;
}

function parseNumberVar(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : undefined;
}

/** Read the config from GitHub repository variables (all strings, any may be unset). */
export function readGodConfigFromVars(vars: Record<string, string | undefined>): GodConfig {
  const v = (key: keyof GodConfig) => vars[GOD_CONFIG_VARIABLES[key]];
  return clampGodConfig({
    enabled: parseBoolVar(v('enabled')),
    autonomy: v('autonomy')?.trim().toLowerCase(),
    everyHours: parseNumberVar(v('everyHours')),
    windowUtc: v('windowUtc')?.trim(),
    maxMinutes: parseNumberVar(v('maxMinutes')),
    maxUsdPerRun: parseNumberVar(v('maxUsdPerRun')),
    maxUsdPerMonth: parseNumberVar(v('maxUsdPerMonth'))
  });
}

/** The inverse of `readGodConfigFromVars`, for writing settings back. */
export function godConfigToVars(config: GodConfig): Record<string, string> {
  const safe = clampGodConfig(config);
  return {
    [GOD_CONFIG_VARIABLES.enabled]: String(safe.enabled),
    [GOD_CONFIG_VARIABLES.autonomy]: safe.autonomy,
    [GOD_CONFIG_VARIABLES.everyHours]: String(safe.everyHours),
    [GOD_CONFIG_VARIABLES.windowUtc]: safe.windowUtc,
    [GOD_CONFIG_VARIABLES.maxMinutes]: String(safe.maxMinutes),
    [GOD_CONFIG_VARIABLES.maxUsdPerRun]: String(safe.maxUsdPerRun),
    [GOD_CONFIG_VARIABLES.maxUsdPerMonth]: String(safe.maxUsdPerMonth)
  };
}

/** The less autonomous of two tiers. A dispatch may lower the configured tier, never raise it. */
export function lowerGodTier(configured: GodTier, requested: GodTier | null | undefined): GodTier {
  if (!requested) return configured;
  return GOD_TIERS.indexOf(requested) < GOD_TIERS.indexOf(configured) ? requested : configured;
}

/**
 * Derived, not hand-listed: `GodGateReasonSchema` is what `recordTick.mjs` will accept into the
 * durable store, so a reason this file invented but the schema did not list would be dropped at
 * record time — invisible except as a tick that recorded no reason.
 */
export type GodDecisionReason = GodGateReason;

export type GodRunDecisionInput = {
  config: GodConfig;
  now: Date | number;
  /** Start of the last run that reached `act`, epoch ms; null if God has never acted. */
  lastActAt: number | null;
  /** Open PRs carrying God's title or branch prefix. */
  openGodPrs: number;
  /** DeepSeek balance in USD; null when unknown (the gate proceeds — the balance is still the cap). */
  balanceUsd: number | null;
  /** Spend recorded this UTC month. */
  monthSpendUsd: number;
  /** Signals since the last act; null when unknown. */
  newSignals: number | null;
  /** Owner pressed "Run now": skips the window, the cadence and the signal floor — never a cap. */
  force?: boolean;
  /** A dispatch's tier, which can only lower the configured one. */
  requestedTier?: GodTier | null;
};

export type GodRunDecision = {
  go: boolean;
  reason: GodDecisionReason;
  tier: GodTier;
  maxMinutes: number;
  /** The per-run cap, shrunk to what is left of the month. */
  maxUsd: number;
  /** When the cadence next allows a run (ISO), or null if it already does. */
  nextDueAt: string | null;
};

/** Stops no "Run now" gets past: the kill switch, one open PR, and money. */
function absoluteStop(
  input: GodRunDecisionInput,
  config: GodConfig,
  maxUsd: number
): GodDecisionReason | null {
  if (!config.enabled) return 'disabled';
  if (input.openGodPrs > 0) return 'open_pr';
  if (maxUsd < GOD_HARD_LIMITS.minUsdPerRun) return 'month_cap';
  if (input.balanceUsd != null && input.balanceUsd < GOD_HARD_LIMITS.minBalanceUsd) {
    return 'balance_low';
  }
  return null;
}

/** Stops the owner's "Run now" skips: the window, the cadence and the signal floor. */
function scheduleStop(
  input: GodRunDecisionInput,
  config: GodConfig,
  nowMs: number,
  nextDueAt: string | null
): GodDecisionReason | null {
  if (!isHourInGodWindow(new Date(nowMs).getUTCHours(), config.windowUtc)) return 'outside_window';
  if (nextDueAt) return 'not_due';
  if (input.newSignals != null && input.newSignals < GOD_HARD_LIMITS.minNewSignals) {
    return 'insufficient_signals';
  }
  return null;
}

function computeNextDueAt(
  lastActAt: number | null,
  everyHours: number,
  nowMs: number
): string | null {
  if (lastActAt == null) return null;
  const dueAtMs = lastActAt + everyHours * 3_600_000 - GOD_HARD_LIMITS.dueSlackMinutes * 60_000;
  return dueAtMs > nowMs ? new Date(dueAtMs).toISOString() : null;
}

export function decideGodRun(input: GodRunDecisionInput): GodRunDecision {
  const config = clampGodConfig(input.config);
  const nowMs = input.now instanceof Date ? input.now.getTime() : Number(input.now);
  const spent = Math.max(0, input.monthSpendUsd || 0);
  const remainingMonth = Math.max(0, config.maxUsdPerMonth - spent);
  const maxUsd = Math.round(Math.min(config.maxUsdPerRun, remainingMonth) * 100) / 100;
  const nextDueAt = computeNextDueAt(input.lastActAt, config.everyHours, nowMs);

  const reason =
    absoluteStop(input, config, maxUsd) ??
    (input.force === true ? null : scheduleStop(input, config, nowMs, nextDueAt)) ??
    'go';
  return {
    go: reason === 'go',
    reason,
    tier: lowerGodTier(config.autonomy, input.requestedTier),
    maxMinutes: config.maxMinutes,
    maxUsd,
    nextDueAt
  };
}
