# Storage Database Design

This document outlines the database schema for the Storage Service, used to track file metadata and manage ownership/access across multiple storage backends.

## Tables

### `storage_volumes`
Defines logical storage locations (local disk, S3 buckets, etc.).

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `name` | VARCHAR(100) | Unique name for the volume |
| `driver` | VARCHAR(20) | 'local', 's3', 'ftp', 'http' |
| `config` | JSONB | Driver-specific configuration (e.g., root path for local) |
| `default_prefix` | TEXT | Optional prefix prepended to all file paths on this volume |
| `enforce_hierarchy` | BOOLEAN | Whether to enforce folder-like structures (Default: true) |
| `path_delimiter` | VARCHAR(5) | The character used to separate path segments (Default: '/') |
| `use_query_params` | BOOLEAN | If true, identifies files via query params (e.g., `?id=`) instead of paths |
| `auto_path_strategy` | VARCHAR(20) | 'none', 'uuid', 'hash' (Default: 'none') |
| `versioning_mode` | VARCHAR(20) | 'none', 'source', 'target' (Default: 'none') |
| `quota_limit` | BIGINT | Total storage limit for this volume in bytes (NULL for unlimited) |
| `quota_used` | BIGINT | Current total storage used on this volume in bytes |
| `is_active` | BOOLEAN | Whether this volume is available for use |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last time the record was modified |

### `user_quotas`
Per-user storage limits and usage tracking for specific volumes.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `user_id` | UUID | FK to `users(id)` |
| `volume_id` | UUID | FK to `storage_volumes(id)` |
| `quota_limit` | BIGINT | Storage limit for this user on this volume (bytes) |
| `quota_used` | BIGINT | Current storage used by this user on this volume (bytes) |
| `updated_at` | TIMESTAMP | Last time the usage was calculated/updated |

### `app_quotas`
Per-app storage limits and usage tracking for specific volumes.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `app_id` | VARCHAR(100) | The ID of the app (e.g., 'chat') |
| `volume_id` | UUID | FK to `storage_volumes(id)` |
| `quota_limit` | BIGINT | Storage limit for this app on this volume (bytes) |
| `quota_used` | BIGINT | Current storage used by this app on this volume (bytes) |
| `updated_at` | TIMESTAMP | Last time the usage was calculated/updated |

### `s3_buckets`
Stores S3-compatible bucket configurations and their endpoints.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `endpoint_url` | TEXT | The S3 API endpoint URL (e.g., `s3.amazonaws.com`) |
| `bucket_name` | VARCHAR(255) | Name of the bucket |
| `region` | VARCHAR(50) | S3 region (e.g., `us-east-1`) |
| `use_ssl` | BOOLEAN | Whether to use HTTPS (Default: true) |
| `created_at` | TIMESTAMP | Record creation time |

### `s3_credentials`
Stores access keys and secrets for S3 buckets.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `bucket_id` | UUID | FK to `s3_buckets(id)` |
| `access_key` | TEXT | S3 Access Key ID |
| `secret_key` | TEXT | S3 Secret Access Key (Should be encrypted) |
| `description` | TEXT | Purpose of these credentials |
| `created_at` | TIMESTAMP | Record creation time |

### `http_endpoints`
Stores remote HTTP/WebDAV storage locations.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `url` | TEXT | The base URL of the HTTP storage |
| `description` | TEXT | Human-readable name/description |
| `created_at` | TIMESTAMP | Record creation time |

### `http_credentials`
Authentication details for HTTP endpoints.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `endpoint_id` | UUID | FK to `http_endpoints(id)` |
| `auth_type` | VARCHAR(20) | 'basic', 'bearer', 'custom_header' |
| `credentials` | JSONB | Encrypted credentials (e.g., username/password or token) |
| `created_at` | TIMESTAMP | Record creation time |

### `ftp_endpoints`
Stores FTP/SFTP storage locations and credentials.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `host` | VARCHAR(255) | Hostname or IP |
| `port` | INTEGER | Port (Default: 21 for FTP, 22 for SFTP) |
| `protocol` | VARCHAR(10) | 'ftp', 'sftp' |
| `username` | VARCHAR(100) | Login username |
| `password` | TEXT | Login password (Should be encrypted) |
| `key_path` | TEXT | Path to private key for SFTP (if applicable) |
| `created_at` | TIMESTAMP | Record creation time |

### `local_paths`
Defines approved local filesystem paths for storage.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `path` | TEXT | Absolute path on the host system |
| `description` | TEXT | Purpose of this path |
| `created_at` | TIMESTAMP | Record creation time |

### `files`
Tracks metadata for all files stored via the Storage Service.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key (Default: gen_random_uuid()) |
| `volume_id` | UUID | FK to `storage_volumes(id)` |
| `user_id` | UUID | Foreign Key to `users(id)` (NULL for system/app files) |
| `app_id` | VARCHAR(100) | Identifier for the app that owns the file (e.g., 'chat') |
| `namespace` | VARCHAR(50) | 'users' or 'apps' |
| `filename` | TEXT | Original filename provided by user/app |
| `storage_path` | TEXT | Internal path relative to the volume root |
| `mime_type` | VARCHAR(100) | File MIME type (e.g., 'image/png') |
| `size` | BIGINT | File size in bytes |
| `metadata` | JSONB | Custom metadata/tags (e.g., `{"project": "Alpha"}`) |
| `is_public` | BOOLEAN | Whether the file can be accessed without auth (Default: false) |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last time the record was modified |
| `deleted_at` | TIMESTAMP | Soft delete timestamp (NULL if active) |

## Relationships
- **`files.volume_id`** references **`storage_volumes.id`**.
- **`files.user_id`** references **`users.id`**.
- **`user_quotas.user_id`** references **`users.id`**.
- **`user_quotas.volume_id`** references **`storage_volumes.id`**.
- **`app_quotas.volume_id`** references **`storage_volumes.id`**.
- **`s3_credentials.bucket_id`** references **`s3_buckets.id`**.
- **`http_credentials.endpoint_id`** references **`http_endpoints.id`**.
- **`storage_volumes`** link to backend-specific tables via their `config` JSONB. For example:
    - `{ "bucket_id": "UUID" }` for S3.
    - `{ "endpoint_id": "UUID" }` for HTTP.
    - `{ "ftp_id": "UUID" }` for FTP/SFTP.
    - `{ "local_path_id": "UUID" }` for Local Disk.
- **Secrets** (`s3_credentials.secret_key`, `ftp_endpoints.password`, `http_credentials.credentials`) MUST be encrypted at rest using a system-wide encryption key.
