import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { encryptBlogPassword } from '@/lib/blog-credential-crypto';
import { isTrustedOrigin } from '@/lib/request-security';
import { isValidDomainEntry } from '@/lib/trusted-domains';
import {
  KEY_PROVIDERS,
  KEY_COLUMNS,
  describeAllKeyStatuses,
  validateApiKeyFormat,
  encryptApiKey,
  PROVIDER_LABELS,
  type KeyProvider,
} from '@/lib/tenant-keys';

const MAX_TEXT_FIELD_LENGTH = 200;
const MAX_SERVICES = 20;
const MAX_DOMAINS = 20;

// The client is sent the tenant row minus anything that is, or decrypts to, a
// credential. Listed explicitly rather than filtered by name pattern so that
// adding a secret column and forgetting to mask it fails loudly in review
// rather than quietly shipping it to the browser.
const SECRET_COLUMNS = [
  'password_hash',
  'blog_password_encrypted',
  'anthropic_api_key_encrypted',
  'openai_api_key_encrypted',
  'gemini_api_key_encrypted',
] as const;

function stripSecrets(tenant: Record<string, unknown>): Record<string, unknown> {
  const safe = { ...tenant };
  for (const column of SECRET_COLUMNS) delete safe[column];
  return safe;
}

/** The plaintext field a client sends for each provider, e.g. `anthropic_api_key`. */
function keyInputField(provider: KeyProvider): string {
  return `${provider}_api_key`;
}

// Get tenant settings
export async function GET(request: NextRequest) {
  try {
    const sessionData = getSession(request);
    if (!sessionData) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', sessionData.id)
      .single();

    if (error || !tenant) {
      return NextResponse.json(
        { error: '계정 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Don't send credential material to the client. API keys are write-only:
    // once stored, the tenant gets a masked hint and nothing more.
    const tenantData = stripSecrets(tenant);

    return NextResponse.json({
      tenant: tenantData,
      apiKeys: describeAllKeyStatuses(tenant),
    });
  } catch (error) {
    console.error('Error in GET /api/tenant/settings:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function isValidUpdatePayload(updates: Record<string, unknown>): boolean {
  const textFields = ['name', 'category', 'address', 'blog_platform', 'blog_id', 'blog_password_encrypted', 'blog_board_name'];
  for (const field of textFields) {
    const value = updates[field];
    if (value !== undefined && (typeof value !== 'string' || value.length > MAX_TEXT_FIELD_LENGTH)) {
      return false;
    }
  }

  if (updates.main_services !== undefined) {
    const services = updates.main_services;
    if (
      !Array.isArray(services) ||
      services.length > MAX_SERVICES ||
      !services.every((s) => typeof s === 'string' && s.length <= MAX_TEXT_FIELD_LENGTH)
    ) {
      return false;
    }
  }

  if (updates.trusted_domains !== undefined) {
    const domains = updates.trusted_domains;
    if (
      !Array.isArray(domains) ||
      domains.length > MAX_DOMAINS ||
      !domains.every((d) => typeof d === 'string' && d.length <= MAX_TEXT_FIELD_LENGTH && isValidDomainEntry(d))
    ) {
      return false;
    }
  }

  return true;
}

// Update tenant settings
export async function PUT(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
    }

    const sessionData = getSession(request);
    if (!sessionData) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const updates = await request.json();

    if (!isValidUpdatePayload(updates)) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // Fields that can be updated
    const allowedFields = [
      'name',
      'category',
      'main_services',
      'address',
      'trusted_domains',
      'blog_platform',
      'blog_id',
      'blog_password_encrypted',
      'blog_board_name',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    // The blog platform password is the tenant's external credential —
    // never store it in plaintext.
    if (typeof updateData.blog_password_encrypted === 'string' && updateData.blog_password_encrypted) {
      updateData.blog_password_encrypted = encryptBlogPassword(updateData.blog_password_encrypted);
    }

    // BYOK. The client sends plaintext (`anthropic_api_key`); it is encrypted
    // here and only ever read back as a masked hint. An empty string is an
    // explicit "remove my key" — distinct from omitting the field, which leaves
    // the stored key alone, so re-saving the settings form does not wipe keys
    // the form never displayed.
    for (const provider of KEY_PROVIDERS) {
      const submitted = updates[keyInputField(provider)];
      if (submitted === undefined) continue;

      if (typeof submitted !== 'string') {
        return NextResponse.json(
          { error: `${PROVIDER_LABELS[provider]} API 키 형식이 올바르지 않습니다.` },
          { status: 400 }
        );
      }

      const trimmed = submitted.trim();
      if (!trimmed) {
        updateData[KEY_COLUMNS[provider]] = null;
        continue;
      }

      const problem = validateApiKeyFormat(trimmed);
      if (problem) {
        return NextResponse.json(
          { error: `${PROVIDER_LABELS[provider]}: ${problem}` },
          { status: 400 }
        );
      }

      updateData[KEY_COLUMNS[provider]] = encryptApiKey(trimmed);
    }

    if (updates.image_provider !== undefined) {
      const requested = updates.image_provider;
      if (requested !== null && requested !== 'openai' && requested !== 'gemini') {
        return NextResponse.json(
          { error: '이미지 생성 제공자가 올바르지 않습니다.' },
          { status: 400 }
        );
      }
      updateData.image_provider = requested;
    }

    // Check if all required fields are filled
    const requiredFields = ['name', 'main_services', 'address', 'blog_id', 'blog_board_name'];
    const { data: currentHospital } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', sessionData.id)
      .single();

    if (currentHospital) {
      const allFieldsFilled = requiredFields.every(field => {
        const value = updateData[field] !== undefined ? updateData[field] : currentHospital[field];
        return value !== null && value !== '' && (Array.isArray(value) ? value.length > 0 : true);
      });

      if (allFieldsFilled) {
        updateData.is_initial_setup_complete = true;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update(updateData)
      .eq('id', sessionData.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating tenant:', error);
      return NextResponse.json(
        { error: '설정 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: '설정이 저장되었습니다.',
      tenant: stripSecrets(data),
      apiKeys: describeAllKeyStatuses(data),
    });
  } catch (error) {
    console.error('Error in PUT /api/tenant/settings:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
