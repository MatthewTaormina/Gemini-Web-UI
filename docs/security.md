# Security

The Gemini Web UI is a self-hosted AI integration platform that prioritizes security and isolation.

## 1. JWT Revocation

The project implements a JWT revocation system using a database-backed blacklist of JTIs (JWT IDs).

### 1.1 JTI (JWT ID)
Every JWT issued by the system contains a unique `jti` (JWT ID). This ID is used to uniquely identify each user's session and can be revoked individually.

### 1.2 Blacklist (`revoked_tokens` table)
The `revoked_tokens` table stores all revoked JTIs. The `authenticateToken` middleware checks each request's JTI against this table and returns an error if it's found.

---

## 2. Database-Backed Secrets

The JWT signing secret is generated at first boot and stored in the `system_config` table. This removes the need for a static `.env` file and provides a more secure way to manage sensitive information.

---

## 3. Storage Isolation

The `StorageService` enforces a strict, hierarchical path structure to ensure that data is isolated between different sub-apps and individual users.

- **Apps Namespace**: Internal application data that is not directly accessible by users.
- **User Namespace**: A "Personal Cloud" storage area for individual user files.

---

## 4. Root User Protection

The Root user is a special singleton account that bypasses all permission checks. It's protected from deletion or soft-deletion by a database trigger (`trg_protect_root_user`).

---

## 5. Metadata Validation

The `validateMetadata` utility ensures that metadata strictly consists of key-value pairs and nested objects, with no arrays permitted. This provides a clean, object-oriented metadata tree that's perfect for complex, nested tagging.
