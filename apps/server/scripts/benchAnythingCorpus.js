/**
 * Fixed corpus for benchAnything.js. Each case is a full Anything-mode HTML
 * document plus the outcome the validation ladder is expected to produce.
 *
 * Kinds:
 *   valid    — must stay accepted (regression = ladder got stricter than browsers)
 *   policy   — sandbox-contract / lib-allowlist violations; must stay rejected
 *              (regression = safety gate weakened)
 *   quality  — static structure/JS/CSS defects; must stay rejected
 *   runtime  — pages that only fail when executed; must stay rejected by the runtime check
 *   shape    — not a usable document at all; must stay rejected
 */

const page = (body, { head = '', doctype = true } = {}) =>
  `${doctype ? '<!DOCTYPE html>\n' : ''}<html>\n<head><style>body { margin: 0; font-family: sans-serif; }</style>${head}</head>\n<body>\n${body}\n</body>\n</html>`;

export const ANYTHING_BENCH_CORPUS = [
  // ── valid: must stay accepted ────────────────────────────────────────────
  {
    id: 'valid-static',
    kind: 'valid',
    expectedAccept: true,
    html: page('<h1>Tides</h1><p>Two high tides a day, dragged around by the Moon.</p>')
  },
  {
    id: 'valid-interactive',
    kind: 'valid',
    expectedAccept: true,
    html: page(
      `<h1>Counter</h1><button id="b">Add</button><output id="o">0</output>
<script>
  const o = document.getElementById('o');
  let n = 0;
  document.getElementById('b').addEventListener('click', () => { n += 1; o.textContent = String(n); });
</script>`
    )
  },
  {
    id: 'valid-raf-animation',
    kind: 'valid',
    expectedAccept: true,
    html: page(
      `<h1>Orbit</h1><canvas id="c" width="200" height="200"></canvas>
<script>
  const ctx = document.getElementById('c').getContext('2d');
  let t = 0;
  function frame() {
    t += 0.02;
    ctx.clearRect(0, 0, 200, 200);
    ctx.fillRect(100 + Math.cos(t) * 60, 100 + Math.sin(t) * 60, 6, 6);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
</script>`
    )
  },
  {
    id: 'valid-module-script',
    kind: 'valid',
    expectedAccept: true,
    html: page(
      `<h1>Module</h1><p id="out">…</p>
<script type="module">
  const facts = ['a', 'b'];
  document.getElementById('out').textContent = facts.join(', ');
</script>`
    )
  },
  {
    // Regression case for the optional-end-tag false positive: spec-valid HTML
    // with implied closers used to be rejected as "unclosed_tag".
    id: 'valid-optional-closers',
    kind: 'valid',
    expectedAccept: true,
    html: page(
      `<h1>Lists</h1>
<p>First paragraph<p>Second paragraph
<ul><li>one<li>two</ul>
<table><thead><tr><th>A<th>B<tbody><tr><td>1<td>2</table>`
    )
  },
  {
    id: 'valid-domcontentloaded-init',
    kind: 'valid',
    expectedAccept: true,
    html: page(
      `<div id="app"></div>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('app').innerHTML = '<h1>Booted</h1><p>Init built this.</p>';
  });
</script>`
    )
  },
  {
    // Allowlisted lib marker: the runtime check must execute the page WITH the
    // vendored d3 injected (regression = expansion dropped from the ladder).
    id: 'valid-lib-d3',
    kind: 'valid',
    expectedAccept: true,
    html: page(
      `<h1>Bars</h1><svg id="viz" width="300" height="120"></svg>
<script>
  const data = [4, 8, 15, 16, 23, 42];
  d3.select('#viz').selectAll('rect').data(data).join('rect')
    .attr('x', (d, i) => i * 48)
    .attr('y', (d) => 120 - d * 2)
    .attr('width', 40)
    .attr('height', (d) => d * 2)
    .attr('fill', 'steelblue');
</script>`,
      { head: '<!-- @lib:d3 -->' }
    )
  },
  {
    // Second allowlisted lib: physics via matter must execute under the
    // runtime check's canvas stubs (regression = a lib bump or stub change
    // breaks lib pages while plain pages keep passing).
    id: 'valid-lib-matter',
    kind: 'valid',
    expectedAccept: true,
    html: page(
      `<h1>Drop</h1><canvas id="world" width="400" height="300"></canvas>
<script>
  const engine = Matter.Engine.create();
  const render = Matter.Render.create({
    canvas: document.getElementById('world'),
    engine,
    options: { width: 400, height: 300 }
  });
  Matter.Composite.add(engine.world, [
    Matter.Bodies.rectangle(200, 40, 60, 60),
    Matter.Bodies.circle(240, 0, 24),
    Matter.Bodies.rectangle(200, 290, 400, 20, { isStatic: true })
  ]);
  Matter.Render.run(render);
  Matter.Runner.run(Matter.Runner.create(), engine);
</script>`,
      { head: '<!-- @lib:matter -->' }
    )
  },

  // ── policy: sandbox-contract violations, must stay rejected ─────────────
  {
    id: 'policy-external-script',
    kind: 'policy',
    expectedAccept: false,
    expectedCode: 'external_script',
    html: page('<h1>CDN</h1>', {
      head: '<script src="https://cdn.example.com/d3.min.js"></script>'
    })
  },
  {
    id: 'policy-fetch-url',
    kind: 'policy',
    expectedAccept: false,
    expectedCode: 'external_url',
    html: page(`<h1>Fetcher</h1><script>fetch('https://api.example.com/data');</script>`)
  },
  {
    id: 'policy-parent-escape',
    kind: 'policy',
    expectedAccept: false,
    expectedCode: 'parent_escape',
    html: page(`<h1>Escape</h1><script>window.parent.postMessage('hi', '*');</script>`)
  },
  {
    id: 'policy-nested-iframe',
    kind: 'policy',
    expectedAccept: false,
    expectedCode: 'embedded_browsing',
    html: page('<h1>Frame</h1><iframe srcdoc="<p>inner</p>"></iframe>')
  },
  {
    // Markup-only lint used to miss JS-created frames; runtime then reported
    // SecurityError on contentWindow access (generation bench: layout-dashboard).
    id: 'policy-js-iframe-create',
    kind: 'policy',
    expectedAccept: false,
    expectedCode: 'embedded_browsing',
    html: page(`<h1>Preview</h1><div id="host"></div>
<script>
  const frame = document.createElement('iframe');
  frame.srcdoc = '<p>inner</p>';
  document.getElementById('host').appendChild(frame);
  frame.contentWindow.document.title = 'x';
</script>`)
  },
  {
    // Lib markers are an allowlist: unknown ids must stay rejected (regression
    // = arbitrary marker ids silently pass and render as dead comments).
    id: 'policy-unknown-lib',
    kind: 'policy',
    expectedAccept: false,
    expectedCode: 'unknown_lib',
    html: page('<h1>jQuery page</h1>', { head: '<!-- @lib:jquery -->' })
  },

  // ── quality: static defects, must stay rejected ──────────────────────────
  {
    id: 'quality-js-syntax',
    kind: 'quality',
    expectedAccept: false,
    expectedCode: 'script_syntax',
    html: page('<h1>Broken</h1><script>function ( { nope</script>')
  },
  {
    // Regression case for the module-script gap: bad syntax inside
    // <script type="module"> used to skip the acorn check entirely (and jsdom
    // does not execute module scripts, so the runtime layer missed it too).
    id: 'quality-module-js-syntax',
    kind: 'quality',
    expectedAccept: false,
    expectedCode: 'script_syntax',
    html: page('<h1>Broken module</h1><script type="module">const x = {;</script>')
  },
  {
    id: 'quality-unclosed-div',
    kind: 'quality',
    expectedAccept: false,
    expectedCode: 'unclosed_tag',
    html: page('<div class="panel"><h1>Half a panel</h1>')
  },
  {
    id: 'quality-css-unbalanced',
    kind: 'quality',
    expectedAccept: false,
    expectedCode: 'css_unbalanced',
    html: page('<h1>Styles</h1>', { head: '<style>h1 { color: red;</style>' })
  },

  // ── runtime: only fail when executed, must stay rejected ────────────────
  {
    id: 'runtime-throw',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page('<h1>Boom</h1><script>renderChartThatDoesNotExist();</script>')
  },
  {
    id: 'runtime-blank',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'blank_render',
    html: page(`<script>console.log('I rendered nothing');</script>`)
  },
  {
    id: 'runtime-hang',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_timeout',
    html: page('<h1>Spin</h1><script>while (true) { Math.random(); }</script>')
  },
  {
    // Libraries exist only behind their marker: d3 without <!-- @lib:d3 -->
    // must fail at execution (regression = ambient injection crept in).
    id: 'runtime-lib-without-marker',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page(`<h1>No marker</h1><svg id="viz"></svg><script>d3.select('#viz');</script>`)
  },

  // ── shape: not a document, must stay rejected ────────────────────────────
  {
    id: 'shape-not-markup',
    kind: 'shape',
    expectedAccept: false,
    html: 'Here is a nice page about tides! It has two sections and a footer.'
  },
  {
    id: 'shape-oversize',
    kind: 'shape',
    expectedAccept: false,
    html: page(`<h1>Huge</h1><p>${'x'.repeat(210_000)}</p>`)
  }
];
