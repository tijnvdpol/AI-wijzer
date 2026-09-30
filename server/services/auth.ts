import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ApiError } from '../../shared/types.js';
import { config } from '../config.js';
import { decrement, increment } from './counter.js';

const COOKIE = 'aiwijzer_sessie';
// The PIN is asked on every visit (the client logs out on page load). This is only the maximum lifetime of an open session.
const SESSION_SECONDS = 2 * 60 * 60;
const MAX_FAILED = 5;
const LOCKOUT_SECONDS = 15 * 60;

/** Locally the PIN is optional; on Vercel it is mandatory, so a forgotten ACCESS_PIN never leaves the app open. */
export function pinRequired(): boolean {
  return config.accessPin !== '' || Boolean(process.env.VERCEL);
}

// The PIN is part of the signing key: changing ACCESS_PIN logs everyone out.
function sign(expires: number): string {
  return createHmac('sha256', `${config.sessionSecret}|${config.accessPin}`).update(String(expires)).digest('hex');
}

function sameString(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

function readCookie(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=');
  }
  return undefined;
}

export function hasValidSession(req: Request): boolean {
  if (!pinRequired()) return true;
  if (config.accessPin === '') return false;
  const token = readCookie(req);
  if (!token) return false;
  const [expiresText, signature] = token.split('.');
  const expires = Number(expiresText);
  if (!signature || !Number.isFinite(expires) || expires < Date.now()) return false;
  return sameString(signature, sign(expires));
}

function cookieFlags(req: Request): string {
  return `Path=/; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}`;
}

function setSession(req: Request, res: Response): void {
  const expires = Date.now() + SESSION_SECONDS * 1000;
  // No Max-Age: a session cookie that the browser drops when it is closed.
  res.setHeader('Set-Cookie', `${COOKIE}=${expires}.${sign(expires)}; ${cookieFlags(req)}`);
}

export const requirePin: RequestHandler = (req, res: Response<ApiError>, next: NextFunction) => {
  if (hasValidSession(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'Voer de pincode in om de AI Wijzer te gebruiken.', code: 'unauthorized' });
};

export function sessionStatus(req: Request): { pinRequired: boolean; authorized: boolean } {
  return { pinRequired: pinRequired(), authorized: hasValidSession(req) };
}

/** Checks the PIN; max 5 wrong tries per IP per 15 minutes. Sets the session cookie on success. */
export async function login(req: Request, res: Response<ApiError | { ok: true }>, pin: unknown): Promise<void> {
  if (pinRequired() && config.accessPin === '') {
    res.status(500).json({ error: 'De server mist een ACCESS_PIN. Stel die in bij de omgevingsvariabelen.', code: 'server' });
    return;
  }
  const key = `aiwijzer:pin:${req.ip ?? 'onbekend'}`;
  let failed = 0;
  try {
    failed = await increment(key, LOCKOUT_SECONDS);
  } catch (err) {
    console.warn('[auth] teller niet bereikbaar:', err instanceof Error ? err.message : err);
  }
  if (failed > MAX_FAILED) {
    res.status(429).json({ error: 'Te veel foute pogingen. Probeer het over een kwartier opnieuw.', code: 'rate_limited' });
    return;
  }
  if (typeof pin !== 'string' || !sameString(pin.trim(), config.accessPin)) {
    res.status(401).json({ error: 'Onjuiste pincode.', code: 'unauthorized' });
    return;
  }
  await decrement(key).catch(() => undefined);
  setSession(req, res);
  res.json({ ok: true });
}

export function logout(req: Request, res: Response): void {
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; ${cookieFlags(req)}`);
  res.json({ ok: true });
}
