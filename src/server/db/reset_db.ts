import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function resetDatabase() {
  try {
    console.log('Resetting database (dropping all tables)...');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      // Drop in order of dependencies
      await client.query('DROP TABLE IF EXISTS user_roles CASCADE');
      await client.query('DROP TABLE IF EXISTS role_permissions CASCADE');
      await client.query('DROP TABLE IF EXISTS roles CASCADE');
      await client.query('DROP TABLE IF EXISTS permissions CASCADE');
      await client.query('DROP TABLE IF EXISTS users CASCADE');
      
      const sqlPath = path.join(__dirname, 'setup.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      
      console.log('Executing fresh setup script...');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('Database reset and setup completed successfully.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error resetting database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetDatabase();
