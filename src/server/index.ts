import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import chatRouter from './apps/chat/ChatRouter.js';
import storageRouter from './apps/storage/StorageRouter.js';
import { pool } from './db/pool.js';
import { authenticateToken, hasPermission, getJwtSecret, AuthRequest, UserPayload } from './middleware/auth.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static serving for chat uploads
const storagePath = path.resolve(process.env.STORAGE_PATH || './storage_data');
const uploadDir = path.join(storagePath, 'chat_uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

app.get('/api/setup/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM users WHERE is_root = true');
    const count = parseInt(result.rows[0].count, 10);
    res.json({ initialized: count > 0 });
  } catch {
    // If table doesn't exist, it's definitely not initialized
    res.json({ initialized: false, error: 'Database not initialized' });
  }
});

app.get('/api/health', authenticateToken, (req, res) => {
  res.json({ status: 'ok', user: (req as AuthRequest).user });
});

// Admin User Management Endpoints
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (!hasPermission(user, 'read', 'dashboard') && !hasPermission(user, 'read', 'users')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, is_root, enabled, created_at, last_login_at, deleted_at FROM users ORDER BY created_at DESC'
    );
    
    const usersWithRoles = await Promise.all(result.rows.map(async (u) => {
      const rolesRes = await pool.query(
        'SELECT r.id, r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = $1',
        [u.id]
      );
      return { ...u, roles: rolesRes.rows };
    }));

    res.json(usersWithRoles);
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/users', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (!hasPermission(user, 'create', 'users')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'User created' });
  } catch {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (!hasPermission(user, 'delete', 'users')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await pool.query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    res.json({ message: 'User soft-deleted' });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete user';
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/api/admin/users/:id/restore', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (!hasPermission(user, 'update', 'users')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await pool.query('UPDATE users SET deleted_at = NULL WHERE id = $1', [req.params.id]);
    res.json({ message: 'User restored' });
  } catch {
    res.status(500).json({ error: 'Failed to restore user' });
  }
});

app.post('/api/admin/users/:id/password', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (!hasPermission(user, 'reset_password', 'users')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, password_last_set_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, req.params.id]
    );
    res.json({ message: 'Password reset successful' });
  } catch {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.post('/api/setup/root', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const checkUsers = await pool.query('SELECT COUNT(*) FROM users WHERE is_root = true');
    if (parseInt(checkUsers.rows[0].count, 10) > 0) {
      return res.status(400).json({ error: 'System already initialized' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await pool.query(
      'INSERT INTO users (username, password_hash, is_root) VALUES ($1, $2, $3)',
      [username, hashedPassword, true]
    );
    
    res.status(201).json({ message: 'Root user created successfully' });
  } catch (err) {
    console.error('Root setup error:', err);
    res.status(500).json({ error: 'Failed to create root user' });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Password complexity validation
  const minLength = 8;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }
  if (!hasNumber) {
    return res.status(400).json({ error: 'Password must include at least one number' });
  }
  if (!hasSpecial) {
    return res.status(400).json({ error: 'Password must include at least one special character' });
  }

  try {
    const userExists = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'Registration successful' });
  } catch {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL',
      [username]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

      // Fetch permissions
      let permissions: string[] = [];
      if (user.is_root) {
        permissions = ['*:*'];
      } else {
        const permResult = await pool.query(
          `SELECT DISTINCT p.name 
           FROM permissions p
           JOIN role_permissions rp ON p.id = rp.permission_id
           JOIN roles r ON rp.role_id = r.id
           JOIN user_roles ur ON r.id = ur.role_id
           WHERE ur.user_id = $1`,
          [user.id]
        );
        permissions = permResult.rows.map(row => row.name);
      }

      // Generate JWT
      const secret = await getJwtSecret();
      const jti = uuidv4();
      const token = jwt.sign(
        { id: user.id, username: user.username, is_root: user.is_root, permissions, jti },
        secret,
        { expiresIn: '24h' }
      );

      res.json({ 
        success: true, 
        username: user.username, 
        is_root: user.is_root,
        permissions,
        token
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  try {
    // Revoke the token by adding its jti to the blacklist
    // Set expiry to 25h to ensure it covers the token's lifetime
    await pool.query(
      'INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, NOW() + interval \'25 hours\')',
      [user.jti]
    );
    res.json({ success: true, message: 'Logged out successfully' });
  } catch {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Chat App Routes
app.use('/api/chat', authenticateToken, (req, res, next) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (hasPermission(user, 'read', 'chat') || hasPermission(user, 'write', 'chat')) {
    next();
  } else {
    res.status(403).json({ error: 'Unauthorized' });
  }
}, chatRouter);

// Storage App Routes
app.use('/api/storage', authenticateToken, (req, res, next) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (hasPermission(user, 'read', 'storage') || hasPermission(user, 'upload', 'storage') || hasPermission(user, 'manage', 'storage')) {
    next();
  } else {
    res.status(403).json({ error: 'Unauthorized' });
  }
}, storageRouter);

// Admin Role Management Endpoints
app.get('/api/admin/roles', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (!hasPermission(user, 'read', 'roles')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const roles = await pool.query('SELECT * FROM roles ORDER BY name ASC');
    const rolesWithPerms = await Promise.all(roles.rows.map(async (role) => {
      const perms = await pool.query(
        'SELECT p.id, p.name FROM permissions p JOIN role_permissions rp ON p.id = rp.permission_id WHERE rp.role_id = $1',
        [role.id]
      );
      return { ...role, permissions: perms.rows };
    }));
    res.json(rolesWithPerms);
  } catch {
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

app.get('/api/admin/permissions', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (!hasPermission(user, 'read', 'roles')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query('SELECT * FROM permissions ORDER BY resource ASC, action ASC');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

app.post('/api/admin/roles', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (!hasPermission(user, 'create', 'roles')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { name, description, permissionIds } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roleResult = await client.query(
      'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id',
      [name, description]
    );
    const roleId = roleResult.rows[0].id;

    if (permissionIds && permissionIds.length > 0) {
      for (const permId of permissionIds) {
        await client.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [roleId, permId]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Role created' });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to create role' });
  } finally {
    client.release();
  }
});

app.put('/api/admin/roles/:id', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (!hasPermission(user, 'update', 'roles')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { name, description, permissionIds } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE roles SET name = $1, description = $2 WHERE id = $3',
      [name, description, req.params.id]
    );

    // Sync permissions
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [req.params.id]);
    if (permissionIds && permissionIds.length > 0) {
      for (const permId of permissionIds) {
        await client.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [req.params.id, permId]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ message: 'Role updated' });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update role' });
  } finally {
    client.release();
  }
});

app.post('/api/admin/permissions', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (!user.is_root && !user.permissions.includes('update:roles')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { name, action, resource, description } = req.body;
  try {
    await pool.query(
      'INSERT INTO permissions (name, action, resource, description) VALUES ($1, $2, $3, $4)',
      [name, action, resource, description]
    );
    res.status(201).json({ message: 'Permission created' });
  } catch {
    res.status(500).json({ error: 'Failed to create permission' });
  }
});

app.delete('/api/admin/permissions/:id', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (!user.is_root && !user.permissions.includes('update:roles')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await pool.query('DELETE FROM permissions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Permission deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete permission' });
  }
});

app.post('/api/admin/users/:id/roles', authenticateToken, async (req, res) => {
  const user = (req as AuthRequest).user as UserPayload;
  if (!hasPermission(user, 'update', 'users')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { roleIds } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [req.params.id]);
    if (roleIds && roleIds.length > 0) {
      for (const roleId of roleIds) {
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
          [req.params.id, roleId]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ message: 'User roles updated' });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update user roles' });
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
