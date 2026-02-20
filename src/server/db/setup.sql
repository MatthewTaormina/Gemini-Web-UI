-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
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

-- Create a mock user for testing (password: password123)
-- In a real scenario, this hash would be generated via Argon2/BCrypt
INSERT INTO users (username, password_hash, role)
VALUES ('testuser', '$2b$10$YourMockHashHere', 'admin')
ON CONFLICT (username) DO NOTHING;
