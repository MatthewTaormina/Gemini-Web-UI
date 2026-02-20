import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  try {
    const res = await pool.query('SELECT username, is_root FROM users');
    console.log('Current users in DB:', res.rows);
  } catch (err) {
    console.error('Error checking DB:', err);
  } finally {
    await pool.end();
  }
}
check();
