/**
 * The probe that runs INSIDE an Anything document to report what the page
 * actually rendered: whether the body painted anything, whether canvases were
 * drawn to, whether laid-out boxes collapsed, and whether text clears the
 * contrast floor.
 *
 * This module owns the checks as *source text* rather than as functions,
 * because the code has to execute in the page's own context — either inside the
 * client-shaped sandboxed iframe (the runtime rung, which reports over
 * postMessage since it cannot be read from outside) or inside a plain page
 * driven by `--dump-dom` (the offline bench, which reports through a marker
 * element). One copy, two transports: the checks are the interesting part and
 * duplicating them across the rung and the bench would guarantee drift.
 *
 * Consumers: `anythingRuntimeBrowser.js` (server rung) and
 * `apps/server/scripts/anythingBrowserProbe.js` (bench observer).
 */

/** postMessage `type` the in-iframe probe uses to report its verdict out. */
export const ANYTHING_PROBE_MESSAGE_TYPE = 'archislop:anything-probe';

/**
 * Finding severity.
 *
 * `hard` means the page is BROKEN as rendered — a chart that drew nothing,
 * content laid out at zero width. Only these can justify a rejection.
 *
 * `soft` means a craft violation against anythingDesignGuide.js. Real, worth
 * reporting, but a page at 4.19:1 contrast is legible and shipping it beats
 * burning a 12-60s repair turn. Measured: 32 of 35 accepted pages carried one,
 * so rejecting on soft findings would thrash the repair loop.
 */
export const ANYTHING_FINDING_SEVERITY = Object.freeze({
  blank_canvas: 'hard',
  canvas_zero_size: 'hard',
  collapsed_element: 'hard',
  body_no_height: 'hard',
  low_contrast: 'soft'
});

/** Severity of a finding code. Unknown codes are soft — never invented as hard. */
export function anythingFindingSeverity(code) {
  return ANYTHING_FINDING_SEVERITY[code] ?? 'soft';
}

/** Contrast floor from anythingDesignGuide.js ("body text contrast >= 4.5:1"). */
const CONTRAST_FLOOR = 4.5;

/**
 * The checks, as ES5 source. Defines one global function returning
 * `{ blank, findings, stats }`.
 *
 * ES5 and `var` on purpose: this runs inside untrusted agent output whose own
 * scripts may already have failed, and it must not add a second failure mode of
 * its own. Everything is wrapped so page globals cannot collide with it.
 */
const PROBE_CHECKS_SOURCE = `
function __archislopCollect() {
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
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
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
  /**
   * Boxes the platform widget owns rather than CSS. A native <select> paints its
   * own options, so they measure 0x0 while being perfectly visible and their
   * colors do not describe what the user sees. Reporting them was a real false
   * positive: three <option>s in a speed picker read as a broken page.
   */
  function platformOwned(el) {
    var tag = el.tagName;
    if (tag === 'OPTION' || tag === 'OPTGROUP') return true;
    return !!(el.closest && el.closest('select'));
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEMPLATE: 1, HEAD: 1, META: 1, LINK: 1, TITLE: 1 };

  var findings = [];
  var stats = { canvases: 0, drawnCanvases: 0, lowContrast: 0, checked: 0 };
  var body = document.body;
  var all = body ? body.querySelectorAll('*') : [];

  // 1. Did anything render at all? Mirrors the jsdom rung's hasVisibleContent:
  //    any non-metadata element, or bare text directly in <body>.
  var blank = true;
  if (body) {
    for (var b = 0; b < all.length; b++) {
      if (!SKIP[all[b].tagName]) { blank = false; break; }
    }
    if (blank) {
      for (var n = 0; n < body.childNodes.length; n++) {
        var node = body.childNodes[n];
        if (node.nodeType === 3 && node.textContent && node.textContent.trim()) { blank = false; break; }
      }
    }
  }

  // 2. Canvases that were never drawn to. jsdom cannot see this at all: its
  //    getContext is an inert Proxy where every draw call silently succeeds.
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
      if (!ctx) continue;                       // WebGL and friends: not readable this way
      var data = ctx.getImageData(0, 0, c.width, c.height).data;
      var inked = 0;
      for (var p = 3; p < data.length; p += 4) { if (data[p] !== 0) { inked++; break; } }
      if (inked === 0) {
        findings.push({ code: 'blank_canvas', detail: 'canvas #' + i + ' (' + c.width + 'x' + c.height + ') has no painted pixels' });
      } else {
        stats.drawnCanvases++;
      }
    } catch (e) { /* tainted or unsupported context is not a page defect */ }
  }

  // 3. Elements holding real text that render at zero width or height.
  for (var j = 0; j < all.length; j++) {
    var el = all[j];
    if (SKIP[el.tagName] || platformOwned(el)) continue;
    var cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    var text = (el.textContent || '').trim();
    if (!text) continue;
    var r = el.getBoundingClientRect();
    stats.checked++;
    if (r.width < 1 || r.height < 1) {
      var name = el.tagName.toLowerCase() +
        (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
      findings.push({
        code: 'collapsed_element',
        detail: name + ' is ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' but holds "' + text.slice(0, 40) + '"'
      });
    }
  }

  // 4. Text that cannot be read against what is behind it.
  var seen = {};
  for (var k = 0; k < all.length; k++) {
    var e2 = all[k];
    if (e2.children.length > 0 || SKIP[e2.tagName] || platformOwned(e2)) continue;
    var t2 = (e2.textContent || '').trim();
    if (!t2) continue;
    var cs2 = getComputedStyle(e2);
    if (!visible(e2, cs2)) continue;
    var fg = parseRgb(cs2.color);
    if (!fg || fg.a < 0.5) continue;
    var ratio = contrast(fg.rgb, effectiveBg(e2));
    if (ratio < ${CONTRAST_FLOOR}) {
      var key = cs2.color + '|' + Math.round(ratio * 10);
      if (seen[key]) continue;
      seen[key] = 1;
      stats.lowContrast++;
      findings.push({
        code: 'low_contrast',
        detail: 'ratio ' + ratio.toFixed(2) + ':1 (floor ${CONTRAST_FLOOR}) for "' + t2.slice(0, 32) + '"'
      });
    }
  }

  // 5. Nothing laid out at all.
  if (body) {
    var br = body.getBoundingClientRect();
    if (br.height < 2 && !blank) {
      findings.push({ code: 'body_no_height', detail: 'body lays out at ' + Math.round(br.height) + 'px tall' });
    }
  }

  return { blank: blank, findings: findings, stats: stats };
}`;

/**
 * Build the probe `<script>` to splice into a document.
 *
 * @param {{
 *   settleMs?: number,
 *   transport?: 'postMessage' | 'marker',
 *   markerId?: string
 * }} [options]
 *   `postMessage` is for the sandboxed-iframe rung, where the parent cannot
 *   read into the frame. `marker` writes into an element for `--dump-dom`, and
 *   must only be used where injecting a visible-ish element is harmless — never
 *   in the rung, because a marker element in <body> would defeat the blank
 *   check the rung depends on.
 */
export function buildAnythingProbeScript({
  settleMs = 250,
  transport = 'postMessage',
  markerId = '__archislop_probe__'
} = {}) {
  const deliver =
    transport === 'marker'
      ? `var el = document.getElementById(${JSON.stringify(markerId)});
         if (el) { el.textContent = JSON.stringify(verdict); }`
      : `window.parent.postMessage(
           { type: ${JSON.stringify(ANYTHING_PROBE_MESSAGE_TYPE)},
             blank: verdict.blank, findings: verdict.findings, stats: verdict.stats,
             consoleErrors: verdict.consoleErrors, probeError: verdict.probeError || null },
           '*'
         );`;

  return `<script>(function () {
${PROBE_CHECKS_SOURCE}
  // Console capture must be installed BEFORE the page's own scripts run, which
  // is why this script belongs in <head> rather than at the end of <body>. The
  // jsdom engine gets this free from its VirtualConsole; a browser does not
  // hand console output back across a sandbox boundary, so we buffer it here
  // and ship it out with the verdict.
  var consoleErrors = [];
  try {
    var nativeError = console.error;
    console.error = function () {
      try {
        if (consoleErrors.length < 8) {
          consoleErrors.push(Array.prototype.map.call(arguments, String).join(' '));
        }
      } catch (e) { /* never let capture break the page */ }
      try { nativeError.apply(console, arguments); } catch (e) { /* ignore */ }
    };
  } catch (e) { /* console is not patchable here; carry on */ }

  function run() {
    var verdict;
    try {
      verdict = __archislopCollect();
    } catch (e) {
      verdict = { blank: false, findings: [], stats: {}, probeError: String((e && e.message) || e) };
    }
    verdict.consoleErrors = consoleErrors;
    try {
${deliver}
    } catch (e) { /* reporting must never break the page */ }
  }
  // Let the page's own init (DOMContentLoaded, rAF, timers) run first. Both the
  // load listener and the cap can fire, so guard against reporting twice.
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(run, ${Math.max(0, Number(settleMs) || 0)});
  }
  if (document.readyState === 'complete') { schedule(); }
  else { window.addEventListener('load', schedule); setTimeout(schedule, 1000); }
})();</script>`;
}
