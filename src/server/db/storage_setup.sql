
-- Storage Management Tables

-- Storage Volumes
CREATE TABLE IF NOT EXISTS storage_volumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    owner_app_id VARCHAR(100), -- ID of the app this volume belongs to (e.g., 'cloud-drive')
    driver VARCHAR(20) NOT NULL CHECK (driver IN ('local', 's3', 'ftp', 'http')),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_prefix TEXT,
    enforce_hierarchy BOOLEAN NOT NULL DEFAULT true,
    path_delimiter VARCHAR(5) NOT NULL DEFAULT '/',
    use_query_params BOOLEAN NOT NULL DEFAULT false,
    auto_path_strategy VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (auto_path_strategy IN ('none', 'uuid', 'hash')),
    versioning_mode VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (versioning_mode IN ('none', 'source', 'target')),
    quota_limit BIGINT,
    quota_used BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- S3 Buckets
CREATE TABLE IF NOT EXISTS s3_buckets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint_url TEXT NOT NULL,
    bucket_name VARCHAR(255) NOT NULL,
    region VARCHAR(50),
    use_ssl BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- S3 Credentials
CREATE TABLE IF NOT EXISTS s3_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bucket_id UUID NOT NULL REFERENCES s3_buckets(id) ON DELETE CASCADE,
    access_key TEXT NOT NULL,
    secret_key TEXT NOT NULL, -- Should be encrypted at rest in the app layer
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- HTTP Endpoints
CREATE TABLE IF NOT EXISTS http_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- HTTP Credentials
CREATE TABLE IF NOT EXISTS http_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint_id UUID NOT NULL REFERENCES http_endpoints(id) ON DELETE CASCADE,
    auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('basic', 'bearer', 'custom_header')),
    credentials JSONB NOT NULL, -- Encrypted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- FTP/SFTP Endpoints
CREATE TABLE IF NOT EXISTS ftp_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 21,
    protocol VARCHAR(10) NOT NULL CHECK (protocol IN ('ftp', 'sftp')),
    username VARCHAR(100) NOT NULL,
    password TEXT, -- Encrypted
    key_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Local Paths
CREATE TABLE IF NOT EXISTS local_paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Files Metadata
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    volume_id UUID NOT NULL REFERENCES storage_volumes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    app_id VARCHAR(100),
    namespace VARCHAR(50) NOT NULL CHECK (namespace IN ('users', 'apps')),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type VARCHAR(100),
    size BIGINT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- User Quotas
CREATE TABLE IF NOT EXISTS user_quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    volume_id UUID NOT NULL REFERENCES storage_volumes(id) ON DELETE CASCADE,
    quota_limit BIGINT NOT NULL,
    quota_used BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, volume_id)
);

-- App Quotas
CREATE TABLE IF NOT EXISTS app_quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id VARCHAR(100) NOT NULL,
    volume_id UUID NOT NULL REFERENCES storage_volumes(id) ON DELETE CASCADE,
    quota_limit BIGINT NOT NULL,
    quota_used BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(app_id, volume_id)
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_files_volume_id ON files(volume_id);
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_app_id ON files(app_id);
CREATE INDEX IF NOT EXISTS idx_files_namespace ON files(namespace);

-- Updated_at triggers for storage tables
DROP TRIGGER IF EXISTS update_storage_volumes_updated_at ON storage_volumes;
CREATE TRIGGER update_storage_volumes_updated_at
    BEFORE UPDATE ON storage_volumes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_files_updated_at ON files;
CREATE TRIGGER update_files_updated_at
    BEFORE UPDATE ON files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed initial storage permissions
INSERT INTO permissions (name, action, resource, description) VALUES
    ('read:storage', 'read', 'storage', 'View storage volumes and file lists'),
    ('manage:storage', 'manage', 'storage', 'Configure storage volumes and quotas'),
    ('upload:storage', 'create', 'storage', 'Upload files to storage'),
    ('delete:storage', 'delete', 'storage', 'Delete files from storage')
ON CONFLICT (name) DO NOTHING;

-- Seed default system volume
INSERT INTO storage_volumes (name, owner_user_id, owner_app_id, driver, config, is_active)
SELECT 'system-assets', id, 'system', 'local', '{"local_path": "./storage_data/system"}'::jsonb, true
FROM users WHERE is_system = true
ON CONFLICT (name) DO NOTHING;
