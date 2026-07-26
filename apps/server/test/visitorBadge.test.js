import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  VISITOR_BADGE_COOKIE,
  VISITOR_BADGE_MAX_AGE_SEC,
  buildVisitorBadgeHashSet,
  createVisitorBadgeGate,
  createVisitorBadgeUnlockHandler,
  doorCodeMatches,
  hashDoorCode,
  isVisitorBadgeGateActive,
  parseVisitorBadgeSecrets,
  readCookie,
  resolveVisitorBadgeCookieSecret,
  signVisitorBadgeCookie,
  verifyVisitorBadgeCookie
} from '../src/middleware/visitorBadge.js';
import { renderVisitorBadgePage } from '../src/middleware/visitorBadgePage.js';

test('parseVisitorBadgeSecrets splits and trims comma-separated codes', () => {
  assert.deepEqual(parseVisitorBadgeSecrets({ VISITOR_BADGE_SECRETS: '' }), []);
  assert.deepEqual(parseVisitorBadgeSecrets({}), []);
  assert.deepEqual(parseVisitorBadgeSecrets({ VISITOR_BADGE_SECRETS: ' a ,b,  ,c ' }), [
    'a',
    'b',
    'c'
  ]);
});

test('isVisitorBadgeGateActive is off when secrets unset', () => {
  assert.equal(isVisitorBadgeGateActive({}), false);
  assert.equal(isVisitorBadgeGateActive({ VISITOR_BADGE_SECRETS: 'door' }), true);
});

test('doorCodeMatches accepts any configured secret', () => {
  const hashSet = buildVisitorBadgeHashSet({ VISITOR_BADGE_SECRETS: 'alpha,beta' });
  assert.equal(doorCodeMatches('alpha', hashSet), true);
  assert.equal(doorCodeMatches('beta', hashSet), true);
  assert.equal(doorCodeMatches('gamma', hashSet), false);
  assert.equal(hashDoorCode('alpha').length, 64);
});

test('visitor badge cookie sign/verify round-trip and Max-Age constant', () => {
  assert.equal(VISITOR_BADGE_MAX_AGE_SEC, 30 * 24 * 60 * 60);
  const secret = 'test-cookie-secret';
  const exp = Math.floor(Date.now() / 1000) + VISITOR_BADGE_MAX_AGE_SEC;
  const value = signVisitorBadgeCookie({ exp }, secret);
  assert.deepEqual(verifyVisitorBadgeCookie(value, secret), { exp });
  assert.equal(verifyVisitorBadgeCookie(`${value}x`, secret), null);
  assert.equal(verifyVisitorBadgeCookie(value, secret, (exp + 1) * 1000), null);
});

test('resolveVisitorBadgeCookieSecret prefers invite then dedicated', () => {
  assert.equal(
    resolveVisitorBadgeCookieSecret({
      INVITE_TOKEN_SECRET: 'invite',
      VISITOR_BADGE_COOKIE_SECRET: 'badge'
    }),
    'invite'
  );
  assert.equal(resolveVisitorBadgeCookieSecret({ VISITOR_BADGE_COOKIE_SECRET: 'badge' }), 'badge');
  assert.ok(resolveVisitorBadgeCookieSecret({}).length > 0);
});

test('renderVisitorBadgePage includes door code field and unlock fetch', () => {
  const html = renderVisitorBadgePage({ errorMessage: 'nope' });
  assert.match(html, /Visitor Badge/);
  assert.match(html, /Door code/);
  assert.match(html, /\/api\/visitor-badge/);
  assert.match(html, /nope/);
});

function bootGatedApp(env) {
  const app = express();
  app.use(express.json());
  const hashSet = buildVisitorBadgeHashSet(env);
  app.post('/api/visitor-badge', createVisitorBadgeUnlockHandler({ env, hashSet }));
  app.use(createVisitorBadgeGate({ env, hashSet }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.all('/mcp', (_req, res) => res.json({ mcp: true }));
  app.get('/api/secret-data', (_req, res) => res.json({ secret: true }));
  app.get('/', (_req, res) => res.type('html').send('<html><body>app</body></html>'));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const closeServer = () =>
        new Promise((done) => {
          server.closeAllConnections?.();
          server.close(() => done());
        });
      resolve({ port, closeServer });
    });
  });
}

function parseSetCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length) return raw;
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

test('gate inactive when VISITOR_BADGE_SECRETS empty', async () => {
  const env = { VISITOR_BADGE_SECRETS: '', VISITOR_BADGE_COOKIE_SECRET: 't' };
  const { port, closeServer } = await bootGatedApp(env);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/secret-data`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { secret: true });
  } finally {
    await closeServer();
  }
});

test('gate blocks API without cookie and allows health + mcp', async () => {
  const env = {
    VISITOR_BADGE_SECRETS: 'friends-only',
    VISITOR_BADGE_COOKIE_SECRET: 'cookie-secret'
  };
  const { port, closeServer } = await bootGatedApp(env);
  try {
    const blocked = await fetch(`http://127.0.0.1:${port}/api/secret-data`);
    assert.equal(blocked.status, 401);
    assert.match((await blocked.json()).error, /Visitor Badge/i);

    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(health.status, 200);

    const mcp = await fetch(`http://127.0.0.1:${port}/mcp`);
    assert.equal(mcp.status, 200);

    const html = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { accept: 'text/html' }
    });
    assert.equal(html.status, 401);
    assert.match(await html.text(), /Visitor Badge/);
  } finally {
    await closeServer();
  }
});

test('unlock sets persistent cookie and subsequent requests succeed', async () => {
  const env = {
    VISITOR_BADGE_SECRETS: 'coffee-is-for-closers',
    VISITOR_BADGE_COOKIE_SECRET: 'cookie-secret'
  };
  const { port, closeServer } = await bootGatedApp(env);
  try {
    const bad = await fetch(`http://127.0.0.1:${port}/api/visitor-badge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorCode: 'wrong' })
    });
    assert.equal(bad.status, 401);

    const unlock = await fetch(`http://127.0.0.1:${port}/api/visitor-badge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doorCode: 'coffee-is-for-closers' })
    });
    assert.equal(unlock.status, 200);
    assert.deepEqual(await unlock.json(), { ok: true });

    const setCookies = parseSetCookie(unlock);
    assert.ok(setCookies.length >= 1, 'expected Set-Cookie');
    const cookieHeader = setCookies.join('\n');
    assert.match(cookieHeader, new RegExp(`${VISITOR_BADGE_COOKIE}=`));
    assert.match(cookieHeader, /Max-Age=2592000/i);
    assert.match(cookieHeader, /HttpOnly/i);
    assert.match(cookieHeader, /SameSite=Lax/i);

    const cookiePair = setCookies[0].split(';')[0];
    const fakeReq = { headers: { cookie: cookiePair } };
    assert.ok(readCookie(fakeReq, VISITOR_BADGE_COOKIE));

    const allowed = await fetch(`http://127.0.0.1:${port}/api/secret-data`, {
      headers: { cookie: cookiePair }
    });
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), { secret: true });

    const home = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { accept: 'text/html', cookie: cookiePair }
    });
    assert.equal(home.status, 200);
    assert.match(await home.text(), /<body>app<\/body>/);
  } finally {
    await closeServer();
  }
});
