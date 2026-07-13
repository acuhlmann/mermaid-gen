import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mergeLlmTokenRates,
  normalizeLlmModelSlug,
  readLlmCostEnvOverrides,
  VERTEX_GEMINI_PRICING_URL
} from '@archislop/shared';

const DEFAULT_REFRESH_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REMOTE_RATES_URL =
  'https://raw.githubusercontent.com/acuhlmann/mermaid-gen/main/packages/shared/src/data/llm-token-rates.json';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const bundledRatesPath = path.join(repoRoot, 'packages/shared/src/data/llm-token-rates.json');

/** @type {{ rates: Record<string, { inputPerM: number, outputPerM: number }>, version: string | null, pricingUrl: string, sources: string[], updatedAtMs: number } | null} */
let cache = null;
/** @type {Promise<void> | null} */
let inflight = null;

function readPositiveMs(env, key, fallback) {
  const raw = env?.[key];
  if (raw == null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 60_000 ? Math.trunc(n) : fallback;
}

function parseRatesRecord(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const rates = raw.rates && typeof raw.rates === 'object' ? raw.rates : raw;
  /** @type {Record<string, { inputPerM: number, outputPerM: number }>} */
  const out = {};
  for (const [model, value] of Object.entries(rates)) {
    if (!value || typeof value !== 'object') continue;
    const inputPerM = Number(value.inputPerM);
    const outputPerM = Number(value.outputPerM);
    if (!Number.isFinite(inputPerM) || !Number.isFinite(outputPerM)) continue;
    if (inputPerM < 0 || outputPerM < 0) continue;
    out[normalizeLlmModelSlug(model)] = { inputPerM, outputPerM };
  }
  return out;
}

export function readBundledLlmTokenRatesFile() {
  try {
    const raw = fs.readFileSync(bundledRatesPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      version: typeof parsed.version === 'string' ? parsed.version : null,
      pricingUrl:
        typeof parsed.pricingUrl === 'string' && parsed.pricingUrl.trim()
          ? parsed.pricingUrl.trim()
          : VERTEX_GEMINI_PRICING_URL,
      rates: parseRatesRecord(parsed)
    };
  } catch {
    return {
      version: null,
      pricingUrl: VERTEX_GEMINI_PRICING_URL,
      rates: {}
    };
  }
}

function resolveRemoteRatesUrl(env = process.env) {
  const explicit = env.LLM_COST_RATES_URL?.trim();
  if (explicit) return explicit;
  if (env.K_SERVICE) return DEFAULT_REMOTE_RATES_URL;
  return null;
}

function modelsToRefreshFromEnv(env = process.env) {
  const slugs = new Set([
    env.VERTEX_MODEL_FAST,
    env.VERTEX_MODEL_QUALITY,
    env.VERTEX_MODEL,
    env.OPENROUTER_MODEL_FAST,
    env.OPENROUTER_MODEL_QUALITY,
    env.OPENROUTER_MODEL,
    env.DEEPSEEK_MODEL_FAST,
    env.DEEPSEEK_MODEL_QUALITY,
    env.DEEPSEEK_MODEL,
    env.MERMAID_REPAIR_MODEL
  ]);
  return [...slugs]
    .map((s) => (typeof s === 'string' ? normalizeLlmModelSlug(s) : ''))
    .filter(Boolean);
}

async function fetchRemoteRatesJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`rates fetch ${response.status}`);
  return response.json();
}

async function fetchOpenRouterRates(env = process.env) {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return {};
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`openrouter models ${response.status}`);
  const body = await response.json();
  const wanted = new Set(modelsToRefreshFromEnv(env));
  /** @type {Record<string, { inputPerM: number, outputPerM: number }>} */
  const out = {};
  for (const model of body?.data ?? []) {
    const id = typeof model?.id === 'string' ? model.id : '';
    if (!id) continue;
    const slug = normalizeLlmModelSlug(id);
    const tail = id.includes('/') ? id.split('/').pop() : id;
    const matches =
      wanted.has(slug) ||
      [...wanted].some((w) => slug.includes(w) || w.includes(slug) || tail.includes(w));
    if (!matches) continue;
    const prompt = Number(model?.pricing?.prompt);
    const completion = Number(model?.pricing?.completion);
    if (!Number.isFinite(prompt) && !Number.isFinite(completion)) continue;
    out[slug] = {
      inputPerM: Number.isFinite(prompt) ? prompt * 1_000_000 : 0,
      outputPerM: Number.isFinite(completion) ? completion * 1_000_000 : 0
    };
  }
  return out;
}

async function buildRatesSnapshot(env = process.env) {
  const bundled = readBundledLlmTokenRatesFile();
  const sources = bundled.rates && Object.keys(bundled.rates).length > 0 ? ['bundled'] : [];
  let rates = { ...bundled.rates };
  let version = bundled.version;
  let pricingUrl = bundled.pricingUrl;

  const remoteUrl = resolveRemoteRatesUrl(env);
  if (remoteUrl) {
    try {
      const remote = await fetchRemoteRatesJson(remoteUrl);
      const remoteRates = parseRatesRecord(remote);
      if (Object.keys(remoteRates).length > 0) {
        rates = { ...rates, ...remoteRates };
        sources.push('remote');
        if (typeof remote.version === 'string' && remote.version.trim()) {
          version = remote.version.trim();
        }
        if (typeof remote.pricingUrl === 'string' && remote.pricingUrl.trim()) {
          pricingUrl = remote.pricingUrl.trim();
        }
      }
    } catch {
      // Bundled + env overrides still apply when the remote feed is unreachable.
    }
  }

  if (env.OPENROUTER_API_KEY?.trim()) {
    try {
      const orRates = await fetchOpenRouterRates(env);
      if (Object.keys(orRates).length > 0) {
        rates = { ...rates, ...orRates };
        sources.push('openrouter');
      }
    } catch {
      // ignore — Vertex defaults remain
    }
  }

  const envRates = readLlmCostEnvOverrides(env);
  if (Object.keys(envRates).length > 0) {
    rates = { ...rates, ...envRates };
    sources.push('env');
  }

  // Legacy built-in table fallback for anything still missing after feeds.
  rates = { ...mergeLlmTokenRates({}), ...rates, ...envRates };

  return {
    rates,
    version,
    pricingUrl,
    sources,
    updatedAtMs: Date.now()
  };
}

export function getCachedLlmCostRates(env = process.env) {
  if (cache) return cache;
  const bundled = readBundledLlmTokenRatesFile();
  const envRates = readLlmCostEnvOverrides(env);
  cache = {
    rates: { ...mergeLlmTokenRates({}), ...bundled.rates, ...envRates },
    version: bundled.version,
    pricingUrl: bundled.pricingUrl,
    sources: ['bundled', ...(Object.keys(envRates).length ? ['env'] : [])],
    updatedAtMs: Date.now()
  };
  return cache;
}

export async function refreshLlmCostRates(env = process.env) {
  if (inflight) {
    await inflight;
    return cache;
  }
  inflight = (async () => {
    try {
      cache = await buildRatesSnapshot(env);
    } finally {
      inflight = null;
    }
  })();
  await inflight;
  return cache;
}

export function scheduleLlmCostRatesRefresh(env = process.env) {
  const refreshMs = readPositiveMs(env, 'LLM_COST_RATES_REFRESH_MS', DEFAULT_REFRESH_MS);
  void refreshLlmCostRates(env);
  const timer = setInterval(() => {
    void refreshLlmCostRates(env);
  }, refreshMs);
  if (typeof timer.unref === 'function') timer.unref();
}
