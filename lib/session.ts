import { NextRequest } from 'next/server';
import crypto from 'crypto';

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET environment variable is required to sign session cookies.'
    );
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url');
}

function signaturesMatch(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

export interface TenantSession {
  type: 'tenant';
  id: string;
  login_id: string;
  exp: number;
}

export interface AdminSession {
  type: 'admin';
  id: string;
  username: string;
  role: string;
  exp: number;
}

function createToken(payload: TenantSession | AdminSession): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token: string): TenantSession | AdminSession | null {
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const encodedPayload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  if (!signaturesMatch(sign(encodedPayload), signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    if (payload.type !== 'tenant' && payload.type !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}

export function createTenantSessionToken(data: { id: string; login_id: string }): string {
  return createToken({
    type: 'tenant',
    id: data.id,
    login_id: data.login_id,
    exp: Date.now() + SESSION_MAX_AGE_MS,
  });
}

export function createAdminSessionToken(data: { id: string; username: string; role: string }): string {
  return createToken({
    type: 'admin',
    id: data.id,
    username: data.username,
    role: data.role,
    exp: Date.now() + SESSION_MAX_AGE_MS,
  });
}

export function getSession(request: NextRequest): TenantSession | null {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.type === 'tenant' ? payload : null;
}

export function getAdminSession(request: NextRequest): AdminSession | null {
  const token = request.cookies.get('admin_session')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.type === 'admin' ? payload : null;
}

export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_MAX_AGE_MS / 1000;
