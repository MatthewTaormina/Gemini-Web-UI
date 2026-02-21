import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageDriver } from "./StorageDriver.js";

export interface S3Config {
    endpoint_url: string;
    bucket_name: string;
    region?: string;
    use_ssl?: boolean;
    credentials: {
        access_key: string;
        secret_key: string;
    };
}

export class S3Driver implements StorageDriver {
    name = 's3' as const;
    private client: S3Client;
    private bucket: string;

    constructor(config: S3Config) {
        this.client = new S3Client({
            endpoint: config.endpoint_url,
            region: config.region || 'us-east-1',
            credentials: {
                accessKeyId: config.credentials.access_key,
                secretAccessKey: config.credentials.secret_key,
            },
            forcePathStyle: true, // Often needed for S3-compatible endpoints like MinIO
            tls: config.use_ssl ?? true,
        });
        this.bucket = config.bucket_name;
    }

    async saveFile(path: string, buffer: Buffer, mimeType?: string): Promise<void> {
        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: path,
            Body: buffer,
            ContentType: mimeType,
        }));
    }

    async readFile(path: string): Promise<Buffer> {
        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: path,
        }));
        
        const stream = response.Body as any;
        return Buffer.concat(await stream.toArray());
    }

    async deleteFile(path: string): Promise<void> {
        await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: path,
        }));
    }

    async exists(path: string): Promise<boolean> {
        try {
            await this.client.send(new HeadObjectCommand({
                Bucket: this.bucket,
                Key: path,
            }));
            return true;
        } catch {
            return false;
        }
    }

    async list(prefix: string): Promise<string[]> {
        const response = await this.client.send(new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
        }));
        return response.Contents?.map(c => c.Key!).filter(Boolean) || [];
    }

    async getPresignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: path,
        });
        return getSignedUrl(this.client, command, { expiresIn });
    }

    async streamFile(path: string): Promise<NodeJS.ReadableStream> {
        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: path,
        }));
        return response.Body as unknown as NodeJS.ReadableStream;
    }
}
