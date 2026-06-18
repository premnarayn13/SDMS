-- Create virtual_folders table first (file_metadata references it)
CREATE TABLE IF NOT EXISTS virtual_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES virtual_folders(id) ON DELETE CASCADE,
    description TEXT,
    color VARCHAR(20) DEFAULT '#6366f1',
    icon VARCHAR(50) DEFAULT 'folder',
    is_system BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create file_metadata table
CREATE TABLE IF NOT EXISTS file_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    drive_id UUID REFERENCES google_drive_tokens(id) ON DELETE SET NULL,
    drive_file_id VARCHAR(255),
    original_name VARCHAR(500) NOT NULL,
    display_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    mime_type VARCHAR(255),
    file_extension VARCHAR(20),
    size_bytes BIGINT DEFAULT 0,
    checksum_sha256 VARCHAR(64),
    virtual_folder_id UUID REFERENCES virtual_folders(id) ON DELETE SET NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    sensitivity VARCHAR(20) DEFAULT 'normal',
    is_favorite BOOLEAN DEFAULT false,
    is_trashed BOOLEAN DEFAULT false,
    trashed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create file_versions table
CREATE TABLE IF NOT EXISTS file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES file_metadata(id) ON DELETE CASCADE,
    version_number VARCHAR(20) NOT NULL,
    drive_version_id VARCHAR(255),
    size_bytes BIGINT DEFAULT 0,
    checksum_sha256 VARCHAR(64),
    change_description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_metadata_user_id ON file_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_drive_id ON file_metadata(drive_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_status ON file_metadata(status);
CREATE INDEX IF NOT EXISTS idx_file_metadata_is_favorite ON file_metadata(is_favorite);
CREATE INDEX IF NOT EXISTS idx_file_metadata_file_type ON file_metadata(file_type);
CREATE INDEX IF NOT EXISTS idx_file_metadata_virtual_folder ON file_metadata(virtual_folder_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_virtual_folders_user_id ON virtual_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_folders_parent ON virtual_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- Enable Row Level Security
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for file_metadata
CREATE POLICY "Users can view own files" ON file_metadata
    FOR SELECT USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Users can insert own files" ON file_metadata
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Users can update own files" ON file_metadata
    FOR UPDATE USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Users can delete own files" ON file_metadata
    FOR DELETE USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

-- RLS Policies for file_versions
CREATE POLICY "Users can view own file versions" ON file_versions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM file_metadata WHERE id = file_versions.file_id AND user_id::text = auth.uid()::text)
        OR auth.role() = 'service_role'
    );

CREATE POLICY "Users can insert own file versions" ON file_versions
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- RLS Policies for virtual_folders
CREATE POLICY "Users can view own folders" ON virtual_folders
    FOR SELECT USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Users can manage own folders" ON virtual_folders
    FOR ALL USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

-- RLS Policies for activity_log
CREATE POLICY "Users can view own activity" ON activity_log
    FOR SELECT USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Service can insert activity" ON activity_log
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
