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

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------
// The raw marker is machine syntax — `[#1 | THUMBNAIL | 진료실에서 상담하는
// 장면 | text : 첫 방문 안내]` — and the editor used to show it inline, mixed
// into the prose. Deleting a stray bracket silently detached an image.
//
// It cannot simply be hidden, though: the marker's POSITION is the information.
// It says where in the article that image belongs, and only the author can move
// it. So the editor sees a short placeholder it can read, move, or deliberately
// remove, and the full marker is restored on save.

const PLACEHOLDER_PATTERN = /⟦이미지\s*(\d+)⟧/g;

export function imagePlaceholder(id: string): string {
  return `⟦이미지 ${id}⟧`;
}

/** Article text as the editor should show it: markers become placeholders. */
export function toEditableContent(content: string): string {
  return content.replace(
    new RegExp(IMAGE_SUGGESTION_PATTERN),
    (_match, id: string) => imagePlaceholder(id.trim())
  );
}

/**
 * Puts the full markers back, taking each one's current wording from the image
 * cards rather than from the text the placeholder replaced — the cards are
 * where descriptions are edited, so they are the newer copy.
 *
 * A placeholder whose suggestion no longer exists is dropped: the user removed
 * that image, and leaving a marker for it would reattach a deleted slot.
 */
export function fromEditableContent(
  editable: string,
  suggestions: { id: string; type: string; description: string; text: string }[]
): string {
  const byId = new Map(suggestions.map((suggestion) => [suggestion.id, suggestion]));

  return editable.replace(PLACEHOLDER_PATTERN, (_match, id: string) => {
    const suggestion = byId.get(id.trim());
    if (!suggestion) return '';

    const base = `[#${suggestion.id} | ${suggestion.type} | ${suggestion.description}`;
    return suggestion.text ? `${base} | text : ${suggestion.text}]` : `${base}]`;
  });
}
