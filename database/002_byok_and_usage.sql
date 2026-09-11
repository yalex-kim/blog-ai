-- ============================================================================
-- 002 — bring-your-own-key storage, and usage metering
-- ============================================================================
-- Run after 001_repair_schema.sql (or straight after schema.sql on a fresh
-- database). Safe to re-run.
--
-- Two changes:
--
--   1. Each tenant can store their own provider API keys. They are encrypted
--      with BLOG_CREDENTIAL_ENCRYPTION_KEY before they reach the database —
--      the same envelope as the blog platform password — so a database dump
--      does not hand over anyone's billing.
--
--   2. usage_events records what each generation consumed, so a tenant can see
--      what their key was charged. Token counts are the ground truth; cost_usd
--      is an estimate computed at write time from lib/pricing.ts and is NULL
--      when no rate is known for that model or image provider.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- tenants — per-tenant keys
-- ---------------------------------------------------------------------------
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS anthropic_api_key_encrypted TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS openai_api_key_encrypted    TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gemini_api_key_encrypted    TEXT;

-- Which image provider this tenant's own key is for. NULL means "follow the
-- deployment's IMAGE_PROVIDER default".
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS image_provider TEXT;

COMMENT ON COLUMN tenants.anthropic_api_key_encrypted IS 'AES-256-GCM, key from BLOG_CREDENTIAL_ENCRYPTION_KEY — never stored in plaintext, never returned to a client';
COMMENT ON COLUMN tenants.openai_api_key_encrypted    IS 'AES-256-GCM, key from BLOG_CREDENTIAL_ENCRYPTION_KEY — never stored in plaintext, never returned to a client';
COMMENT ON COLUMN tenants.gemini_api_key_encrypted    IS 'AES-256-GCM, key from BLOG_CREDENTIAL_ENCRYPTION_KEY — never stored in plaintext, never returned to a client';
COMMENT ON COLUMN tenants.image_provider IS 'openai | gemini | NULL to follow the IMAGE_PROVIDER env default';

-- ---------------------------------------------------------------------------
-- usage_events — one row per billable provider call
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- What produced the call: blog_generation | topic_recommendation | image_generation
  kind TEXT NOT NULL,
  -- anthropic | openai | gemini
  provider TEXT NOT NULL,
  -- The exact model id sent to the provider, which is what the rate table keys on.
  model TEXT NOT NULL,
  -- 'tenant' when the tenant's own key paid for this, 'platform' when it fell
  -- back to the deployment's key. Without this a BYOK dashboard would quietly
  -- bill a tenant for calls their key never made.
  key_source TEXT NOT NULL DEFAULT 'platform',

  blog_post_id UUID REFERENCES blog_posts(id) ON DELETE SET NULL,

  -- Ground truth, straight from the provider's usage block.
  input_tokens                INTEGER NOT NULL DEFAULT 0,
  output_tokens               INTEGER NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_input_tokens     INTEGER NOT NULL DEFAULT 0,
  -- Billed separately from tokens at $10 per 1,000 searches.
  web_search_requests         INTEGER NOT NULL DEFAULT 0,
  image_count                 INTEGER NOT NULL DEFAULT 0,

  -- Estimate. NULL = could not be priced (unknown model, or an image provider
  -- with no configured per-image rate). Read it as "unknown", never as zero.
  cost_usd NUMERIC(12, 6),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The dashboard's only query shape: this tenant, newest first, windowed by date.
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_time ON usage_events(tenant_id, created_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
-- No policies, as with every other table: the server reaches these rows with
-- the service role key and scopes them by the session's tenant id.

COMMIT;

-- ============================================================================
-- Verify.
-- ============================================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'usage_events'
ORDER BY ordinal_position;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenants'
  AND column_name LIKE '%api_key_encrypted'
ORDER BY column_name;
