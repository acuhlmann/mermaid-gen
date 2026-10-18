/**
 * Local metering proxy between a coding harness and God's paid wallet (ADR-0019).
 *
 * The harness gets a base URL on 127.0.0.1 and a per-run token instead of the real key; this proxy
 * holds the key (read from a file it deletes at start), forwards only an allowlist of model routes,
 * strips request fields it does not recognise, prices every response from its reported usage with
 * the shared rate table, and answers HTTP 402 once the run has spent its cap. It exists because
 * DeepSeek Harness has no cost limit of its own and its DeepSeek adapter attaches a
 * `dsh_session_log` field (the whole session, tool results included) to every request unless the
 * plugin is switched off — the field allowlist removes it even if that switch fails.
 *
 * Both wire formats are understood: the Anthropic Messages shape dsh uses (`/anthropic/v1/messages`,
 * `x-api-key`) and the OpenAI chat shape (`/chat/completions`, Bearer). Which upstream path, auth
 * header and model id belong to that wire is the profile's business (see `upstream.mjs`), so a run
 * can be re-pointed from the gateway wallet to the first-party account with one flag. The cap itself
 * is priced from the shared rate table — never from whatever the upstream says it cost, because a
 * number the payer computes is not a limit on the payer. What the gateway reported is recorded
 * beside it (`gatewayUsd`) so the owner can compare the estimate against the invoice.
 *
 * Overshoot is bounded by the requests already in flight when the cap is crossed.
 */
import http from 'node:http';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import {
  estimateLlmCostUsd,
  mergeLlmTokenRates,
  resolveLlmTokenRates
} from '@archislop/shared/llmCostEstimate.js';
import {
  DEFAULT_UPSTREAM,
  UPSTREAM_PROFILES,
  adaptBodyForWallet,
  canonicalModelId,
  resolveUpstreamProfile,
  upstreamBaseUrl,
  upstreamModelId,
  upstreamPathFor
} from './upstream.mjs';

export const DEFAULT_ALLOWED_MODELS = Object.freeze([
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'deepseek-flash'
]);

/** Every route the proxy understands. Anything else is a 404 and is reported. */
const ROUTES = Object.freeze([
  { method: 'POST', path: '/anthropic/v1/messages', family: 'anthropic', metered: true },
  {
    method: 'POST',
    path: '/anthropic/v1/messages/count_tokens',
    family: 'anthropic',
    metered: false,
    /** The one route a wallet may not serve: the proxy answers it from the request size. */
    localEstimate: true
  },
  { method: 'GET', path: '/anthropic/v1/models', family: 'anthropic', metered: false },
  { method: 'POST', path: '/chat/completions', family: 'openai', metered: true },
  { method: 'POST', path: '/v1/chat/completions', family: 'openai', metered: true },
  { method: 'GET', path: '/models', family: 'openai', metered: false },
  { method: 'GET', path: '/v1/models', family: 'openai', metered: false }
]);

const REQUEST_FIELDS = Object.freeze({
  anthropic: new Set([
    'model',
    'messages',
    'system',
    'max_tokens',
    'stop_sequences',
    'stream',
    'temperature',
    'top_p',
    'tools',
    'tool_choice',
    'thinking',
    'output_config'
  ]),
  openai: new Set([
    'model',
    'messages',
    'tools',
    'tool_choice',
    'temperature',
    'top_p',
    'max_tokens',
    'max_completion_tokens',
    'stream',
    'stream_options',
    'stop',
    'response_format',
    'frequency_penalty',
    'presence_penalty',
    'logprobs',
    'top_logprobs',
    'thinking',
    'reasoning_effort',
    'parallel_tool_calls'
  ])
});

/** A full 1M-token context is ~4 MB of JSON; anything beyond this is not a model request. */
const MAX_REQUEST_BYTES = 64 * 1024 * 1024;
/** When a response carries no usage we still charge something: this many output tokens. */
const UNMETERED_OUTPUT_TOKENS = 8192;

function sendJson(res, status, body) {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function errorBody(type, message) {
  return { type: 'error', error: { type, message } };
}

function readClientToken(req) {
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string' && apiKey) return apiKey;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length);
  return null;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new Error('request too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Accumulates usage from either wire format. Streaming totals are cumulative, so each field keeps
 * the largest value seen.
 */
export function createUsageTracker() {
  const seen = {};
  const take = (key, value) => {
    const n = finiteOrNull(value);
    if (n != null) seen[key] = Math.max(seen[key] ?? 0, n);
  };
  const feedUsage = (usage) => {
    if (!usage || typeof usage !== 'object') return;
    for (const key of [
      'input_tokens',
      'output_tokens',
      'cache_read_input_tokens',
      'cache_creation_input_tokens',
      'prompt_tokens',
      'completion_tokens',
      'prompt_cache_hit_tokens',
      'cost'
    ]) {
      take(key, usage[key]);
    }
    // A gateway reports cached input nested instead of as a sibling field.
    take('cached_tokens', usage.prompt_tokens_details?.cached_tokens);
  };
  return {
    feed(event) {
      if (!event || typeof event !== 'object') return;
      if (event.type === 'message_start') feedUsage(event.message?.usage);
      else feedUsage(event.usage);
    },
    /** Normalised usage: total input (cache hits included), the cached part, and output. */
    result() {
      if (seen.prompt_tokens != null || seen.completion_tokens != null) {
        return {
          inputTokens: seen.prompt_tokens ?? 0,
          cacheHitTokens: Math.max(seen.prompt_cache_hit_tokens ?? 0, seen.cached_tokens ?? 0),
          outputTokens: seen.completion_tokens ?? 0
        };
      }
      if (seen.input_tokens != null || seen.output_tokens != null) {
        // Anthropic counts cache reads outside `input_tokens`; add them back. If DeepSeek's
        // emulation already includes them, this over-counts — the safe direction for a cap.
        const cacheRead = seen.cache_read_input_tokens ?? 0;
        return {
          inputTokens:
            (seen.input_tokens ?? 0) + cacheRead + (seen.cache_creation_input_tokens ?? 0),
          cacheHitTokens: Math.max(cacheRead, seen.prompt_cache_hit_tokens ?? 0),
          outputTokens: seen.output_tokens ?? 0
        };
      }
      return null;
    },
    /**
     * What the wallet itself says this response cost, in USD, or null when it did not say. Kept out
     * of `result()` so the token shape stays the contract the run record is built from: this number
     * is the invoice, and when it exists it is a better bound on spend than any rate table.
     */
    gatewayUsd() {
      return seen.cost ?? null;
    }
  };
}

/** Feed every complete `data:` line of an SSE text stream to `onData`; return the unfinished tail. */
export function drainSseLines(buffer, onData) {
  const lines = buffer.split('\n');
  const tail = lines.pop() ?? '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice('data:'.length).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      onData(JSON.parse(payload));
    } catch {
      // A malformed line is the upstream's problem; usage simply stays unknown for it.
    }
  }
  return tail;
}

function pricingModel(model, rates) {
  const slug = canonicalModelId(model);
  // An id the table does not know is priced as Pro: the most expensive model the proxy allows.
  return resolveLlmTokenRates(slug, rates) ? slug : 'deepseek-v4-pro';
}

function readKey({ apiKey, keyFile }) {
  if (apiKey) return String(apiKey).trim();
  if (!keyFile) throw new Error('meterProxy: pass apiKey or keyFile');
  const key = fs.readFileSync(keyFile, 'utf8').trim();
  fs.rmSync(keyFile, { force: true });
  if (!key) throw new Error('meterProxy: key file was empty');
  return key;
}

/**
 * @param {{
 *   apiKey?: string,
 *   keyFile?: string,
 *   upstream?: string,
 *   upstreamProfile?: 'openrouter' | 'deepseek',
 *   clientToken?: string,
 *   maxUsd: number,
 *   allowedModels?: readonly string[],
 *   rates?: Record<string, import('@archislop/shared/llmCostEstimate.js').LlmTokenRates>,
 *   env?: NodeJS.ProcessEnv,
 *   onEvent?: (event: Record<string, unknown>) => void,
 *   fetchImpl?: typeof fetch,
 *   requestTimeoutMs?: number
 * }} options
 */
export async function startMeterProxy(options) {
  const key = readKey(options);
  // An explicit profile wins over the host, because a test's `127.0.0.1` stand-in for a gateway has
  // no way to announce itself by hostname — and the base URL still comes from `--upstream`.
  const wallet = options.upstream ?? DEFAULT_UPSTREAM;
  const profile = options.upstreamProfile
    ? (UPSTREAM_PROFILES[options.upstreamProfile] ?? resolveUpstreamProfile(wallet))
    : resolveUpstreamProfile(wallet);
  const upstream = upstreamBaseUrl(profile, wallet);
  const clientToken = options.clientToken ?? `god-${randomBytes(24).toString('hex')}`;
  const maxUsd = Number(options.maxUsd);
  if (!(maxUsd > 0)) throw new Error('meterProxy: maxUsd must be positive');
  const allowedModels = new Set(
    (options.allowedModels ?? DEFAULT_ALLOWED_MODELS).map(canonicalModelId)
  );
  // A caller may pass its env to price from `LLM_COST_USD_PER_M_*` overrides for the wallet actually
  // being billed; unset (tests, and anything wanting the shipped sheet) means the bundled table.
  const rates = options.rates ?? mergeLlmTokenRates(options.env ?? {});
  const onEvent = options.onEvent ?? (() => {});
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestTimeoutMs = options.requestTimeoutMs ?? 15 * 60_000;

  const state = {
    calls: 0,
    unmeteredCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheHitTokens: 0,
    usd: 0,
    /** What the wallet itself said each response cost, summed: the invoice beside the estimate. */
    gatewayUsd: 0,
    gatewayCalls: 0,
    estimatedUsd: 0,
    /** Times the proxy answered `count_tokens` itself because the wallet has no such route. */
    localCountTokens: 0,
    stopReason: null,
    models: new Set(),
    blocked: [],
    strippedFields: new Set()
  };

  const charge = (model, usage, requestBytes, gatewayUsd) => {
    const metered = usage ?? {
      inputTokens: Math.ceil(requestBytes / 3),
      cacheHitTokens: 0,
      outputTokens: UNMETERED_OUTPUT_TOKENS
    };
    if (!usage) state.unmeteredCalls += 1;
    const estimate =
      estimateLlmCostUsd({
        inputTokens: metered.inputTokens,
        cacheHitInputTokens: metered.cacheHitTokens,
        outputTokens: metered.outputTokens,
        model: pricingModel(model, rates),
        rates
      }) ?? 0;
    // The wallet's own number wins when it names a price. The rate table cannot stand in for a gateway
    // price: model ids normalize to the publisher's tail (`deepseek/deepseek-v4-pro` and
    // `deepseek-v4-pro` are the same key), so the only price the table knows is the first-party list —
    // which for this model is roughly double what the gateway charges. Charging that would quietly
    // halve the budget the owner set.
    //
    // A reported price of zero is not believed, though: `cost: 0` is what a wallet says when the money
    // is going somewhere else (a bring-your-own-key link), and treating that as free would leave the
    // cap open on exactly the spend it exists to bound. Such a call falls back to the estimate.
    const usd = gatewayUsd != null && gatewayUsd > 0 ? gatewayUsd : estimate;
    state.calls += 1;
    state.inputTokens += metered.inputTokens;
    state.outputTokens += metered.outputTokens;
    state.cacheHitTokens += metered.cacheHitTokens;
    state.usd += usd;
    state.estimatedUsd += estimate;
    state.models.add(model);
    if (gatewayUsd != null) {
      state.gatewayUsd += gatewayUsd;
      state.gatewayCalls += 1;
    }
    onEvent({
      type: 'model',
      model,
      ...metered,
      usd,
      totalUsd: state.usd,
      metered: Boolean(usage),
      gatewayUsd,
      totalGatewayUsd: state.gatewayUsd
    });
  };

  const sanitizeBody = (route, raw) => {
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
    const allowed = REQUEST_FIELDS[route.family];
    for (const field of Object.keys(body)) {
      if (allowed.has(field)) continue;
      delete body[field];
      if (!state.strippedFields.has(field)) {
        state.strippedFields.add(field);
        onEvent({ type: 'stripped', field });
      }
    }
    if (route.family === 'openai' && body.stream === true) {
      body.stream_options = { ...(body.stream_options ?? {}), include_usage: true };
    }
    adaptBodyForWallet(profile, route.family, body);
    return body;
  };

  const upstreamHeaders = (route, req) => {
    const headers = { 'content-type': 'application/json', accept: req.headers.accept ?? '*/*' };
    if (route.family === 'anthropic' && profile.anthropicAuth === 'x-api-key') {
      headers['x-api-key'] = key;
      if (typeof req.headers['anthropic-version'] === 'string') {
        headers['anthropic-version'] = req.headers['anthropic-version'];
      }
    } else {
      headers.authorization = `Bearer ${key}`;
    }
    return headers;
  };

  const relay = async (route, targetPath, req, res, payload) => {
    const response = await fetchImpl(`${upstream}${targetPath}`, {
      method: route.method,
      headers: upstreamHeaders(route, req),
      body: payload,
      signal: AbortSignal.timeout(requestTimeoutMs)
    });
    if (response.status === 402) {
      state.stopReason ??= 'balance';
      onEvent({ type: 'balance' });
    }
    const contentType = response.headers.get('content-type') ?? 'application/json';
    res.writeHead(response.status, { 'content-type': contentType });
    const tracker = createUsageTracker();
    if (contentType.includes('text/event-stream') && response.body) {
      const decoder = new TextDecoder();
      let buffer = '';
      for await (const chunk of response.body) {
        res.write(chunk);
        buffer = drainSseLines(buffer + decoder.decode(chunk, { stream: true }), (event) =>
          tracker.feed(event)
        );
      }
      drainSseLines(`${buffer}\n`, (event) => tracker.feed(event));
      res.end();
    } else {
      const text = await response.text();
      res.end(text);
      try {
        tracker.feed(JSON.parse(text));
      } catch {
        // Not JSON: no usage to read.
      }
    }
    return { ok: response.ok, usage: tracker.result(), gatewayUsd: tracker.gatewayUsd() };
  };

  const handle = async (req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://proxy.invalid').pathname;
    const route = ROUTES.find((r) => r.method === req.method && r.path === pathname);
    if (!route) {
      state.blocked.push(`${req.method} ${pathname}`.slice(0, 160));
      onEvent({ type: 'blocked', method: req.method, path: pathname });
      sendJson(res, 404, errorBody('not_found', 'route not allowed by the God meter proxy'));
      return;
    }
    if (readClientToken(req) !== clientToken) {
      sendJson(res, 401, errorBody('authentication_error', 'unknown client token'));
      return;
    }
    if (route.metered && state.usd >= maxUsd) {
      if (!state.stopReason) {
        state.stopReason = 'budget';
        onEvent({ type: 'budget', usd: state.usd, maxUsd });
      }
      sendJson(res, 402, errorBody('budget_exhausted', 'ArchiSlop God per-run budget exhausted'));
      return;
    }
    // Where this route lives on the wallet now being billed: a path, or `null` when the wallet has no
    // such route and the proxy answers it itself.
    const targetPath = upstreamPathFor(profile, route.path);
    if (targetPath === undefined) {
      state.blocked.push(`${req.method} ${pathname}`.slice(0, 160));
      onEvent({ type: 'blocked', method: req.method, path: pathname });
      sendJson(
        res,
        404,
        errorBody('not_found', `${profile.label} does not serve this route for God`)
      );
      return;
    }

    let payload;
    let model = null;
    let requestBytes = 0;
    if (route.method === 'POST') {
      const raw = await readBody(req);
      requestBytes = Buffer.byteLength(raw);
      let body;
      try {
        body = sanitizeBody(route, raw);
      } catch {
        sendJson(
          res,
          400,
          errorBody('invalid_request_error', 'request body must be a JSON object')
        );
        return;
      }
      model = typeof body.model === 'string' ? body.model : null;
      if (route.metered && (!model || !allowedModels.has(canonicalModelId(model)))) {
        sendJson(res, 400, errorBody('invalid_request_error', 'model not allowed for this run'));
        return;
      }
      // The id the run asked for is the id that is priced and reported; only the wire gets the
      // gateway's prefixed slug. Reversing that would make the spike's `model_honoured` check read
      // back an id nobody configured.
      if (model) body.model = upstreamModelId(profile, model);
      payload = JSON.stringify(body);
    }

    if (targetPath === null) {
      if (!route.localEstimate) {
        sendJson(res, 404, errorBody('not_found', `${profile.label} does not serve this route`));
        return;
      }
      // A token count is a context-budgeting hint, not money: answer it here rather than hand the
      // harness a 404 it cannot plan around. ~4 bytes per token is the usual rough divisor.
      state.localCountTokens += 1;
      onEvent({ type: 'count_tokens', bytes: requestBytes });
      sendJson(res, 200, { input_tokens: Math.max(1, Math.ceil(requestBytes / 4)) });
      return;
    }

    const { ok, usage, gatewayUsd } = await relay(route, targetPath, req, res, payload);
    if (route.metered && (ok || usage)) charge(model, usage, requestBytes, gatewayUsd);
  };

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      onEvent({ type: 'upstream_error', message: String(error?.message ?? error).slice(0, 200) });
      sendJson(res, 502, errorBody('api_error', 'upstream request failed'));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    port,
    /** Origin to hand an OpenAI-format client. */
    baseUrl: `http://127.0.0.1:${port}`,
    /** Base URL for dsh's DeepSeek adapter (Anthropic format). */
    anthropicBaseUrl: `http://127.0.0.1:${port}/anthropic`,
    /** Which wallet this run bills, and where the proxy dials it. Recorded, never secret. */
    wallet: { profile: profile.name, label: profile.label, upstream },
    clientToken,
    usage() {
      return {
        calls: state.calls,
        unmeteredCalls: state.unmeteredCalls,
        inputTokens: state.inputTokens,
        outputTokens: state.outputTokens,
        cacheHitTokens: state.cacheHitTokens,
        usd: Math.round(state.usd * 1e6) / 1e6,
        /** The rate-table total, kept beside the charged one so the estimate stays auditable. */
        estimatedUsd: Math.round(state.estimatedUsd * 1e6) / 1e6,
        gatewayUsd: Math.round(state.gatewayUsd * 1e6) / 1e6,
        gatewayCalls: state.gatewayCalls,
        localCountTokens: state.localCountTokens,
        models: [...state.models],
        blocked: [...state.blocked],
        strippedFields: [...state.strippedFields]
      };
    },
    stopReason() {
      return state.stopReason;
    },
    close() {
      return new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
    }
  };
}
