import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { buildOfflineOracleReply, parseGodPetitionReply } from '../src/god/godPetitionPrompt.js';
import {
  dispatchPetitionWorkflow,
  filePetitionPr,
  inferGodWorkflowFocus
} from '../src/god/godPetitionPr.js';
import { createGodPetitionRouter } from '../src/routes/godPetition.js';
import { createGodWindowGate } from '../src/middleware/godWindowGate.js';
import { createGodStatusRouter } from '../src/routes/godStatus.js';

const PROPOSAL = {
  worthy: true,
  title: 'god-petition: add divine dark mode',
  branchSlug: 'add-divine-dark-mode',
  summary: 'Mortals demand darkness to hide their spaghetti diagrams.',
  targetArea: 'apps/web',
  implementationPlan: ['Add celestial CSS tokens', 'Wire toggle', 'Verify tests'],
  divineBlessing: 'May thy contrast ratios clear WCAG AA.'
};

async function bootApp({ petitionOptions = {}, withOwnerGate = false } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/god', createGodPetitionRouter(petitionOptions));
  if (withOwnerGate) {
    app.use('/api/god', createGodWindowGate({ env: { GOD_WINDOW_TOKEN: 'secret-owner-token' } }));
    app.use('/api/god', createGodStatusRouter());
  }
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((done) => {
        server.closeAllConnections?.();
        server.close(() => done());
      })
  };
}

test('parseGodPetitionReply extracts fenced JSON, clamps favorDelta, and sanitizes branchSlug', () => {
  const raw = [
    '```json',
    JSON.stringify({
      reply: 'LO MORTAL, THY YAML HATH REACHED HEAVEN.',
      favorDelta: 999,
      mood: 'benevolent',
      judgment: 'blessed by ci',
      prProposal: {
        worthy: true,
        title: 'feat: divine dark mode',
        branchSlug: 'Divine Dark Mode!!!',
        summary: 'Add sacred obsidian styling for late-night architects.',
        targetArea: 'apps/web',
        implementationPlan: ['Step 1', 'Step 2'],
        divineBlessing: 'Go forth and ship.'
      }
    }),
    '```'
  ].join('\n');

  const parsed = parseGodPetitionReply(raw, 40);
  assert.equal(parsed.favorDelta, 40);
  assert.equal(parsed.favor, 80);
  assert.equal(parsed.mood, 'benevolent');
  assert.equal(parsed.judgment, 'BLESSED BY CI');
  assert.equal(parsed.prProposal?.branchSlug, 'divine-dark-mode');
});

test('parseGodPetitionReply degrades gracefully when model outputs unstructured prose', () => {
  const parsed = parseGodPetitionReply('Thy architecture smells of burnt YAML.', 30);
  assert.match(parsed.reply, /burnt YAML/);
  assert.equal(parsed.favor, 35);
  assert.equal(parsed.prProposal, null);
  assert.equal(parsed.judgment, 'PROSE WITHOUT SCHEMA');
});

test('buildOfflineOracleReply roasts active diagram and grants a PR proposal for a pitched wish with offering', () => {
  const reply = buildOfflineOracleReply({
    messages: [
      {
        role: 'user',
        content: 'O Great Architect, I wish for a feature to export sacred SVG badges cleanly.'
      }
    ],
    offering: 'kubernetes_yaml',
    currentFavor: 40,
    userName: 'Gilfoyle',
    diagramContext: { contentType: 'mermaid', diagramSource: 'flowchart TD\nA-->B\nB-->C' }
  });

  assert.match(reply.reply, /GILFOYLE/);
  assert.match(reply.reply, /mermaid artifact \(3 lines/);
  assert.ok(reply.favor >= 70);
  assert.equal(reply.judgment, 'WORTHY OF A BRANCH');
  assert.ok(reply.prProposal);
  assert.equal(reply.prProposal.worthy, true);
});

test('buildOfflineOracleReply withholds PR proposal when favor is low and no wish was pitched', () => {
  const reply = buildOfflineOracleReply({
    messages: [{ role: 'user', content: 'hi' }],
    offering: 'none',
    currentFavor: 30
  });
  assert.equal(reply.prProposal, null);
  assert.ok(reply.favor < 30);
});

test('filePetitionPr returns a clear unconfigured scroll when no GitHub token is present', async () => {
  const res = await filePetitionPr({
    proposal: PROPOSAL,
    prayerSummary: 'Please add dark mode',
    favor: 78,
    userName: 'Dinesh',
    env: {},
    nowMs: () => Date.parse('2026-11-15T10:00:00.000Z')
  });

  assert.equal(res.filed, false);
  assert.equal(res.mode, 'unconfigured');
  assert.equal(res.reason, 'missing_github_token');
  assert.equal(res.branch, 'god-petition/add-divine-dark-mode-20261115100000');
  assert.equal(res.filePath, 'docs/petitions/add-divine-dark-mode-20261115100000.md');
  assert.match(res.ghCommand, /gh pr create/);
  assert.match(res.divineMessage, /GOD_PR_TOKEN/);
  assert.equal(res.workflowDispatch.status, 'unconfigured');
  assert.equal(res.workflowDispatch.dispatched, false);
  assert.match(res.workflowDispatch.ghWorkflowCommand, /gh workflow run god\.yml/);
});

test('inferGodWorkflowFocus maps proposal area/title to god.yml enum choices', () => {
  assert.equal(inferGodWorkflowFocus({ targetArea: 'apps/web', title: 'Studio button' }), 'ux');
  assert.equal(inferGodWorkflowFocus({ title: 'Fix mermaid flowchart quotes' }), 'mermaid');
  assert.equal(inferGodWorkflowFocus({ summary: 'Improve chart Flint labels' }), 'chart');
  assert.equal(inferGodWorkflowFocus({ summary: 'General refactor' }), 'any');
});

test('filePetitionPr creates branch, commits petition spec, opens PR, and dispatches god.yml', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', body: init.body });
    if (String(url).includes('/git/ref/heads/main')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ object: { sha: 'abc1234' } })
      };
    }
    if (String(url).endsWith('/git/refs')) {
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ ref: 'refs/heads/god-petition/x' })
      };
    }
    if (String(url).includes('/contents/docs/petitions/')) {
      return { ok: true, status: 201, text: async () => JSON.stringify({ content: {} }) };
    }
    if (String(url).endsWith('/pulls')) {
      return {
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({
            number: 999,
            html_url: 'https://github.com/acuhlmann/mermaid-gen/pull/999'
          })
      };
    }
    if (String(url).endsWith('/actions/workflows/god.yml/dispatches')) {
      return { ok: true, status: 204, text: async () => '' };
    }
    return { ok: false, status: 404, text: async () => 'not found' };
  };

  const res = await filePetitionPr({
    proposal: PROPOSAL,
    favor: 88,
    userName: 'Jared',
    env: { GOD_PR_TOKEN: 'ghp_super_secret_token' },
    fetchImpl,
    nowMs: () => Date.parse('2026-11-15T10:00:00.000Z')
  });

  assert.equal(res.filed, true);
  assert.equal(res.mode, 'github_pr');
  assert.equal(res.prNumber, 999);
  assert.equal(res.prUrl, 'https://github.com/acuhlmann/mermaid-gen/pull/999');
  assert.equal(calls.length, 5);
  assert.ok(calls[2].url.includes('docs/petitions/add-divine-dark-mode-20261115100000.md'));
  assert.ok(calls[4].url.endsWith('/actions/workflows/god.yml/dispatches'));
  const dispatchPayload = JSON.parse(calls[4].body);
  assert.equal(dispatchPayload.ref, 'god-petition/add-divine-dark-mode-20261115100000');
  assert.equal(dispatchPayload.inputs.tier, 'propose');
  assert.equal(dispatchPayload.inputs.focus, 'ux');
  assert.equal(res.workflowDispatch.dispatched, true);
  assert.equal(res.workflowDispatch.status, 'dispatched');
});

test('dispatchPetitionWorkflow falls back to baseBranch when a fresh branch returns 422', async () => {
  const refsTried = [];
  const fetchImpl = async (_url, init = {}) => {
    const body = JSON.parse(init.body);
    refsTried.push(body.ref);
    if (body.ref === 'god-petition/new') {
      return { ok: false, status: 422, text: async () => 'ref not indexed yet' };
    }
    return { ok: true, status: 204, text: async () => '' };
  };
  const res = await dispatchPetitionWorkflow({
    repo: 'acuhlmann/mermaid-gen',
    ref: 'god-petition/new',
    fallbackRef: 'main',
    focus: 'ux',
    env: { GOD_PR_TOKEN: 'ghp_test' },
    fetchImpl
  });
  assert.deepEqual(refsTried, ['god-petition/new', 'main']);
  assert.equal(res.dispatched, true);
  assert.equal(res.ref, 'main');
});

test('POST /api/god/petition/dispatch triggers workflow dispatch route cleanly', async () => {
  const app = await bootApp({
    petitionOptions: {
      env: {},
      dispatchWorkflow: async ({ ref, focus }) => ({
        attempted: true,
        dispatched: true,
        status: 'dispatched',
        workflow: 'god.yml',
        ref,
        focus,
        workflowUrl: 'https://github.com/acuhlmann/mermaid-gen/actions/workflows/god.yml',
        ghWorkflowCommand: 'gh workflow run god.yml',
        message: 'Dispatched!'
      })
    }
  });
  try {
    const res = await fetch(`${app.base}/api/god/petition/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ref: 'god-petition/x', focus: 'mermaid' })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.dispatched, true);
    assert.equal(body.focus, 'mermaid');
  } finally {
    await app.close();
  }
});

test('HTTP routes: capabilities, offline oracle, mocked LLM petition, file-pr, and owner gate isolation', async () => {
  const app = await bootApp({
    withOwnerGate: true,
    petitionOptions: {
      env: {},
      invokeModel: async () =>
        JSON.stringify({
          reply: 'BEHOLD, MORTAL. THY PRAYER HATH BEEN PARSED.',
          favorDelta: 30,
          mood: 'smitten',
          judgment: 'DIVINE MANDATE',
          prProposal: PROPOSAL
        })
    }
  });

  try {
    // Owner telemetry route remains locked behind GOD_WINDOW_TOKEN.
    const gated = await fetch(`${app.base}/api/god/status`);
    assert.equal(gated.status, 401);

    const capsRes = await fetch(`${app.base}/api/god/petition/capabilities`);
    assert.equal(capsRes.status, 200);
    const caps = await capsRes.json();
    assert.equal(caps.v, 1);
    assert.ok(Array.isArray(caps.offerings) && caps.offerings.length >= 4);

    const bad = await fetch(`${app.base}/api/god/petition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [] })
    });
    assert.equal(bad.status, 400);

    const prayRes = await fetch(`${app.base}/api/god/petition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Please grant me a dark mode PR' }],
        offering: 'kubernetes_yaml',
        currentFavor: 40
      })
    });
    assert.equal(prayRes.status, 200);
    const prayBody = await prayRes.json();
    assert.equal(prayBody.mode, 'llm');
    assert.equal(prayBody.favor, 70);
    assert.equal(prayBody.prProposal.title, PROPOSAL.title);

    const fileRes = await fetch(`${app.base}/api/god/petition/file-pr`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ proposal: PROPOSAL, favor: 70, userName: 'Richard' })
    });
    assert.equal(fileRes.status, 200);
    const fileBody = await fileRes.json();
    assert.equal(fileBody.filed, false);
    assert.equal(fileBody.mode, 'unconfigured');
  } finally {
    await app.close();
  }
});

test('POST /api/god/petition serves offline-oracle when LLM is unconfigured', async () => {
  const app = await bootApp({ petitionOptions: { env: {} } });
  try {
    const res = await fetch(`${app.base}/api/god/petition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'I wish for a better feature in Studio' }],
        offering: 'unused_microservices',
        currentFavor: 40
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.mode, 'offline-oracle');
    assert.equal(body.llmConfigured, false);
    assert.ok(body.prProposal);
  } finally {
    await app.close();
  }
});
