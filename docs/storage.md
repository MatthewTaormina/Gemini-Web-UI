# Storage Service

The Gemini Web UI includes a built-in, abstracted Storage Service that handles all file-related operations with a focus on logical isolation, multi-backend support, and quota management.

## 1. Volume-Based Architecture

The system is built around **Storage Volumes**, which are logical storage locations mapped to specific drivers. A volume can be global or owned by a specific user and/or application.

### 1.1 Multi-Driver Support
The service supports multiple storage backends through a unified interface (`StorageDriver.ts`):
- **`DiskDriver.ts`**: Local filesystem storage. Supports direct streaming.
- **`S3Driver.ts`**: AWS S3 and S3-compatible services (MinIO, etc.). Supports streaming and **Presigned URLs** for efficient delivery.
- **Planned Drivers**: FTP/SFTP and HTTP/WebDAV.

### 1.2 Hybrid Delivery
Files are served through a centralized `/storage/file/:id` endpoint. The delivery strategy depends on the backend:
- **Local/Disk**: The server proxies the file stream directly to the client.
- **S3**: The server generates a temporary presigned URL and redirects (302) the client for direct download, offloading bandwidth.

---

## 2. Ownership & Quotas

Volumes and files are managed with strict ownership and usage tracking.

### 2.1 Dual-Ownership
Volumes can belong to both a **User** and an **App** simultaneously. For example, a user's Chat uploads are stored in a volume owned by that user and the "Chat" application.

### 2.2 Quota Enforcement
The system tracks storage usage at three levels:
- **Volume Level**: Total capacity of the logical volume.
- **User Quota**: Per-user limits on a specific volume.
- **App Quota**: Per-app limits on a specific volume.

---

## 3. Storage API

All file operations should be performed through the `StorageService` or the `/storage` API.

### 3.1 Server-Side (`StorageService.ts`)
- **`uploadFile(params)`**: Saves a file buffer to a volume and records metadata.
- **`getFileStream(fileId)`**: Returns a readable stream for a file.
- **`getFileUrl(fileId)`**: Returns a public or internal URL for a file.
- **`deleteFile(fileId)`**: Removes file from storage and cleans up database records.

### 3.2 REST API
- **`POST /storage/upload`**: Upload a file (requires multipart/form-data).
- **`GET /storage/file/:id`**: Retrieve/stream a file. Supports authentication via `Authorization` header or `?token=` query parameter (for `<img>` tags).
- **`GET /storage/volumes`**: Manage storage configurations.

---

## 4. Security

- **Authenticated Access**: All storage endpoints require a valid JWT.
- **Query Param Auth**: To support markdown-rendered images, the `/storage/file/:id` endpoint accepts a `token` query parameter for cases where headers cannot be set (e.g., standard browser `<img>` requests).
- **Reserved Identities**: The system includes a reserved **`system` user** and **`system` app** for core assets and global configurations.

---

## 5. Storage Schema
Detailed database documentation can be found in [docs/database/storage.md](./database/storage.md).
