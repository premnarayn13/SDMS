-- Multi-Drive Support Migration
-- Allows users to connect multiple Google Drive accounts with adjustable storage limits

-- =====================================================
-- STEP 1: Drop the unique constraint on user_id to allow multiple drives
-- =====================================================
-- First check if the constraint exists and drop it
DO $$ 
BEGIN
    -- Drop unique constraint if exists (constraint name may vary)
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'google_drive_tokens_user_id_key'
    ) THEN
        ALTER TABLE google_drive_tokens DROP CONSTRAINT google_drive_tokens_user_id_key;
    END IF;
    
    -- Also try alternate constraint name
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_drive'
    ) THEN
        ALTER TABLE google_drive_tokens DROP CONSTRAINT unique_user_drive;
    END IF;
END $$;

-- =====================================================
-- STEP 2: Add new columns for multi-drive support
-- =====================================================

-- Display name for user-friendly identification (e.g., "Work Drive", "Personal Drive")
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

-- Drive index for ordering (auto-assigns letter: A, B, C, etc.)
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS drive_index INT DEFAULT 0;

-- User-configurable storage allocation (default 10GB)
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS allocated_storage_bytes BIGINT DEFAULT 10737418240;

-- Status indicator (active, disconnected, error)
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Last sync time
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Color for visual distinction in UI
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#3b82f6';

-- =====================================================
-- STEP 3: Create unique constraint for user + drive_email combination
-- =====================================================
-- Prevent same Google account from being linked twice by same user
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_drive_email'
    ) THEN
        ALTER TABLE google_drive_tokens 
        ADD CONSTRAINT unique_user_drive_email UNIQUE (user_id, drive_email);
    END IF;
END $$;

-- =====================================================
-- STEP 4: Create index for efficient querying
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_google_drive_tokens_user_id ON google_drive_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_google_drive_tokens_status ON google_drive_tokens(status);

-- =====================================================
-- STEP 5: Update existing records with display names
-- =====================================================
UPDATE google_drive_tokens 
SET display_name = 'Primary Drive', 
    drive_index = 0,
    color = '#3b82f6'
WHERE display_name IS NULL;

-- =====================================================
-- STEP 6: Create function to get next drive index for user
-- =====================================================
CREATE OR REPLACE FUNCTION get_next_drive_index(p_user_id UUID)
RETURNS INT AS $$
DECLARE
    next_index INT;
BEGIN
    SELECT COALESCE(MAX(drive_index) + 1, 0) INTO next_index
    FROM google_drive_tokens
    WHERE user_id = p_user_id;
    RETURN next_index;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 7: Create view for drive with letter labels
-- =====================================================
CREATE OR REPLACE VIEW user_drives_with_labels AS
SELECT 
    gdt.*,
    CASE 
        WHEN gdt.display_name IS NOT NULL AND gdt.display_name != '' THEN gdt.display_name
        ELSE 'Drive ' || CHR(65 + gdt.drive_index)  -- 65 is ASCII for 'A'
    END AS label
FROM google_drive_tokens gdt
WHERE gdt.status = 'active' OR gdt.status IS NULL;

-- =====================================================
-- Completion message
-- =====================================================
SELECT 'Multi-drive migration completed successfully!' as status;
