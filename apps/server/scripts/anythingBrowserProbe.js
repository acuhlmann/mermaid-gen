// anythingBrowserProbe.js
//
// Renders an Anything-mode document in a REAL browser and reports the visual
// defects the jsdom runtime check (anythingRuntimeSandbox.js) structurally
// cannot see: collapsed layout, invisible text, and canvases that were never
// drawn to.
//
// This is a MEASUREMENT tool for benchAnythingGeneration.js, not a validation
// rung. It runs as an observer alongside the real ladder so we can count how
// many pages the ladder accepts that a browser would object to — the rejection
// delta that decides whether a browser rung is worth promoting into the request
// path. Nothing here is wired into the server.
//
// Why jsdom cannot answer these:
//   - it has no layout engine, so getBoundingClientRect() returns zeros for
//     EVERY element and a collapsed box is indistinguishable from a healthy one
//   - its canvas getContext() is an inert Proxy where every draw call succeeds
//     and nothing is drawn, so a blank chart passes as readily as a real one
//   - it resolves almost no cascaded style, so contrast is unknowable
//
// The probe script runs inside the untrusted page and could in principle be
// tampered with by page JS. That is acceptable for a bench (we are measuring,
// not enforcing); it would need hardening — CDP-side evaluation rather than an
// in-page script — before any of this became a gate.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_BROWSER_SETTLE_MS = 250;
export const DEFAULT_BROWSER_TIMEOUT_MS = 15_000;

/**
 * Finding severity — the distinction that keeps the measurement honest.
 *
 * `hard` findings mean the page is BROKEN as rendered: a chart that drew
 * nothing, content laid out at zero width, a body with no height. These are the
 * ones a browser rung could justifiably reject on.
 *
 * `soft` findings are craft violations against anythingDesignGuide.js — real,
 * worth reporting, but a page at 4.19:1 contrast is legible and shipping it
 * beats burning a 12-60s repair turn on it.
 *
 * Reporting one blended "flagged rate" over both would badly overstate how much
 * more a browser rung would reject, because soft findings dominate by count.
 */
export const BROWSER_FINDING_SEVERITY = Object.freeze({
  blank_canvas: 'hard',
  canvas_zero_size: 'hard',
  collapsed_element: 'hard',
  body_no_height: 'hard',
  low_contrast: 'soft'
});

/** Severity of a finding code; unknown codes are treated as soft, never invented as hard. */
export function findingSeverity(code) {
  return BROWSER_FINDING_SEVERITY[code] ?? 'soft';
}

const PROBE_MARKER = '__ARCHISLOP_PROBE__';

/** Contrast floor from anythingDesignGuide.js ("body text contrast >= 4.5:1"). */
const CONTRAST_FLOOR = 4.5;

/**
 * Candidate binaries, most preferred first. headless_shell is ~half the size of
 * full Chromium and is all a probe needs.
 */
const BROWSER_CANDIDATES = [
  process.env.ANYTHING_BROWSER_BIN,
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome'
].filter(Boolean);

/** Resolve a usable browser binary, or null when none is installed. */
export function resolveBrowserBinary() {
  for (const candidate of BROWSER_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // unreadable path — try the next candidate
    }
  }
  // Glob the playwright cache so a different pinned build still resolves.
  try {
    const root = '/opt/pw-browsers';
    for (const entry of fs.readdirSync(root)) {
      if (!entry.startsWith('chromium')) continue;
      for (const leaf of ['chrome-linux/headless_shell', 'chrome-linux/chrome']) {
        const full = path.join(root, entry, leaf);
        if (fs.existsSync(full)) return full;
      }
    }
  } catch {
    // no playwright cache here
  }
  return null;
}

/**
 * In-page probe. Serialized into the document, runs after the settle window,
 * and writes its verdict as JSON text into a marker element that we read back
 * out of the dumped DOM.
 *
 * Written as a plain string (not a stringified function) so the settle value
 * can be interpolated and so nothing depends on this file's own transpilation.
 */
function buildProbeScript(settleMs) {
  return `
<div id="${PROBE_MARKER}" style="display:none"></div>
<script>
(function () {
  function lum(rgb) {
    var p = rgb.map(function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
  }
  function parseRgb(s) {
    var m = /rgba?\\(([^)]+)\\)/.exec(s || '');
    if (!m) return null;
    var parts = m[1].split(',').map(function (x) { return parseFloat(x); });
    if (parts.length < 3 || parts.some(isNaN)) return null;
    return { rgb: parts.slice(0, 3), a: parts.length > 3 ? parts[3] : 1 };
  }
  function contrast(a, b) {
    var la = lum(a), lb = lum(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }
  /** Walk ancestors for the first non-transparent background. */
  function effectiveBg(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var c = parseRgb(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.5) return c.rgb;
      node = node.parentElement;
    }
    return [255, 255, 255];
  }
  function visible(el, cs) {
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.01;
  }

  function probe() {
    var findings = [];
    var stats = { canvases: 0, drawnCanvases: 0, textNodes: 0, checked: 0 };

    // 1. Canvases that were never drawn to. jsdom cannot see this at all.
    var canvases = document.querySelectorAll('canvas');
    stats.canvases = canvases.length;
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i];
      if (!c.width || !c.height) {
        findings.push({ code: 'canvas_zero_size', detail: 'canvas #' + i + ' is ' + c.width + 'x' + c.height });
        continue;
      }
      try {
        var ctx = c.getContext('2d');
        if (!ctx) { continue; }        // WebGL and friends — not readable this way
        var data = ctx.getImageData(0, 0, c.width, c.height).data;
        var inked = 0;
        for (var p = 3; p < data.length; p += 4) { if (data[p] !== 0) { inked++; } }
        if (inked === 0) {
          findings.push({ code: 'blank_canvas', detail: 'canvas #' + i + ' (' + c.width + 'x' + c.height + ') has no painted pixels' });
        } else {
          stats.drawnCanvases++;
        }
      } catch (e) {
        // tainted or unsupported context — not a page defect
      }
    }

    // 2. Elements holding real text that render at zero width or height.
    var all = document.body ? document.body.querySelectorAll('*') : [];
    for (var j = 0; j < all.length; j++) {
      var el = all[j];
      var tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE' || tag === 'HEAD' || tag === 'META' || tag === 'LINK') continue;
      // Elements whose box the platform widget owns, not CSS. An <option> inside
      // a native <select> always measures 0x0 even though the user can see and
      // pick it — reporting that as collapsed layout is a false positive, and it
      // is the exact one the first baseline run produced (three <option>s in a
      // speed picker, flagged as a broken page).
      if (tag === 'OPTION' || tag === 'OPTGROUP') continue;
      if (el.closest && el.closest('select')) continue;
      var cs = getComputedStyle(el);
      if (!visible(el, cs)) continue;
      var text = (el.textContent || '').trim();
      if (!text) continue;
      var r = el.getBoundingClientRect();
      stats.checked++;
      if (r.width < 1 || r.height < 1) {
        findings.push({
          code: 'collapsed_element',
          detail: tag.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') +
            ' is ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' but holds "' + text.slice(0, 40) + '"'
        });
      }
    }

    // 3. Text that cannot be read against what is behind it.
    var seenContrast = {};
    for (var k = 0; k < all.length; k++) {
      var e2 = all[k];
      if (e2.children.length > 0) continue;                 // leaf text only
      // Same platform-widget exclusion as the layout pass: a native <select>
      // paints its own options, so the page's CSS colors do not describe what
      // the user actually sees there.
      if (e2.tagName === 'OPTION' || (e2.closest && e2.closest('select'))) continue;
      var t2 = (e2.textContent || '').trim();
      if (!t2) continue;
      var cs2 = getComputedStyle(e2);
      if (!visible(e2, cs2)) continue;
      var fg = parseRgb(cs2.color);
      if (!fg || fg.a < 0.5) continue;
      var ratio = contrast(fg.rgb, effectiveBg(e2));
      if (ratio < ${CONTRAST_FLOOR}) {
        var key = cs2.color + '|' + Math.round(ratio * 10);
        if (seenContrast[key]) continue;
        seenContrast[key] = 1;
        stats.textNodes++;
        findings.push({
          code: 'low_contrast',
          detail: 'ratio ' + ratio.toFixed(2) + ':1 (floor ${CONTRAST_FLOOR}) for "' + t2.slice(0, 32) + '"'
        });
      }
    }

    // 4. Nothing painted at all: body has no laid-out area.
    if (document.body) {
      var br = document.body.getBoundingClientRect();
      if (br.height < 2) {
        findings.push({ code: 'body_no_height', detail: 'body lays out at ' + Math.round(br.height) + 'px tall' });
      }
    }

    var el2 = document.getElementById('${PROBE_MARKER}');
    if (el2) { el2.textContent = JSON.stringify({ findings: findings, stats: stats }); }
  }

  // Let the page's own init (DOMContentLoaded, rAF, timers) run first.
  setTimeout(function () {
    try { probe(); }
    catch (e) {
      var m = document.getElementById('${PROBE_MARKER}');
      if (m) { m.textContent = JSON.stringify({ probeError: String(e && e.message || e) }); }
    }
  }, ${Math.max(0, settleMs - 20)});
})();
</script>`;
}

/** Splice the probe in just before </body> so page scripts are already parsed. */
function injectProbe(html, settleMs) {
  const probe = buildProbeScript(settleMs);
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx === -1) return html + probe;
  return html.slice(0, idx) + probe + html.slice(idx);
}

/**
 * Render `html` in a headless browser and report visual findings.
 *
 * Fails OPEN like the jsdom rung: a missing binary or a crashed render returns
 * `{ ok: true, skipped: true }` rather than manufacturing a defect. A bench
 * that silently attributed its own breakage to the page would be worse than no
 * bench at all.
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

  // A file:// URL rather than a data: URL — a 200 KB document with a vendored
  // library expands past a comfortable argv budget once base64-encoded.
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
          // Belt and braces: the policy lint already rejects external refs, but
          // a bench must never be able to reach the network on a page's behalf.
          '--host-resolver-rules=MAP * ~NOTFOUND',
          '--disable-extensions',
          // Advances timers in virtual time instead of waiting them out, so the
          // settle window costs almost nothing.
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
      const dom = Buffer.concat(stdout).toString('utf8');
      const parsed = extractProbeVerdict(dom);
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
    // The DOM dump escapes markup characters inside text content.
    const unescaped = raw
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    return JSON.parse(unescaped);
  } catch {
    return null;
  }
}
