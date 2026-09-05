import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { extractHostVerdict, interpretVerdict } from '../src/tools/anythingRuntimeBrowser.js';
import {
  DEFAULT_ANYTHING_RUNTIME_TIMEOUT_MS,
  isAnythingVisualRejectionEnabled,
  resolveAnythingRuntimeEngine,
  resolveAnythingRuntimeFallbackTimeoutMs,
  runAnythingRuntimeCheck
} from '../src/tools/anythingRuntimeCheck.js';

/**
 * Pure seams of the browser engine. The engine's *behaviour* is covered by
 * anythingRuntimeCheck.test.js, which runs unchanged against both engines and
 * is the real drift check between them — these tests cover the decision logic
 * that suite cannot reach directly (severity gating, verdict precedence, and
 * the engine/rejection switches).
 */

test('resolveAnythingRuntimeEngine honours explicit selection over availability', () => {
  // Explicit wins both ways, so `jsdom` is a one-variable production rollback
  // even on a host that has Chromium installed.
  assert.equal(resolveAnythingRuntimeEngine({ ANYTHING_RUNTIME_ENGINE: 'jsdom' }), 'jsdom');
  assert.equal(resolveAnythingRuntimeEngine({ ANYTHING_RUNTIME_ENGINE: 'browser' }), 'browser');
  assert.equal(resolveAnythingRuntimeEngine({ ANYTHING_RUNTIME_ENGINE: 'JSDOM' }), 'jsdom');
});

test('resolveAnythingRuntimeEngine falls back to jsdom when no browser resolves', () => {
  // `auto` must degrade rather than break: a contributor without Chromium still
  // gets a working gate, just one that cannot see layout or paint.
  const engine = resolveAnythingRuntimeEngine({
    ANYTHING_RUNTIME_ENGINE: 'auto',
    ANYTHING_BROWSER_BIN: '/nonexistent/not-a-browser'
  });
  assert.ok(engine === 'browser' || engine === 'jsdom');
});

test('visual rejection is off unless explicitly enabled', () => {
  // Off by default on purpose: enabling it adds a rejection reason, and every
  // extra rejection costs a 12-60s repair turn.
  assert.equal(isAnythingVisualRejectionEnabled({}), false);
  assert.equal(isAnythingVisualRejectionEnabled({ ANYTHING_RUNTIME_VISUAL_REJECT: '0' }), false);
  assert.equal(isAnythingVisualRejectionEnabled({ ANYTHING_RUNTIME_VISUAL_REJECT: '' }), false);
  assert.equal(isAnythingVisualRejectionEnabled({ ANYTHING_RUNTIME_VISUAL_REJECT: '1' }), true);
  assert.equal(isAnythingVisualRejectionEnabled({ ANYTHING_RUNTIME_VISUAL_REJECT: 'true' }), true);
  assert.equal(isAnythingVisualRejectionEnabled({ ANYTHING_RUNTIME_VISUAL_REJECT: 'on' }), true);
});

test('interpretVerdict reports script failures ahead of an empty body', () => {
  // A page that threw usually also rendered nothing. The exception is the
  // actionable diagnostic; "empty body" is just its consequence.
  const result = interpretVerdict({
    errors: [{ kind: 'error', message: 'Uncaught ReferenceError: boom is not defined' }],
    probe: { blank: true, findings: [], stats: {} }
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'runtime_error');
  assert.match(result.error, /boom is not defined/);
});

test('interpretVerdict de-duplicates repeated error messages', () => {
  const result = interpretVerdict({
    errors: [
      { message: 'same failure' },
      { message: 'same failure' },
      { message: 'other failure' }
    ],
    probe: { blank: false, findings: [], stats: {} }
  });
  assert.equal(result.code, 'runtime_error');
  assert.equal(result.error.match(/same failure/g).length, 1);
  assert.match(result.error, /other failure/);
});

test('interpretVerdict surfaces console.error as a warning, not a failure', () => {
  const result = interpretVerdict({
    errors: [],
    probe: { blank: false, findings: [], stats: {}, consoleErrors: ['just noise'] }
  });
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((w) => w.includes('just noise')));
});

test('visual findings are warnings by default, never rejections', () => {
  // The default posture: report the breakage, do not spend a repair turn on it.
  const result = interpretVerdict({
    errors: [],
    probe: {
      blank: false,
      findings: [{ code: 'blank_canvas', detail: 'canvas #0 has no painted pixels' }],
      stats: {}
    }
  });
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((w) => w.includes('blank_canvas')));
});

test('visual rejection fires only on hard findings, never on contrast', () => {
  const soft = interpretVerdict(
    {
      errors: [],
      probe: {
        blank: false,
        findings: [{ code: 'low_contrast', detail: 'ratio 4.19:1' }],
        stats: {}
      }
    },
    { rejectOnVisual: true }
  );
  // Contrast is legible. Rejecting on it would thrash the repair loop — 32 of
  // 35 accepted pages carried one in the generation baseline.
  assert.equal(soft.ok, true);
  assert.ok(soft.warnings.some((w) => w.includes('low_contrast')));

  const hard = interpretVerdict(
    {
      errors: [],
      probe: {
        blank: false,
        findings: [{ code: 'collapsed_element', detail: 'span.card is 0x0 but holds "x"' }],
        stats: {}
      }
    },
    { rejectOnVisual: true }
  );
  assert.equal(hard.ok, false);
  assert.equal(hard.code, 'visual_broken');
  assert.match(hard.error, /0x0/);
});

test('interpretVerdict fails open when the frame never reported', () => {
  // The frame may wedge before the probe runs. Blaming the page for the
  // harness's blind spot would block valid output.
  const result = interpretVerdict({ errors: [], probe: null });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
});

test('extractHostVerdict parses the host marker payload', () => {
  const dom =
    '<html><body><div id="__archislop_host__">' +
    '{&quot;errors&quot;:[],&quot;probe&quot;:{&quot;blank&quot;:false,&quot;findings&quot;:[]}}' +
    '</div></body></html>';
  const verdict = extractHostVerdict(dom);
  assert.deepEqual(verdict.errors, []);
  assert.equal(verdict.probe.blank, false);
});

test('extractHostVerdict returns null rather than throwing on a missing payload', () => {
  assert.equal(extractHostVerdict('<html><body>nothing</body></html>'), null);
  assert.equal(extractHostVerdict('<div id="__archislop_host__"></div>'), null);
  assert.equal(extractHostVerdict('<div id="__archislop_host__">not json</div>'), null);
});

test('a browser that hangs on startup does not reject a valid page', async (t) => {
  // Regression for a CI failure that is also a production path. The wall clock
  // covers the browser's startup AND the page's execution, so a cold launch is
  // indistinguishable from a hung page: on a GitHub runner the first two
  // launches took 6043ms and 6047ms against a 6000ms budget and were reported
  // as the page failing to settle, while every warm launch after finished in
  // 1-2.7s. Cloud Run scales to zero, so the first request after an idle period
  // pays exactly that cost, and a good page would be rejected into a repair turn.
  //
  // The engine distinguishes the two by evidence rather than by timing: a
  // timeout that produced no page verdict at all is treated as infrastructure
  // and fails open, so runAnythingRuntimeCheck falls back to jsdom — which has
  // no meaningful startup and can be trusted on the question.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anything-hangbin-'));
  const fakeBin = path.join(dir, 'hanging-browser');
  fs.writeFileSync(fakeBin, '#!/bin/sh\nexec sleep 600\n', { mode: 0o755 });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // The fallback's clock is pinned rather than left at its floor, because the
  // subject here is the fail-open *rule* — an evidence-free browser timeout
  // must not reject a good page — and not how fast jsdom happens to be. Left
  // at the floor this asserted both at once, and the second half is decided by
  // suite load: jsdom's measured p50 is ~1,009 ms (CLAUDE.md, Anything ladder)
  // against a 6,000 ms floor, and under a saturated full-suite run that
  // headroom disappears. It duly failed on clean `main` as one case out of 671
  // while passing 13/13 alone (issue #353). A number well clear of the floor
  // takes the runner's load out of the verdict; a fallback that still cannot
  // finish inside it is a real fault, which is what this should go red for.
  const result = await runAnythingRuntimeCheck(
    '<!DOCTYPE html><html><head></head><body><h1>fine</h1></body></html>',
    {
      env: {
        ANYTHING_RUNTIME_ENGINE: 'browser',
        ANYTHING_BROWSER_BIN: fakeBin,
        ANYTHING_RUNTIME_FALLBACK_TIMEOUT_MS: '30000'
      },
      timeoutMs: 1200
    }
  );

  // jsdom ran the page and found nothing wrong, so the page is accepted even
  // though the browser never produced a verdict.
  assert.equal(result.ok, true, JSON.stringify(result));
});

test("the jsdom fallback does not reshare the browser rung's clock", () => {
  // A budget tightened for the browser was meant for the browser. The fallback
  // has to spawn a child process and load jsdom inside whatever clock is left,
  // so resharing one turned an infrastructure shortfall into a page rejection.
  assert.equal(
    resolveAnythingRuntimeFallbackTimeoutMs({}, 200),
    DEFAULT_ANYTHING_RUNTIME_TIMEOUT_MS
  );
  assert.equal(
    resolveAnythingRuntimeFallbackTimeoutMs({}, 1200),
    DEFAULT_ANYTHING_RUNTIME_TIMEOUT_MS
  );

  // A budget RAISED for the browser was meant for both — heavy pages are heavy
  // in either engine — so the floor lifts rather than capping.
  assert.equal(resolveAnythingRuntimeFallbackTimeoutMs({}, 20000), 20000);

  // And it stays independently tunable, which is what makes it a budget rather
  // than a constant.
  assert.equal(
    resolveAnythingRuntimeFallbackTimeoutMs(
      { ANYTHING_RUNTIME_FALLBACK_TIMEOUT_MS: '2500' },
      20000
    ),
    2500
  );
  assert.equal(
    resolveAnythingRuntimeFallbackTimeoutMs({ ANYTHING_RUNTIME_FALLBACK_TIMEOUT_MS: '0' }, 1200),
    DEFAULT_ANYTHING_RUNTIME_TIMEOUT_MS
  );
  assert.equal(
    resolveAnythingRuntimeFallbackTimeoutMs({ ANYTHING_RUNTIME_FALLBACK_TIMEOUT_MS: 'soon' }, 1200),
    DEFAULT_ANYTHING_RUNTIME_TIMEOUT_MS
  );
});

test('a browser budget too tight to spawn jsdom still does not reject a valid page', async (t) => {
  // The deterministic half of the flake above, and the test that fails without
  // the fix. 200ms cannot cover a child-process spawn plus a jsdom import graph
  // on ANY machine, warm or cold — so while the two rungs shared a clock this
  // returned `runtime_timeout` every time, blaming a page that never ran for
  // the fallback's startup. The sibling test only caught it on a slow host,
  // which is why it was filed as a flake rather than as the bug it was pinning.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anything-tightbin-'));
  const fakeBin = path.join(dir, 'hanging-browser');
  fs.writeFileSync(fakeBin, '#!/bin/sh\nexec sleep 600\n', { mode: 0o755 });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const result = await runAnythingRuntimeCheck(
    '<!DOCTYPE html><html><head></head><body><h1>fine</h1></body></html>',
    { env: { ANYTHING_RUNTIME_ENGINE: 'browser', ANYTHING_BROWSER_BIN: fakeBin }, timeoutMs: 200 }
  );

  assert.equal(result.ok, true, JSON.stringify(result));
  // The browser's fail-open warning survives into the fallback's result — that
  // warning is the evidence that the rung skipped rather than passed.
  //
  // What must survive is the *category*, not the path. `anythingRuntimeBrowser.js`
  // declines to judge for six distinct infrastructure reasons (`no browser binary
  // found`, `could not stage page`, `browser spawn failed`, `browser timed out`,
  // `browser exited without a verdict`, `page never reported a verdict`) and all
  // six route through the same `failOpen()`; which one fires here is a property of
  // the OS, not of the rule under test. #356's reasoning applies verbatim: the
  // subject is the fail-open rule, and anything else the assertion happens to
  // depend on is an incident that will decide the verdict on its own.
  assert.ok(
    result.warnings.some((w) => w.startsWith('Runtime check skipped (')),
    JSON.stringify(result)
  );
  if (process.platform !== 'win32') {
    // The timeout path specifically stays pinned where it can be produced, because
    // it is the half #347 was about: the budget given here (200ms) cannot cover a
    // child-process spawn plus a jsdom import graph, so a browser that *starts and
    // starves* is what this fixture exists to create. Windows cannot spawn this
    // test's extensionless `#!/bin/sh` fixture at all — it reaches the same rule
    // through `browser spawn failed` — so requiring the timeout wording there
    // would assert an OS fact rather than a product one.
    assert.ok(
      result.warnings.some((w) => w.includes('browser timed out')),
      `POSIX runs the starved-spawn path, which is what the 200ms budget is for: ${JSON.stringify(result)}`
    );
  }
});

test('a genuinely hanging page is still rejected when the browser times out', async () => {
  // The other half, and the reason the carve-out is by evidence and not by
  // timing: failing open on an evidence-free timeout must not make genuinely
  // hanging pages acceptable. A sync loop blocks the dump too, so this also
  // reaches jsdom — which times out on its own and supplies the real verdict.
  //
  // The fallback budget is pinned rather than left at its floor only to keep
  // the test short: a page that never settles times out under any budget, so
  // the number cannot change the verdict here — which is exactly the property
  // that makes the separate clock safe.
  const result = await runAnythingRuntimeCheck(
    '<!DOCTYPE html><html><head></head><body><h1>spin</h1><script>while(true){}</script></body></html>',
    {
      env: { ANYTHING_RUNTIME_ENGINE: 'browser', ANYTHING_RUNTIME_FALLBACK_TIMEOUT_MS: '2500' },
      timeoutMs: 1500
    }
  );
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(result.code, 'runtime_timeout');
});
