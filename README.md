# Gemini Web UI

A high-performance, modular, and secure self-hosted web interface for Gemini AI, featuring a robust PostgreSQL-backed RBAC system and a pluggable app architecture.

## 🚀 Quick Start
1.  **Install dependencies**: `npm install`
2.  **Setup Database**: `npm run db:setup` (Requires PostgreSQL)
3.  **Start Development**: `npm run dev`
4.  **Initialize**: Navigate to `http://localhost:3000` to create your Root Admin account.

---

## 📚 Documentation Index

Explore our comprehensive technical documentation:

### 🛠 Core Framework
- **[Architecture Overview](./ARCHITECTURE.md)**: The Modular Monolith & App Registry design.
- **[App Ecosystem](./docs/apps.md)**: How to build and register new sub-apps (Chat, Notes, etc.).
- **[Storage Service](./docs/storage.md)**: Driver-based file management (Disk/S3) with namespace isolation.

### 🔐 Security & Access
- **[IAM (Identity & Access Management)](./docs/iam.md)**: Roles, Wildcard Permissions, and the Root Singleton.
- **[Security Specifications](./docs/security.md)**: JWT Revocation (JTI), DB-backed secrets, and session management.

### 📊 Data & UI
- **[Database Schema](./docs/database.md)**: PostgreSQL tables, pgvector, and JSONB structures.
- **[UI/UX Design](./docs/ui.md)**: Layout shells, Attach/Detach UI patterns, and Modal management.

### ⚙️ Operations
- **[Full Setup Guide](./docs/setup.md)**: Detailed installation and deployment instructions.
- **[Development Guide](./docs/development.md)**: Codebase structure, build commands, and contribution rules.

---

## 🛠 Tech Stack
- **Frontend**: React (TypeScript), Vite, Vanilla CSS.
- **Backend**: Node.js (Express), TypeScript.
- **Database**: PostgreSQL with `pgvector` & `JSONB`.
- **Auth**: JWT with JTI revocation, Bcrypt hashing.
- **Storage**: Abstracted Driver Architecture (Local Disk / S3 ready).

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
