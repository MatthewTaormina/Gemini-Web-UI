
-- Hierarchical Settings Management using ltree

-- Enable ltree extension
CREATE EXTENSION IF NOT EXISTS ltree;

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key ltree PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for ltree search
CREATE INDEX IF NOT EXISTS idx_settings_key_gist ON settings USING GIST (key);

-- Trigger to update updated_at on change
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Initial permissions for settings management
INSERT INTO permissions (name, action, resource, description) VALUES
    ('read:settings', 'read', 'settings', 'View system and user settings'),
    ('update:settings', 'update', 'settings', 'Modify system and user settings'),
    ('manage:settings', 'manage', 'settings', 'Full control over all settings')
ON CONFLICT (name) DO NOTHING;

-- Assign settings permissions to Super Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'Super Admin' AND p.name IN ('read:settings', 'update:settings', 'manage:settings')
ON CONFLICT DO NOTHING;

-- Seed default settings
INSERT INTO settings (key, value) VALUES
    ('global.system', '{"theme": "light", "language": "en", "allow_registration": true}'::jsonb),
    ('global.app.chat', '{"default_model": "gemini-3-flash-preview", "enable_tools": ["generate_image", "math"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
