import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only';

app.use(cors());
app.use(express.json());

// Postgres Pool
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface UserPayload {
  id: string;
  username: string;
  is_root: boolean;
  permissions: string[];
}

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: string | jwt.JwtPayload | UserPayload;
}

// Middleware to verify JWT
const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user as UserPayload;
    next();
  });
};

app.get('/api/setup/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM users');
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

app.post('/api/setup/root', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const checkUsers = await pool.query('SELECT COUNT(*) FROM users');
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
      if (!user.is_root) {
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
      const token = jwt.sign(
        { id: user.id, username: user.username, is_root: user.is_root, permissions },
        JWT_SECRET,
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
