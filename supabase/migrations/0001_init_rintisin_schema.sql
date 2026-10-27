-- ============================================================================
-- Rintisin AI — Initial Database Schema, Row Level Security & Realtime
-- Requirements: 2.1–2.7, 10.1, 11.8, 14.1, 20.1, 21.2
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Modul 1: module1_analyses (Module1_Analysis)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.module1_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_idea TEXT NOT NULL CHECK (char_length(btrim(product_idea)) BETWEEN 20 AND 1000),
  category TEXT NOT NULL CHECK (category IN ('KULINER', 'FASHION', 'KRIYA', 'BEAUTY')),
  initial_capital_idr BIGINT NOT NULL CHECK (initial_capital_idr BETWEEN 1 AND 10000000000),
  target_city TEXT NOT NULL CHECK (char_length(btrim(target_city)) BETWEEN 2 AND 100),
  step1_status TEXT NOT NULL DEFAULT 'IDLE' CHECK (step1_status IN ('IDLE', 'RUNNING', 'SUCCESS', 'FAILED')),
  step2_status TEXT NOT NULL DEFAULT 'IDLE' CHECK (step2_status IN ('IDLE', 'RUNNING', 'SUCCESS', 'FAILED')),
  step1_result JSONB,
  step2_result JSONB,
  step1_model TEXT CHECK (step1_model IS NULL OR step1_model IN ('openai/gpt-oss-120b', 'openai/gpt-oss-20b')),
  step2_model TEXT CHECK (step2_model IS NULL OR step2_model IN ('openai/gpt-oss-120b', 'openai/gpt-oss-20b')),
  is_degraded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module1_analyses_user_created
  ON public.module1_analyses (user_id, created_at DESC);

ALTER TABLE public.module1_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "module1_select_own" ON public.module1_analyses;
CREATE POLICY "module1_select_own"
  ON public.module1_analyses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "module1_insert_own" ON public.module1_analyses;
CREATE POLICY "module1_insert_own"
  ON public.module1_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "module1_update_own" ON public.module1_analyses;
CREATE POLICY "module1_update_own"
  ON public.module1_analyses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "module1_delete_own" ON public.module1_analyses;
CREATE POLICY "module1_delete_own"
  ON public.module1_analyses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. Modul 2: module2_radars (Radar_Job)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.module2_radars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  maps_urls JSONB NOT NULL CHECK (jsonb_typeof(maps_urls) = 'array' AND jsonb_array_length(maps_urls) BETWEEN 1 AND 3),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SCRAPING', 'ANALYZING', 'COMPLETED', 'FAILED')),
  result JSONB,
  failed_competitors JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(failed_competitors) = 'array'),
  error_message TEXT,
  map_models JSONB,
  reduce_model TEXT CHECK (reduce_model IS NULL OR reduce_model IN ('openai/gpt-oss-120b', 'openai/gpt-oss-20b')),
  is_degraded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT module2_completed_requires_result CHECK (
    (status = 'COMPLETED' AND result IS NOT NULL) OR
    (status <> 'COMPLETED' AND result IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_module2_radars_user_created
  ON public.module2_radars (user_id, created_at DESC);

ALTER TABLE public.module2_radars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "module2_select_own" ON public.module2_radars;
CREATE POLICY "module2_select_own"
  ON public.module2_radars
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "module2_insert_own" ON public.module2_radars;
CREATE POLICY "module2_insert_own"
  ON public.module2_radars
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "module2_update_own" ON public.module2_radars;
CREATE POLICY "module2_update_own"
  ON public.module2_radars
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "module2_delete_own" ON public.module2_radars;
CREATE POLICY "module2_delete_own"
  ON public.module2_radars
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. Supabase Realtime Publication (Requirement 2.3 & 21.2)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'module2_radars'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.module2_radars;
  END IF;
END
$$;
