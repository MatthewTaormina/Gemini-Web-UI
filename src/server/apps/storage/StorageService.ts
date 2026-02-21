import pg from 'pg';
import { StorageDriver } from './StorageDriver.js';
import { DiskDriver } from './DiskDriver.js';
import { S3Driver, S3Config } from './S3Driver.js';
import path from 'path';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export class StorageService {
    private drivers: Map<string, StorageDriver> = new Map();
    
    // Namespaces
    private static USER_PREFIX = 'users';
    private static APP_PREFIX = 'apps';

    constructor() {}

    private async getDriverForVolume(volumeId: string): Promise<StorageDriver> {
        if (this.drivers.has(volumeId)) {
            return this.drivers.get(volumeId)!;
        }

        const res = await pool.query('SELECT * FROM storage_volumes WHERE id = $1', [volumeId]);
        if (res.rows.length === 0) throw new Error('Volume not found');
        const volume = res.rows[0];

        let driver: StorageDriver;
        switch (volume.driver) {
            case 'local':
                const rootPath = volume.config.local_path || process.env.STORAGE_PATH || './storage_data';
                driver = new DiskDriver(path.resolve(rootPath));
                break;
            case 's3':
                // Fetch credentials from the database for this bucket
                const bucketRes = await pool.query('SELECT * FROM s3_buckets WHERE id = $1', [volume.config.bucket_id]);
                if (bucketRes.rows.length === 0) throw new Error('S3 Bucket config not found');
                const bucket = bucketRes.rows[0];

                const credsRes = await pool.query('SELECT * FROM s3_credentials WHERE bucket_id = $1 LIMIT 1', [bucket.id]);
                if (credsRes.rows.length === 0) throw new Error('S3 Credentials not found');
                const creds = credsRes.rows[0];

                const s3Config: S3Config = {
                    endpoint_url: bucket.endpoint_url,
                    bucket_name: bucket.bucket_name,
                    region: bucket.region,
                    use_ssl: bucket.use_ssl,
                    credentials: {
                        access_key: creds.access_key,
                        secret_key: creds.secret_key // TODO: Decrypt
                    }
                };
                driver = new S3Driver(s3Config);
                break;
            default:
                throw new Error(`Driver ${volume.driver} not supported yet`);
        }

        this.drivers.set(volumeId, driver);
        return driver;
    }

    /**
     * Save a file and record it in the database.
     */
    async uploadFile(params: {
        volumeId: string,
        userId?: string,
        appId?: string,
        namespace: 'users' | 'apps',
        filename: string,
        buffer: Buffer,
        mimeType?: string,
        metadata?: any
    }): Promise<any> {
        const { volumeId, userId, appId, namespace, filename, buffer, mimeType, metadata } = params;
        const driver = await this.getDriverForVolume(volumeId);
        
        const volumeRes = await pool.query('SELECT * FROM storage_volumes WHERE id = $1', [volumeId]);
        const volume = volumeRes.rows[0];

        // 1. Generate storage path based on strategy
        let storagePath = '';
        const prefix = volume.default_prefix || '';
        const namespacePath = namespace === 'users' ? `users/${userId}` : `apps/${appId}`;
        
        if (volume.auto_path_strategy === 'uuid') {
            const ext = path.extname(filename);
            storagePath = path.join(prefix, namespacePath, `${uuidv4()}${ext}`);
        } else {
            storagePath = path.join(prefix, namespacePath, filename);
        }

        // 2. Check Quotas (Optional: simplified for now)
        // ...

        // 3. Save to Driver
        await driver.saveFile(storagePath, buffer, mimeType);

        // 4. Record in DB
        const res = await pool.query(
            `INSERT INTO files (
                volume_id, user_id, app_id, namespace, 
                filename, storage_path, mime_type, size, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [volumeId, userId, appId, namespace, filename, storagePath, mimeType, buffer.length, metadata || {}]
        );

        // 5. Update volume quota used
        await pool.query('UPDATE storage_volumes SET quota_used = quota_used + $1 WHERE id = $2', [buffer.length, volumeId]);

        // 6. Update User Quota if applicable
        const finalUserId = userId || volume.owner_user_id;
        if (finalUserId) {
            await pool.query(`
                INSERT INTO user_quotas (user_id, volume_id, quota_limit, quota_used)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, volume_id) 
                DO UPDATE SET quota_used = user_quotas.quota_used + $4, updated_at = CURRENT_TIMESTAMP
            `, [finalUserId, volumeId, volume.quota_limit || 0, buffer.length]);
        }

        // 7. Update App Quota if applicable
        const finalAppId = appId || volume.owner_app_id;
        if (finalAppId) {
            await pool.query(`
                INSERT INTO app_quotas (app_id, volume_id, quota_limit, quota_used)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (app_id, volume_id) 
                DO UPDATE SET quota_used = app_quotas.quota_used + $4, updated_at = CURRENT_TIMESTAMP
            `, [finalAppId, volumeId, volume.quota_limit || 0, buffer.length]);
        }

        return res.rows[0];
    }

    async getFileStream(fileId: string): Promise<{ stream: NodeJS.ReadableStream, mimeType: string, filename: string }> {
        const res = await pool.query('SELECT * FROM files WHERE id = $1', [fileId]);
        if (res.rows.length === 0) throw new Error('File not found');
        const file = res.rows[0];

        const driver = await this.getDriverForVolume(file.volume_id);
        if (!driver.streamFile) throw new Error('Driver does not support streaming');

        const stream = await driver.streamFile(file.storage_path);
        return { stream, mimeType: file.mime_type, filename: file.filename };
    }

    async getFileBuffer(fileId: string): Promise<Buffer> {
        const res = await pool.query('SELECT * FROM files WHERE id = $1', [fileId]);
        if (res.rows.length === 0) throw new Error('File not found');
        const file = res.rows[0];

        const driver = await this.getDriverForVolume(file.volume_id);
        return driver.readFile(file.storage_path);
    }

    async getFileUrl(fileId: string): Promise<string | null> {
        const res = await pool.query('SELECT * FROM files WHERE id = $1', [fileId]);
        if (res.rows.length === 0) return null;
        const file = res.rows[0];

        const driver = await this.getDriverForVolume(file.volume_id);
        if (driver.getPresignedUrl) {
            return driver.getPresignedUrl(file.storage_path);
        }

        // Fallback to local server proxy URL
        return `/storage/file/${file.id}`;
    }

    async deleteFile(fileId: string): Promise<void> {
        const res = await pool.query('SELECT * FROM files WHERE id = $1', [fileId]);
        if (res.rows.length === 0) return;
        const file = res.rows[0];

        const driver = await this.getDriverForVolume(file.volume_id);
        
        // 1. Delete from Driver
        await driver.deleteFile(file.storage_path);

        // 2. Delete from DB
        await pool.query('DELETE FROM files WHERE id = $1', [fileId]);

        // 3. Update Quota
        await pool.query('UPDATE storage_volumes SET quota_used = quota_used - $1 WHERE id = $2', [file.size, file.volume_id]);
        
        // Note: We could also update user/app quotas here, but for simplicity let's stick to volume for now.
    }
}

export const storageService = new StorageService();
