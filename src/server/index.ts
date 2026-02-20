import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// import { GoogleGenerativeAI } from '@google/generative-ai';
// import pg from 'pg';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Postgres Pool
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/setup/root', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const checkUsers = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(checkUsers.rows[0].count, 10) > 0) {
      return res.status(400).json({ error: 'System already initialized' });
    }

    // In a production app, use bcrypt to hash the password
    await pool.query(
      'INSERT INTO users (username, password_hash, role, is_root) VALUES ($1, $2, $3, $4)',
      [username, password, 'admin', true]
    );
    
    res.status(201).json({ message: 'Root user created successfully' });
  } catch {
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

    await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, password]
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
      'SELECT * FROM users WHERE username = $1 AND password_hash = $2 AND deleted_at IS NULL',
      [username, password]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
      res.json({ success: true, username: user.username, is_root: user.is_root });
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
