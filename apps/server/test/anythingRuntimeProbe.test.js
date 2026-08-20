import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANYTHING_PROBE_MESSAGE_TYPE,
  anythingFindingSeverity,
  buildAnythingProbeScript
} from '../src/tools/anythingRuntimeProbe.js';

/**
 * The probe checks are shared verbatim between the production runtime rung
 * (anythingRuntimeBrowser.js) and the bench observer (anythingBrowserProbe.js).
 * anythingRuntimeCheck.test.js holds both engines to the same verdicts; these
 * tests cover the shared module's own seams — severity gating and script
 * transport — so a drift in the probe source fails here rather than only in a
 * slow browser run.
 */

test('anythingFindingSeverity maps known codes to hard vs soft', () => {
  assert.equal(anythingFindingSeverity('blank_canvas'), 'hard');
  assert.equal(anythingFindingSeverity('canvas_zero_size'), 'hard');
  assert.equal(anythingFindingSeverity('collapsed_element'), 'hard');
  assert.equal(anythingFindingSeverity('body_no_height'), 'hard');
  assert.equal(anythingFindingSeverity('low_contrast'), 'soft');
});

test('anythingFindingSeverity treats unknown codes as soft', () => {
  assert.equal(anythingFindingSeverity('some_future_check'), 'soft');
  assert.equal(anythingFindingSeverity(undefined), 'soft');
  assert.equal(anythingFindingSeverity(''), 'soft');
});

test('buildAnythingProbeScript defaults to postMessage transport in head', () => {
  const script = buildAnythingProbeScript();
  assert.match(script, /^<script>/);
  assert.match(script, /__archislopCollect/);
  assert.match(script, new RegExp(ANYTHING_PROBE_MESSAGE_TYPE));
  assert.match(script, /window\.parent\.postMessage/);
  assert.doesNotMatch(script, /getElementById\("__archislop_probe__"\)/);
});

test('buildAnythingProbeScript marker transport writes into a named element', () => {
  const script = buildAnythingProbeScript({
    transport: 'marker',
    markerId: '__custom_probe__'
  });
  assert.match(script, /getElementById\("__custom_probe__"\)/);
  assert.doesNotMatch(script, /window\.parent\.postMessage/);
});

test('buildAnythingProbeScript honours settleMs in the scheduled timeout', () => {
  const script = buildAnythingProbeScript({ settleMs: 400 });
  assert.match(script, /setTimeout\(run, 400\)/);
});

test('buildAnythingProbeScript clamps negative settleMs to zero', () => {
  const script = buildAnythingProbeScript({ settleMs: -50 });
  assert.match(script, /setTimeout\(run, 0\)/);
});

test('buildAnythingProbeScript patches console.error and ships consoleErrors with the verdict', () => {
  const script = buildAnythingProbeScript();
  assert.match(script, /console\.error = function/);
  assert.match(script, /verdict\.consoleErrors = consoleErrors/);
});
