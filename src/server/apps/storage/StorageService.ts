import { StorageDriver } from './StorageDriver.js';
import { DiskDriver } from './DiskDriver.js';
import path from 'path';

export class StorageService {
    private driver: StorageDriver;
    
    // Namespaces
    private static USER_PREFIX = 'users';
    private static APP_PREFIX = 'apps';

    constructor() {
        // Here is where we switch to S3 later based on ENV vars
        const storagePath = process.env.STORAGE_PATH || './storage_data';
        this.driver = new DiskDriver(path.resolve(storagePath));
    }

    /**
     * Save a file for a specific user (Their Personal Cloud).
     */
    async saveUserFile(userId: string, filename: string, buffer: Buffer): Promise<void> {
        const key = path.join(StorageService.USER_PREFIX, userId, filename);
        await this.driver.saveFile(key, buffer);
    }

    /**
     * Save a file for an App (Internal App Data).
     * Isolated from users and other apps.
     */
    async saveAppFile(appId: string, filename: string, buffer: Buffer): Promise<void> {
        const key = path.join(StorageService.APP_PREFIX, appId, filename);
        await this.driver.saveFile(key, buffer);
    }
    
    async getUserFile(userId: string, filename: string): Promise<Buffer> {
        const key = path.join(StorageService.USER_PREFIX, userId, filename);
        return this.driver.readFile(key);
    }

    async getAppFile(appId: string, filename: string): Promise<Buffer> {
        const key = path.join(StorageService.APP_PREFIX, appId, filename);
        return this.driver.readFile(key);
    }
}
