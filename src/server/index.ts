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

// Placeholder for Gemini AI
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Placeholder for Postgres
// const { Pool } = pg;
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Mock users database
const users = [
  { username: 'testuser', password: 'password123' }
];

app.post('/api/register', (req, res) => {
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

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'User already exists' });
  }

  users.push({ username, password });
  res.status(201).json({ message: 'Registration successful' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    res.json({ success: true, username: user.username });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
