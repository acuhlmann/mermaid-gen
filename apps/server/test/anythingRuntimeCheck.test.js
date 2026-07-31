import test from 'node:test';
import assert from 'node:assert/strict';
import { expandAnythingLibs } from '@archislop/shared/anythingLibVendor.js';
import {
  isAnythingRuntimeCheckEnabled,
  runAnythingRuntimeCheck
} from '../src/tools/anythingRuntimeCheck.js';

function doc(body, { head = '' } = {}) {
  return `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
}

test('isAnythingRuntimeCheckEnabled defaults on and honors kill switches', () => {
  assert.equal(isAnythingRuntimeCheckEnabled({}), true);
  assert.equal(isAnythingRuntimeCheckEnabled({ ANYTHING_RUNTIME_CHECK: '1' }), true);
  assert.equal(isAnythingRuntimeCheckEnabled({ ANYTHING_RUNTIME_CHECK: '0' }), false);
  assert.equal(isAnythingRuntimeCheckEnabled({ ANYTHING_RUNTIME_CHECK: 'false' }), false);
  assert.equal(isAnythingRuntimeCheckEnabled({ ANYTHING_RUNTIME_CHECK: 'off' }), false);
});

// Each case spawns a jsdom child with a hard deadline. Run serially so parallel
// workers in a full-suite run do not contend on CPU (see docs/agents/sensors.md).
test('runtime sandbox integration', { concurrency: false }, async (t) => {
  await t.test('accepts a working interactive page', async () => {
    const result = await runAnythingRuntimeCheck(
      doc(
        `<h1>Counter</h1><button id="b">+1</button>
         <script>
           let n = 0;
           document.getElementById('b').addEventListener('click', () => { n += 1; });
           requestAnimationFrame(() => { document.title = 'ready'; });
         </script>`
      ),
      { env: {} }
    );
    assert.equal(result.ok, true);
    assert.equal(result.skipped, undefined);
  });

  await t.test('rejects a page whose script throws at load', async () => {
    const result = await runAnythingRuntimeCheck(
      doc(`<h1>Broken</h1><script>definitelyNotDefined();</script>`),
      { env: {} }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'runtime_error');
    assert.match(result.error, /definitelyNotDefined/);
  });

  await t.test('rejects errors thrown from deferred init (setTimeout)', async () => {
    const result = await runAnythingRuntimeCheck(
      doc(`<h1>Later</h1><script>setTimeout(() => { missingInitFn(); }, 10);</script>`),
      { env: {} }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'runtime_error');
    assert.match(result.error, /missingInitFn/);
  });

  await t.test('rejects unhandled promise rejections', async () => {
    const result = await runAnythingRuntimeCheck(
      doc(`<h1>Promise</h1><script>Promise.reject(new Error('boom in promise'));</script>`),
      { env: {} }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'runtime_error');
    assert.match(result.error, /boom in promise/);
  });

  await t.test('rejects a page that renders an empty body', async () => {
    const result = await runAnythingRuntimeCheck(
      doc(`<script>const data = [1, 2, 3]; // builds nothing</script>`),
      { env: {} }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'blank_render');
    assert.match(result.error, /empty <body>/);
  });

  await t.test('accepts a page that builds its DOM from script', async () => {
    const result = await runAnythingRuntimeCheck(
      doc(
        `<script>
           const h = document.createElement('h1');
           h.textContent = 'built at runtime';
           document.body.appendChild(h);
         </script>`
      ),
      { env: {} }
    );
    assert.equal(result.ok, true);
  });

  await t.test('kills an infinite loop and reports a timeout', async () => {
    const result = await runAnythingRuntimeCheck(
      doc(`<h1>Spin</h1><script>while (true) {}</script>`),
      { env: {}, timeoutMs: 2000 }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'runtime_timeout');
    assert.match(result.error, /did not settle within 2000ms/);
  });

  await t.test('storage access fails like the real sandbox (opaque origin)', async () => {
    const result = await runAnythingRuntimeCheck(
      doc(`<h1>Store</h1><script>localStorage.setItem('k', 'v');</script>`),
      { env: {} }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'runtime_error');
    assert.match(result.error, /localStorage/);
  });

  await t.test('document.cookie access fails like the real sandbox', async () => {
    const result = await runAnythingRuntimeCheck(
      doc(`<h1>Cookie</h1><script>document.cookie = 'a=1';</script>`),
      { env: {} }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'runtime_error');
    assert.match(result.error, /cookie/i);
  });

  await t.test('unhandled fetch failures are rejected, matching connect-src none', async () => {
    const result = await runAnythingRuntimeCheck(
      doc(`<h1>Fetch</h1><script>fetch('/api/data').then((r) => r.json());</script>`),
      { env: {} }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'runtime_error');
    assert.match(result.error, /fetch/i);
  });

  await t.test('canvas, matchMedia, observers, and audio do not false-positive', async () => {
    const result = await runAnythingRuntimeCheck(
      doc(
        `<canvas id="c" width="200" height="100"></canvas>
         <script>
           const ctx = document.getElementById('c').getContext('2d');
           ctx.fillStyle = '#468';
           ctx.fillRect(0, 0, 200, 100);
           const grad = ctx.createLinearGradient(0, 0, 200, 0);
           grad.addColorStop(0, '#000');
           const w = ctx.measureText('hi').width + 10;
           if (matchMedia('(prefers-color-scheme: dark)').matches) { ctx.fill(); }
           new IntersectionObserver(() => {}).observe(document.body);
           new ResizeObserver(() => {}).observe(document.body);
           const audio = new AudioContext();
           const osc = audio.createOscillator();
           osc.connect(audio.destination);
           requestIdleCallback(() => {});
         </script>`
      ),
      { env: {} }
    );
    assert.equal(result.ok, true, JSON.stringify(result));
  });

  await t.test(
    'host-object monkey-patching (Tone.js pattern) does not false-positive on stubs',
    async () => {
      const result = await runAnythingRuntimeCheck(
        doc(
          `<h1>Patch</h1>
         <script>
           const ctx = new AudioContext();
           let target = ctx;
           while (!target.hasOwnProperty('state')) target = Object.getPrototypeOf(target);
           const { get, set } = Object.getOwnPropertyDescriptor(target, 'state');
           Object.defineProperty(ctx, 'state', { configurable: true, get, set });
           if (!('state' in ctx)) throw new Error('has trap missing');
         </script>`
        ),
        { env: {} }
      );
      assert.equal(result.ok, true, JSON.stringify(result));
    }
  );

  await t.test('vendored libraries execute cleanly in the sandbox (d3 + matter)', async () => {
    const { html, injected } = expandAnythingLibs(
      doc(
        `<h1>Libs</h1><svg id="viz"></svg><canvas id="world" width="200" height="100"></canvas>
         <script>
           d3.select('#viz').append('rect').attr('width', 10);
           const engine = Matter.Engine.create();
           const render = Matter.Render.create({
             canvas: document.getElementById('world'),
             engine,
             options: { width: 200, height: 100 }
           });
           Matter.Composite.add(engine.world, [
             Matter.Bodies.rectangle(100, 20, 30, 30),
             Matter.Bodies.rectangle(100, 90, 200, 10, { isStatic: true })
           ]);
           Matter.Render.run(render);
           Matter.Runner.run(Matter.Runner.create(), engine);
         </script>`,
        { head: '<!-- @lib:d3 --><!-- @lib:matter -->' }
      )
    );
    assert.deepEqual(injected, ['d3', 'matter']);
    const result = await runAnythingRuntimeCheck(html, { env: {} });
    assert.equal(result.ok, true, JSON.stringify(result));
  });

  await t.test('alert and console.error surface as warnings, not failures', async () => {
    const result = await runAnythingRuntimeCheck(
      doc(`<h1>Noisy</h1><script>alert('hi'); console.error('just noise');</script>`),
      { env: {} }
    );
    assert.equal(result.ok, true);
    assert.ok(result.warnings.length >= 1, JSON.stringify(result.warnings));
  });

  await t.test('fails open when the sandbox cannot produce a verdict', async () => {
    const result = await runAnythingRuntimeCheck(doc('<h1>x</h1>'), { env: {}, timeoutMs: 1 });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'runtime_timeout');
  });
});
