import crypto from 'node:crypto';
import { createIpRateLimiter, keyByRequestIp } from '../utils/ipRateLimit.js';

export const GOD_WINDOW_COOKIE = 'archislop_god_window';
export const GOD_WINDOW_MAX_AGE_SEC = 12 * 60 * 60;

/** Unlock attempts per client IP. Generous for a human mistyping a token, hostile to a wordlist. */
export const GOD_WINDOW_UNLOCK_MAX_ATTEMPTS = 10;
export const GOD_WINDOW_UNLOCK_WINDOW_MS = 15 * 60 * 1000;

/**
 * Owner gate for the God window (ADR-0019 §10).
 *
 * This is deliberately NOT the visitor badge. The badge is a shared door code whose gate is inert by
 * default (`createVisitorBadgeGate` calls `next()` whenever `VISITOR_BADGE_SECRETS` is unset) and whose
 * cookie secret falls back to a constant published in this repo, so it cannot carry a panel showing what
 * God costs and how often it acts: an owner who never configured the badge would publish it, and any
 * badge holder would read it. `GOD_WINDOW_TOKEN` fails closed — no token means the window is closed.
 *
 * Only JSON is answered here. The `/god` shell is plain SPA HTML with no data in it, and the React pane
 * owns the token form, so a second server-rendered form would be a second thing to keep in sync.
 */

/** The gate is open only when an owner token is configured. No token, no window. */
export function isGodWindowEnabled(env = process.env) {
  return Boolean(String(env.GOD_WINDOW_TOKEN ?? '').trim());
}

/**
 * The HMAC key for the owner cookie. `GOD_WINDOW_COOKIE_SECRET` is the dedicated setting; when it is
 * absent the key derives from the token rather than from a published dev constant — the token is already
 * a private owner secret, and the two are rotated together anyway.
 */
export function resolveGodWindowCookieSecret(env = process.env) {
  const dedicated = String(env.GOD_WINDOW_COOKIE_SECRET ?? '').trim();
  if (dedicated) return dedicated;
  return `archislop-god-window:${String(env.GOD_WINDOW_TOKEN ?? '').trim()}`;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Compared as equal-length digests so a wrong token reveals nothing about the real length. */
function tokenMatches(submitted, configured) {
  const a = Buffer.from(sha256Hex(submitted));
  const b = Buffer.from(sha256Hex(configured));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function signGodWindowCookie(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** Split `body.sig`; anything without exactly one dot-shaped half is not one of ours. */
function splitCookie(value) {
  if (typeof value !== 'string' || !value.includes('.')) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  return { body, sig };
}

/** Constant-time compare of the HMAC half against the secret this deployment signs with. */
function signatureMatches(body, sig, secret) {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
}

/**
 * The payload is base64url, not encrypted, so its shape is attacker-chosen: `scope` and a finite `exp`
 * are required, not assumed.
 */
function readOwnerPayload(body) {
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload?.scope !== 'god') return null;
    if (typeof payload?.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * A valid owner cookie is one this module signed, unexpired, *and* scoped to `god`. The scope check is
 * the load-bearing line: the payload is only base64url, so a visitor badge cookie — same shape, different
 * secret, far wider audience — would decode straight into the owner's seat if the two secrets ever
 * coincided, which they do the moment `INVITE_TOKEN_SECRET` is set and `GOD_WINDOW_COOKIE_SECRET` is not.
 */
export function verifyGodWindowCookie(value, secret, nowMs = Date.now()) {
  const parts = splitCookie(value);
  if (!parts) return null;
  if (!signatureMatches(parts.body, parts.sig, secret)) return null;
  const payload = readOwnerPayload(parts.body);
  if (!payload) return null;
  if (payload.exp * 1000 <= nowMs) return null;
  return { exp: payload.exp };
}

/** Reads one cookie out of the header; `decodeURIComponent` can throw on a hostile value. */
function readCookie(req, name) {
  const header = req.headers?.cookie;
  if (typeof header !== 'string' || !header) return undefined;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function setGodWindowCookie(res, cookieValue, { secure }) {
  const parts = [
    `${GOD_WINDOW_COOKIE}=${encodeURIComponent(cookieValue)}`,
    // Path-scoped to the owner surface: this credential must not ride along on every app request.
    'Path=/api/god',
    `Max-Age=${GOD_WINDOW_MAX_AGE_SEC}`,
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

/**
 * `POST /api/god/unlock` — exchange the owner token for the cookie. Attached *before* the gate, so one
 * request can earn the credential the next request will be asked for.
 *
 * With no token configured this answers 503, not 404: an owner wiring the window for the first time needs
 * to be told the gate is unconfigured rather than handed a dead route that looks like a typo. It is never
 * a success path — there is no token to guess when none exists.
 *
 * `maxAttemptsPerWindow` exists because this is the only unauthenticated write on the owner surface, and
 * the token is a single shared secret with no second factor: an owner who picks a short one is protected
 * by the limiter, not by the token's entropy. Keyed on `req.ip` (trust proxy is set in the bootstrap),
 * never on `X-Forwarded-For`, which the client controls.
 */
export function createGodWindowUnlockHandler(options = {}) {
  const env = options.env ?? process.env;
  const nowMs = options.nowMs ?? (() => Date.now());
  const limiter =
    options.limiter ??
    createIpRateLimiter({
      windowMs: options.windowMs ?? GOD_WINDOW_UNLOCK_WINDOW_MS,
      maxHits: options.maxAttemptsPerWindow ?? GOD_WINDOW_UNLOCK_MAX_ATTEMPTS,
      keyFn: keyByRequestIp
    });

  return (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (limiter.isLimited(req)) {
      res.status(429).json({ error: 'Too many attempts. Try again later.' });
      return;
    }
    const configured = String(env.GOD_WINDOW_TOKEN ?? '').trim();
    if (!configured) {
      res.status(503).json({ error: 'God window access is not configured on this deployment.' });
      return;
    }
    const submitted = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    // Every attempt is charged, including the blank and malformed ones, so an empty body cannot be
    // used to probe the endpoint for free.
    limiter.recordHit(req);
    if (!submitted || !tokenMatches(submitted, configured)) {
      res.status(401).json({ error: 'That is not the owner token.' });
      return;
    }
    limiter.reset(req);
    const exp = Math.floor(nowMs() / 1000) + GOD_WINDOW_MAX_AGE_SEC;
    setGodWindowCookie(
      res,
      signGodWindowCookie({ scope: 'god', exp }, resolveGodWindowCookieSecret(env)),
      { secure: env.NODE_ENV === 'production' }
    );
    res.status(200).json({ ok: true });
  };
}

/**
 * Gate for everything under `/api/god`, mounted ahead of the status router in `loadServerApp.js`.
 *
 * Fails closed in both directions: unconfigured answers 503, configured-but-unauthenticated answers 401.
 * Neither leaks which of the two the owner is looking at a bug about — the messages differ because the
 * fix differs, not because an unauthenticated caller needs to learn the deployment's shape.
 */
export function createGodWindowGate(options = {}) {
  const env = options.env ?? process.env;
  const nowMs = options.nowMs ?? (() => Date.now());
  const configured = isGodWindowEnabled(env);
  const secret = resolveGodWindowCookieSecret(env);

  return (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!configured) {
      res.status(503).json({ error: 'God window access is not configured on this deployment.' });
      return;
    }
    if (verifyGodWindowCookie(readCookie(_req, GOD_WINDOW_COOKIE), secret, nowMs())) {
      next();
      return;
    }
    res.status(401).json({ error: 'Owner token required.' });
  };
}
