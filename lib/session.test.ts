import { describe, expect, it, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import {
  createTenantSessionToken,
  createAdminSessionToken,
  getSession,
  getAdminSession,
} from './session';

function requestWithCookie(name: string, value: string): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    headers: { cookie: `${name}=${value}` },
  });
}

beforeAll(() => {
  process.env.SESSION_SECRET = 'test-secret-do-not-use-in-production';
});

describe('session tokens', () => {
  it('round-trips a valid tenant session', () => {
    const token = createTenantSessionToken({ id: 'tenant-1', login_id: 'clinic-a' });
    const session = getSession(requestWithCookie('session', token));
    expect(session).toEqual(
      expect.objectContaining({ type: 'tenant', id: 'tenant-1', login_id: 'clinic-a' })
    );
  });

  it('round-trips a valid admin session', () => {
    const token = createAdminSessionToken({ id: 'admin-1', username: 'root', role: 'super_admin' });
    const session = getAdminSession(requestWithCookie('admin_session', token));
    expect(session).toEqual(
      expect.objectContaining({ type: 'admin', id: 'admin-1', username: 'root', role: 'super_admin' })
    );
  });

  it('rejects a tampered payload', () => {
    const token = createTenantSessionToken({ id: 'tenant-1', login_id: 'clinic-a' });
    const [payload, signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ type: 'admin', id: 'attacker', username: 'root', role: 'super_admin', exp: Date.now() + 1000000 })
    ).toString('base64url');
    const forgedToken = `${forgedPayload}.${signature}`;
    void payload;

    expect(getAdminSession(requestWithCookie('admin_session', forgedToken))).toBeNull();
  });

  it('rejects an expired session', () => {
    const expiredPayload = Buffer.from(
      JSON.stringify({ type: 'tenant', id: 'x', login_id: 'y', exp: Date.now() - 1000 })
    ).toString('base64url');
    // Sign it correctly so only expiry causes rejection.
    const signature = crypto
      .createHmac('sha256', process.env.SESSION_SECRET!)
      .update(expiredPayload)
      .digest('base64url');
    const token = `${expiredPayload}.${signature}`;

    expect(getSession(requestWithCookie('session', token))).toBeNull();
  });

  it('does not accept an admin token on the tenant cookie', () => {
    const token = createAdminSessionToken({ id: 'admin-1', username: 'root', role: 'super_admin' });
    expect(getSession(requestWithCookie('session', token))).toBeNull();
  });

  it('returns null when the cookie is missing', () => {
    expect(getSession(new NextRequest('http://localhost/api/test'))).toBeNull();
  });
});
