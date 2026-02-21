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

## 5. Built-in Apps

### 5.1 Chat Application
The Chat app is a flagship integration of the Gemini 3.1, 3.0, and 2.5 series models.

**Features:**
- **Professional Layout**: A centered, modern interface inspired by high-end AI platforms.
- **Model Switching**: Mid-chat model selection via a header dropdown, allowing users to pivot between 3.1 Pro (reasoning), 3.0 Flash (speed), and 2.5 Image (creation).
- **Auto-Titling**: Automatically generates a concise (max 5 words) conversation title using `gemini-3.1-flash-preview` immediately after the first user message.
- **Batch Image Generation**: Support for direct image models like `gemini-2.5-flash-image` which can produce up to 4 images per prompt in a single API call.
- **Image Editing**: Intelligent context handling that focuses on the most recent image for modification when an "edit" command is given.
- **Multimodal History**: Full support for mixed text and image history, enabling long-context visual reasoning.
