# Gemini Web UI - Architectural Documentation

This document provides a comprehensive technical overview of the Gemini Web UI project, a self-hosted platform for AI integration with a focus on modularity, security, and structured data.

## 1. System Architecture: Modular Monolith
The project follows a **Modular Monolith** pattern to balance development speed with architectural isolation.

### 1.1 App Registry (`src/server/apps/AppRegistry.ts`)
The central "Brain" of the server. It manages the lifecycle of sub-applications.
- **`ServerAppModule`**: The interface every app must implement.
- **`AppContext`**: Shared services (Database, Storage, Logger) provided to every app during initialization.
- **Namespacing**: Each app is mounted at `/api/apps/{appId}` to ensure routing isolation.

### 1.2 Frontend Shell
A React-based single-page application (SPA) that acts as the container.
- **Lazy Loading**: Future apps are intended to be loaded via React `Suspense` only when accessed.
- **Layout Split**: Distinct `MainLayout` (Public/User) and `DashboardLayout` (Admin) shells.

---

## 2. Identity & Access Management (IAM)

### 2.1 RBAC Model
A granular permission system based on the `{action}:{resource}` pattern.
- **Wildcards**: Supports patterns like `*:users` (all actions on users) or `read:*` (read-only on all resources).
- **Root User Singleton**: Enforced at the database level (`singleton_root_user` index). The Root user bypasses all permission checks (`*:*`).
- **Protection Trigger**: A PostgreSQL trigger (`trg_protect_root_user`) prevents the deletion or soft-deletion of the root account.

### 2.2 JWT & Session Security
- **Database-Backed Secrets**: The JWT signing secret is generated at first boot and stored in the `system_config` table, removing reliance on static `.env` files.
- **Token Revocation (Blacklist)**: 
  - Every JWT contains a unique `jti` (JWT ID).
  - The `revoked_tokens` table stores blacklisted JTIs.
  - The `authenticateToken` middleware verifies revocation on every request.
- **Logout**: Revokes the current session server-side before clearing local storage.

---

## 3. Storage Service (`src/server/apps/storage`)
An abstracted file management system designed for extensibility.

- **`StorageDriver`**: Interface for file operations (`saveFile`, `readFile`, `deleteFile`, `exists`, `list`).
- **`DiskDriver`**: Current implementation using local filesystem with directory traversal protection.
- **`S3Driver` (Planned)**: Future support for AWS S3/Object storage.
- **Isolation Layers**:
  - `apps/{appId}/`: Private internal storage for sub-apps.
  - `users/{userId}/`: Private personal cloud storage for individual users.

---

## 4. Database & Structured Data

### 4.1 PostgreSQL Schema
- **pgvector**: Enabled for future AI embedding and vector search capabilities.
- **JSONB Metadata**: Core resources (`users`, `roles`, `permissions`) include a `meta` column.

### 4.2 Metadata Specification (`src/shared/utils/metadata.ts`)
Metadata follows a strict, recursive tree structure:
```typescript
interface MetaNode {
    name: string;
    value: string | number | boolean | null;
    children: { [key: string]: MetaNode };
}
```
**Constraints**:
- **No Arrays**: Only key-value pairs and nested objects are allowed.
- **Nesting**: Parent nodes can hold a `value` *and* have `children`.

---

## 5. Development Workflow

### 5.1 Initialization
If the database is empty, the system automatically redirects to `/setup` to create the initial Root Administrator.

### 5.2 Commands
- `npm run db:setup`: Initializes the PostgreSQL schema.
- `npm run dev`: Starts Vite (3000) and Express (3001) in development mode.
- `npm run build`: Compiles the full TypeScript project.

### 5.3 Database Utilities (`src/server/db/`)
- `check_users.ts`: Lists current users.
- `reset_users.ts`: Clears all users (triggers setup mode).
- `migrate_meta.ts`: Schema migration for the `meta` column.
- `migrate_secrets.ts`: Schema migration for system configuration.
