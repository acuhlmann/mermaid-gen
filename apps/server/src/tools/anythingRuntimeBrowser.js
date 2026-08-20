/**
 * Browser engine for the Anything runtime check.
 *
 * Instead of approximating the client sandbox — which is what
 * `anythingRuntimeSandbox.js` does in jsdom, patching `localStorage`,
 * `document.cookie` and `fetch` to fail — this loads a host page that builds
 * the *actual* client iframe:
 *
 *     <iframe sandbox="allow-scripts" srcdoc="<wrapAnythingSrcDoc(html)>">
 *
 * using the same `ANYTHING_IFRAME_SANDBOX` / `wrapAnythingSrcDoc` the renderer
 * uses (`AnythingRenderer.jsx`). Measured consequences, all for real rather
 * than emulated: `localStorage` and `document.cookie` throw SecurityError on
 * the opaque origin, `fetch` is refused by the injected CSP's
 * `connect-src 'none'`, and uncaught errors plus unhandled rejections arrive
 * over the runtime-error bridge `wrapAnythingSrcDoc` already injects. On top of
 * that the page gets a real canvas and a real layout engine, which is the whole
 * reason for the swap — jsdom stubs canvas with an inert Proxy and has no
 * layout at all, so a chart that draws nothing and a box that collapses to zero
 * width are both invisible to it.
 *
 * The parent deliberately cannot reach into the frame (no `allow-same-origin`),
 * so everything the frame reports comes back over postMessage.
 *
 * Same process discipline as the jsdom engine: a child process with a clean
 * environment, no network, and a hard kill timeout. Infrastructure failures
 * fail OPEN with a warning; page failures fail CLOSED.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ANYTHING_IFRAME_SANDBOX,
  ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE,
  wrapAnythingSrcDoc
} from '@archislop/shared';

import {
  ANYTHING_PROBE_MESSAGE_TYPE,
  anythingFindingSeverity,
  buildAnythingProbeScript
} from './anythingRuntimeProbe.js';

const MAX_ERRORS = 5;
const MAX_WARNINGS = 8;
const MAX_MESSAGE_LENGTH = 400;
const HOST_MARKER_ID = '__archislop_host__';

/**
 * Candidate binaries, most preferred first. `headless_shell` is roughly half
 * the size of full Chromium and is all this needs; `/usr/bin/chromium` is what
 * the Debian package in the Dockerfile installs.
 */
const BROWSER_CANDIDATES = [
  process.env.ANYTHING_BROWSER_BIN,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
].filter(Boolean);

/** Resolve a usable browser binary, or null when none is installed. */
export function resolveAnythingBrowserBinary(env = process.env) {
  const explicit = env?.ANYTHING_BROWSER_BIN;
  const candidates = explicit ? [explicit, ...BROWSER_CANDIDATES] : BROWSER_CANDIDATES;
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      // unreadable path — try the next candidate
    }
  }
  // Glob the playwright cache so a differently-pinned build still resolves.
  try {
    for (const entry of fs.readdirSync('/opt/pw-browsers')) {
      if (!entry.startsWith('chromium')) continue;
      for (const leaf of ['chrome-linux/headless_shell', 'chrome-linux/chrome']) {
        const full = path.join('/opt/pw-browsers', entry, leaf);
        if (fs.existsSync(full)) return full;
      }
    }
  } catch {
    // no playwright cache here
  }
  return null;
}

/**
 * Splice a snippet immediately after <head>. The probe must land there rather
 * than at the end of <body> for two reasons: its console capture has to be
 * installed before the page's own scripts run, and anything it added to <body>
 * would make the body non-empty and defeat the blank-render check.
 */
function injectIntoHead(html, snippet) {
  const headMatch = html.match(/<head(\s[^>]*)?>/i);
  if (headMatch && headMatch.index != null) {
    const at = headMatch.index + headMatch[0].length;
    return `${html.slice(0, at)}${snippet}${html.slice(at)}`;
  }
  const htmlMatch = html.match(/<html(\s[^>]*)?>/i);
  if (htmlMatch && htmlMatch.index != null) {
    const at = htmlMatch.index + htmlMatch[0].length;
    return `${html.slice(0, at)}<head>${snippet}</head>${html.slice(at)}`;
  }
  return `${snippet}${html}`;
}

function truncate(value) {
  const text = String(value ?? '').trim();
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text;
}

/** Embed a string in a <script> without letting it terminate the block. */
function embedJson(value) {
  return JSON.stringify(value).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
}

/**
 * The host page. It owns nothing but the iframe and the message log — all
 * observation happens inside the frame and arrives over postMessage.
 *
 * The srcdoc is handed over as a JSON string and assigned to the `srcdoc`
 * *property* rather than written as an attribute: agent HTML is full of quotes,
 * and attribute-escaping it by hand is a bug waiting to happen.
 */
function buildHostPage({ srcdoc, settleMs }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<div id="${HOST_MARKER_ID}"></div>
<script>(function () {
  var errors = [];
  var probe = null;
  var marker = document.getElementById(${embedJson(HOST_MARKER_ID)});

  function flush() {
    try {
      marker.textContent = JSON.stringify({ errors: errors, probe: probe });
    } catch (e) { /* nothing useful to do here */ }
  }

  window.addEventListener('message', function (ev) {
    var d = ev && ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === ${embedJson(ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE)}) {
      errors.push({ kind: d.kind, message: d.message, detail: d.detail || null });
    } else if (d.type === ${embedJson(ANYTHING_PROBE_MESSAGE_TYPE)}) {
      probe = {
        blank: d.blank, findings: d.findings || [], stats: d.stats || {},
        consoleErrors: d.consoleErrors || [], probeError: d.probeError || null
      };
    } else {
      return;
    }
    flush();
  });

  flush();

  var frame = document.createElement('iframe');
  frame.setAttribute('sandbox', ${embedJson(ANYTHING_IFRAME_SANDBOX)});
  // A real viewport, so layout means something. jsdom has none at all.
  frame.setAttribute('width', '1280');
  frame.setAttribute('height', '800');
  frame.style.cssText = 'width:1280px;height:800px;border:0';
  frame.srcdoc = ${embedJson(srcdoc)};
  document.body.appendChild(frame);

  // Backstop: report whatever arrived even if the page never settles cleanly.
  setTimeout(flush, ${Math.max(0, Number(settleMs) || 0) + 800});
})();</script>
</body></html>`;
}

/** Pull the host marker's JSON payload back out of the dumped DOM. */
export function extractHostVerdict(dom) {
  const idx = dom.indexOf(`id="${HOST_MARKER_ID}"`);
  if (idx === -1) return null;
  const open = dom.indexOf('>', idx);
  const close = dom.indexOf('</div>', open);
  if (open === -1 || close === -1) return null;
  const raw = dom.slice(open + 1, close).trim();
  if (!raw) return null;
  try {
    const unescaped = raw
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
    return JSON.parse(unescaped);
  } catch {
    return null;
  }
}

function failOpen(warning) {
  return { ok: true, skipped: true, warnings: [warning] };
}

/**
 * Execute an Anything document in a real browser, inside the client sandbox.
 *
 * Returns the same shape as the jsdom engine — callers must not be able to tell
 * which one ran, beyond the extra warnings.
 *
 * @param {string} html Validated document text, with @lib: markers expanded.
 * @param {{
 *   env?: NodeJS.ProcessEnv, timeoutMs?: number, settleMs?: number,
 *   binPath?: string|null, rejectOnVisual?: boolean
 * }} [options]
 * @returns {Promise<
 *   | { ok: true, skipped?: true, warnings: string[] }
 *   | { ok: false, code: 'runtime_error'|'blank_render'|'runtime_timeout'|'visual_broken', error: string, warnings: string[] }
 * >}
 */
export async function runAnythingBrowserCheck(html, options = {}) {
  const { env = process.env, timeoutMs = 6000, settleMs = 250, rejectOnVisual = false } = options;
  const bin = options.binPath ?? resolveAnythingBrowserBinary(env);

  if (!bin) {
    return failOpen('Runtime check skipped (no browser binary found).');
  }

  // A file:// URL rather than data:: a 200 KB document with a vendored library
  // spliced in overruns a comfortable argv budget once encoded.
  let dir;
  let pageFile;
  try {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anything-rt-'));
    pageFile = path.join(dir, 'host.html');
    const srcdoc = wrapAnythingSrcDoc(injectIntoHead(html, buildAnythingProbeScript({ settleMs })));
    fs.writeFileSync(pageFile, buildHostPage({ srcdoc, settleMs }), 'utf8');
  } catch (error) {
    return failOpen(`Runtime check skipped (could not stage page: ${error.message}).`);
  }

  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  };

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(
        bin,
        [
          '--headless',
          '--disable-gpu',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          // Defence in depth. The CSP inside the frame already refuses network,
          // but the browser process must not be able to reach out either.
          '--host-resolver-rules=MAP * ~NOTFOUND',
          // Advances timers in virtual time rather than waiting them out, so
          // the settle window costs almost nothing in wall clock.
          `--virtual-time-budget=${Math.max(0, Number(settleMs) || 0) + 900}`,
          '--dump-dom',
          `file://${pageFile}`
        ],
        // Clean environment on purpose: the child renders untrusted agent
        // output, so API keys and server config must not be reachable from it.
        { stdio: ['ignore', 'pipe', 'pipe'], env: {} }
      );
    } catch (error) {
      cleanup();
      resolve(failOpen(`Runtime check skipped (browser spawn failed: ${error.message}).`));
      return;
    }

    const stdout = [];
    const stderr = [];
    let settled = false;
    let timedOut = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      cleanup();
      resolve(result);
    };

    const killTimer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // already gone
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) =>
      finish(failOpen(`Runtime check skipped (browser spawn failed: ${error.message}).`))
    );

    child.on('close', (exitCode) => {
      const dom = Buffer.concat(stdout).toString('utf8');
      const verdict = extractHostVerdict(dom);

      if (timedOut) {
        // Cold browser startup on a loaded CI runner can consume the whole
        // budget before `--dump-dom` returns anything — that is harness
        // infrastructure, not a page fault. Fail open so the jsdom fallback
        // in runAnythingRuntimeCheck can still gate the document.
        //
        // A synchronous infinite loop also blocks the dump, but the host
        // marker's initial flush() still lands in stdout; only a probe-less,
        // error-less verdict means nothing from the page ever ran.
        if (!verdict || (verdict.errors.length === 0 && !verdict.probe)) {
          finish(
            failOpen(
              `Runtime check skipped (browser timed out after ${timeoutMs}ms without a page verdict).`
            )
          );
          return;
        }
        finish({
          ok: false,
          code: 'runtime_timeout',
          error:
            `Page scripts did not settle within ${timeoutMs}ms — likely an infinite loop or ` +
            'unbounded synchronous work. Make initialization finish quickly and drive ongoing ' +
            'work from requestAnimationFrame or timers.',
          warnings: []
        });
        return;
      }

      if (!verdict) {
        const detail = Buffer.concat(stderr).toString('utf8').trim().slice(0, 200);
        finish(
          failOpen(
            `Runtime check skipped (browser exited ${exitCode ?? 'unknown'} without a verdict` +
              `${detail ? `: ${detail}` : ''}).`
          )
        );
        return;
      }

      finish(interpretVerdict(verdict, { rejectOnVisual }));
    });
  });
}

/**
 * Turn what the frame reported into the rung's verdict.
 *
 * Order matters and mirrors the jsdom engine: a page that threw is reported as
 * an error even if it also rendered nothing, because the exception is the
 * actionable diagnostic and "empty body" is usually just its consequence.
 */
/** Warnings the frame reported that are noise rather than failure. */
function collectProbeWarnings(probe) {
  const warnings = [];
  if (!probe) return warnings;
  if (probe.probeError) {
    warnings.push(truncate(`Runtime probe failed: ${probe.probeError}`));
  }
  // console.error is noise, not failure — the same call the jsdom engine's
  // VirtualConsole makes. A browser does not hand console output across the
  // sandbox boundary, so the probe buffers it and ships it with the verdict.
  for (const line of (probe.consoleErrors ?? []).slice(0, MAX_WARNINGS)) {
    warnings.push(truncate(`console.error: ${line}`));
  }
  return warnings;
}

/** De-duplicated, capped list of the page's uncaught failures. */
function formatErrorList(errors) {
  const seen = new Set();
  const list = [];
  for (const entry of errors) {
    const message = truncate(entry?.message);
    if (!message || seen.has(message)) continue;
    seen.add(message);
    if (list.length < MAX_ERRORS) list.push(`- ${message}`);
  }
  return list.join('\n');
}

export function interpretVerdict(verdict, { rejectOnVisual = false } = {}) {
  const errors = Array.isArray(verdict.errors) ? verdict.errors : [];
  const probe = verdict.probe ?? null;

  // The frame never reported. Its scripts may have wedged before the probe ran;
  // fail open rather than blame the page for the harness's blind spot.
  if (!probe && errors.length === 0) {
    return failOpen('Runtime check skipped (page never reported a verdict).');
  }

  const warnings = collectProbeWarnings(probe);

  if (errors.length > 0) {
    return {
      ok: false,
      code: 'runtime_error',
      error: `Page JavaScript failed at runtime:\n${formatErrorList(errors)}`,
      warnings
    };
  }

  if (probe?.blank) {
    return {
      ok: false,
      code: 'blank_render',
      error:
        'The page rendered an empty <body> — no visible elements or text were produced. ' +
        'Emit the visible content in markup, or make the init script actually build it.',
      warnings
    };
  }

  const findings = Array.isArray(probe?.findings) ? probe.findings : [];
  const hard = findings.filter((f) => anythingFindingSeverity(f?.code) === 'hard');
  const reject = rejectOnVisual && hard.length > 0;

  // Anything not being rejected on is still worth reporting.
  for (const finding of findings.slice(0, MAX_WARNINGS)) {
    if (reject && anythingFindingSeverity(finding?.code) === 'hard') continue;
    warnings.push(truncate(`${finding.code}: ${finding.detail}`));
  }

  if (!reject) return { ok: true, warnings };

  return {
    ok: false,
    code: 'visual_broken',
    error:
      `The page rendered, but parts of it are not visible:\n` +
      `${hard
        .slice(0, MAX_ERRORS)
        .map((f) => `- ${f.detail}`)
        .join('\n')}\n` +
      'Give the affected elements real layout (a zero-width or zero-height box paints nothing), ' +
      'and draw to every canvas you create.',
    warnings
  };
}
