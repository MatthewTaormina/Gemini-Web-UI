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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
