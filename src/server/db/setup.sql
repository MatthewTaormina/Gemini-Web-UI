-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable Vector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS "vector";
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
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL, -- Format action:resource
    action VARCHAR(50) NOT NULL,       -- create, read, update, delete
    resource VARCHAR(50) NOT NULL,     -- users, roles, etc.
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
    ('delete:roles', 'delete', 'roles', 'Delete roles')
ON CONFLICT (name) DO NOTHING;

-- Seed default roles
INSERT INTO roles (name, description) VALUES
    ('Super Admin', 'Full unrestricted access to all resources')
ON CONFLICT (name) DO NOTHING;

-- Assign *:* to Super Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'Super Admin' AND p.name = '*:*'
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
