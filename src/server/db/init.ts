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

async function setupDatabase() {
  try {
    const sqlPath = path.join(__dirname, 'setup.sql');
    const storageSqlPath = path.join(__dirname, 'storage_setup.sql');
    const settingsSqlPath = path.join(__dirname, 'settings_setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const storageSql = fs.readFileSync(storageSqlPath, 'utf8');
    const settingsSql = fs.readFileSync(settingsSqlPath, 'utf8');

    console.log('Connecting to database...');
    const client = await pool.connect();
    
    try {
      console.log('Executing main setup script...');
      await client.query(sql);
      console.log('Executing storage setup script...');
      await client.query(storageSql);
      console.log('Executing settings setup script...');
      await client.query(settingsSql);
      console.log('Database setup completed successfully.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error setting up database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
