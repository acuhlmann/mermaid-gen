import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractProbeVerdict,
  findingSeverity,
  runAnythingBrowserProbe
} from '../scripts/anythingBrowserProbe.js';

/**
 * The browser probe is bench-only tooling (benchAnythingGeneration.js), not a
 * validation rung — nothing in the request path imports it. These tests cover
 * the two pure seams plus the fail-open contract, all without a browser, so the
 * suite stays fast and runs on machines with no Chromium installed.
 */

test('findingSeverity separates broken renders from craft violations', () => {
  // Hard = the page is broken as rendered; these are the only ones a rung could
  // justifiably reject on.
  assert.equal(findingSeverity('blank_canvas'), 'hard');
  assert.equal(findingSeverity('canvas_zero_size'), 'hard');
  assert.equal(findingSeverity('collapsed_element'), 'hard');
  assert.equal(findingSeverity('body_no_height'), 'hard');

  // Soft = legible but below the design guide's bar.
  assert.equal(findingSeverity('low_contrast'), 'soft');
});

test('findingSeverity treats an unknown code as soft, never inventing a hard failure', () => {
  // A new probe check that forgets to register its severity must not silently
  // start counting toward the "would a browser reject this" number.
  assert.equal(findingSeverity('some_future_check'), 'soft');
  assert.equal(findingSeverity(undefined), 'soft');
});

test('extractProbeVerdict parses the marker payload out of a dumped DOM', () => {
  const dom =
    '<html><body><h1>x</h1>' +
    '<div id="__ARCHISLOP_PROBE__" style="display:none">' +
    '{"findings":[{"code":"blank_canvas","detail":"canvas #0"}],"stats":{"canvases":1}}' +
    '</div></body></html>';

  const verdict = extractProbeVerdict(dom);
  assert.equal(verdict.findings.length, 1);
  assert.equal(verdict.findings[0].code, 'blank_canvas');
  assert.equal(verdict.stats.canvases, 1);
});

test('extractProbeVerdict un-escapes markup entities in the payload', () => {
  // --dump-dom escapes quotes and angle brackets inside text content, so the
  // JSON arrives entity-encoded and a naive JSON.parse would throw.
  const dom =
    '<div id="__ARCHISLOP_PROBE__">' +
    '{&quot;findings&quot;:[{&quot;code&quot;:&quot;collapsed_element&quot;,' +
    '&quot;detail&quot;:&quot;p is 0x18 but holds &amp;lt;hi&amp;gt;&quot;}]}' +
    '</div>';

  const verdict = extractProbeVerdict(dom);
  assert.equal(verdict.findings[0].code, 'collapsed_element');
});

test('extractProbeVerdict returns null rather than throwing on a missing or broken marker', () => {
  // A page that hung, crashed, or never ran the probe must read as "no verdict"
  // so the caller can fail open — not as a defect in the page.
  assert.equal(extractProbeVerdict('<html><body>no marker here</body></html>'), null);
  assert.equal(extractProbeVerdict('<div id="__ARCHISLOP_PROBE__"></div>'), null);
  assert.equal(extractProbeVerdict('<div id="__ARCHISLOP_PROBE__">not json</div>'), null);
  assert.equal(extractProbeVerdict(''), null);
});

test('runAnythingBrowserProbe fails open when no browser binary is available', async () => {
  // The bench must stay usable on a machine with no Chromium. Manufacturing a
  // finding here would be worse than reporting nothing, because it would show up
  // as the page being broken.
  const result = await runAnythingBrowserProbe('<html><body><p>hi</p></body></html>', {
    binPath: '/nonexistent/definitely-not-a-browser'
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
  assert.equal(result.findings, undefined);
});
