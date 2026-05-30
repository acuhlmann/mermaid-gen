import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_INVITE_TOKEN_TTL_MS = Number(process.env.INVITE_TOKEN_TTL_MS) || 60 * 60 * 1000;

export const DEV_INVITE_TOKEN_SECRET = 'archislop-dev-invite-secret-change-in-production';

function inviteSecret(): string {
  return (
    process.env.INVITE_TOKEN_SECRET ??
    process.env.ARCHISLOP_INVITE_SECRET ??
    DEV_INVITE_TOKEN_SECRET
  );
}

/** Refuse to start in production when invite tokens would be forgeable. */
export function assertProductionInviteSecret(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const secret = inviteSecret();
  if (secret === DEV_INVITE_TOKEN_SECRET) {
    throw new Error(
      'INVITE_TOKEN_SECRET must be set to a strong random value in production (see .env.example).'
    );
  }
}

export function signInviteToken({
  sessionId,
  ttlMs = DEFAULT_INVITE_TOKEN_TTL_MS,
  singleUse = false
}: {
  sessionId: string;
  ttlMs?: number;
  singleUse?: boolean;
}): string {
  const body = {
    sessionId,
    exp: Date.now() + ttlMs,
    n: randomBytes(8).toString('hex'),
    su: singleUse ? 1 : 0
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', inviteSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyInviteToken(
  token: string
): { sessionId: string; singleUse: boolean } | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const dot = token.lastIndexOf('.');
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', inviteSecret()).update(encoded).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let body: { sessionId?: string; exp?: number; su?: number };
  try {
    body = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      sessionId?: string;
      exp?: number;
      su?: number;
    };
  } catch {
    return null;
  }
  if (!body?.sessionId || typeof body.exp !== 'number' || Date.now() > body.exp) return null;
  return { sessionId: body.sessionId, singleUse: Boolean(body.su) };
}

export { DEFAULT_INVITE_TOKEN_TTL_MS };
