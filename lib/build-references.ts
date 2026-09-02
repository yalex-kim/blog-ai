import { CitedSnippet } from './extract-citations';
import { ParsedReference } from './parse-references';

export interface VerifiedReference {
  title: string;
  url: string;
  snippets: string[];
}

// Two sources describe the same page with slightly different URL strings:
// the search result's real URL, and the URL Claude retyped into its
// "[참고자료]" list. Normalize away the differences that don't change what
// page is being referenced, so titles from the model's list can be matched
// onto the verified citation. Query strings are preserved — they identify
// the page on sites like health.kr (?drug_cd=...).
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.protocol = parsed.protocol.toLowerCase();
    const normalized = parsed.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return url.trim().replace(/\/$/, '');
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Builds the reference list shown to the user and appended to the article.
//
// Citations are the source of truth: every entry here was actually cited by
// the model from a real search result, and carries the quoted text to prove
// it. Claude's self-written "[참고자료]" bullets are used only to supply a
// nicer human-readable title — they never introduce a reference on their
// own, because the model can write that list from memory (or get the URL
// subtly wrong) without having searched at all.
export function buildVerifiedReferences(
  parsed: ParsedReference[],
  cited: Map<string, CitedSnippet>
): VerifiedReference[] {
  const titleByUrl = new Map<string, string>();
  for (const ref of parsed) {
    titleByUrl.set(normalizeUrl(ref.url), ref.title);
  }

  return [...cited.values()].map((citation) => ({
    title:
      titleByUrl.get(normalizeUrl(citation.url)) ||
      citation.title ||
      hostnameOf(citation.url),
    url: citation.url,
    snippets: citation.snippets,
  }));
}
