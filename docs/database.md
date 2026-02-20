# Database Design

## System Architecture
**Database Engine**: PostgreSQL (v14+)

## Overview
This document outlines the database schema for the Gemini Web UI. We use PostgreSQL as our primary data store to ensure ACID compliance and robust relational mapping.

## Tables

### `users`
Stores user account information and authentication state.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key (Default: gen_random_uuid()) |
| `username` | VARCHAR(255) | Unique login name |
| `password_hash` | TEXT | Argon2 or BCrypt hash of the password |
| `is_root` | BOOLEAN | Flag for the system root user (Default: false) |
| `enabled` | BOOLEAN | Account status (Default: true) |
| `failed_login_attempts` | INTEGER | Counter for security lockout (Default: 0) |
| `lockout_until` | TIMESTAMP | Timestamp until which login is barred |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last time the record was modified |
| `last_login_at` | TIMESTAMP | Last successful login timestamp |
| `password_last_set_at` | TIMESTAMP | Last time the password was changed |
| `deleted_at` | TIMESTAMP | Soft delete timestamp (NULL if active) |

### `roles`
Defines sets of permissions that can be assigned to users.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `name` | VARCHAR(100) | Unique name of the role (e.g., 'editor') |
| `description` | TEXT | Human-readable description |
| `created_at` | TIMESTAMP | Creation time |

### `permissions`
Individual fine-grained actions following the `action:resource` or `action:resource:id` pattern.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `name` | VARCHAR(100) | Unique identifier (e.g., `create:users`, `read:dashboard`) |
| `action` | VARCHAR(50) | The CRUD verb (create, read, update, delete) |
| `resource` | VARCHAR(50) | The target resource (users, roles, dashboard, etc.) |
| `description` | TEXT | What this permission allows |
| `created_at` | TIMESTAMP | Creation time |

### `role_permissions`
Many-to-many relationship between roles and permissions. This defines the **Policy** for each role.

## Constraints
- **Singleton Root**: Only one user can have `is_root = true`.
- **Immutable Root**: The root user cannot be deleted (either hard or soft delete).
- **RBAC Policies**: 
  - Access is determined by the union of all permissions assigned to a user's roles.
  - Standard format: `{verb}:{resource}`.
  - Root user bypasses all policy checks (Super Admin).

## Relationships
```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigned_to
    ROLES ||--o{ ROLE_PERMISSIONS : contains
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : linked_to

    USERS {
        uuid id PK
        string username
        boolean is_root
    }
    ROLES {
        uuid id PK
        string name
        string description
    }
    PERMISSIONS {
        uuid id PK
        string name
        string description
    }
```

## Security Considerations
- **Passwords**: Never store plain-text passwords. Use a strong hashing algorithm.
- **Lockout**: After 5 failed attempts, the `lockout_until` should be set to 15 minutes in the future.
- **Soft Deletes**: Consider adding `deleted_at` if data retention for audit is required.
