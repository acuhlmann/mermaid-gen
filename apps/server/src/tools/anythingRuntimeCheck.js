/**
 * Runtime verification layer for Anything-mode HTML: actually executes the
 * document's scripts in a jsdom sandbox (see anythingRuntimeSandbox.js) and
 * rejects pages that throw uncaught errors, reject promises unhandled, hang,
 * or render an empty <body>. This is a QUALITY gate on agent output — the
 * security boundary remains the client's sandboxed iframe.
 *
 * The check runs in a child process with a clean environment (no secrets), a
 * capped heap, and a hard kill timeout, because the page JS is untrusted LLM
 * output and jsdom is not a security sandbox. Infrastructure failures
 * (spawn/crash) fail OPEN with a warning — a broken checker must not block
 * valid pages; script failures and timeouts fail CLOSED.
 */

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveAnythingBrowserBinary, runAnythingBrowserCheck } from './anythingRuntimeBrowser.js';

export const DEFAULT_ANYTHING_RUNTIME_TIMEOUT_MS = 6000;
export const DEFAULT_ANYTHING_RUNTIME_SETTLE_MS = 250;

// fileURLToPath (not URL.pathname) so Windows gets `D:\...` instead of `/D:/...`.
const SANDBOX_PATH = fileURLToPath(new URL('./anythingRuntimeSandbox.js', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SANDBOX_MAX_OLD_SPACE_MB = 256;

/** Minimum Node for jsdom 30 (matches its `engines.node` lower bounds). */
const JSDOM_MIN_NODE = Object.freeze({ major: 22, minor: 22, patch: 2 });

function parseNodeVersion(version) {
  const match = /^v(\d+)\.(\d+)\.(\d+)/.exec(String(version ?? '').trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function compareNodeVersion(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/** True when `version` can import and run jsdom 30 (undici zstd needs a recent patch). */
export function nodeVersionMeetsJsdomMinimum(version) {
  const parsed = parseNodeVersion(version);
  if (!parsed) return false;
  if (parsed.major >= 26) return true;
  if (parsed.major === 24 && parsed.minor >= 15) return true;
  if (parsed.major === 22 && compareNodeVersion(parsed, JSDOM_MIN_NODE) >= 0) return true;
  return false;
}

function readRepoNvmrcLabel() {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, '.nvmrc'), 'utf8').trim();
  } catch {
    return null;
  }
}

/** First installed nvm Node whose folder name starts with `v${label}`. */
function resolveNvmNodeBinary(label, home = os.homedir()) {
  if (!label) return null;
  const versionsDir = path.join(home, '.nvm', 'versions', 'node');
  let entries;
  try {
    entries = fs.readdirSync(versionsDir);
  } catch {
    return null;
  }
  const prefix = label.startsWith('v') ? label : `v${label}`;
  for (const entry of entries.sort()) {
    if (!entry.startsWith(prefix)) continue;
    const candidate = path.join(versionsDir, entry, 'bin', 'node');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Node binary used to spawn the jsdom sandbox child.
 *
 * The parent process may be an older platform Node (Cloud Agent VMs have shipped
 * behind `.nvmrc` before). jsdom then crashes on import and the rung fail-opens,
 * which silently disables blank_render and runtime_timeout. Prefer an explicit
 * override, then the repo's `.nvmrc` install under nvm, then the current binary.
 */
function nodeVersionFromBinary(nodeBin) {
  try {
    return execFileSync(nodeBin, ['-p', 'process.version'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function resolveAnythingJsdomExecPath(env = process.env) {
  const explicit = String(env?.ANYTHING_RUNTIME_NODE ?? '').trim();
  if (explicit && fs.existsSync(explicit)) return explicit;

  if (nodeVersionMeetsJsdomMinimum(process.version)) return process.execPath;

  const fromNvm = resolveNvmNodeBinary(readRepoNvmrcLabel(), env?.HOME || os.homedir());
  if (fromNvm) {
    const nvmVersion = nodeVersionFromBinary(fromNvm);
    if (nvmVersion && nodeVersionMeetsJsdomMinimum(nvmVersion)) return fromNvm;
  }

  return process.execPath;
}

/**
 * Enabled unless ANYTHING_RUNTIME_CHECK is explicitly turned off
 * ('0' | 'false' | 'off').
 */
export function isAnythingRuntimeCheckEnabled(env = process.env) {
  const raw = String(env?.ANYTHING_RUNTIME_CHECK ?? '')
    .trim()
    .toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off';
}

/**
 * Which engine executes the page.
 *
 * `browser` runs it inside the real client sandbox (an `allow-scripts` iframe
 * with the same CSP the renderer applies), so it sees real layout and real
 * canvas pixels. `jsdom` is the original engine: no layout engine, canvas
 * stubbed with an inert Proxy, and the sandbox contract emulated by hand.
 *
 * `auto` prefers the browser and falls back to jsdom when no binary resolves,
 * so a contributor without Chromium still gets a working gate and `jsdom` is a
 * one-variable rollback if the browser path misbehaves in production.
 */
export function resolveAnythingRuntimeEngine(env = process.env) {
  const raw = String(env?.ANYTHING_RUNTIME_ENGINE ?? 'auto')
    .trim()
    .toLowerCase();
  if (raw === 'jsdom') return 'jsdom';
  if (raw === 'browser') return 'browser';
  return resolveAnythingBrowserBinary(env) ? 'browser' : 'jsdom';
}

/**
 * Whether the browser engine may reject on visual breakage (a canvas that drew
 * nothing, a box that collapsed to zero size) rather than only warning.
 *
 * Off by default: turning it on adds a rejection reason, and every extra
 * rejection costs a 12-60s repair turn. The generation bench measured the
 * ceiling at ~8.6% of accepted pages, so this is enabled deliberately and
 * measured, never as a side effect of the engine swap.
 */
export function isAnythingVisualRejectionEnabled(env = process.env) {
  const raw = String(env?.ANYTHING_RUNTIME_VISUAL_REJECT ?? '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on';
}

function resolveTimeoutMs(env, override) {
  if (Number.isFinite(override) && override > 0) return override;
  const raw = Number(env?.ANYTHING_RUNTIME_CHECK_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_ANYTHING_RUNTIME_TIMEOUT_MS;
}

/**
 * The budget the jsdom fallback gets when the browser rung fails open.
 *
 * It must NOT be the browser's budget. The two engines exist as a pair
 * precisely because their startup costs differ: the browser's clock is sized
 * for a Chromium launch, while jsdom's has to cover a child-process spawn plus
 * a jsdom import graph. Resharing one clock meant a caller who tightened the
 * budget for the browser silently starved the fallback, and the fallback then
 * reported `runtime_timeout` — a page rejection — for what was only the second
 * rung running out of clock. That shipped, and it is a production path too:
 * Cloud Run scales to zero, so the first request after an idle period pays
 * both cold starts back to back.
 *
 * So the fallback keeps its own floor. A caller who *raised* the budget still
 * gets the benefit (`Math.max`) — generosity was meant for both engines; only
 * tightening was meant for the browser.
 */
export function resolveAnythingRuntimeFallbackTimeoutMs(env = process.env, browserBudgetMs = 0) {
  const raw = Number(env?.ANYTHING_RUNTIME_FALLBACK_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return Math.max(
    Number.isFinite(browserBudgetMs) ? browserBudgetMs : 0,
    DEFAULT_ANYTHING_RUNTIME_TIMEOUT_MS
  );
}

function failOpen(warning) {
  return { ok: true, skipped: true, warnings: [warning] };
}

/**
 * Execute an Anything HTML document in the runtime sandbox.
 *
 * @param {string} html Validated document text (post parseAnythingHtml).
 * @param {{ env?: NodeJS.ProcessEnv, timeoutMs?: number, settleMs?: number }} [options]
 * @returns {Promise<
 *   | { ok: true, skipped?: boolean, warnings: string[] }
 *   | { ok: false, code: 'runtime_error' | 'blank_render' | 'runtime_timeout', error: string, warnings: string[] }
 * >}
 */
export async function runAnythingRuntimeCheck(
  html,
  { env = process.env, timeoutMs, settleMs, engine } = {}
) {
  const budgetMs = resolveTimeoutMs(env, timeoutMs);
  const settle =
    Number.isFinite(settleMs) && settleMs >= 0 ? settleMs : DEFAULT_ANYTHING_RUNTIME_SETTLE_MS;

  const selected = engine ?? resolveAnythingRuntimeEngine(env);
  if (selected === 'browser') {
    const result = await runAnythingBrowserCheck(html, {
      env,
      timeoutMs: budgetMs,
      settleMs: settle,
      rejectOnVisual: isAnythingVisualRejectionEnabled(env)
    });
    // A browser that could not run at all is an infrastructure failure, and the
    // rung's rule is that those fail open rather than block a valid page. jsdom
    // is still here and still correct on everything except layout and paint, so
    // falling back to it is strictly better than skipping the rung entirely.
    if (result.skipped) {
      // Its own clock, not the browser's — see resolveAnythingRuntimeFallbackTimeoutMs.
      const jsdomResult = await runAnythingJsdomCheck(html, {
        budgetMs: resolveAnythingRuntimeFallbackTimeoutMs(env, budgetMs),
        settle,
        env
      });
      return {
        ...jsdomResult,
        warnings: [...(result.warnings ?? []), ...(jsdomResult.warnings ?? [])]
      };
    }
    return result;
  }

  return runAnythingJsdomCheck(html, { budgetMs, settle, env });
}

/**
 * The original jsdom engine, unchanged. Kept as the fallback and as the
 * reference implementation the browser engine has to agree with — both are
 * exercised by the same contract suite (anythingRuntimeCheck.test.js) rather
 * than by two suites that could drift apart.
 */
function runAnythingJsdomCheck(html, { budgetMs, settle, env = process.env }) {
  const nodeBin = resolveAnythingJsdomExecPath(env);
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(
        nodeBin,
        [`--max-old-space-size=${SANDBOX_MAX_OLD_SPACE_MB}`, SANDBOX_PATH, `--settle-ms=${settle}`],
        {
          // Clean environment on purpose: the child executes untrusted page
          // JS, so API keys and server config must not be reachable from it.
          env: {},
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );
    } catch (error) {
      resolve(
        failOpen(
          `Runtime check skipped (sandbox spawn failed: ${error instanceof Error ? error.message : error}).`
        )
      );
      return;
    }

    let settled = false;
    let timedOut = false;
    const stdout = [];
    const stderr = [];

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      resolve(result);
    };

    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, budgetMs);

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));

    child.on('error', (error) => {
      finish(failOpen(`Runtime check skipped (sandbox spawn failed: ${error.message}).`));
    });

    child.on('close', (exitCode) => {
      if (timedOut) {
        finish({
          ok: false,
          code: 'runtime_timeout',
          error:
            `Page scripts did not settle within ${budgetMs}ms — likely an infinite loop or ` +
            'unbounded synchronous work. Make initialization finish quickly and drive ongoing ' +
            'work from requestAnimationFrame or timers.',
          warnings: []
        });
        return;
      }

      let report = null;
      try {
        report = JSON.parse(Buffer.concat(stdout).toString('utf8'));
      } catch {
        report = null;
      }

      if (!report || !Array.isArray(report.errors)) {
        // Crash without a verdict (OOM, jsdom internal failure). Fail open:
        // this layer must not block pages over checker infrastructure.
        const detail = Buffer.concat(stderr).toString('utf8').trim().slice(0, 200);
        finish(
          failOpen(
            `Runtime check skipped (sandbox exited ${exitCode ?? 'unknown'} without a verdict` +
              `${detail ? `: ${detail}` : ''}).`
          )
        );
        return;
      }

      const warnings = Array.isArray(report.warnings) ? report.warnings : [];

      if (report.errors.length > 0) {
        const list = report.errors.map((message) => `- ${message}`).join('\n');
        finish({
          ok: false,
          code: 'runtime_error',
          error: `Page JavaScript failed at runtime:\n${list}`,
          warnings
        });
        return;
      }

      if (report.blank) {
        finish({
          ok: false,
          code: 'blank_render',
          error:
            'The page rendered an empty <body> — no visible elements or text were produced. ' +
            'Emit the visible content in markup, or make the init script actually build it.',
          warnings
        });
        return;
      }

      finish({ ok: true, warnings });
    });

    child.stdin.on('error', () => {
      // Child died before consuming stdin; 'close' delivers the verdict.
    });
    child.stdin.end(html);
  });
}
