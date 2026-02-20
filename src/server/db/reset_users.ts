import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function reset() {
  try {
    await pool.query('TRUNCATE TABLE users CASCADE');
    console.log('Users table cleared successfully.');
  } catch (err) {
    console.error('Error clearing users table:', err);
  } finally {
    await pool.end();
  }
}
reset();
