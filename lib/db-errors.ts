import type { PostgrestError } from '@supabase/supabase-js';

// PostgREST's code for "the filter matched no rows" when .single() was asked
// for exactly one. On a credential lookup this is the *only* error that means
// "no such account" — every other code is the database telling us something is
// wrong with the query or the schema, which is a server fault, not a bad
// password.
//
// Keeping the two apart matters more than it looks. A column the app filters
// on but the deployed table does not have (42703) comes back as an error here;
// folded into the "not found" branch it renders as a 401, and a correct
// password looks exactly like a wrong one with nothing to debug from.
const NO_ROWS_RETURNED = 'PGRST116';

export function isNoRowsError(error: PostgrestError | null | undefined): boolean {
  return error?.code === NO_ROWS_RETURNED;
}

/** True for an error that means the query itself is broken, not that the row is absent. */
export function isDatabaseFault(error: PostgrestError | null | undefined): boolean {
  return !!error && !isNoRowsError(error);
}

/**
 * Logs a PostgREST fault with enough detail to identify a schema mismatch from
 * the platform's logs. `message`/`details`/`hint` are PostgREST's own strings
 * (e.g. `column admins.is_active does not exist`) and carry no row data.
 */
export function logDatabaseFault(context: string, error: PostgrestError): void {
  console.error(`[${context}] database query failed`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}
