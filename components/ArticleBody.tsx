'use client';

import ReactMarkdown from 'react-markdown';
import { parseImageSuggestions } from '@/lib/parse-image-suggestions';

const MARKDOWN_COMPONENTS = {
  h1: ({ ...props }) => (
    <h1 className="text-[2rem] font-bold text-ink leading-snug text-balance mb-6 mt-0" {...props} />
  ),
  h2: ({ ...props }) => (
    <h2 className="text-2xl font-bold text-ink leading-snug text-balance mb-4 mt-10" {...props} />
  ),
  h3: ({ ...props }) => <h3 className="text-xl font-bold text-ink mb-3 mt-7" {...props} />,
  p: ({ ...props }) => (
    <p className="text-[1.0625rem] leading-[1.85] text-ink-soft mb-5" {...props} />
  ),
  strong: ({ ...props }) => <strong className="font-bold text-ink" {...props} />,
  a: ({ ...props }) => (
    <a
      className="text-accent underline underline-offset-2 decoration-line-strong hover:decoration-accent"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  ul: ({ ...props }) => (
    <ul className="list-disc pl-6 my-5 space-y-2.5 text-[1.0625rem] leading-[1.85]" {...props} />
  ),
  ol: ({ ...props }) => (
    <ol className="list-decimal pl-6 my-5 space-y-2.5 text-[1.0625rem] leading-[1.85]" {...props} />
  ),
  li: ({ ...props }) => <li className="text-ink-soft" {...props} />,
};

function Markdown({ children }: { children: string }) {
  if (!children.trim()) return null;
  return <ReactMarkdown components={MARKDOWN_COMPONENTS}>{children}</ReactMarkdown>;
}

// Stands in for the image at its position in the article. Deliberately wide
// and short rather than the real 1:1 crop — the point is to show *where* an
// image lands and what it is, without pushing the surrounding paragraphs a
// full screen apart.
function ImageSlot({
  id,
  type,
  description,
  text,
}: {
  id: string;
  type: string;
  description: string;
  text: string;
}) {
  return (
    <div className="my-9 rounded-card border border-dashed border-line-strong bg-accent-tint/60 px-5 py-4 font-sans">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
          {id}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-strong">
          {type}
        </span>
        <span className="text-[11px] text-ink-faint">이미지 자리</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft break-keep">{description}</p>
      {text && (
        <p className="mt-1.5 text-sm font-medium text-accent-strong break-keep">“{text}”</p>
      )}
    </div>
  );
}

// Splits the article on its `[#N | TYPE | 묘사 | text : ...]` markers and
// renders each one as a placeholder, so the markers stop showing up as raw
// bracket syntax in the middle of the prose.
export function ArticleBody({ content }: { content: string }) {
  const slots = parseImageSuggestions(content, 0);

  if (slots.length === 0) {
    return <Markdown>{content}</Markdown>;
  }

  const nodes = [];
  let cursor = 0;

  slots.forEach((slot, i) => {
    const before = content.slice(cursor, slot.position);
    if (before.trim()) {
      nodes.push(<Markdown key={`md-${i}`}>{before}</Markdown>);
    }
    nodes.push(<ImageSlot key={`slot-${i}`} {...slot} />);
    // parseImageSuggestions reports where the marker starts; skip past its
    // closing bracket so the marker text itself never reaches the renderer.
    cursor = content.indexOf(']', slot.position) + 1;
  });

  const rest = content.slice(cursor);
  if (rest.trim()) {
    nodes.push(<Markdown key="md-last">{rest}</Markdown>);
  }

  return <>{nodes}</>;
}
