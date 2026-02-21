import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db/pool.js';

export interface UserPayload {
  id: string;
  username: string;
  is_root: boolean;
  permissions: string[];
  jti: string;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}

let cachedSecret: string | null = null;
export const getJwtSecret = async () => {
  if (cachedSecret) return cachedSecret;
  
  const res = await pool.query("SELECT value FROM system_config WHERE key = 'jwt_secret'");
  if (res.rows.length > 0) {
    cachedSecret = res.rows[0].value;
    return cachedSecret!;
  }

  const newSecret = crypto.randomBytes(64).toString('hex');
  await pool.query(
    "INSERT INTO system_config (key, value) VALUES ('jwt_secret', $1) ON CONFLICT (key) DO NOTHING",
    [newSecret]
  );
  cachedSecret = newSecret;
  return newSecret;
};

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // Also check query parameter for cases like <img> tags
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const secret = await getJwtSecret();
    const user = jwt.verify(token, secret) as UserPayload;
    
    const revocation = await pool.query('SELECT 1 FROM revoked_tokens WHERE jti = $1', [user.jti]);
    if (revocation.rows.length > 0) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    req.user = user;
    next();
  } catch (err: any) {
    console.error('JWT Verification Error:', err.message);
    return res.status(403).json({ error: 'Invalid or expired token', message: err.message });
  }
};

export const hasPermission = (user: UserPayload, action: string, resource: string) => {
  if (user.is_root) return true;
  
  return user.permissions.some(perm => {
    const [pAction, pResource] = perm.split(':');
    const actionMatch = pAction === '*' || pAction === action;
    const resourceMatch = pResource === '*' || pResource === resource;
    return actionMatch && resourceMatch;
  });
};

export const requirePermission = (action: string, resource: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    if (hasPermission(req.user, action, resource)) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  };
};

