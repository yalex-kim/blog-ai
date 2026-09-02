export interface ParsedImageSuggestion {
  id: string;
  type: string;
  description: string;
  text: string;
  position: number;
}

const IMAGE_SUGGESTION_PATTERN =
  /\[#(\d+)\s*\|\s*([A-Z]+)\s*\|\s*([^\|\]]+?)(?:\s*\|\s*(?:text\s*:\s*)?([^\]]+))?\]/g;

// Shared with app/dashboard/page.tsx and app/api/generate-blog/route.ts so the
// `[#id | TYPE | description | text : overlay]` format only needs to change here.
export function parseImageSuggestions(content: string, limit = 5): ParsedImageSuggestion[] {
  const suggestions: ParsedImageSuggestion[] = [];
  const regex = new RegExp(IMAGE_SUGGESTION_PATTERN);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    suggestions.push({
      id: match[1].trim(),
      type: match[2].trim(),
      description: match[3].trim(),
      text: match[4] ? match[4].trim() : '',
      position: match.index,
    });
  }

  return limit > 0 ? suggestions.slice(0, limit) : suggestions;
}
