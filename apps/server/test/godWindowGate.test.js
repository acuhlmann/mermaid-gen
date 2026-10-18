import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  GOD_WINDOW_COOKIE,
  GOD_WINDOW_MAX_AGE_SEC,
  createGodWindowGate,
  createGodWindowUnlockHandler,
  isGodWindowEnabled,
  resolveGodWindowCookieSecret,
  signGodWindowCookie,
  verifyGodWindowCookie
} from '../src/middleware/godWindowGate.js';
import { signVisitorBadgeCookie } from '../src/middleware/visitorBadge.js';

const TOKEN = 'owner-token-value';
const ENV = { GOD_WINDOW_TOKEN: TOKEN };

function res() {
  return {
    statusCode: 200,
    body: null,
    type: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    }
  };
}

function cookieFor(secret, payload) {
  return signGodWindowCookie(payload, secret);
}

test('isGodWindowEnabled is false for a missing or blank token', () => {
  assert.equal(isGodWindowEnabled({}), false);
  assert.equal(isGodWindowEnabled({ GOD_WINDOW_TOKEN: '' }), false);
  assert.equal(isGodWindowEnabled({ GOD_WINDOW_TOKEN: '   ' }), false);
  assert.equal(isGodWindowEnabled({ GOD_WINDOW_TOKEN: TOKEN }), true);
});

test('the cookie secret is dedicated, or derived from the token — never a published constant', () => {
  assert.equal(
    resolveGodWindowCookieSecret({
      GOD_WINDOW_COOKIE_SECRET: 'dedicated',
      GOD_WINDOW_TOKEN: TOKEN
    }),
    'dedicated'
  );
  const derived = resolveGodWindowCookieSecret({ GOD_WINDOW_TOKEN: TOKEN });
  assert.equal(derived, `archislop-god-window:${TOKEN}`);
  // The visitor-badge fallback is the thing this gate exists to avoid.
  assert.ok(!derived.includes('dev-cookie-secret'));
});

test('a valid, scoped, unexpired cookie verifies', () => {
  const secret = resolveGodWindowCookieSecret(ENV);
  const exp = Math.floor(Date.now() / 1000) + 60;
  assert.deepEqual(verifyGodWindowCookie(cookieFor(secret, { scope: 'god', exp }), secret), {
    exp
  });
});

test('the scope claim is what stops a visitor badge from opening the window', () => {
  const secret = resolveGodWindowCookieSecret(ENV);
  const exp = Math.floor(Date.now() / 1000) + 60;

  // Same secret, same shape, no `scope` — this is exactly a visitor badge cookie.
  const badge = signVisitorBadgeCookie({ exp }, secret);
  assert.equal(verifyGodWindowCookie(badge, secret), null);

  // And an explicit non-owner scope is refused too.
  assert.equal(verifyGodWindowCookie(cookieFor(secret, { scope: 'badge', exp }), secret), null);
});

test('expired, tampered, malformed and foreign-secret cookies are all refused', () => {
  const secret = resolveGodWindowCookieSecret(ENV);
  const past = Math.floor(Date.now() / 1000) - 1;
  assert.equal(verifyGodWindowCookie(cookieFor(secret, { scope: 'god', exp: past }), secret), null);

  const good = cookieFor(secret, { scope: 'god', exp: past + 3600 });
  const [body, sig] = good.split('.');
  assert.equal(verifyGodWindowCookie(`${body}.${sig.slice(0, -2)}xx`, secret), null);
  // Signed by someone who does not hold the secret.
  assert.equal(
    verifyGodWindowCookie(cookieFor('other-secret', { scope: 'god', exp: past + 3600 }), secret),
    null
  );

  assert.equal(verifyGodWindowCookie(undefined, secret), null);
  assert.equal(verifyGodWindowCookie('noco-dot', secret), null);
  assert.equal(verifyGodWindowCookie(`${Buffer.from('{}').toString('base64url')}.x`, secret), null);
});

test('the gate fails closed: no token means 503 and never reaches the router', () => {
  const gate = createGodWindowGate({ env: {} });
  const response = res();
  let nextCalls = 0;
  gate({ headers: {} }, response, () => {
    nextCalls += 1;
  });
  assert.equal(nextCalls, 0);
  assert.equal(response.statusCode, 503);
});

test('the gate refuses a request with no cookie, and passes one held by the owner', () => {
  const secret = resolveGodWindowCookieSecret(ENV);
  const cookie = cookieFor(secret, {
    scope: 'god',
    exp: Math.floor(Date.now() / 1000) + GOD_WINDOW_MAX_AGE_SEC
  });

  const anonymous = res();
  let nextCalls = 0;
  createGodWindowGate({ env: ENV })({ headers: {} }, anonymous, () => {
    nextCalls += 1;
  });
  assert.equal(nextCalls, 0);
  assert.equal(anonymous.statusCode, 401);

  const owner = res();
  createGodWindowGate({ env: ENV })(
    { headers: { cookie: `${GOD_WINDOW_COOKIE}=${encodeURIComponent(cookie)}` } },
    owner,
    () => {
      nextCalls += 1;
    }
  );
  assert.equal(nextCalls, 1);
  assert.equal(owner.statusCode, 200);
});

test('a hostile cookie header that is not valid percent-encoding is refused, not thrown', () => {
  const gate = createGodWindowGate({ env: ENV });
  const response = res();
  assert.doesNotThrow(() =>
    gate({ headers: { cookie: `${GOD_WINDOW_COOKIE}=%` } }, response, () => {})
  );
  assert.equal(response.statusCode, 401);
});

test('unlock: refused without the token, cookie granted with it', () => {
  const wrong = res();
  createGodWindowUnlockHandler({ env: ENV })({ body: { token: 'nope' } }, wrong);
  assert.equal(wrong.statusCode, 401);
  assert.equal(wrong.headers['Set-Cookie'], undefined);

  const blank = res();
  createGodWindowUnlockHandler({ env: ENV })({ body: {} }, blank);
  assert.equal(blank.statusCode, 401);

  const ok = res();
  createGodWindowUnlockHandler({ env: ENV })({ body: { token: TOKEN } }, ok);
  assert.equal(ok.statusCode, 200);
  const setCookie = ok.headers['Set-Cookie'];
  assert.ok(setCookie.startsWith(`${GOD_WINDOW_COOKIE}=`));
  assert.ok(setCookie.includes('HttpOnly'));
  assert.ok(setCookie.includes('SameSite=Lax'));
  // Path-scoped: this credential must not ride along on every app request.
  assert.ok(setCookie.includes('Path=/api/god'));
  assert.ok(setCookie.includes(`Max-Age=${GOD_WINDOW_MAX_AGE_SEC}`));
  assert.ok(!setCookie.includes('Secure'), 'Secure is a production-only attribute');
});

test('unlock sets Secure in production and answers 503 when no token is configured', () => {
  const prod = res();
  createGodWindowUnlockHandler({ env: { GOD_WINDOW_TOKEN: TOKEN, NODE_ENV: 'production' } })(
    { body: { token: TOKEN } },
    prod
  );
  assert.ok(prod.headers['Set-Cookie'].includes('Secure'));

  const unconfigured = res();
  createGodWindowUnlockHandler({ env: {} })({ body: { token: TOKEN } }, unconfigured);
  assert.equal(unconfigured.statusCode, 503);
  assert.equal(unconfigured.headers['Set-Cookie'], undefined);
});

test('unlock throttles repeated attempts, so a short token is not guessable at speed', () => {
  const handler = createGodWindowUnlockHandler({ env: ENV, maxAttemptsPerWindow: 3 });
  const req = { ip: '203.0.113.7', body: { token: 'nope' } };

  const codes = [];
  for (let i = 0; i < 5; i += 1) {
    const r = res();
    handler(req, r);
    codes.push(r.statusCode);
  }
  // Three charged attempts, then the door closes for the window — even for the right token.
  assert.deepEqual(codes, [401, 401, 401, 429, 429]);
});

test('a blank attempt is charged too, so the route cannot be probed for free', () => {
  const handler = createGodWindowUnlockHandler({ env: ENV, maxAttemptsPerWindow: 2 });
  const codes = [];
  for (const body of [{}, { token: '   ' }, { token: 'x' }]) {
    const r = res();
    handler({ ip: '198.51.100.4', body }, r);
    codes.push(r.statusCode);
  }
  assert.deepEqual(codes, [401, 401, 429]);
});

test('throttling is per client IP, and a locked-out caller is refused even with the right token', () => {
  const handler = createGodWindowUnlockHandler({ env: ENV, maxAttemptsPerWindow: 2 });
  const attacker = { ip: '203.0.113.9', body: { token: 'nope' } };
  for (let i = 0; i < 2; i += 1) handler(attacker, res());

  // A different IP is unaffected by that one's lockout.
  const other = res();
  handler({ ip: '198.51.100.9', body: { token: 'nope' } }, other);
  assert.equal(other.statusCode, 401);

  const locked = res();
  handler({ ip: '203.0.113.9', body: { token: TOKEN } }, locked);
  assert.equal(locked.statusCode, 429);
  assert.equal(locked.headers['Set-Cookie'], undefined);
});

test("a successful unlock clears the caller's budget", () => {
  const handler = createGodWindowUnlockHandler({ env: ENV, maxAttemptsPerWindow: 3 });
  const ip = '192.0.2.20';
  handler({ ip, body: { token: 'nope' } }, res());
  handler({ ip, body: { token: 'nope' } }, res());

  const ok = res();
  handler({ ip, body: { token: TOKEN } }, ok);
  assert.equal(ok.statusCode, 200);

  // Two more wrong tries after the success must not trip a 3-attempt ceiling.
  handler({ ip, body: { token: 'nope' } }, res());
  const last = res();
  handler({ ip, body: { token: 'nope' } }, last);
  assert.equal(last.statusCode, 401);
});

test('both gate answers say no-store — a cached answer about money is worse than a slow one', () => {
  const gated = res();
  createGodWindowGate({ env: {} })({ headers: {} }, gated, () => {});
  assert.equal(gated.headers['Cache-Control'], 'no-store');

  const unlocked = res();
  createGodWindowUnlockHandler({ env: ENV })({ body: { token: TOKEN } }, unlocked);
  assert.equal(unlocked.headers['Cache-Control'], 'no-store');
});

// --- the whole owner surface, booted ------------------------------------------------------------

async function boot() {
  const app = express();
  app.use(express.json());
  app.post('/api/god/unlock', createGodWindowUnlockHandler({ env: ENV }));
  app.use('/api/god', createGodWindowGate({ env: ENV }), (_req, response) =>
    response.status(200).json({ v: 1, source: 'live' })
  );

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
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

test('over the wire: the status view is closed to the public and open to the owner', async () => {
  const app = await boot();
  try {
    const closed = await fetch(`${app.base}/api/god/status`);
    assert.equal(closed.status, 401);

    const refused = await fetch(`${app.base}/api/god/unlock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'wrong' })
    });
    assert.equal(refused.status, 401);

    const unlocked = await fetch(`${app.base}/api/god/unlock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: TOKEN })
    });
    assert.equal(unlocked.status, 200);
    const rawCookie = unlocked.headers.get('set-cookie') ?? '';
    const value = rawCookie.split(';')[0];
    assert.ok(value.includes('='), 'unlock must hand back a cookie');

    const open = await fetch(`${app.base}/api/god/status`, {
      headers: { cookie: value }
    });
    assert.equal(open.status, 200);
    assert.equal(await open.text(), '{"v":1,"source":"live"}');

    // A visitor badge, signed with this very secret, is still not an owner.
    const badge = signVisitorBadgeCookie(
      { exp: Math.floor(Date.now() / 1000) + 60 },
      resolveGodWindowCookieSecret(ENV)
    );
    const badgeAttempt = await fetch(`${app.base}/api/god/status`, {
      headers: { cookie: `${GOD_WINDOW_COOKIE}=${badge}` }
    });
    assert.equal(badgeAttempt.status, 401);
  } finally {
    await app.close();
  }
});
