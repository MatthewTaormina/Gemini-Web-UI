# App Ecosystem

The Gemini Web UI is a modular platform where new features like Chat, Notes, or Research are built as independent sub-apps.

## 1. App Structure

Each sub-app consists of two main parts:
- **Backend Component**: An Express router and an initialization function.
- **Frontend Component**: A React component that is lazy-loaded by the shell.

---

## 2. App Manifest (`src/shared/types/AppManifest.ts`)

Every app must define an `AppManifest` to describe its identity and requirements:
- **`id`**: Unique identifier (e.g., `chat`).
- **`name`**: Human-readable name.
- **`requiredPermissions`**: Permissions the app needs from other services.
- **`exposedPermissions`**: Custom permissions the app defines (e.g., `read:chat`, `write:chat`).

---

## 3. App Lifecycle

### 3.1 Registration (`src/server/apps/AppRegistry.ts`)
Apps are registered with the `AppRegistry` at server startup.
```typescript
appRegistry.register(myChatApp);
```

### 3.2 Initialization
The `AppRegistry` initializes each app by calling its `init(context: AppContext)` function.
- **`AppContext`**: Provides access to shared system services like the `StorageService`, Database Pool, and Logger.

### 3.3 Routing
The server automatically mounts each app's router at `/api/apps/{appId}` to provide a clean, isolated API namespace.

---

## 4. Inter-App Communication

Apps can communicate with each other through the `AppContext`. Future versions will support:
- **Service Mesh**: Direct API calls between apps.
- **Event Bus**: Asynchronous communication via a shared event-driven system.
- **Permissions**: Apps are isolated by default and can only access other apps' APIs if granted permission by the user.
