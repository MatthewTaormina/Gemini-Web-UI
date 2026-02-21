import pg from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface StorageVolume {
    id: string;
    name: string;
    owner_user_id?: string;
    owner_app_id?: string;
    driver: 'local' | 's3' | 'ftp' | 'http';
    config: any;
    default_prefix?: string;
    enforce_hierarchy: boolean;
    path_delimiter: string;
    use_query_params: boolean;
    auto_path_strategy: 'none' | 'uuid' | 'hash';
    versioning_mode: 'none' | 'source' | 'target';
    quota_limit?: number;
    quota_used: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export class StorageVolumeService {
    async getVolumes(): Promise<StorageVolume[]> {
        const res = await pool.query('SELECT * FROM storage_volumes ORDER BY name ASC');
        return res.rows;
    }

    async getVolumeById(id: string): Promise<StorageVolume | null> {
        const res = await pool.query('SELECT * FROM storage_volumes WHERE id = $1', [id]);
        return res.rows[0] || null;
    }

    async createVolume(volume: Partial<StorageVolume>): Promise<StorageVolume> {
        const {
            name, owner_user_id, owner_app_id, driver, config = {}, default_prefix, 
            enforce_hierarchy = true, path_delimiter = '/', 
            use_query_params = false, auto_path_strategy = 'none',
            versioning_mode = 'none', quota_limit
        } = volume;

        const res = await pool.query(
            `INSERT INTO storage_volumes (
                name, owner_user_id, owner_app_id, driver, config, default_prefix, 
                enforce_hierarchy, path_delimiter, 
                use_query_params, auto_path_strategy,
                versioning_mode, quota_limit
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING *`,
            [
                name, owner_user_id, owner_app_id, driver, config, default_prefix, 
                enforce_hierarchy, path_delimiter, 
                use_query_params, auto_path_strategy,
                versioning_mode, quota_limit
            ]
        );
        return res.rows[0];
    }

    async updateVolume(id: string, updates: Partial<StorageVolume>): Promise<StorageVolume> {
        const fields = Object.keys(updates).filter(k => ![ 'id', 'created_at', 'updated_at' ].includes(k));
        if (fields.length === 0) {
            const current = await this.getVolumeById(id);
            if (!current) throw new Error('Volume not found');
            return current;
        }

        const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
        const values = fields.map(f => (updates as any)[f]);

        const res = await pool.query(
            `UPDATE storage_volumes SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
            [id, ...values]
        );
        
        if (res.rows.length === 0) throw new Error('Volume not found');
        return res.rows[0];
    }

    async deleteVolume(id: string): Promise<void> {
        await pool.query('DELETE FROM storage_volumes WHERE id = $1', [id]);
    }

    // S3 Bucket Management
    async createS3Bucket(bucket: { endpoint_url: string, bucket_name: string, region?: string, use_ssl?: boolean }) {
        const { endpoint_url, bucket_name, region, use_ssl = true } = bucket;
        const res = await pool.query(
            'INSERT INTO s3_buckets (endpoint_url, bucket_name, region, use_ssl) VALUES ($1, $2, $3, $4) RETURNING *',
            [endpoint_url, bucket_name, region, use_ssl]
        );
        return res.rows[0];
    }

    // S3 Credentials Management
    async createS3Credentials(creds: { bucket_id: string, access_key: string, secret_key: string, description?: string }) {
        const { bucket_id, access_key, secret_key, description } = creds;
        // NOTE: secret_key should be encrypted before storage. For now, storing as is, but we'll add encryption layer later.
        const res = await pool.query(
            'INSERT INTO s3_credentials (bucket_id, access_key, secret_key, description) VALUES ($1, $2, $3, $4) RETURNING *',
            [bucket_id, access_key, secret_key, description]
        );
        return res.rows[0];
    }

    // Similar methods for HTTP, FTP, and Local Paths...
}

export const storageVolumeService = new StorageVolumeService();
