// Building a Markdown link out of text nobody controls.
//
// Reference titles come from search results — real page titles, which contain
// brackets, pipes, angle brackets and anything else a CMS put in a <title>.
// Interpolated straight into `[title](url)` they collide with the link syntax
// itself and the line renders as literal text with the URL showing, e.g.
//
//   [고객참여 > ADHD 관리하면 완치된다] <하> 부모의 역할 | 국립정신건강센터
//
// whose own brackets end the link text early.

/**
 * Escapes the characters that can terminate or nest link text.
 *
 * Backslash goes first — escaping it after the brackets would double-escape
 * the backslashes this function just added. Newlines become spaces: a title
 * that spans lines would break out of its list item entirely.
 */
export function escapeLinkText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\s*[\r\n]+\s*/g, ' ')
    .trim();
}

/**
 * Formats a URL as a link destination.
 *
 * Angle-bracket form handles the cases a bare destination cannot: spaces, and
 * the unbalanced parentheses that Wikipedia-style URLs are full of. `<` and `>`
 * are the only things the angle form itself cannot carry, and they are not
 * legal in a URL unencoded anyway, so they are percent-encoded.
 */
export function escapeLinkDestination(url: string): string {
  const cleaned = url.trim().replace(/</g, '%3C').replace(/>/g, '%3E');
  return `<${cleaned}>`;
}

/** A Markdown link that survives whatever the title and URL contain. */
export function markdownLink(text: string, url: string): string {
  return `[${escapeLinkText(text)}](${escapeLinkDestination(url)})`;
}
