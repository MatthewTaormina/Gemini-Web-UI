# Identity & Access Management (IAM)

The Gemini Web UI uses a fine-grained, policy-based RBAC system to control access to all resources and sub-apps.

## 1. Roles & Permissions

### 1.1 Permission Structure
Permissions follow the `{action}:{resource}` pattern.
- **Action**: A CRUD verb (e.g., `create`, `read`, `update`, `delete`, `reset_password`).
- **Resource**: The name of the resource (e.g., `users`, `roles`, `dashboard`).

### 1.2 Wildcard Support
For flexible access, the system supports asterisks (`*`) in either position.
- `*:users`: All actions on the users resource.
- `read:*`: Read access to all resources.
- `*:*`: Full system access (Super Admin).

### 1.3 Super Admin Role
The system includes a default **"Super Admin"** role that is automatically seeded with the `*:*` permission during database initialization.

---

## 2. User Management

### 2.1 The Root User (Singleton)
A special "Root Administrator" account is mandatory and must exist for the system to function.
- **Singleton**: Enforced at the database level (`singleton_root_user` unique index).
- **Protection**: A database trigger (`trg_protect_root_user`) prevents the root user from being deleted or soft-deleted.
- **Bypass**: The root user always bypasses all permission checks and is granted a virtual `*:*` permission.

### 2.2 Account Lifecycle
- **Setup Mode**: If no users exist in the database, the system enters "Setup Mode," redirecting all traffic to `/setup`.
- **Soft Delete**: Users are not permanently deleted from the database. Instead, a `deleted_at` timestamp is set, allowing for later restoration.
- **Registration**: New users can register via the public `/register` page, but they are created with **no roles** by default and must be granted access by an administrator.

---

## 3. Policy Enforcement

### 3.1 Backend (`hasPermission`)
Every sensitive API route is guarded by the `authenticateToken` and `hasPermission` logic in `src/server/index.ts`.

### 3.2 Frontend (`checkPermission`)
The `App.tsx` shell provides a `checkPermission` helper function to child components to dynamically show or hide UI elements (buttons, links, pages) based on the user's active permissions.
