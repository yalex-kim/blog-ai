import Anthropic from '@anthropic-ai/sdk';

// The article always opens with its `#` title (rule 3 of the system prompt).
//
// Not anchored to a line start: text blocks are concatenated with no
// separator, so a preamble that doesn't happen to end in a newline runs
// straight into the title ("검색하겠습니다.# 제목"). The lookbehind keeps
// `## 섹션` headings from matching on their second character.
const TITLE_MARKER = /(?<!#)#\s+/;

// Pulls the article out of a web_search response.
//
// With the tool enabled, `content` is a transcript of the server-side loop,
// not a single answer: Claude narrates its intent ("자궁근종을 검색해보겠습니다")
// in a text block *before* the server_tool_use, and may do so again between
// searches. Joining every text block would persist that narration into
// blog_posts.content, render it in the post, and copy it to the blog.
//
// Anchoring on the title rather than dropping everything before the last
// search result is deliberate: if Claude ever interleaves writing with a
// follow-up search, a position-based cut would silently truncate the body,
// whereas the title only ever marks where the article begins. When no title
// is present the text is returned intact, so a malformed response degrades
// to the old behavior instead of coming back empty.
export function extractArticleText(content: Anthropic.ContentBlock[]): string {
  const joined = content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const titleIndex = joined.search(TITLE_MARKER);
  return titleIndex > 0 ? joined.slice(titleIndex) : joined;
}
