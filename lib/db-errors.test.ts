import { describe, expect, it } from 'vitest';
import type { PostgrestError } from '@supabase/supabase-js';
import { isNoRowsError, isDatabaseFault, isConnectionFailure } from './db-errors';

function pgError(partial: Partial<PostgrestError>): PostgrestError {
  return {
    name: 'PostgrestError',
    code: '',
    message: '',
    details: '',
    hint: '',
    ...partial,
  } as PostgrestError;
}

describe('isNoRowsError', () => {
  it('recognises PostgREST "no rows" — the only error that means bad credentials', () => {
    expect(isNoRowsError(pgError({ code: 'PGRST116' }))).toBe(true);
  });

  it('does not treat a missing column as a missing row', () => {
    expect(
      isNoRowsError(pgError({ code: '42703', message: 'column admins.is_active does not exist' }))
    ).toBe(false);
  });

  it('is false for no error at all', () => {
    expect(isNoRowsError(null)).toBe(false);
  });
});

describe('isDatabaseFault', () => {
  it('is false when there is no error, and false for "no rows"', () => {
    expect(isDatabaseFault(null)).toBe(false);
    expect(isDatabaseFault(pgError({ code: 'PGRST116' }))).toBe(false);
  });

  it('is true for the schema drift that once rendered as a 401', () => {
    expect(isDatabaseFault(pgError({ code: '42703' }))).toBe(true);
  });

  it('is true for a paused project, so it cannot render as a 401 either', () => {
    expect(isDatabaseFault(pgError({ code: '', message: 'TypeError: fetch failed' }))).toBe(true);
  });
});

describe('isConnectionFailure', () => {
  it('treats a missing PostgREST code as never having reached PostgREST', () => {
    expect(isConnectionFailure(pgError({ code: '', message: 'TypeError: fetch failed' }))).toBe(true);
  });

  it('recognises the usual transport failures by message', () => {
    for (const message of [
      'fetch failed',
      'request to https://x.supabase.co failed, reason: ECONNREFUSED',
      'getaddrinfo ENOTFOUND x.supabase.co',
      'socket hang up',
      'network timeout',
    ]) {
      expect(isConnectionFailure(pgError({ code: 'ERR', message })), message).toBe(true);
    }
  });

  it('does not mistake a schema error for a connection failure', () => {
    expect(
      isConnectionFailure(
        pgError({ code: '42703', message: 'column admins.is_active does not exist' })
      )
    ).toBe(false);
    expect(
      isConnectionFailure(pgError({ code: '42P01', message: 'relation "admins" does not exist' }))
    ).toBe(false);
  });

  it('is false for no error', () => {
    expect(isConnectionFailure(null)).toBe(false);
  });
});
