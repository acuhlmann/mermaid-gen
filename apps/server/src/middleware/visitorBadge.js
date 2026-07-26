import crypto from 'node:crypto';
import { renderVisitorBadgePage } from './visitorBadgePage.js';

export const VISITOR_BADGE_COOKIE = 'archislop_visitor_badge';
export const VISITOR_BADGE_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days

const DEV_COOKIE_FALLBACK = 'archislop-visitor-badge-dev-cookie-secret';

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function parseVisitorBadgeSecrets(env = process.env) {
  const raw = env.VISITOR_BADGE_SECRETS;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * @param {string} doorCode
 * @returns {string}
 */
export function hashDoorCode(doorCode) {
  return crypto.createHash('sha256').update(doorCode, 'utf8').digest('hex');
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {Set<string>}
 */
export function buildVisitorBadgeHashSet(env = process.env) {
  return new Set(parseVisitorBadgeSecrets(env).map(hashDoorCode));
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {boolean}
 */
export function isVisitorBadgeGateActive(env = process.env) {
  return parseVisitorBadgeSecrets(env).length > 0;
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveVisitorBadgeCookieSecret(env = process.env) {
  const invite = env.INVITE_TOKEN_SECRET?.trim();
  if (invite) return invite;
  const dedicated = env.VISITOR_BADGE_COOKIE_SECRET?.trim();
  if (dedicated) return dedicated;
  return DEV_COOKIE_FALLBACK;
}

/**
 * @param {{ exp: number }} payload
 * @param {string} secret
 * @returns {string}
 */
export function signVisitorBadgeCookie(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/**
 * @param {string | undefined} value
 * @param {string} secret
 * @param {number} [nowMs]
 * @returns {{ exp: number } | null}
 */
export function verifyVisitorBadgeCookie(value, secret, nowMs = Date.now()) {
  if (typeof value !== 'string' || !value.includes('.')) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload?.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
    if (payload.exp * 1000 <= nowMs) return null;
    return { exp: payload.exp };
  } catch {
    return null;
  }
}

/**
 * @param {import('express').Request} req
 * @param {string} name
 * @returns {string | undefined}
 */
export function readCookie(req, name) {
  const header = req.headers?.cookie;
  if (typeof header !== 'string' || !header) return undefined;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== name) continue;
    return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return undefined;
}

/**
 * @param {import('express').Response} res
 * @param {string} cookieValue
 * @param {{ secure?: boolean }} [opts]
 */
export function setVisitorBadgeCookie(res, cookieValue, opts = {}) {
  const secure = opts.secure ?? process.env.NODE_ENV === 'production';
  const parts = [
    `${VISITOR_BADGE_COOKIE}=${encodeURIComponent(cookieValue)}`,
    'Path=/',
    `Max-Age=${VISITOR_BADGE_MAX_AGE_SEC}`,
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

/**
 * @param {string} doorCode
 * @param {Set<string>} hashSet
 * @returns {boolean}
 */
export function doorCodeMatches(doorCode, hashSet) {
  if (typeof doorCode !== 'string' || !doorCode) return false;
  const hash = hashDoorCode(doorCode);
  for (const candidate of hashSet) {
    const a = Buffer.from(hash);
    const b = Buffer.from(candidate);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

function wantsHtml(req) {
  const accept = req.headers?.accept;
  if (typeof accept === 'string' && accept.includes('text/html')) return true;
  if (req.method === 'GET' || req.method === 'HEAD') {
    const path = req.path || '';
    if (!path.startsWith('/api/') && path !== '/mcp') return true;
  }
  return false;
}

function isBypassedPath(req) {
  const path = req.path || '';
  if (path === '/api/health') return true;
  if (path === '/mcp' || path.startsWith('/mcp/')) return true;
  if (path === '/api/visitor-badge') return true;
  return false;
}

/**
 * POST /api/visitor-badge — unlock with door code and set cookie.
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string | undefined>, hashSet?: Set<string>, nowMs?: () => number }} [options]
 */
export function createVisitorBadgeUnlockHandler(options = {}) {
  const env = options.env ?? process.env;
  const hashSet = options.hashSet ?? buildVisitorBadgeHashSet(env);
  const nowMs = options.nowMs ?? (() => Date.now());

  return (req, res) => {
    if (hashSet.size === 0) {
      res.status(404).json({ error: 'Visitor Badge gate is not configured.' });
      return;
    }
    const doorCode =
      typeof req.body?.doorCode === 'string'
        ? req.body.doorCode
        : typeof req.body?.password === 'string'
          ? req.body.password
          : '';
    if (!doorCodeMatches(doorCode, hashSet)) {
      res.status(401).json({ error: 'That door code is not on the list.' });
      return;
    }
    const exp = Math.floor(nowMs() / 1000) + VISITOR_BADGE_MAX_AGE_SEC;
    const cookieValue = signVisitorBadgeCookie({ exp }, resolveVisitorBadgeCookieSecret(env));
    setVisitorBadgeCookie(res, cookieValue, {
      secure: env.NODE_ENV === 'production'
    });
    res.status(200).json({ ok: true });
  };
}

/**
 * Gate middleware: when VISITOR_BADGE_SECRETS is set, require a valid cookie
 * (except health, mcp, and the unlock route).
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string | undefined>, hashSet?: Set<string>, nowMs?: () => number }} [options]
 */
export function createVisitorBadgeGate(options = {}) {
  const env = options.env ?? process.env;
  const hashSet = options.hashSet ?? buildVisitorBadgeHashSet(env);
  const nowMs = options.nowMs ?? (() => Date.now());
  const active = hashSet.size > 0;
  const cookieSecret = resolveVisitorBadgeCookieSecret(env);

  return (req, res, next) => {
    if (!active) {
      next();
      return;
    }
    if (isBypassedPath(req)) {
      next();
      return;
    }
    const cookie = readCookie(req, VISITOR_BADGE_COOKIE);
    if (verifyVisitorBadgeCookie(cookie, cookieSecret, nowMs())) {
      next();
      return;
    }
    if (wantsHtml(req)) {
      res.status(401).type('html').send(renderVisitorBadgePage());
      return;
    }
    res.status(401).json({ error: 'Visitor Badge required. Check in at reception.' });
  };
}
