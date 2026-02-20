export interface AppManifest {
    id: string;
    name: string;
    description?: string;
    version: string;
    /**
     * Permissions this app requires to function.
     * e.g., ['storage:read', 'user:read']
     */
    requiredPermissions?: string[];
    /**
     * Permissions this app Exposes to the system.
     * e.g., ['chat:read', 'chat:write']
     */
    exposedPermissions?: string[];
    /**
     * Is this a system app? (cannot be disabled)
     */
    isSystem?: boolean;
    /**
     * Lazy load entry point for the frontend
     */
    clientEntry?: string;
}
