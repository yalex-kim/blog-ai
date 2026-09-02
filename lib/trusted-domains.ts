// Validation for the per-tenant `web_search` domain allowlist.
//
// The default lists themselves are not here — they belong to each vertical
// pack (`VerticalPack.trustedDomains`), because what counts as an
// authoritative source is entirely industry-specific. This file only knows
// what a well-formed entry looks like.

// Bare domain with an optional path, no scheme — matches the shape the
// web_search tool's allowed_domains expects (e.g. "example.com" or
// "example.com/blog").
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+(\/[\w\-./]*)?$/i;

export function isValidDomainEntry(value: string): boolean {
  return DOMAIN_PATTERN.test(value.trim());
}
