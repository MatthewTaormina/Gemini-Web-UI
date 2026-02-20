export interface StorageDriver {
    name: 'disk' | 's3';
    saveFile(path: string, buffer: Buffer): Promise<void>;
    readFile(path: string): Promise<Buffer>;
    deleteFile(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    list(prefix: string): Promise<string[]>;
}
