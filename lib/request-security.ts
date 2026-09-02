import { NextRequest } from 'next/server';

// Defense-in-depth CSRF check for state-changing requests. sameSite=lax on the
// session cookies already blocks cross-site form/fetch submissions in modern
// browsers; this catches the remaining cases (older browsers, misconfigured
// cookies) without requiring a token round-trip on every page.
export function isTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const source = origin ?? request.headers.get('referer');
  if (!source) return true; // same-origin requests from non-browser/native clients omit both

  try {
    return new URL(source).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}
