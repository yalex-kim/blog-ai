-- ============================================================================
-- 003 — backfill image rows that were recorded before image rates existed
-- ============================================================================
-- OPTIONAL, and one-off.
--
-- You probably do not need this. `/api/usage` re-costs any row whose cost_usd
-- is NULL from the counts it stored, so those rows already show a price in the
-- dashboard without touching the database. This file only matters if you want
-- the stored value corrected too — for an export, or a query that reads
-- cost_usd directly.
--
-- ⚠ The rates below are a SNAPSHOT copied from lib/pricing.ts on 2026-09-11.
-- That file is the source of truth; this one is a transcription that will go
-- stale. Do not start maintaining rates here.
--
-- ⚠ image_quality is NULL on rows written before that column existed, so the
-- tier they actually ran at was never recorded. The block below assumes 'low',
-- which is what the dashboard's selector defaults to. If you generated at a
-- different tier, change ASSUMED_QUALITY before running — at 1024x1024 High is
-- about 36x Low, so the assumption is not a rounding detail.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- Change this if those images were not generated at Low.
  assumed_quality TEXT := 'low';
BEGIN
  -- Record the tier for rows that predate the column, so the row states what
  -- it was priced at rather than leaving the next reader to guess.
  UPDATE usage_events
  SET image_quality = assumed_quality
  WHERE kind = 'image_generation'
    AND image_quality IS NULL;
END $$;

-- gpt-image-2 at 1024x1024. Source: developers.openai.com/api/docs/pricing.
UPDATE usage_events
SET cost_usd = image_count * CASE image_quality
  WHEN 'low'    THEN 0.00588
  WHEN 'medium' THEN 0.05268
  WHEN 'high'   THEN 0.21072
END
WHERE kind = 'image_generation'
  AND provider = 'openai'
  AND cost_usd IS NULL
  AND image_quality IN ('low', 'medium', 'high');

-- gemini-3-pro-image-preview ("Nano Banana Pro"), flat per image.
-- Source: nanobananaapi.ai.
UPDATE usage_events
SET cost_usd = image_count * 0.09
WHERE kind = 'image_generation'
  AND provider = 'gemini'
  AND cost_usd IS NULL;

COMMIT;

-- ============================================================================
-- Verify — no image row should be left unpriced.
-- ============================================================================
SELECT
  provider,
  image_quality,
  COUNT(*)                              AS rows,
  SUM(image_count)                      AS images,
  ROUND(SUM(cost_usd)::numeric, 4)      AS usd,
  COUNT(*) FILTER (WHERE cost_usd IS NULL) AS still_unpriced
FROM usage_events
WHERE kind = 'image_generation'
GROUP BY provider, image_quality
ORDER BY provider, image_quality;
