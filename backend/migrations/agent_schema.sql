-- =====================================================
-- DOCKY AGENT DATABASE SCHEMA
-- Adds AI agent capabilities without disrupting existing features
-- =====================================================

-- =====================================================
-- TABLE 1: Agent chat history
-- Stores all conversations between users and Docky
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    command_type VARCHAR(50),
    results JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_chat_user_id ON agent_chat_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_chat_command ON agent_chat_history(command_type) WHERE command_type IS NOT NULL;

-- =====================================================
-- TABLE 2: File extracted text
-- Caches extracted text from documents for full-text search
-- =====================================================
CREATE TABLE IF NOT EXISTS file_extracted_text (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL UNIQUE REFERENCES file_metadata(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    language VARCHAR(10),
    word_count INT,
    char_count INT,
    extracted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add full-text search column
ALTER TABLE file_extracted_text 
ADD COLUMN IF NOT EXISTS tsv tsvector 
GENERATED ALWAYS AS (to_tsvector('english', text)) STORED;

CREATE INDEX IF NOT EXISTS idx_file_text_tsv ON file_extracted_text USING GIN(tsv);
CREATE INDEX IF NOT EXISTS idx_file_text_file_id ON file_extracted_text(file_id);

-- =====================================================
-- TABLE 3: File entities
-- Stores extracted entities (people, organizations, dates, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS file_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES file_metadata(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_text TEXT NOT NULL,
    confidence FLOAT,
    position INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_file ON file_entities(file_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON file_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_text ON file_entities(entity_text);

-- =====================================================
-- TABLE 4: File keywords
-- Stores TF-IDF extracted keywords for each document
-- =====================================================
CREATE TABLE IF NOT EXISTS file_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES file_metadata(id) ON DELETE CASCADE,
    keyword VARCHAR(100) NOT NULL,
    score FLOAT NOT NULL,
    rank INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_keywords_file ON file_keywords(file_id);
CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON file_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_keywords_score ON file_keywords(score DESC);

-- =====================================================
-- TABLE 5: Activity logs
-- Comprehensive logging of all user actions
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_target ON activity_logs(target_type, target_id);

-- =====================================================
-- TABLE 6: Saved searches
-- User saved search queries for quick access
-- =====================================================
CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    query JSONB NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    use_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);

-- =====================================================
-- TABLE 7: File access tracking
-- Tracks when users access files for analytics
-- =====================================================
CREATE TABLE IF NOT EXISTS file_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES file_metadata(id) ON DELETE CASCADE,
    access_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_user_file ON file_access_logs(user_id, file_id);
CREATE INDEX IF NOT EXISTS idx_access_created ON file_access_logs(created_at DESC);

-- =====================================================
-- TABLE 8: Duplicate file groups
-- Groups files that are detected as duplicates
-- =====================================================
CREATE TABLE IF NOT EXISTS duplicate_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hash VARCHAR(64) NOT NULL,
    file_ids UUID[] NOT NULL,
    file_count INT NOT NULL,
    total_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_duplicate_hash ON duplicate_groups(hash);

-- =====================================================
-- Function: Log activity
-- Helper function to log user activities
-- =====================================================
CREATE OR REPLACE FUNCTION log_activity(
    p_user_id UUID,
    p_action_type VARCHAR(50),
    p_target_type VARCHAR(50) DEFAULT NULL,
    p_target_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO activity_logs (user_id, action_type, target_type, target_id, metadata)
    VALUES (p_user_id, p_action_type, p_target_type, p_target_id, p_metadata)
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Track file access
-- Automatically track file access for analytics
-- =====================================================
CREATE OR REPLACE FUNCTION track_file_access(
    p_user_id UUID,
    p_file_id UUID,
    p_access_type VARCHAR(20) DEFAULT 'view'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO file_access_logs (user_id, file_id, access_type)
    VALUES (p_user_id, p_file_id, p_access_type);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Success message
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Docky Agent schema installed successfully!';
    RAISE NOTICE '8 tables created: agent_chat_history, file_extracted_text, file_entities, file_keywords, activity_logs, saved_searches, file_access_logs, duplicate_groups';
END $$;
