import { StorageDriver } from './StorageDriver.js';
import fs from 'fs/promises';
import path from 'path';

export class DiskDriver implements StorageDriver {
    name = 'disk' as const;
    private root: string;

    constructor(rootPath: string) {
        this.root = rootPath;
    }

    private resolve(filepath: string): string {
        const fullPath = path.join(this.root, filepath);
        // Security check: prevent directory traversal
        if (!fullPath.startsWith(this.root)) {
            throw new Error('Access denied: Path traversal attempt');
        }
        return fullPath;
    }

    async saveFile(filepath: string, buffer: Buffer, mimeType?: string): Promise<void> {
        const fullPath = this.resolve(filepath);
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, buffer);
    }

    async readFile(filepath: string): Promise<Buffer> {
        return fs.readFile(this.resolve(filepath));
    }

    async deleteFile(filepath: string): Promise<void> {
        return fs.unlink(this.resolve(filepath));
    }

    async exists(filepath: string): Promise<boolean> {
        try {
            await fs.access(this.resolve(filepath));
            return true;
        } catch {
            return false;
        }
    }

    async list(prefix: string): Promise<string[]> {
        const fullPath = this.resolve(prefix);
        try {
            const files = await fs.readdir(fullPath);
            return files;
        } catch {
            return [];
        }
    }

    async streamFile(filepath: string): Promise<NodeJS.ReadableStream> {
        const fsReadStream = (await import('fs')).createReadStream(this.resolve(filepath));
        return fsReadStream as unknown as NodeJS.ReadableStream;
    }
}
