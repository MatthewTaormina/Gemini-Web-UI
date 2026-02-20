-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable Vector extension for AI embeddings (Optional, comment if not available)
-- CREATE EXTENSION IF NOT EXISTS "vector";
-- Enable Crypto extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_root BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    lockout_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    password_last_set_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL, -- Format action:resource
    action VARCHAR(50) NOT NULL,       -- create, read, update, delete
    resource VARCHAR(50) NOT NULL,     -- users, roles, etc.
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Role-Permissions Junction
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- User-Roles Junction
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Ensure only one root user exists
CREATE UNIQUE INDEX singleton_root_user ON users (is_root) WHERE is_root = true;

-- Prevent deletion of root user
CREATE OR REPLACE FUNCTION protect_root_user()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.is_root = true) THEN
        RAISE EXCEPTION 'The root user cannot be deleted or soft-deleted.';
    END IF;
    RETURN OLD;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_protect_root_user
    BEFORE DELETE OR UPDATE OF deleted_at ON users
    FOR EACH ROW
    EXECUTE FUNCTION protect_root_user();

-- Seed initial permissions
INSERT INTO permissions (name, action, resource, description) VALUES
    ('*:*', '*', '*', 'Full system access'),
    ('read:dashboard', 'read', 'dashboard', 'Ability to access the admin dashboard'),
    ('create:users', 'create', 'users', 'Create new system users'),
    ('read:users', 'read', 'users', 'View user lists'),
    ('update:users', 'update', 'users', 'Update existing users'),
    ('delete:users', 'delete', 'users', 'Soft-delete users'),
    ('restore:users', 'update', 'users', 'Restore soft-deleted users'),
    ('reset_password:users', 'update', 'users', 'Reset any user password'),
    ('create:roles', 'create', 'roles', 'Create new roles'),
    ('read:roles', 'read', 'roles', 'View roles and permissions'),
    ('update:roles', 'update', 'roles', 'Modify roles and permissions'),
    ('delete:roles', 'delete', 'roles', 'Delete roles'),
    ('read:chat', 'read', 'chat', 'View chat messages and history'),
    ('write:chat', 'write', 'chat', 'Send chat messages'),
    ('delete:chat', 'delete', 'chat', 'Delete chat history'),
    ('manage:chat_settings', 'manage', 'chat_settings', 'Modify Gemini chat settings')
ON CONFLICT (name) DO NOTHING;

-- Seed default roles
INSERT INTO roles (name, description) VALUES
    ('Super Admin', 'Full unrestricted access to all resources'),
    ('Chat User', 'Access to the Gemini Chat application')
ON CONFLICT (name) DO NOTHING;

-- Assign *:* to Super Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'Super Admin' AND p.name = '*:*'
ON CONFLICT DO NOTHING;

-- Assign chat permissions to Chat User role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'Chat User' AND p.name IN ('read:chat', 'write:chat', 'delete:chat')
ON CONFLICT DO NOTHING;

-- Trigger to update updated_at on change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- System configuration (for secrets, global settings)
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Token Blacklist (for revocation)
CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti UUID PRIMARY KEY,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat Application Tables
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gemini-3-flash-preview',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'model', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);

-- Trigger for conversations updated_at
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
