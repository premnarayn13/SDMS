-- DocMatrix Database Schema for Supabase
-- Run these migrations in order in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== 1. USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- NULL for OAuth users
    name VARCHAR(255),
    avatar_url TEXT,
    auth_provider VARCHAR(50) DEFAULT 'email' CHECK (auth_provider IN ('email', 'google')),
    email_verified BOOLEAN DEFAULT FALSE,
    account_status VARCHAR(20) DEFAULT 'pending' CHECK (account_status IN ('pending', 'active', 'suspended', 'deleted')),
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret TEXT,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);

-- ==================== 2. AUTH SESSIONS TABLE ====================
CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- Index for user session lookups
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

-- ==================== 3. OTP TOKENS TABLE ====================
CREATE TABLE IF NOT EXISTS otp_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('email_verification', 'drive_link', 'delete_file', 'delete_account', 'password_reset', 'mfa')),
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for OTP lookups
CREATE INDEX IF NOT EXISTS idx_otp_tokens_email_purpose ON otp_tokens(email, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires_at ON otp_tokens(expires_at);

-- ==================== 4. LINKED DRIVES TABLE ====================
CREATE TABLE IF NOT EXISTS linked_drives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    drive_email VARCHAR(255) NOT NULL,
    folder_id VARCHAR(255) NOT NULL,
    folder_name VARCHAR(255),
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    quota_bytes_total BIGINT,
    quota_bytes_used BIGINT,
    soft_limit_bytes BIGINT DEFAULT 10737418240,  -- 10GB default
    is_primary BOOLEAN DEFAULT TRUE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, folder_id)
);

-- Index for drive lookups
CREATE INDEX IF NOT EXISTS idx_linked_drives_user_id ON linked_drives(user_id);

-- ==================== 5. VIRTUAL FOLDERS TABLE ====================
CREATE TABLE IF NOT EXISTS virtual_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES virtual_folders(id) ON DELETE CASCADE,
    color VARCHAR(7),  -- Hex color like #FF5733
    icon VARCHAR(50),
    is_favorite BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for folder lookups
CREATE INDEX IF NOT EXISTS idx_virtual_folders_user_id ON virtual_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_folders_parent_id ON virtual_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_virtual_folders_deleted_at ON virtual_folders(deleted_at);

-- ==================== 6. FILE METADATA TABLE ====================
CREATE TABLE IF NOT EXISTS file_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    drive_id UUID NOT NULL REFERENCES linked_drives(id) ON DELETE CASCADE,
    drive_file_id VARCHAR(255) NOT NULL,
    virtual_folder_id UUID REFERENCES virtual_folders(id) ON DELETE SET NULL,
    original_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    file_extension VARCHAR(20),
    checksum_sha256 VARCHAR(64),
    is_favorite BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft', 'final')),
    sensitivity VARCHAR(20) DEFAULT 'normal' CHECK (sensitivity IN ('normal', 'internal', 'confidential', 'restricted')),
    description TEXT,
    notes TEXT,
    custom_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    UNIQUE(drive_id, drive_file_id)
);

-- Indexes for file lookups
CREATE INDEX IF NOT EXISTS idx_file_metadata_user_id ON file_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_drive_id ON file_metadata(drive_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_virtual_folder_id ON file_metadata(virtual_folder_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_deleted_at ON file_metadata(deleted_at);
CREATE INDEX IF NOT EXISTS idx_file_metadata_is_favorite ON file_metadata(is_favorite);
CREATE INDEX IF NOT EXISTS idx_file_metadata_tags ON file_metadata USING GIN(tags);

-- ==================== 7. FILE VERSIONS TABLE ====================
CREATE TABLE IF NOT EXISTS file_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES file_metadata(id) ON DELETE CASCADE,
    version_number VARCHAR(20) NOT NULL,
    drive_version_id VARCHAR(255),
    size_bytes BIGINT,
    checksum_sha256 VARCHAR(64),
    change_description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for version lookups
CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);

-- ==================== 8. FILE SHARES TABLE ====================
CREATE TABLE IF NOT EXISTS file_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES file_metadata(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_email VARCHAR(255) NOT NULL,
    permission VARCHAR(20) DEFAULT 'viewer' CHECK (permission IN ('viewer', 'editor')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(file_id, shared_with_email)
);

-- Index for share lookups
CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_shared_with_email ON file_shares(shared_with_email);

-- ==================== 9. ACTIVITY LOGS TABLE ====================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('file', 'folder', 'drive', 'account', 'share')),
    entity_id UUID,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for activity lookups
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- ==================== 10. AUDIT LOGS TABLE (IMMUTABLE) ====================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make audit_logs append-only (no updates or deletes)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_audit_update ON audit_logs;
CREATE TRIGGER prevent_audit_update
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- Index for audit lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ==================== 11. USER PREFERENCES TABLE ====================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    theme VARCHAR(20) DEFAULT 'light',
    view_mode VARCHAR(20) DEFAULT 'grid',
    sort_by VARCHAR(50) DEFAULT 'name',
    sort_order VARCHAR(10) DEFAULT 'asc',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    sidebar_collapsed BOOLEAN DEFAULT FALSE,
    custom_settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== HELPER FUNCTIONS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_linked_drives_updated_at ON linked_drives;
CREATE TRIGGER update_linked_drives_updated_at
    BEFORE UPDATE ON linked_drives
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_virtual_folders_updated_at ON virtual_folders;
CREATE TRIGGER update_virtual_folders_updated_at
    BEFORE UPDATE ON virtual_folders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_file_metadata_updated_at ON file_metadata;
CREATE TRIGGER update_file_metadata_updated_at
    BEFORE UPDATE ON file_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================== ROW LEVEL SECURITY (RLS) ====================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE linked_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Sessions policies
CREATE POLICY "Users can view own sessions" ON auth_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON auth_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Linked drives policies
CREATE POLICY "Users can view own drives" ON linked_drives
    FOR ALL USING (auth.uid() = user_id);

-- Virtual folders policies
CREATE POLICY "Users can manage own folders" ON virtual_folders
    FOR ALL USING (auth.uid() = user_id);

-- File metadata policies
CREATE POLICY "Users can manage own files" ON file_metadata
    FOR ALL USING (auth.uid() = user_id);

-- File versions policies
CREATE POLICY "Users can view own file versions" ON file_versions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM file_metadata 
            WHERE file_metadata.id = file_versions.file_id 
            AND file_metadata.user_id = auth.uid()
        )
    );

-- File shares policies
CREATE POLICY "Users can manage shares they created" ON file_shares
    FOR ALL USING (auth.uid() = shared_by);

CREATE POLICY "Users can view files shared with them" ON file_shares
    FOR SELECT USING (shared_with_email = (SELECT email FROM users WHERE id = auth.uid()));

-- Activity logs policies
CREATE POLICY "Users can view own activity" ON activity_logs
    FOR SELECT USING (auth.uid() = user_id);

-- User preferences policies
CREATE POLICY "Users can manage own preferences" ON user_preferences
    FOR ALL USING (auth.uid() = user_id);

-- ==================== SERVICE ROLE BYPASS ====================
-- Note: Service role bypasses RLS automatically in Supabase
