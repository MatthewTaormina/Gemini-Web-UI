export interface StorageDriver {
    name: 'disk' | 's3' | 'ftp' | 'http';
    saveFile(path: string, buffer: Buffer, mimeType?: string): Promise<void>;
    readFile(path: string): Promise<Buffer>;
    deleteFile(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    list(prefix: string): Promise<string[]>;
    getPresignedUrl?(path: string, expiresIn?: number): Promise<string>;
    streamFile?(path: string): Promise<NodeJS.ReadableStream>;
}
