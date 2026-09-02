export interface ParsedReference {
  title: string;
  url: string;
  // Populated separately (see lib/extract-citations.ts) from Anthropic's
  // actual citation metadata, not by this parser.
  snippets?: string[];
}

// Matches a trailing "[참고자료]" section through the end of the content.
const REFERENCE_SECTION_PATTERN = /\[참고자료\]([\s\S]*?)$/;
// Each bullet: "- 출처명: https://..."
const REFERENCE_LINE_PATTERN = /^-\s*(.+?)\s*:\s*(https?:\/\/\S+)$/;

// Shared with app/api/generate-blog/route.ts. Extracts the "[참고자료]"
// section the system prompt asks Claude to append after using web_search,
// and strips it out of the displayed content (same treatment as the
// "[이미지 키워드]" section already gets).
export function parseReferences(content: string): { references: ParsedReference[]; content: string } {
  const match = content.match(REFERENCE_SECTION_PATTERN);
  if (!match) {
    return { references: [], content };
  }

  const references: ParsedReference[] = [];
  for (const line of match[1].split('\n')) {
    const lineMatch = line.trim().match(REFERENCE_LINE_PATTERN);
    if (lineMatch) {
      references.push({ title: lineMatch[1].trim(), url: lineMatch[2].trim() });
    }
  }

  return {
    references,
    content: content.slice(0, match.index).trim(),
  };
}
