-- DocMatrix Database Migration
-- Run this in Supabase SQL Editor to add all missing columns

-- =====================================================
-- USERS TABLE - Add missing columns
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- =====================================================
-- USER PREFERENCES TABLE - Add missing columns
-- =====================================================
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS view_mode VARCHAR(20) DEFAULT 'grid';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS sort_by VARCHAR(20) DEFAULT 'name';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS sort_order VARCHAR(10) DEFAULT 'asc';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS sidebar_collapsed BOOLEAN DEFAULT FALSE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS custom_settings JSONB DEFAULT '{}';

-- =====================================================
-- GOOGLE DRIVE TOKENS TABLE - Add missing columns
-- =====================================================
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS folder_id VARCHAR(255);
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS folder_name VARCHAR(255);
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS quota_bytes_total BIGINT DEFAULT 0;
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS quota_bytes_used BIGINT DEFAULT 0;
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS soft_limit_bytes BIGINT DEFAULT 10737418240;
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT TRUE;
ALTER TABLE google_drive_tokens ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Also add these if columns have different names
DO $$ 
BEGIN
    -- Add token_expires_at if token_expiry exists but token_expires_at doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_drive_tokens' AND column_name = 'token_expiry') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_drive_tokens' AND column_name = 'token_expires_at') THEN
        ALTER TABLE google_drive_tokens RENAME COLUMN token_expiry TO token_expires_at;
    END IF;
    
    -- Rename drive_quota_* to quota_bytes_* if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_drive_tokens' AND column_name = 'drive_quota_total') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_drive_tokens' AND column_name = 'quota_bytes_total') THEN
        ALTER TABLE google_drive_tokens RENAME COLUMN drive_quota_total TO quota_bytes_total;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_drive_tokens' AND column_name = 'drive_quota_used') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_drive_tokens' AND column_name = 'quota_bytes_used') THEN
        ALTER TABLE google_drive_tokens RENAME COLUMN drive_quota_used TO quota_bytes_used;
    END IF;
END $$;

-- Make access_token_encrypted and refresh_token_encrypted nullable for the insert
ALTER TABLE google_drive_tokens ALTER COLUMN access_token_encrypted DROP NOT NULL;
ALTER TABLE google_drive_tokens ALTER COLUMN refresh_token_encrypted DROP NOT NULL;

SELECT 'Migration completed successfully!' as status;
