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
      await client.query('DROP TABLE IF EXISTS app_quotas CASCADE');
      await client.query('DROP TABLE IF EXISTS user_quotas CASCADE');
      await client.query('DROP TABLE IF EXISTS files CASCADE');
      await client.query('DROP TABLE IF EXISTS local_paths CASCADE');
      await client.query('DROP TABLE IF EXISTS ftp_endpoints CASCADE');
      await client.query('DROP TABLE IF EXISTS http_credentials CASCADE');
      await client.query('DROP TABLE IF EXISTS http_endpoints CASCADE');
      await client.query('DROP TABLE IF EXISTS s3_credentials CASCADE');
      await client.query('DROP TABLE IF EXISTS s3_buckets CASCADE');
      await client.query('DROP TABLE IF EXISTS storage_volumes CASCADE');
      await client.query('DROP TABLE IF EXISTS attachments CASCADE');
      await client.query('DROP TABLE IF EXISTS messages CASCADE');
      await client.query('DROP TABLE IF EXISTS conversations CASCADE');
      await client.query('DROP TABLE IF EXISTS revoked_tokens CASCADE');
      await client.query('DROP TABLE IF EXISTS system_config CASCADE');
      await client.query('DROP TABLE IF EXISTS user_roles CASCADE');
      await client.query('DROP TABLE IF EXISTS role_permissions CASCADE');
      await client.query('DROP TABLE IF EXISTS roles CASCADE');
      await client.query('DROP TABLE IF EXISTS permissions CASCADE');
      await client.query('DROP TABLE IF EXISTS users CASCADE');
      
      const sqlPath = path.join(__dirname, 'setup.sql');
      const storageSqlPath = path.join(__dirname, 'storage_setup.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      const storageSql = fs.readFileSync(storageSqlPath, 'utf8');
      
      console.log('Executing fresh setup scripts...');
      await client.query(sql);
      await client.query(storageSql);
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
