/**
 * Local metering proxy between a coding harness and the DeepSeek API (ADR-0019).
 *
 * The harness gets a base URL on 127.0.0.1 and a per-run token instead of the real key; this proxy
 * holds the key (read from a file it deletes at start), forwards only an allowlist of model routes,
 * strips request fields it does not recognise, prices every response from its reported usage with
 * the shared rate table, and answers HTTP 402 once the run has spent its cap. It exists because
 * DeepSeek Harness has no cost limit of its own and its DeepSeek adapter attaches a
 * `dsh_session_log` field (the whole session, tool results included) to every request unless the
 * plugin is switched off — the field allowlist removes it even if that switch fails.
 *
 * Both wire formats are understood: the Anthropic Messages shape dsh uses
 * (`/anthropic/v1/messages`, `x-api-key`) and the OpenAI chat shape (`/chat/completions`, Bearer).
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

export const DEFAULT_UPSTREAM = 'https://api.deepseek.com';
export const DEFAULT_ALLOWED_MODELS = Object.freeze([
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'deepseek-flash'
]);

/** Harness catalog ids → rate-table slugs. */
const MODEL_ALIASES = Object.freeze({
  'deepseek-flash': 'deepseek-v4-flash',
  'deepseek-pro': 'deepseek-v4-pro'
});

/** Every route the proxy forwards. Anything else is a 404 and is reported. */
const ROUTES = Object.freeze([
  { method: 'POST', path: '/anthropic/v1/messages', family: 'anthropic', metered: true },
  {
    method: 'POST',
    path: '/anthropic/v1/messages/count_tokens',
    family: 'anthropic',
    metered: false
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
      'prompt_cache_hit_tokens'
    ]) {
      take(key, usage[key]);
    }
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
          cacheHitTokens: seen.prompt_cache_hit_tokens ?? 0,
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
  const slug = MODEL_ALIASES[model] ?? model;
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
 *   clientToken?: string,
 *   maxUsd: number,
 *   allowedModels?: readonly string[],
 *   rates?: Record<string, import('@archislop/shared/llmCostEstimate.js').LlmTokenRates>,
 *   onEvent?: (event: Record<string, unknown>) => void,
 *   fetchImpl?: typeof fetch,
 *   requestTimeoutMs?: number
 * }} options
 */
export async function startMeterProxy(options) {
  const key = readKey(options);
  const upstream = String(options.upstream ?? DEFAULT_UPSTREAM).replace(/\/$/, '');
  const clientToken = options.clientToken ?? `god-${randomBytes(24).toString('hex')}`;
  const maxUsd = Number(options.maxUsd);
  if (!(maxUsd > 0)) throw new Error('meterProxy: maxUsd must be positive');
  const allowedModels = new Set(options.allowedModels ?? DEFAULT_ALLOWED_MODELS);
  const rates = options.rates ?? mergeLlmTokenRates({});
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
    stopReason: null,
    models: new Set(),
    blocked: [],
    strippedFields: new Set()
  };

  const charge = (model, usage, requestBytes) => {
    const metered = usage ?? {
      inputTokens: Math.ceil(requestBytes / 3),
      cacheHitTokens: 0,
      outputTokens: UNMETERED_OUTPUT_TOKENS
    };
    if (!usage) state.unmeteredCalls += 1;
    const usd =
      estimateLlmCostUsd({
        inputTokens: metered.inputTokens,
        cacheHitInputTokens: metered.cacheHitTokens,
        outputTokens: metered.outputTokens,
        model: pricingModel(model, rates),
        rates
      }) ?? 0;
    state.calls += 1;
    state.inputTokens += metered.inputTokens;
    state.outputTokens += metered.outputTokens;
    state.cacheHitTokens += metered.cacheHitTokens;
    state.usd += usd;
    state.models.add(model);
    onEvent({
      type: 'model',
      model,
      ...metered,
      usd,
      totalUsd: state.usd,
      metered: Boolean(usage)
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
    return body;
  };

  const upstreamHeaders = (route, req) => {
    const headers = { 'content-type': 'application/json', accept: req.headers.accept ?? '*/*' };
    if (route.family === 'anthropic') {
      headers['x-api-key'] = key;
      if (typeof req.headers['anthropic-version'] === 'string') {
        headers['anthropic-version'] = req.headers['anthropic-version'];
      }
    } else {
      headers.authorization = `Bearer ${key}`;
    }
    return headers;
  };

  const relay = async (route, req, res, payload) => {
    const response = await fetchImpl(`${upstream}${route.path}`, {
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
    return { ok: response.ok, usage: tracker.result() };
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
      if (route.metered && (!model || !allowedModels.has(model))) {
        sendJson(res, 400, errorBody('invalid_request_error', 'model not allowed for this run'));
        return;
      }
      payload = JSON.stringify(body);
    }

    const { ok, usage } = await relay(route, req, res, payload);
    if (route.metered && (ok || usage)) charge(model, usage, requestBytes);
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
    clientToken,
    usage() {
      return {
        calls: state.calls,
        unmeteredCalls: state.unmeteredCalls,
        inputTokens: state.inputTokens,
        outputTokens: state.outputTokens,
        cacheHitTokens: state.cacheHitTokens,
        usd: Math.round(state.usd * 1e6) / 1e6,
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
