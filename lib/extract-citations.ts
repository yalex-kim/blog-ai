import Anthropic from '@anthropic-ai/sdk';

export interface CitedSnippet {
  url: string;
  title: string | null;
  // Every distinct quote (~150 chars each, an API-imposed cap on
  // cited_text) cited from this url across the response, in the order
  // they first appear. A url cited for multiple separate claims yields
  // multiple entries here instead of just the first.
  snippets: string[];
}

// Anthropic attaches real citation metadata (url, title, and the exact
// quoted text used) to text blocks whenever web_search grounded a claim.
// This is ground truth from the API, unlike the model's self-written
// "[참고자료]" bullet list (see lib/parse-references.ts), which can drift
// from what was actually cited. Returns one entry per unique URL.
export function extractCitedSnippets(content: Anthropic.ContentBlock[]): Map<string, CitedSnippet> {
  const snippets = new Map<string, CitedSnippet>();

  for (const block of content) {
    if (block.type !== 'text' || !block.citations) continue;

    for (const citation of block.citations) {
      if (citation.type !== 'web_search_result_location') continue;

      const existing = snippets.get(citation.url);
      if (!existing) {
        snippets.set(citation.url, {
          url: citation.url,
          title: citation.title,
          snippets: [citation.cited_text],
        });
      } else if (!existing.snippets.includes(citation.cited_text)) {
        existing.snippets.push(citation.cited_text);
      }
    }
  }

  return snippets;
}
