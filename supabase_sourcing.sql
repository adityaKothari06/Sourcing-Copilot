-- ========================================================
-- SOURCING COPILOT TABLES FOR EXISTING SUPABASE PROJECT
-- Paste and run this in your Supabase SQL Editor.
-- Does NOT affect any existing candidates/CRM tables.
-- ========================================================

-- 1. Sourcing Positions Table
CREATE TABLE IF NOT EXISTS sourcing_positions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    raw_input TEXT NOT NULL,
    input_type TEXT DEFAULT 'text',
    parsed JSONB NOT NULL DEFAULT '{}'::jsonb,
    keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    queries JSONB NOT NULL DEFAULT '{}'::jsonb,
    search_rating TEXT,
    search_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Keyword Feedback Submissions Log
CREATE TABLE IF NOT EXISTS sourcing_keyword_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id TEXT REFERENCES sourcing_positions(id) ON DELETE CASCADE,
    keyword_text TEXT NOT NULL,
    category TEXT DEFAULT 'skill',
    portal TEXT DEFAULT 'naukri',
    vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Global Aggregate Keyword Knowledge
CREATE TABLE IF NOT EXISTS sourcing_keyword_ratings (
    keyword_text TEXT PRIMARY KEY,
    upvotes INT NOT NULL DEFAULT 0,
    downvotes INT NOT NULL DEFAULT 0,
    category TEXT DEFAULT 'skill',
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sourcing_pos_created ON sourcing_positions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sourcing_feedback_kw ON sourcing_keyword_feedback(keyword_text);

-- Enable RLS and allow full access for web app
ALTER TABLE sourcing_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_keyword_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_keyword_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access on sourcing_positions" ON sourcing_positions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access on sourcing_keyword_feedback" ON sourcing_keyword_feedback FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access on sourcing_keyword_ratings" ON sourcing_keyword_ratings FOR ALL USING (true) WITH CHECK (true);
