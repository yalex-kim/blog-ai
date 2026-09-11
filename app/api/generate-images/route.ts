import { NextRequest, NextResponse } from 'next/server';
import { uploadImageFromBuffer, saveImageMetadata } from '@/lib/image-storage';
import {
  generateImagePrompt,
  parseImageType,
  deriveLocationLabel,
  ThumbnailBranding,
} from '@/lib/image-prompts';
import { getVertical } from '@/lib/verticals/registry';
import { IMAGE_TYPES, resolveImageType, type ImageType, type VerticalPack } from '@/lib/verticals/types';
import { supabaseAdmin } from '@/lib/supabase';
import { getImageProvider, resolveImageProviderId } from '@/lib/image-providers';
import { getSession } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { isTrustedOrigin } from '@/lib/request-security';
import {
  resolveApiKey,
  missingKeyMessage,
  KEY_COLUMNS,
  MISSING_API_KEY_CODE,
} from '@/lib/tenant-keys';
import { recordUsage } from '@/lib/usage';
import { normalizeImageQuality, DEFAULT_IMAGE_QUALITY } from '@/lib/pricing';

// The model each provider actually generates with — recorded on usage rows so
// the dashboard can name what was billed.
const IMAGE_MODELS: Record<string, string> = {
  openai: 'gpt-image-2',
  gemini: 'gemini-3-pro-image-preview',
};

export const maxDuration = 300; // 5 minutes for High quality generation

const VALID_IMAGE_TYPES: readonly ImageType[] = IMAGE_TYPES;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_TEXT_LENGTH = 200;
const MAX_KEYWORDS = 5;

// Accepts historical slot names (MEDICAL) as well as current ones, so a
// dashboard replaying an older post's suggestions still validates.
function isKnownImageType(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toUpperCase();
  return (
    (VALID_IMAGE_TYPES as readonly string[]).includes(normalized) ||
    resolveImageType(normalized) !== 'EXPLAINER' ||
    normalized === 'EXPLAINER'
  );
}

function isValidKeywordItem(keyword: unknown): boolean {
  if (typeof keyword === 'string') return keyword.length <= MAX_DESCRIPTION_LENGTH;
  if (typeof keyword !== 'object' || keyword === null) return false;
  const k = keyword as Record<string, unknown>;
  if (typeof k.description !== 'string' || k.description.length > MAX_DESCRIPTION_LENGTH) return false;
  if (k.text !== undefined && (typeof k.text !== 'string' || k.text.length > MAX_TEXT_LENGTH)) return false;
  if (k.type !== undefined && !isKnownImageType(k.type)) return false;
  return true;
}

// Every image needs the tenant's vertical pack (it supplies the visual style
// and the domain framing), THUMBNAIL cards additionally print the real tenant
// name and neighbourhood, and BYOK needs the tenant's own image provider key.
// One round trip covers all three, for the whole request rather than per image.
// Which provider to call is not read here — the dashboard sends it per request.
interface TenantImageContext {
  pack: VerticalPack;
  branding: ThumbnailBranding;
  tenant: {
    openai_api_key_encrypted?: string | null;
    gemini_api_key_encrypted?: string | null;
  } | null;
}

async function loadTenantImageContext(tenantId: string): Promise<TenantImageContext> {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select(`name, address, vertical, ${KEY_COLUMNS.openai}, ${KEY_COLUMNS.gemini}`)
    .eq('id', tenantId)
    .single();

  return {
    pack: getVertical(tenant?.vertical),
    branding: {
      tenantName: tenant?.name || undefined,
      location: deriveLocationLabel(tenant?.address) || undefined,
    },
    tenant,
  };
}

// Confirms the caller's session actually owns the blog post before allowing
// writes/deletes against its images (prevents cross-tenant tampering).
async function verifyBlogPostOwnership(blogPostId: string, tenantId: string): Promise<boolean> {
  const { data: post } = await supabaseAdmin
    .from('blog_posts')
    .select('tenant_id')
    .eq('id', blogPostId)
    .single();
  return !!post && post.tenant_id === tenantId;
}

export async function POST(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
    }

    const sessionData = getSession(request);
    if (!sessionData) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { allowed, retryAfterSeconds } = checkRateLimit(
      `generate-images:${sessionData.id}`,
      30,
      60 * 60 * 1000
    );
    if (!allowed) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const { keywords, topic, description, text, type: requestedType, index, blogPostId, replaceExisting, promptId, imageProvider: providerOverride, imageQuality } = await request.json();

    if (blogPostId !== undefined && blogPostId !== null) {
      if (typeof blogPostId !== 'string' || !(await verifyBlogPostOwnership(blogPostId, sessionData.id))) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
      }
    }

    // Loaded once for the whole request — both the single-image and batch paths
    // below share the pack, the branding and the tenant's key.
    const { pack, branding, tenant } = await loadTenantImageContext(sessionData.id);

    const providerId = resolveImageProviderId(providerOverride);
    const imageKey = resolveApiKey(providerId, tenant);
    if (!imageKey) {
      return NextResponse.json(
        { error: missingKeyMessage(providerId), code: MISSING_API_KEY_CODE, provider: providerId },
        { status: 400 }
      );
    }

    const imageProvider = getImageProvider(providerId, imageKey.apiKey);

    // Falling back to the provider's own default rather than null keeps the
    // recorded quality equal to what was actually generated, which is what the
    // per-tier rate is looked up by.
    const quality = normalizeImageQuality(imageQuality) ?? DEFAULT_IMAGE_QUALITY;

    // Single image generation (for regeneration)
    if (description !== undefined && index !== undefined) {
      if (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH) {
        return NextResponse.json({ error: '이미지 설명이 올바르지 않습니다.' }, { status: 400 });
      }
      if (text !== undefined && (typeof text !== 'string' || text.length > MAX_TEXT_LENGTH)) {
        return NextResponse.json({ error: '이미지 텍스트가 올바르지 않습니다.' }, { status: 400 });
      }
      if (requestedType !== undefined && !isKnownImageType(requestedType)) {
        return NextResponse.json({ error: '이미지 타입이 올바르지 않습니다.' }, { status: 400 });
      }

      // If replaceExisting is true, delete old image first
      if (replaceExisting && blogPostId && index !== undefined) {
        try {
          // Find and delete existing image with same blog_post_id and display_order
          const { data: existingImages, error: fetchError } = await supabaseAdmin
            .from('blog_images')
            .select('id, storage_path')
            .eq('blog_post_id', blogPostId)
            .eq('display_order', index);

          if (fetchError) {
            console.error('Error fetching existing images:', fetchError);
          } else if (existingImages && existingImages.length > 0) {
            for (const img of existingImages) {
              // Delete from storage
              const { error: storageError } = await supabaseAdmin.storage
                .from('blog-images')
                .remove([img.storage_path]);

              if (storageError) {
                console.error('Error deleting from storage:', storageError);
              }

              // Delete from database
              const { error: dbError } = await supabaseAdmin
                .from('blog_images')
                .delete()
                .eq('id', img.id);

              if (dbError) {
                console.error('Error deleting from database:', dbError);
              }
            }
          }
        } catch (deleteError) {
          console.error('Error during image deletion:', deleteError);
          // Continue with generation even if deletion fails
        }
      }

      // The caller sends the type alongside the description; parseImageType is
      // only the fallback for the legacy "TYPE|description" encoding. Without
      // this the type was silently lost here and every individually generated
      // image came out as MEDICAL, ignoring INTRO/CTA/INFOGRAPHIC styling.
      const { type, description: cleanDescription } = requestedType
        ? { type: resolveImageType(requestedType), description: description.trim() }
        : parseImageType(description);

      // Generate typed prompt
      const prompt = generateImagePrompt(pack, type, topic, cleanDescription, text, branding);

      const result = await imageProvider.generateImage({
        prompt,
        size: "1024x1024",
        quality,
      });

      // Metered on generation, not on upload: the provider bills for the image
      // whether or not storing it afterwards succeeds.
      await recordUsage({
        tenantId: sessionData.id,
        kind: 'image_generation',
        provider: providerId,
        model: IMAGE_MODELS[providerId] ?? providerId,
        keySource: imageKey.source,
        blogPostId: blogPostId ?? null,
        imageCount: 1,
        imageQuality: quality,
      });

      const b64Image = result.imageData;

      if (blogPostId && b64Image) {
        try {
          const imageBuffer = Buffer.from(b64Image, 'base64');
          const finalImageUrl = await uploadImageFromBuffer(imageBuffer);

          // Extract storage path from URL for metadata
          const urlParts = finalImageUrl.split('/');
          const storagePath = urlParts[urlParts.length - 1];

          // Save metadata to database
          await saveImageMetadata(
            blogPostId,
            description,
            text || '',
            storagePath,
            finalImageUrl,
            prompt,
            index, // Pass order index
            type, // Pass image type
            promptId // Pass prompt ID
          );

          return NextResponse.json({
            image: {
              keyword: cleanDescription,
              url: finalImageUrl,
              prompt: prompt,
              type: type,
            },
            index,
          });
        } catch (uploadError) {
          console.error('Failed to upload image:', uploadError);
          return NextResponse.json(
            { error: '이미지 저장 중 오류가 발생했습니다. 다시 시도해주세요.' },
            { status: 502 }
          );
        }
      }

      return NextResponse.json({
        image: {
          keyword: cleanDescription,
          url: '',
          prompt: prompt,
          type: type,
        },
        index,
      });
    }

    // Batch image generation
    if (!keywords || keywords.length === 0) {
      return NextResponse.json(
        { error: '이미지 키워드를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(keywords) || keywords.length > MAX_KEYWORDS || !keywords.every(isValidKeywordItem)) {
      return NextResponse.json(
        { error: '이미지 키워드 입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // Generate images for each keyword
    const imagePromises = keywords.map(async (keyword: string | {type?: string, description: string, text: string, id?: string}, idx: number) => {
      // Handle both string and object formats
      const visualDescription = typeof keyword === 'string' ? keyword : keyword.description;
      const textContent = typeof keyword === 'object' && keyword !== null ? keyword.text : '';
      const imageType = typeof keyword === 'object' && keyword !== null && keyword.type ? keyword.type : '';
      const promptId = typeof keyword === 'object' && keyword !== null && keyword.id ? keyword.id : undefined;

      // Parse image type from description (supports both TYPE|description format and separate type field)
      const { type, description: cleanDescription } = imageType
        ? { type: resolveImageType(imageType), description: visualDescription }
        : parseImageType(visualDescription);

      // Generate typed prompt
      const prompt = generateImagePrompt(pack, type, topic, cleanDescription, textContent, branding);

      const result = await imageProvider.generateImage({
        prompt,
        size: "1024x1024",
        quality,
      });

      const b64Image = result.imageData;

      // Convert base64 to buffer and upload to Supabase
      let finalImageUrl = '';
      let uploadFailed = false;
      if (blogPostId && b64Image) {
        try {
          const imageBuffer = Buffer.from(b64Image, 'base64');
          finalImageUrl = await uploadImageFromBuffer(imageBuffer);

          // Extract storage path from URL for metadata
          const urlParts = finalImageUrl.split('/');
          const storagePath = urlParts[urlParts.length - 1];

          // Save metadata to database
          await saveImageMetadata(
            blogPostId,
            visualDescription,
            textContent,
            storagePath,
            finalImageUrl,
            prompt,
            idx, // Pass order index
            type, // Pass image type
            promptId // Pass prompt ID
          );
        } catch (uploadError) {
          console.error('Failed to upload image:', uploadError);
          finalImageUrl = '';
          uploadFailed = true;
        }
      }

      return {
        keyword: cleanDescription,
        text: textContent,
        url: finalImageUrl,
        prompt: prompt,
        type: type,
        ...(uploadFailed ? { error: '이미지 저장에 실패했습니다.' } : {}),
      };
    });

    const results = await Promise.allSettled(imagePromises);

    // One row for the batch, counting only the images the provider actually
    // produced — a call that threw was not billed.
    const generatedCount = results.filter((r) => r.status === 'fulfilled').length;
    if (generatedCount > 0) {
      await recordUsage({
        tenantId: sessionData.id,
        kind: 'image_generation',
        provider: providerId,
        model: IMAGE_MODELS[providerId] ?? providerId,
        keySource: imageKey.source,
        blogPostId: blogPostId ?? null,
        imageCount: generatedCount,
        imageQuality: quality,
      });
    }

    // A single failed image must not lose the ones that worked, so each
    // rejection becomes an error entry in its own slot.
    const images = results.map((result, idx) =>
      result.status === 'fulfilled'
        ? result.value
        : {
            keyword: typeof keywords[idx] === 'string' ? keywords[idx] : keywords[idx]?.description ?? '',
            text: '',
            url: '',
            prompt: '',
            type: 'EXPLAINER',
            error: '이미지 생성에 실패했습니다.',
          }
    );

    return NextResponse.json({ images });
  } catch (error: unknown) {
    console.error('Error generating images:', error);
    const errorMessage = error instanceof Error ? error.message : '이미지 생성 중 오류가 발생했습니다.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
