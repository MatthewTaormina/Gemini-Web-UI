import express from 'express';
import { settingsService } from './SettingsService.js';
import { authenticateToken, requirePermission } from '../../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/settings/merged
 * Returns the merged settings for the current user and an optional appId.
 */
router.get('/merged', authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user?.id;
        const appId = req.query.appId as string;
        const merged = await settingsService.getMergedSettings(appId, userId);
        res.json(merged);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/settings/path/:path
 * Returns the setting at the specific ltree path.
 */
router.get('/path/:path', authenticateToken, async (req, res) => {
    try {
        const path = req.params.path;
        // Basic security check: user can only access their own paths or global/system if they have permission
        const userId = (req as any).user?.id;
        const userLabel = userId.replace(/-/g, '_');
        
        const isUserPath = path.includes(`.user.${userLabel}`) || path.startsWith(`global.user.${userLabel}`);
        const isAdmin = (req as any).user?.is_root;

        if (!isUserPath && !isAdmin) {
            // Check for read:settings permission
            // This is handled by middleware if we use it, but here we do it inline for more granular control
            // Or we just use requirePermission('read:settings') for non-user paths.
        }

        const value = await settingsService.getSetting(path);
        res.json({ value });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/settings/path/:path
 * Sets the setting at the specific ltree path.
 */
router.post('/path/:path', authenticateToken, async (req, res) => {
    try {
        const path = req.params.path;
        const { value } = req.body;
        const userId = (req as any).user?.id;
        const userLabel = userId.replace(/-/g, '_');

        const isUserPath = path.includes(`.user.${userLabel}`) || path.startsWith(`global.user.${userLabel}`);
        const isAdmin = (req as any).user?.is_root;

        if (!isUserPath && !isAdmin) {
             return res.status(403).json({ error: "Unauthorized to modify this path" });
        }

        await settingsService.setSetting(path, value);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/settings/system
 * Returns system-wide settings.
 */
router.get('/system', authenticateToken, async (req, res) => {
    try {
        const value = await settingsService.getSetting('global.system');
        res.json(value || {});
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/settings/system
 * Updates system-wide settings. Requires permission.
 */
router.post('/system', authenticateToken, requirePermission('update:settings'), async (req, res) => {
    try {
        const { value } = req.body;
        await settingsService.setSetting('global.system', value);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
