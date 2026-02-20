# Documentation Index

Welcome to the Gemini Web UI documentation. This repository contains the technical specifications and guides for the self-hosted AI integration platform.

## 🛠 Core Concepts
- **[Architecture](../ARCHITECTURE.md)**: Overview of the Modular Monolith, App Registry, and System Design.
- **[Database Schema](./database.md)**: Detailed ERD and table specifications for PostgreSQL, RBAC, and System Config.
- **[Security](./security.md)**: JWT Revocation, JTI, and Database-backed Secret management.

## 👥 Identity & Access Management (IAM)
- **[Roles & Permissions](./iam.md#roles-and-permissions)**: Detailed explanation of the `action:resource` pattern and wildcard support.
- **[User Management](./iam.md#user-management)**: Root user singleton, soft-deletes, and account lifecycle.

## 📁 Services & Apps
- **[Storage Service](./storage.md)**: Driver-based abstraction (Disk/S3) and file namespacing.
- **[App Ecosystem](./apps.md)**: Guide to creating and registering new sub-apps.

## 🎨 User Interface (UI)
- **[Design System](./ui.md)**: Dashboard vs Site layouts, Modal management, and Badge-based permissions UI.

## 🚀 Operations
- **[Installation & Setup](./setup.md)**: How to initialize the database and create the root user.
- **[Development Guide](./development.md)**: Project structure, build commands, and contribution guidelines.
