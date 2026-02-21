import { pool } from '../../db/pool.js';

export interface Setting {
    key: string;
    value: any;
    created_at?: Date;
    updated_at?: Date;
}

export class SettingsService {
    /**
     * Converts a string (like a UUID) to a safe ltree label by replacing dashes with underscores.
     */
    private toLtreeLabel(id: string): string {
        return id.replace(/-/g, '_');
    }

    /**
     * Gets a single setting by its exact ltree key.
     */
    async getSetting(key: string): Promise<any | null> {
        const res = await pool.query(
            "SELECT value FROM settings WHERE key = $1::ltree",
            [key]
        );
        return res.rows.length > 0 ? res.rows[0].value : null;
    }

    /**
     * Sets or updates a setting.
     */
    async setSetting(key: string, value: any): Promise<void> {
        await pool.query(
            `INSERT INTO settings (key, value) 
             VALUES ($1::ltree, $2::jsonb) 
             ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = CURRENT_TIMESTAMP`,
            [key, JSON.stringify(value)]
        );
    }

    /**
     * Deletes a setting.
     */
    async deleteSetting(key: string): Promise<void> {
        await pool.query("DELETE FROM settings WHERE key = $1::ltree", [key]);
    }

    /**
     * Gets all settings matching a prefix or ltree query.
     */
    async getSettingsByPrefix(prefix: string): Promise<Setting[]> {
        const res = await pool.query(
            "SELECT key::text, value, created_at, updated_at FROM settings WHERE key <@ $1::ltree",
            [prefix]
        );
        return res.rows;
    }

    /**
     * Resolves settings for a specific context (user and/or app), merging them hierarchically.
     * Precedence (highest to lowest):
     * 1. global.app.<app_id>.user.<user_id>
     * 2. global.app.<app_id>.user.default
     * 3. global.app.<app_id>
     * 4. global.app.<app_id>.default
     * 5. global.app.default
     * 6. global.user.<user_id>
     * 7. global.user.default
     * 8. global.system
     */
    async getMergedSettings(appId?: string, userId?: string): Promise<any> {
        const paths: string[] = ['global.system', 'global.user.default'];
        
        if (userId) {
            const userLabel = this.toLtreeLabel(userId);
            paths.push(`global.user.${userLabel}`);
        }

        if (appId) {
            const appLabel = this.toLtreeLabel(appId);
            paths.push('global.app.default');
            paths.push(`global.app.${appLabel}.default`);
            paths.push(`global.app.${appLabel}`);
            paths.push(`global.app.${appLabel}.user.default`);
            
            if (userId) {
                const userLabel = this.toLtreeLabel(userId);
                paths.push(`global.app.${appLabel}.user.${userLabel}`);
            }
        }

        // Fetch all matching settings
        const res = await pool.query(
            "SELECT key::text, value FROM settings WHERE key = ANY($1::ltree[])",
            [paths]
        );

        const settingsMap = new Map<string, any>();
        res.rows.forEach(row => settingsMap.set(row.key, row.value));

        // Merge logic (lowest precedence first)
        let merged = {};

        // 1. System
        if (settingsMap.has('global.system')) {
            merged = this.deepMerge(merged, settingsMap.get('global.system'));
        }

        // 2. User Default
        if (settingsMap.has('global.user.default')) {
            merged = this.deepMerge(merged, settingsMap.get('global.user.default'));
        }

        // 3. User Global
        if (userId) {
            const path = `global.user.${this.toLtreeLabel(userId)}`;
            if (settingsMap.has(path)) {
                merged = this.deepMerge(merged, settingsMap.get(path));
            }
        }

        // 4. App Default
        if (appId) {
            if (settingsMap.has('global.app.default')) {
                merged = this.deepMerge(merged, settingsMap.get('global.app.default'));
            }
        }

        // 5. App Specific Default
        if (appId) {
            const path = `global.app.${this.toLtreeLabel(appId)}.default`;
            if (settingsMap.has(path)) {
                merged = this.deepMerge(merged, settingsMap.get(path));
            }
        }

        // 6. App Global
        if (appId) {
            const path = `global.app.${this.toLtreeLabel(appId)}`;
            if (settingsMap.has(path)) {
                merged = this.deepMerge(merged, settingsMap.get(path));
            }
        }

        // 7. App User Default
        if (appId) {
            const path = `global.app.${this.toLtreeLabel(appId)}.user.default`;
            if (settingsMap.has(path)) {
                merged = this.deepMerge(merged, settingsMap.get(path));
            }
        }

        // 8. App User Specific
        if (appId && userId) {
            const path = `global.app.${this.toLtreeLabel(appId)}.user.${this.toLtreeLabel(userId)}`;
            if (settingsMap.has(path)) {
                merged = this.deepMerge(merged, settingsMap.get(path));
            }
        }

        return merged;
    }

    private deepMerge(target: any, source: any): any {
        if (typeof source !== 'object' || source === null) return source;
        if (typeof target !== 'object' || target === null) target = {};

        const result = { ...target };
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(target[key], source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        return result;
    }

    /**
     * Helper to get ltree path for specific contexts
     */
    getSystemPath(): string { return 'global.system'; }
    getUserDefaultPath(): string { return 'global.user.default'; }
    getUserPath(userId: string): string { return `global.user.${this.toLtreeLabel(userId)}`; }
    getAppDefaultPath(): string { return 'global.app.default'; }
    getAppSpecificDefaultPath(appId: string): string { return `global.app.${this.toLtreeLabel(appId)}.default`; }
    getAppPath(appId: string): string { return `global.app.${this.toLtreeLabel(appId)}`; }
    getAppUserDefaultPath(appId: string): string { return `global.app.${this.toLtreeLabel(appId)}.user.default`; }
    getAppUserPath(appId: string, userId: string): string { 
        return `global.app.${this.toLtreeLabel(appId)}.user.${this.toLtreeLabel(userId)}`; 
    }
}

export const settingsService = new SettingsService();
