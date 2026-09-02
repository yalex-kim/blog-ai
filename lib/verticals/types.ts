/**
 * The vertical pack contract.
 *
 * A vertical pack is everything that makes this engine write for *one kind of
 * business*. The engine itself — sessions, generation, image storage, reference
 * verification — knows nothing about hospitals, development centres, or law
 * firms. It asks a pack for the words.
 *
 * Adding an industry means adding one file under `lib/verticals/` and listing
 * it in `registry.ts`. Nothing else in the codebase should branch on a
 * vertical id.
 */

/**
 * Image slots the engine understands.
 *
 * These names are deliberately industry-neutral and are persisted in
 * `blog_images.image_type`, so they must stay stable. What each slot *depicts*
 * is the pack's business: EXPLAINER renders anatomy for a clinic and a
 * development-milestone diagram for a therapy centre.
 */
export type ImageType =
  | 'THUMBNAIL'
  | 'INTRO'
  | 'EXPLAINER'
  | 'LIFESTYLE'
  | 'WARNING'
  | 'CTA'
  | 'INFOGRAPHIC';

export const IMAGE_TYPES: readonly ImageType[] = [
  'THUMBNAIL',
  'INTRO',
  'EXPLAINER',
  'LIFESTYLE',
  'WARNING',
  'CTA',
  'INFOGRAPHIC',
];

/**
 * Historical slot names that still appear in stored posts. `MEDICAL` was the
 * pre-generalization name for EXPLAINER; posts written before the rename keep
 * it in their `[#n | MEDICAL | ...]` markers, so the parser has to accept it.
 */
export const IMAGE_TYPE_ALIASES: Readonly<Record<string, ImageType>> = {
  MEDICAL: 'EXPLAINER',
};

/**
 * Resolves a slot name written by the model into a known `ImageType`,
 * accepting the historical aliases above.
 *
 * Falls back to EXPLAINER, the one slot that suits an unlabelled description
 * in any vertical.
 */
export function resolveImageType(raw: string): ImageType {
  const normalized = raw.trim().toUpperCase();
  if ((IMAGE_TYPES as readonly string[]).includes(normalized)) return normalized as ImageType;
  return IMAGE_TYPE_ALIASES[normalized] ?? 'EXPLAINER';
}

/** Visual direction handed to the image model for one slot. */
export interface ImagePromptTemplate {
  style: string;
  colors: string;
  mood: string;
  elements: string;
  /** Only meaningful for photographic slots. */
  camera?: string;
}

export interface VerticalImageSlot {
  /** Korean label shown to the writer model when it picks a slot. */
  label: string;
  /** One line telling the writer model when this slot is the right choice. */
  writerGuidance: string;
  /**
   * Whether the writer appends `| text : ...` for this slot. Scene-only slots
   * (INTRO, LIFESTYLE) carry no overlay text.
   */
  hasTextOverlay: boolean;
  template: ImagePromptTemplate;
}

/**
 * What the tenant is called, everywhere. Swapping these is what turns
 * "병원 이름 / 진료과목 / 환자" into "센터 이름 / 전문 분야 / 보호자" without
 * touching a single component.
 */
export interface VerticalTerminology {
  /** The account holder: '병원', '센터', '매장'. */
  tenantNoun: string;
  /** Form label for the display name: '병원 이름'. */
  tenantNameLabel: string;
  /** Form label for the specialty field: '진료과목', '전문 분야'. */
  categoryLabel: string;
  /** Form label for the service list: '주요 진료 항목', '주요 프로그램'. */
  servicesLabel: string;
  /** Who the posts speak to: '환자', '보호자', '고객'. */
  audienceNoun: string;
  /** Seed value for the specialty field on a new account. */
  defaultCategory: string;
  /** Placeholder examples for the service list input. */
  serviceExamples: string[];
}

/**
 * The writing rules. These become the system prompt for post generation —
 * see `buildBlogSystemPrompt`.
 */
export interface VerticalWriting {
  /** "당신은 …입니다" — the role the model plays. */
  persona: string;
  /** Legal and advertising constraints. The non-negotiable ones. */
  complianceRules: string[];
  /** Voice, register, and how to address the reader. */
  toneRules: string[];
  /** Post skeleton: what sections, in what order. */
  structureRules: string[];
  /** Target length, as a sentence. */
  lengthGuidance: string;
  /** Words the post must never contain. Enforced by prompt, not by regex. */
  bannedPhrases: string[];
  /** How the closing section should invite contact. */
  ctaGuidance: string;
  /** When and how the model must ground claims with `web_search`. */
  researchRules: string[];
  /** Platform-specific SEO note (Naver, Google, …). */
  seoNote: string;
}

/**
 * Domain framing for the image model.
 *
 * Every generated image carries a sentence declaring what kind of content it
 * is and who publishes it, and that framing does real work: it is what keeps a
 * clinic's anatomy diagram from being refused as graphic content, and what
 * keeps a development centre's illustrations from drifting clinical. `{topic}`
 * is substituted with the post topic.
 */
export interface VerticalImagery {
  /** Leading declaration, e.g. "MEDICAL EDUCATIONAL CONTENT: …". */
  contentDeclaration: string;
  /** Framing for design-led slots (EXPLAINER, INFOGRAPHIC, WARNING, CTA). */
  sceneContext: string;
  /** Framing for photographic slots (INTRO, LIFESTYLE). */
  photoContext: string;
  /** Framing for the THUMBNAIL title card. */
  thumbnailContext: string;
  /** Advertising/appropriateness rule appended to every prompt. */
  advertisingRule: string;
  /** Trailing bullet list of technical and tonal requirements. */
  technicalNotes: string[];
}

export interface VerticalTopicCategory {
  /** Bracket key the model emits, e.g. `정보성` → `[정보성]`. */
  key: string;
  /** What this category covers, for the recommender prompt. */
  description: string;
  /** One concrete example topic, to anchor the model. */
  example: string;
}

export interface VerticalPack {
  /** Stable id, persisted in `tenants.vertical`. */
  id: string;
  /** Human-readable name for the admin UI. */
  label: string;
  /** One line describing who this pack is for. */
  description: string;
  terminology: VerticalTerminology;
  writing: VerticalWriting;
  images: {
    /** Slots every post must contain. THUMBNAIL is always first. */
    required: ImageType[];
    /** Slots the writer may pick from to fill the remaining budget. */
    optional: ImageType[];
    /** Total image suggestions per post. */
    count: number;
    slots: Record<ImageType, VerticalImageSlot>;
  };
  imagery: VerticalImagery;
  /** Seed allowlist for the `web_search` tool. Tenants can override it. */
  trustedDomains: string[];
  /** Categories the topic recommender proposes, five topics each. */
  topicCategories: VerticalTopicCategory[];
}
