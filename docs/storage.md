# Storage Service

The Gemini Web UI includes a built-in, abstracted Storage Service that handles all file-related operations with a focus on isolation and extensibility.

## 1. Driver-Based Architecture

The service uses a **Driver-Based Architecture**, allowing it to support multiple storage backends through a single, unified interface (`StorageDriver.ts`).

### 1.1 `DiskDriver.ts`
The current default implementation for local development and self-hosted environments.
- **Root Path**: Configurable via the `STORAGE_PATH` environment variable.
- **Security**: Resolves all file paths against the root to prevent directory traversal attacks.
- **Recursive Directory Support**: Automatically creates directories when saving files.

### 1.2 `S3Driver.ts` (Planned)
Future driver for AWS S3 and other S3-compatible object storage services (MinIO, DigitalOcean Spaces).

---

## 2. Isolation & Namespacing

The `StorageService` enforces a strict, hierarchical path structure to ensure data is isolated between different sub-apps and individual users.

### 2.1 Apps Namespace (`/apps`)
Internal application data that is not directly accessible by users.
- **Path**: `apps/{appId}/{filename}`
- **Isolation**: Each sub-app (Chat, Notes, etc.) is siloed within its own subdirectory.

### 2.2 User Namespace (`/users`)
A "Personal Cloud" storage area for individual user files.
- **Path**: `users/{userId}/{filename}`
- **Isolation**: Users can only access their own files within their unique UUID directory.

---

## 3. Storage API

All file operations should be performed through the `StorageService` facade, which provides the following methods:

- **`saveUserFile(userId: string, filename: string, buffer: Buffer)`**: Save a file for a specific user.
- **`saveAppFile(appId: string, filename: string, buffer: Buffer)`**: Save a file for an internal app.
- **`getUserFile(userId: string, filename: string)`**: Retrieve a file for a specific user.
- **`getAppFile(appId: string, filename: string)`**: Retrieve a file for an internal app.

---

## 4. Git Ignore & Retention

To prevent large binary files or sensitive user data from being committed to the repository, certain directories are explicitly ignored by Git.

### 4.1 `storage_data/chat_uploads/`
Contains all user-uploaded and AI-generated images for the Chat application.
- **Status**: Ignored.
- **Access**: Managed via the Chat application's internal database for mapping UUID filenames to original metadata.

### 4.2 `references/`
Contains official UI references, screenshots, and design assets.
- **Status**: Ignored.
- **Usage**: Local development and design-consistency testing only.
