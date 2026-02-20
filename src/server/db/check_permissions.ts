import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  try {
    const res = await pool.query('SELECT name, action, resource FROM permissions');
    console.log('Current permissions in DB:', res.rows);
  } catch (err) {
    console.error('Error checking permissions:', err);
  } finally {
    await pool.end();
  }
}
check();
