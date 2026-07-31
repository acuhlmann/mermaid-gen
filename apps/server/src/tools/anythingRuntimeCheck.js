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

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ANYTHING_RUNTIME_TIMEOUT_MS = 6000;
export const DEFAULT_ANYTHING_RUNTIME_SETTLE_MS = 250;

// fileURLToPath (not URL.pathname) so Windows gets `D:\...` instead of `/D:/...`.
const SANDBOX_PATH = fileURLToPath(new URL('./anythingRuntimeSandbox.js', import.meta.url));
const SANDBOX_MAX_OLD_SPACE_MB = 256;

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

function resolveTimeoutMs(env, override) {
  if (Number.isFinite(override) && override > 0) return override;
  const raw = Number(env?.ANYTHING_RUNTIME_CHECK_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_ANYTHING_RUNTIME_TIMEOUT_MS;
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
  { env = process.env, timeoutMs, settleMs } = {}
) {
  const budgetMs = resolveTimeoutMs(env, timeoutMs);
  const settle =
    Number.isFinite(settleMs) && settleMs >= 0 ? settleMs : DEFAULT_ANYTHING_RUNTIME_SETTLE_MS;

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(
        process.execPath,
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
