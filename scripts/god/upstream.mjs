/**
 * God's paid wallet: which account a run bills, how that account is addressed on the wire, and where
 * to ask it how much money is left (ADR-0019 §5).
 *
 * One module owns all three because they must never disagree. The meter proxy and the gate both come
 * here, so `--upstream` is the only switch an operator touches — a run that bills the gateway while
 * the gate reads a first-party balance would be bounded by a number with nothing to do with its spend.
 *
 * Why profiles exist at all: the harness (`dsh`) speaks the Anthropic Messages shape and the probe
 * server speaks the OpenAI chat shape, and both wallets serve both shapes — at different paths, with
 * different auth headers, under different model ids, and with different support. The runner hands both
 * clients a local proxy, so nothing on the harness side ever learns which wallet is behind it.
 */
import { normalizeLlmModelSlug } from '@archislop/shared/llmCostEstimate.js';

/** Harness and probe-server ids → the rate-table slug each is priced under. */
const MODEL_ALIASES = Object.freeze({
  'deepseek-flash': 'deepseek-v4-flash',
  'deepseek-pro': 'deepseek-v4-pro'
});

export const UPSTREAM_PROFILES = Object.freeze({
  /**
   * The gateway the owner caps from their own dashboard — God's default wallet, deliberately separate
   * from the app's `OPENROUTER_API_KEY` so a drained God budget cannot take Brain down with it.
   *
   * Measured against the live API (2026-10-18): Anthropic-shaped `POST /api/v1/messages` answers with
   * standard `content_block` events and an Anthropic-shaped `usage` object, the OpenAI shape lives at
   * `/api/v1/chat/completions`, and `messages/count_tokens` does not exist — hence the `null` target,
   * which makes the proxy answer that one call itself instead of handing the harness a 404.
   */
  openrouter: Object.freeze({
    name: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    hosts: Object.freeze(['openrouter.ai']),
    keyEnv: 'OPENROUTER_GOD_KEY',
    /** How the Anthropic-shaped wire is authenticated upstream; the chat shape is always Bearer. */
    anthropicAuth: 'bearer',
    /** Gateway slug prefix: the harness sends `deepseek-v4-pro`, the gateway knows the prefixed id. */
    modelPrefix: 'deepseek/',
    /**
     * Client path → upstream path. `null` = no such route upstream, so the proxy answers it locally.
     * Both `/chat/completions` and `/v1/chat/completions` land on one upstream path because the two
     * clients the proxy serves address the same endpoint differently.
     */
    routes: Object.freeze({
      '/anthropic/v1/messages': '/messages',
      '/anthropic/v1/messages/count_tokens': null,
      '/anthropic/v1/models': '/models',
      '/chat/completions': '/chat/completions',
      '/v1/chat/completions': '/chat/completions',
      '/models': '/models',
      '/v1/models': '/models'
    }),
    /** Read-only money endpoints, in the order they are asked. */
    balance: Object.freeze(['/key', '/credits'])
  }),

  /**
   * God's own first-party account: the documented rollback wallet. Its wire is the passthrough the
   * proxy was built against, and any host the profiles do not name keeps this shape — which is what
   * lets the test fixtures stand in for it on `127.0.0.1` without a profile entry of their own.
   */
  deepseek: Object.freeze({
    name: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    hosts: Object.freeze(['api.deepseek.com', 'deepseek.com']),
    keyEnv: 'GOD_DEEPSEEK_API_KEY',
    anthropicAuth: 'x-api-key',
    modelPrefix: null,
    routes: null,
    balance: Object.freeze(['/user/balance'])
  })
});

/** The wallet a run bills when nothing names one. */
export const DEFAULT_UPSTREAM = UPSTREAM_PROFILES.openrouter.baseUrl;

/**
 * Which wallet this invocation bills: the explicit flag, then `GOD_UPSTREAM`, then the default.
 * Three separate rungs (gate, probe, act) must agree on the answer, so they all call this rather than
 * each reading one of the two sources it happens to care about.
 *
 * @param {string | undefined} raw the `--upstream` value, if any
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveWallet(raw, env = process.env) {
  const flag = String(raw ?? '').trim();
  if (flag) return flag;
  const configured = String(env.GOD_UPSTREAM ?? '').trim();
  return configured || DEFAULT_UPSTREAM;
}

/**
 * Profiles are keyed by name and picked by host, so a rollback is a URL and not a code edit.
 *
 * @param {string | undefined} raw a profile name or an upstream URL; unset means the default wallet
 */
export function resolveUpstreamProfile(raw) {
  const value = String(raw ?? '').trim();
  if (UPSTREAM_PROFILES[value]) return UPSTREAM_PROFILES[value];
  let host = null;
  try {
    host = new URL(value || DEFAULT_UPSTREAM).hostname;
  } catch {
    host = null;
  }
  if (host) {
    for (const profile of Object.values(UPSTREAM_PROFILES)) {
      if (profile.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return profile;
    }
  }
  return UPSTREAM_PROFILES.deepseek;
}

/** The origin to dial: an explicit URL wins, a profile name resolves to its published one. */
export function upstreamBaseUrl(profile, raw) {
  const value = String(raw ?? '').trim();
  if (!value || UPSTREAM_PROFILES[value]) return (UPSTREAM_PROFILES[value] ?? profile).baseUrl;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return profile.baseUrl;
  }
}

/**
 * Where a client-facing route lives upstream: `undefined` when the profile does not serve it at all
 * (refuse it), `null` when the wallet has no such route (answer it locally, metered as nothing).
 */
export function upstreamPathFor(profile, clientPath) {
  if (!profile.routes) return clientPath;
  return Object.prototype.hasOwnProperty.call(profile.routes, clientPath)
    ? profile.routes[clientPath]
    : undefined;
}

/** The id the request is allowlisted and priced under, whichever shape it arrived in. */
export function canonicalModelId(model) {
  const slug = normalizeLlmModelSlug(String(model ?? ''));
  return MODEL_ALIASES[slug] ?? slug;
}

/**
 * The id to put on the wire. A first-party wallet is served untouched — what the harness asked for is
 * what it gets — because only the gateway needs a publisher prefix, and rewriting the id on the
 * rollback path would silently change a wire that is otherwise frozen.
 */
export function upstreamModelId(profile, model) {
  const raw = String(model ?? '');
  if (!profile.modelPrefix) return raw;
  const id = canonicalModelId(raw);
  return id.includes('/') ? id : `${profile.modelPrefix}${id}`;
}

/**
 * Fix up the request for the wallet being billed, in place.
 *
 * The probe server runs the product's real DeepSeek lane, which asks for reasoning to be off with
 * DeepSeek's own `thinking` field. Measured on the live gateway (2026-10-18): that field is accepted
 * and **ignored** — the model thinks anyway and the run pays for it, so the probe would be measuring
 * a behaviour production does not have. `reasoning: {enabled:false}` is the gateway's spelling of the
 * same instruction and it works (about 4x cheaper on the same prompt). Translating here keeps the
 * intent of the lane being measured instead of silently changing it.
 *
 * Only an explicit disable is rewritten: a request that did not ask to switch thinking off is left
 * exactly as it arrived, so the harness keeps its reasoning by default.
 *
 * @param {object} profile
 * @param {'anthropic' | 'openai'} family
 * @param {Record<string, unknown>} body
 */
export function adaptBodyForWallet(profile, family, body) {
  if (!profile.modelPrefix || family !== 'openai') return;
  const thinking = body.thinking;
  if (!thinking || typeof thinking !== 'object' || thinking.type !== 'disabled') return;
  delete body.thinking;
  body.reasoning = { ...(body.reasoning ?? {}), enabled: false };
}

function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * The God key for a wallet, from the environment the CLI already loaded.
 *
 * The runner never puts this in the harness's environment: `dsh` gets the meter proxy's per-run
 * token. An env fallback exists for local runs, where `--key-file` would otherwise force a tempfile;
 * in CI the key is still staged as a file the proxy reads and deletes.
 */
export function keyFromEnv(profile, env = process.env) {
  const value = env[profile.keyEnv];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * The credentials a rung should hand the meter proxy, from whichever source the caller supplied.
 *
 * `--key-file` is the CI path: the workflow writes the secret to a file the proxy reads and deletes,
 * so the key never sits in a step's environment. Locally the same value may simply live in the
 * wallet's own env var, which is what `--env-file=.env` gives an operator. Both paths end at the same
 * proxy; neither ever puts the key in the harness's environment, because the harness only sees the
 * proxy's per-run token.
 *
 * @param {{ wallet?: string, keyFile?: string, apiKey?: string, env?: NodeJS.ProcessEnv }} o
 */
export function resolveGodKey({ wallet, keyFile, apiKey, env = process.env } = {}) {
  if (keyFile || apiKey) return { keyFile, apiKey };
  const resolved = resolveWallet(wallet, env);
  const profile = resolveUpstreamProfile(resolved);
  const fromEnv = keyFromEnv(profile, env);
  if (!fromEnv) {
    throw new Error(
      `no God key for the ${profile.label} wallet: pass --key-file or set ${profile.keyEnv}`
    );
  }
  return { apiKey: fromEnv };
}

/**
 * Money left in the wallet, which is what `GOD_HARD_LIMITS.minBalanceUsd` is measured against.
 *
 * The binding figure is the **smallest** number the gateway will admit to, because any of the three
 * can run out first: the per-key cap the owner set on God's key, an organisational budget that
 * resets on its own schedule, and the prepaid credit balance. A key with no cap reports
 * `limit: null` — uncapped, not free — so it contributes no candidate.
 *
 * @param {string | undefined} rawWallet profile name or URL
 * @param {string | null | undefined} key
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, baseUrl?: string, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {Promise<number | null>} USD left, or null when the wallet would not say (the gate proceeds
 *   — the per-run and monthly caps are still the limit)
 */
export async function fetchUpstreamBalanceUsd(rawWallet, key, opts = {}) {
  const profile = UPSTREAM_PROFILES[rawWallet] ?? resolveUpstreamProfile(rawWallet);
  const secret = key ?? keyFromEnv(profile, opts.env ?? process.env);
  if (!secret) return null;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl ?? upstreamBaseUrl(profile, rawWallet);
  const candidates = [];

  for (const path of profile.balance) {
    let data = null;
    try {
      const res = await fetchImpl(`${base}${path}`, {
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000)
      });
      if (!res.ok) continue;
      const body = await res.json();
      data = body && typeof body === 'object' ? (body.data ?? body) : null;
    } catch {
      continue;
    }
    if (!data || typeof data !== 'object') continue;

    if (path === '/key') {
      if (data.limit != null) {
        const left = finiteOrNull(data.limit_remaining);
        if (left != null) candidates.push(left);
      }
      for (const budget of Array.isArray(data.budgets) ? data.budgets : []) {
        const left = finiteOrNull(budget?.remaining_usd);
        if (left != null) candidates.push(left);
      }
    } else if (path === '/credits') {
      const credits = finiteOrNull(data.total_credits);
      const used = finiteOrNull(data.total_usage);
      if (credits != null && used != null) candidates.push(credits - used);
    } else if (path === '/user/balance') {
      const infos = Array.isArray(data.balance_infos) ? data.balance_infos : [];
      const usd = infos.find((i) => String(i?.currency ?? '').toUpperCase() === 'USD');
      // CNY-only accounts stay unknown rather than inventing an FX rate.
      const total = finiteOrNull(usd?.total_balance ?? usd?.balance);
      if (total != null) candidates.push(total);
    }
  }

  if (!candidates.length) return null;
  return Math.round(Math.min(...candidates) * 1e6) / 1e6;
}
