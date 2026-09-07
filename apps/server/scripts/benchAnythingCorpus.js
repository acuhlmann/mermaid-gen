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
    // Regression case for the CSS-comment false positive: a `/* ... { ... } ... */`
    // comment explaining brace-using syntax used to defeat checkCssBalance, which
    // counted braces inside comments same as live rules — `css_unbalanced` was an
    // unexamined top code in the 2026-09-04 generation baseline. Pins that a
    // brace mentioned only in a comment no longer trips the counter.
    id: 'valid-css-comment-with-brace',
    kind: 'valid',
    expectedAccept: true,
    html: page('<h1>Styled</h1>', {
      head: '<style>/* grid-template-areas uses a { region } string, not real braces */ h1 { color: teal; }</style>'
    })
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
  {
    // A <script> cut short before its closing tag (generation truncated
    // mid-page) used to defeat the comment stripper: with no literal
    // `</script>` to match, the whole unclosed body stayed unstripped, so a
    // plain `//` line comment inside it read as an external URL —
    // `external_url` was the largest bucket in the 2026-09-04 generation
    // baseline, and both repro docs were truncated mid-script, not a real
    // URL. Pins that this now falls through to the real defect.
    id: 'quality-unclosed-script-with-comment',
    kind: 'quality',
    expectedAccept: false,
    expectedCode: 'unclosed_tag',
    html: page('<h1>Cut short</h1><script>\nconst angle = 0.9; // radians\nconst x = 1;')
  },
  {
    // maskRawTextElementBodies had the same "no literal closer, so the raw
    // body stays unmasked" gap #538 fixed in stripNonLoadContexts, but for
    // the tag-balance checker instead of the URL scanner: a truncated
    // <script> whose body contains a `<` comparison (e.g. `i<dot.length`,
    // a normal loop condition) let checkUnclosedTags scan real JS as HTML
    // and report a bogus "Unclosed <dot> tag." instead of the real
    // "Unclosed <script> tag." — reproduced from a live generation-bench
    // run (2026-09-06) whose model output was cut off mid-script. Pins
    // that the real defect is named, not a tag that was never there.
    id: 'quality-unclosed-script-with-comparison',
    kind: 'quality',
    expectedAccept: false,
    expectedCode: 'unclosed_tag',
    html: page(
      '<h1>Cut short</h1><script>\nfor (var i = 0; i<dot.length; i++) {\n  console.log(i);'
    )
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
  {
    // getTotalLength lives on SVGGeometryElement, so <rect> HAS it in a real browser and
    // only jsdom's stub throws — reaching for a <g> wrapper (or any non-geometry node) is
    // the mistake the generation bench actually hit on layout dashboards, and it throws in
    // both engines. Regression = the engines have drifted apart again.
    id: 'runtime-svg-gettotallength',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page(
      `<h1>Bad stroke</h1>
<svg width="200" height="40"><g id="bar"><rect x="0" y="10" width="180" height="20" fill="#06c"/></g></svg>
<script>
  const bar = document.getElementById('bar');
  bar.style.strokeDasharray = bar.getTotalLength();
</script>`
    )
  },
  {
    // d3.forceLink resolves source/target against node ids — a link pointing at a name
    // absent from the nodes array is the dominant generation-bench runtime_error class
    // (lib-d3-network "node not found: undefined"). Regression = the runtime check stopped
    // executing force simulations.
    id: 'runtime-d3-force-link-mismatch',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page(
      `<h1>Graph</h1><svg width="200" height="200"></svg>
<script>
  const nodes = [{ id: 'a' }, { id: 'b' }];
  const links = [{ source: 'a', target: 'missing' }];
  d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id))
    .force('charge', d3.forceManyBody());
</script>`,
      { head: '<!-- @lib:d3 -->' }
    )
  },
  {
    // d3.drag().on('end', dragended) with no dragended binding — lib-d3-network
    // first-pass "dragended is not defined". Regression = runtime check stopped
    // executing drag setup.
    id: 'runtime-d3-drag-handler-missing',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page(
      `<h1>Graph</h1><svg width="200" height="200"></svg>
<script>
  const svg = d3.select('svg');
  svg.selectAll('circle').data([{ id: 'a' }]).join('circle').call(d3.drag().on('end', dragended));
</script>`,
      { head: '<!-- @lib:d3 -->' }
    )
  },
  {
    // game-memory first-pass "a.slice is not a function": the model shuffles a
    // NodeList from querySelectorAll as if it were an Array. Regression = both
    // engines drift.
    id: 'runtime-nodelist-slice',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page(
      `<h1>Cards</h1>
<div class="card">A</div><div class="card">B</div><div class="card">C</div>
<script>
  const cards = document.querySelectorAll('.card');
  cards.slice(0, 2);
</script>`
    )
  },
  {
    // lib-matter-stack first-pass "box.setStatic is not a function": the model treats
    // Matter bodies like OOP instances. Regression = both engines drift.
    id: 'runtime-matter-setstatic',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page(
      `<h1>Stack</h1><canvas id="stage" width="320" height="240"></canvas>
<script>
  const { Engine, Render, Bodies, Runner } = Matter;
  const engine = Engine.create();
  const box = Bodies.rectangle(160, 40, 40, 40);
  box.setStatic(true);
  const render = Render.create({ canvas: document.getElementById('stage'), engine });
  Runner.run(Runner.create(), engine);
  Render.run(render);
</script>`,
      { head: '<!-- @lib:matter -->' }
    )
  },
  {
    // lib-matter-stack first-pass "Runner.tick is not a function": the model calls
    // runner.tick(engine) as an instance method instead of the static
    // Matter.Runner.tick(runner, engine, time). Regression = both engines drift.
    id: 'runtime-matter-runner-tick',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page(
      `<h1>Stack</h1><canvas id="stage" width="320" height="240"></canvas>
<script>
  const { Engine, Bodies, Composite, Runner } = Matter;
  const engine = Engine.create();
  Composite.add(engine.world, Bodies.rectangle(160, 40, 40, 40));
  const runner = Runner.create();
  runner.tick(engine);
</script>`,
      { head: '<!-- @lib:matter -->' }
    )
  },
  {
    // lib-matter-stack first-pass "Matter.Sleeping.setEnabled is not a function": the
    // model hallucinates a toggle method on the Sleeping module instead of setting the
    // Engine's own enableSleeping boolean. Regression = both engines drift.
    id: 'runtime-matter-sleeping-setenabled',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page(
      `<h1>Stack</h1><canvas id="stage" width="320" height="240"></canvas>
<script>
  const { Engine, Bodies, Composite } = Matter;
  const engine = Engine.create();
  Matter.Sleeping.setEnabled(engine, true);
  Composite.add(engine.world, Bodies.rectangle(160, 40, 40, 40));
</script>`,
      { head: '<!-- @lib:matter -->' }
    )
  },
  {
    // lib-matter-stack first-pass "Cannot read properties of undefined (reading
    // 'position')": a resize/init handler calls Matter.Body.setPosition on a body
    // variable before the function that creates it has run. Guarding on the Engine
    // existing doesn't catch this — the body itself is still undefined. Regression =
    // both engines drift.
    id: 'runtime-matter-body-before-create',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page(
      `<h1>Stack</h1><canvas id="stage" width="320" height="240"></canvas>
<script>
  const { Engine, Bodies, Composite, Body } = Matter;
  const engine = Engine.create();
  let ground;
  function reposition() {
    if (engine) {
      Body.setPosition(ground, { x: 160, y: 220 });
    }
  }
  reposition();
  ground = Bodies.rectangle(160, 220, 320, 20, { isStatic: true });
  Composite.add(engine.world, ground);
</script>`,
      { head: '<!-- @lib:matter -->' }
    )
  },
  {
    // lib-matter-stack first-pass "Matter.Body.setDimensions is not a function": the
    // model treats a body's shape as resizable in place instead of scaling or
    // recreating it. Regression = both engines drift.
    id: 'runtime-matter-body-setdimensions',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page(
      `<h1>Stack</h1><canvas id="stage" width="320" height="240"></canvas>
<script>
  const { Engine, Bodies, Composite, Body } = Matter;
  const engine = Engine.create();
  const ground = Bodies.rectangle(160, 220, 1, 1, { isStatic: true });
  Composite.add(engine.world, ground);
  Body.setDimensions(ground, { width: 320, height: 20 });
</script>`,
      { head: '<!-- @lib:matter -->' }
    )
  },
  {
    // lib-matter-stack first-pass "Cannot access 'body' before initialization": the
    // model reads the const it is still assigning (id: body && body.id) inside the
    // object literal that initializes it — a TDZ self-reference, not the "line above
    // its declaration" case the existing rule already covered. Regression = both
    // engines drift.
    id: 'runtime-const-self-reference-init',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page(
      `<h1>Cards</h1><div id="out"></div>
<script>
  function makeCard(label) {
    const card = { label: label, prevId: card && card.id };
    return card;
  }
  document.getElementById('out').textContent = JSON.stringify(makeCard('A'));
</script>`
    )
  },
  {
    // layout-dashboard first-pass "k.fmt is not a function": the model treats a KPI
    // data row as if it carried its own formatter. Regression = both engines drift.
    id: 'runtime-fmt-on-data-row',
    kind: 'runtime',
    expectedAccept: false,
    expectedCode: 'runtime_error',
    html: page(
      `<h1>Dashboard</h1><output id="kpi">…</output>
<script>
  const k = { label: 'Revenue', value: 10810 };
  document.getElementById('kpi').textContent = k.fmt(k.value);
</script>`
    )
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
