-- MEGA Storage Integration Migration
-- Prototype mode: stores MEGA credentials in plain text by product request.

CREATE TABLE IF NOT EXISTS mega_storage_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mega_email VARCHAR(320) NOT NULL,
    mega_password TEXT NOT NULL,
    folder_name VARCHAR(255) NOT NULL,
    is_connected BOOLEAN DEFAULT TRUE,
    last_verified_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_mega_connection_per_user UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_mega_storage_user_id ON mega_storage_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_mega_storage_email ON mega_storage_connections(mega_email);

ALTER TABLE mega_storage_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mega connection" ON mega_storage_connections
    FOR SELECT USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Service role can insert mega connection" ON mega_storage_connections
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can update own mega connection" ON mega_storage_connections
    FOR UPDATE USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');

CREATE POLICY "Users can delete own mega connection" ON mega_storage_connections
    FOR DELETE USING (auth.uid()::text = user_id::text OR auth.role() = 'service_role');
