// anythingBrowserProbe.js
//
// Bench-side observer: renders an Anything document in a real browser and
// reports the visual defects jsdom structurally cannot see.
//
// The CHECKS live in apps/server/src/tools/anythingRuntimeProbe.js, shared with
// the production runtime rung (anythingRuntimeBrowser.js). This file is only
// the bench's transport and driver. Keeping one copy of the checks matters:
// they encode measured false-positive fixes (a native <select> owns its
// options' boxes, so they measure 0x0 while being perfectly visible) and a
// second copy would drift away from the rung that actually gates output.
//
// Transport differs from the rung's on purpose. The rung renders inside a
// sandboxed iframe it cannot read into, so the probe reports over postMessage.
// The bench renders the page directly, so it reads a marker element out of
// `--dump-dom` — simpler, and there is no sandbox boundary in the way.
//
// This runs page JS, so it is a MEASUREMENT tool, not a gate. It changes no
// verdict; it exists to count how many pages the ladder accepts that a browser
// would object to.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  anythingFindingSeverity,
  buildAnythingProbeScript
} from '../src/tools/anythingRuntimeProbe.js';
import { resolveAnythingBrowserBinary } from '../src/tools/anythingRuntimeBrowser.js';

export const DEFAULT_BROWSER_SETTLE_MS = 250;
export const DEFAULT_BROWSER_TIMEOUT_MS = 15_000;

const PROBE_MARKER = '__ARCHISLOP_PROBE__';

/** Severity of a finding code — re-exported so bench callers have one import. */
export const findingSeverity = anythingFindingSeverity;

/** Resolve a usable browser binary, or null when none is installed. */
export function resolveBrowserBinary() {
  return resolveAnythingBrowserBinary(process.env);
}

/**
 * Splice the marker element and the probe script in before </body>.
 *
 * The marker is safe here (unlike in the rung, where an added body element
 * would defeat the blank-render check) because the bench only reads findings —
 * it never decides whether the body rendered.
 */
function injectProbe(html, settleMs) {
  const probe =
    `<div id="${PROBE_MARKER}" style="display:none"></div>` +
    buildAnythingProbeScript({ settleMs, transport: 'marker', markerId: PROBE_MARKER });
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx === -1) return html + probe;
  return html.slice(0, idx) + probe + html.slice(idx);
}

/** Pull the marker element's JSON payload back out of the dumped DOM. */
export function extractProbeVerdict(dom) {
  const idx = dom.indexOf(`id="${PROBE_MARKER}"`);
  if (idx === -1) return null;
  const open = dom.indexOf('>', idx);
  const close = dom.indexOf('</div>', open);
  if (open === -1 || close === -1) return null;
  const raw = dom.slice(open + 1, close).trim();
  if (!raw) return null;
  try {
    // --dump-dom escapes markup characters inside text content, so the JSON
    // arrives entity-encoded and a naive JSON.parse would throw.
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

/**
 * Render `html` in a headless browser and report visual findings.
 *
 * Fails OPEN: a missing binary or a crashed render returns
 * `{ ok: true, skipped: true }` rather than manufacturing a defect. A bench
 * that attributed its own breakage to the page would be worse than no bench.
 *
 * @param {string} html Post-validation document (with @lib: markers expanded).
 * @param {{ settleMs?: number, timeoutMs?: number, binPath?: string|null }} [options]
 * @returns {Promise<{ok: true, skipped?: true, reason?: string, findings?: Array<{code:string,detail:string}>, stats?: object}>}
 */
export async function runAnythingBrowserProbe(html, options = {}) {
  const settleMs = Number.isFinite(options.settleMs) ? options.settleMs : DEFAULT_BROWSER_SETTLE_MS;
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? options.timeoutMs
    : DEFAULT_BROWSER_TIMEOUT_MS;
  const bin = options.binPath ?? resolveBrowserBinary();

  if (!bin) {
    return { ok: true, skipped: true, reason: 'no Chromium binary found' };
  }

  // A file:// URL rather than data:: a 200 KB document with a vendored library
  // spliced in overruns a comfortable argv budget once encoded.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anything-probe-'));
  const pageFile = path.join(dir, 'page.html');
  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  };

  try {
    fs.writeFileSync(pageFile, injectProbe(html, settleMs), 'utf8');
  } catch (error) {
    cleanup();
    return { ok: true, skipped: true, reason: `could not stage page: ${error.message}` };
  }

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
          // The policy lint already rejects external refs, but a bench must
          // never be able to reach the network on a page's behalf.
          '--host-resolver-rules=MAP * ~NOTFOUND',
          '--disable-extensions',
          `--virtual-time-budget=${settleMs + 200}`,
          '--dump-dom',
          `file://${pageFile}`
        ],
        { stdio: ['ignore', 'pipe', 'pipe'], env: {} }
      );
    } catch (error) {
      cleanup();
      resolve({ ok: true, skipped: true, reason: `spawn failed: ${error.message}` });
      return;
    }

    const stdout = [];
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      cleanup();
      resolve(result);
    };

    const killTimer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // already gone
      }
      finish({ ok: true, skipped: true, reason: `probe timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', () => {
      // Chromium is chatty on stderr (fontconfig, dbus); the verdict is on stdout.
    });
    child.on('error', (error) =>
      finish({ ok: true, skipped: true, reason: `spawn failed: ${error.message}` })
    );

    child.on('close', () => {
      const parsed = extractProbeVerdict(Buffer.concat(stdout).toString('utf8'));
      if (!parsed) {
        finish({ ok: true, skipped: true, reason: 'probe produced no verdict' });
        return;
      }
      if (parsed.probeError) {
        finish({ ok: true, skipped: true, reason: `probe threw: ${parsed.probeError}` });
        return;
      }
      finish({ ok: true, findings: parsed.findings ?? [], stats: parsed.stats ?? {} });
    });
  });
}
