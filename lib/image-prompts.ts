/**
 * Image prompt construction.
 *
 * The *shape* of an image prompt — a title card is typography, a scene is a
 * photograph, every prompt forbids invented branding — is engine-level and
 * lives here. What the image should depict, and the domain framing that keeps
 * the model on-tone, comes from the tenant's vertical pack. Nothing in this
 * file knows what industry it is drawing for.
 */

import type { ImageType, VerticalPack } from './verticals/types';
import { resolveImageType } from './verticals/types';

export type { ImageType };
export { resolveImageType };
export interface ThumbnailLayout {
  /** Short label, only used to make prompts and tests readable. */
  name: string;
  /** Where the text block sits and how it is aligned — the thing that actually
   *  makes two cards look like different designs. */
  composition: string;
  /** Frame, background treatment, and props. */
  decoration: string;
  /** How the clinic line is presented when there is one. */
  footer: string;
}

/**
 * Layout motifs for THUMBNAIL cards.
 *
 * Each entry owns its own alignment and text placement. That is deliberate: an
 * earlier version pinned every card to a centred top-to-bottom stack and varied
 * only the ornaments, which made all six read as one design with different
 * stickers. The reference thumbnails differ in composition first — right-aligned
 * beside an illustration, arched over a hero word, stacked hard against a corner
 * — so composition is what varies here.
 */
export const THUMBNAIL_LAYOUTS: readonly ThumbnailLayout[] = [
  {
    name: 'clipboard',
    composition:
      'Text block centred, sitting slightly above the vertical middle. Eyebrow set in an upward arch that curves over the headline. Headline on two lines, the second line noticeably larger than the first.',
    decoration:
      'A white rounded card filling most of the frame on a soft gradient background, held by a realistic metal clipboard clip at the top centre. Flat starburst and sparkle shapes in the accent colour peek out from behind the headline.',
    footer: 'A small muted line near the bottom with a thin coloured underline stroke and a tiny marker-pen doodle at its right end.',
  },
  {
    name: 'ribbon',
    composition:
      'Text block centred and vertically balanced. A thin horizontal divider separates the headline from the subtitle below it.',
    decoration:
      'A ribbon banner sweeping across the top of the card, small rounded ornaments in the corners, and a plain tinted background behind the card.',
    footer: 'The clinic line rides inside the ribbon banner at the top instead of sitting at the bottom.',
  },
  {
    name: 'wave-frame',
    composition:
      'Headline dead centre and enormous, dominating the frame. Eyebrow small and letter-spaced directly above it. No divider — whitespace does the separating.',
    decoration:
      'A white card framed by a soft wavy, scalloped border in the accent colour, with one cluster of small flat 3D-style props (megaphone, envelope, star) tucked into a bottom corner.',
    footer: 'A small muted line in the lower area, well clear of the props.',
  },
  {
    name: 'botanical',
    composition:
      'Text block centred with generous breathing room, pushed down so the upper third stays open. Headline two lines, the first line small and coloured, the second line huge and dark.',
    decoration:
      'A rounded off-white card on a tinted background, with flat botanical leaves and one blossom overlapping the card at the top-left and bottom-right corners. Text stays entirely clear of the foliage.',
    footer: 'A small grey line at the bottom centre, noticeably lighter than the subtitle.',
  },
  {
    name: 'illustration-split',
    composition:
      'Two-column split. A flat vector illustration of a Korean woman — and a baby if the topic fits — occupies one side, full height. All text is right-aligned in the opposite column, the headline stacked across three short lines rather than two.',
    decoration:
      'Soft single-tone background with faint oversized florals behind the illustration. No card, no frame — the illustration is the frame.',
    footer: 'Two to four rounded hashtag pills stacked in the bottom corner opposite the illustration, one of them carrying the clinic name.',
  },
  {
    name: 'memo',
    composition:
      'Text block left-aligned and set slightly off-centre, as if handwritten notes. A hand-drawn highlighter stroke runs behind part of the headline, and a small checkbox line sits under the subtitle.',
    decoration:
      'A memo-paper card taped at two corners on a plain tinted background, with a marker-pen doodle beside the text and a faint ruled-line texture on the paper.',
    footer: 'A small pill-shaped label in a corner carrying the clinic line.',
  },
  {
    name: 'band',
    composition:
      'No card. Headline left-aligned in the lower two-thirds of the frame, sitting on top of a wide horizontal colour band that bleeds off both edges. Eyebrow above the band, subtitle below it.',
    decoration:
      'Flat solid background, one oversized simple icon or geometric shape in the upper-right at low opacity, and a thin rule under the eyebrow.',
    footer: 'A small line in the bottom-left corner, aligned with the headline.',
  },
  {
    name: 'sticker',
    composition:
      'Headline centred inside a large rounded speech-bubble or sticker shape that tilts a few degrees off horizontal. Eyebrow on a small tilted tag above it, subtitle straight and centred below the bubble.',
    decoration:
      'A dotted-grid or notebook-lined background, with three or four small circular badge stickers scattered around the bubble at varying sizes.',
    footer: 'A small straight line at the bottom centre, untilted, so it reads as the sober element.',
  },
] as const;

/**
 * Colour schemes, picked independently of the layout so the two axes multiply
 * instead of moving in lockstep.
 */
export const THUMBNAIL_PALETTES = [
  'Cream and warm sand background, deep espresso-brown headline, mustard-yellow highlight accent',
  'Pale lilac background, deep violet headline, charcoal secondary text, soft white card',
  'Sky-blue to mint gradient background, dark forest-green headline, amber accent',
  'Blush pink background, plum-red headline, dusty rose illustration tones',
  'Soft mint background, charcoal headline, coral-pink accent shapes',
  'Butter-yellow background, teal headline, warm grey secondary text',
  'Warm ivory background, deep teal headline, salmon-pink accent shapes',
  'Dusty sage background, near-black headline, terracotta accent',
] as const;

/**
 * How the headline itself is emphasised — the third independent axis.
 */
export const THUMBNAIL_HEADLINE_TREATMENTS = [
  'Set the two headline lines in two different colours, the first in the accent colour and the second in the darkest colour of the palette.',
  'Run a thick, slightly rough highlighter stroke in the accent colour behind one of the headline lines, with the text sitting on top of it.',
  'Give the headline a hard offset shadow in the accent colour, a few pixels down and to the right, like layered paper.',
  'Set one headline line as knockout white text inside a filled rounded rectangle in the accent colour, and the other line plain and dark.',
  'Curve the shorter headline line into a gentle upward arch above the straight, much larger second line.',
  'Set the shorter headline line in wide letter-spacing with thin strokes, contrasting against the extremely heavy second line.',
] as const;

interface ThumbnailStyle {
  layout: ThumbnailLayout;
  palette: string;
  treatment: string;
}

/**
 * Picks the three style axes. With a variant they are unpacked deterministically
 * (mixed-radix, layout in the least significant position); without one each axis
 * rolls independently, giving 8 × 8 × 6 = 384 combinations rather than the 6 that
 * a single shared index allowed.
 */
export function selectThumbnailStyle(variant?: number): ThumbnailStyle {
  const pick = <T>(list: readonly T[], index: number | undefined): T =>
    list[index === undefined ? Math.floor(Math.random() * list.length) : index % list.length];

  if (variant === undefined) {
    return {
      layout: pick(THUMBNAIL_LAYOUTS, undefined),
      palette: pick(THUMBNAIL_PALETTES, undefined),
      treatment: pick(THUMBNAIL_HEADLINE_TREATMENTS, undefined),
    };
  }

  const seed = Math.abs(Math.trunc(variant));
  const layoutCount = THUMBNAIL_LAYOUTS.length;
  const paletteCount = THUMBNAIL_PALETTES.length;

  return {
    layout: pick(THUMBNAIL_LAYOUTS, seed),
    palette: pick(THUMBNAIL_PALETTES, Math.floor(seed / layoutCount)),
    treatment: pick(THUMBNAIL_HEADLINE_TREATMENTS, Math.floor(seed / (layoutCount * paletteCount))),
  };
}

const LOCATION_TOKEN = /([가-힣]+(?:동|구|시|읍|면))/g;

/**
 * Pulls a short neighbourhood label out of a Korean street address, the way the
 * reference thumbnails label themselves ("풍무동, 패트라산부인과").
 *
 * Prefers the most specific token (동 > 구 > 시), because that is what local
 * search traffic actually uses. Returns '' when nothing usable is present.
 */
export function deriveLocationLabel(address?: string | null): string {
  if (!address) return '';
  const tokens = address.match(LOCATION_TOKEN);
  if (!tokens) return '';

  // "서울특별시" / "경기도 고양시" are too coarse to be worth printing when a
  // 동 or 구 is available, so rank by specificity rather than taking the first.
  const bySuffix = (suffix: string) => tokens.find((t) => t.endsWith(suffix) && t.length > 1);
  return bySuffix('동') || bySuffix('구') || bySuffix('읍') || bySuffix('면') || bySuffix('시') || '';
}

export interface ThumbnailBranding {
  /** Real tenant name, rendered verbatim in the footer. Never invented. */
  tenantName?: string;
  /** Neighbourhood/district label such as "풍무동" or "광진구". */
  location?: string;
  /**
   * Pins the design for reproducibility. Layout, palette, and headline
   * treatment are unpacked from it on separate digits, so consecutive variants
   * differ in layout while the same layout still reaches every palette.
   * Random and independent per axis when omitted.
   */
  variant?: number;
}

function buildThumbnailPrompt(
  pack: VerticalPack,
  topic: string,
  visualDescription: string,
  textContent: string | undefined,
  branding: ThumbnailBranding
): string {
  const { layout, palette, treatment } = selectThumbnailStyle(branding.variant);

  const footerParts = [branding.location, branding.tenantName].filter(Boolean);
  const footerInstruction = footerParts.length
    ? `Footer — "${footerParts.join(', ')}", reproduced exactly, character for character. ${layout.footer}`
    : `Footer — none. Do not add any ${pack.terminology.tenantNoun} name or footer line; leave that area empty.`;

  const subtitleInstruction = textContent
    ? `Subtitle — "${textContent}". You may break it across two lines at a natural word boundary, but do not reword it.`
    : 'Subtitle — write one short, natural Korean line (15–25 characters) that expands on the headline.';

  return `
KOREAN BLOG TITLE CARD (썸네일): ${withTopic(pack.imagery.thumbnailContext, topic)}

Square 1:1 composition. Typography is the main subject and must dominate the frame.

Text elements (the layout below decides where each one sits — do not default to a centred stack):
1. Eyebrow — one small line qualifying the headline (a symptom, a qualifier, or a location; roughly 5–15 characters), set in the accent colour.
2. Headline — the key term drawn from the content below, in an extremely large, heavy, rounded Korean sans-serif (think 여기어때 잘난체 / G마켓 산스 Bold), filling most of the available width.
3. ${subtitleInstruction}
4. ${footerInstruction}

Content to draw the headline and eyebrow from:
${visualDescription}

Layout — "${layout.name}". Follow this composition exactly; it is what distinguishes this card from other cards in the series:
${layout.composition}

Decoration:
${layout.decoration}

Headline treatment:
${treatment}

Colour scheme:
${palette}

Typography and text rules:
- All text is Korean (한글). Every character must be a real, correctly formed Hangul syllable — no invented glyphs, no broken jamo, no Latin filler, no Japanese or Chinese characters.
- Keep the total word count low. A crowded card is a failed card: eyebrow + headline + one short subtitle + one footer line, nothing more.
- Leave generous margins; nothing may touch or run off the frame edge.
- Decorative elements must sit behind or beside the text, never on top of it.

BRANDING RULE: Do NOT invent any ${pack.terminology.tenantNoun}, business, or company name, and do NOT draw any logo, emblem, or watermark. ${
    footerParts.length
      ? 'The only permitted brand text is the exact footer line given above.'
      : 'No brand or business name may appear anywhere on the card.'
  }

${pack.imagery.advertisingRule}
`;
}

/** Substitutes the `{topic}` placeholder used throughout a pack's imagery copy. */
function withTopic(template: string, topic: string): string {
  return template.split('{topic}').join(topic);
}

/**
 * Builds the prompt for one image suggestion.
 *
 * @param pack - The tenant's vertical pack; supplies slot styling and domain framing
 * @param type - Which image slot this is
 * @param topic - The blog post topic
 * @param visualDescription - What the writer asked to see in the image
 * @param textContent - Korean text to overlay (slots with `hasTextOverlay`)
 * @param branding - Real tenant name/location, used by THUMBNAIL only
 */
export function generateImagePrompt(
  pack: VerticalPack,
  type: ImageType,
  topic: string,
  visualDescription: string,
  textContent?: string,
  branding: ThumbnailBranding = {}
): string {
  // Title cards are typography, not scenes, so they get their own builder
  // instead of being squeezed through the photographic template below.
  if (type === 'THUMBNAIL') {
    return buildThumbnailPrompt(pack, topic, visualDescription, textContent, branding);
  }

  const slot = pack.images.slots[type];
  const { template } = slot;

  const overlayInstruction = textContent
    ? `Convey this Korean message in the image: "${textContent}". Weave it naturally into the design as part of the composition — you may split it into a headline plus shorter supporting lines, distribute the pieces across the layout, and adjust spacing, sizing, and emphasis so it reads as intentional graphic design rather than one verbatim line of copied text. Use clean, legible Korean typography that fits the overall style.`
    : '';

  // Scene slots stay mostly text-free; design-oriented slots may carry
  // supporting Korean labels so the layout can breathe instead of dumping one
  // verbatim text block.
  const supportingTextInstruction = slot.hasTextOverlay
    ? 'You may add brief, natural Korean titles, headings, labels, or captions that complement the content and fit the design (for example section titles, icon captions, or numbered steps). Keep all text accurate, correctly spelled, and meaningful.'
    : 'Keep this scene mostly free of text; only add a short Korean label if it genuinely fits the image.';

  const textInstruction = [overlayInstruction, supportingTextInstruction]
    .filter(Boolean)
    .join(' ');

  // Forbid fabricated branding (real branding is added separately, never
  // generated) and garbled lettering — without banning legitimate content labels.
  const noBrandingInstruction = `CRITICAL BRANDING RULE: Do NOT generate any brand logos, emblems, watermarks, or invented ${pack.terminology.tenantNoun}/company names on signboards, building exteriors, nameplates, uniforms, or documents. Do NOT produce garbled, distorted, or meaningless lettering. Any text that appears must be accurate, meaningful Korean relevant to the content above.`;

  const contextInstruction = withTopic(
    slot.hasTextOverlay ? pack.imagery.sceneContext : pack.imagery.photoContext,
    topic
  );

  return `
${pack.imagery.contentDeclaration}

${contextInstruction}

Visual Content:
${visualDescription}

Style Guidelines:
- ${template.style}
- Colors: ${template.colors}
- Mood: ${template.mood}
- Key Visual Elements: ${template.elements}
${template.camera ? `- Camera & Realism: ${template.camera}` : ''}

${textInstruction}

${noBrandingInstruction}

${pack.imagery.advertisingRule}

Technical Requirements:
${pack.imagery.technicalNotes.map((note) => `- ${note}`).join('\n')}
`;
}

/**
 * Parses a `TYPE|description` string into its parts.
 * Falls back to EXPLAINER when no type prefix is present.
 */
export function parseImageType(description: string): {
  type: ImageType;
  description: string;
} {
  const typeMatch = description.match(/^([A-Z]+)\|(.+)$/); // ex: "INTRO|여성의 복통"

  if (typeMatch) {
    return {
      type: resolveImageType(typeMatch[1]),
      description: typeMatch[2].trim(),
    };
  }

  return {
    type: 'EXPLAINER',
    description: description.trim(),
  };
}
