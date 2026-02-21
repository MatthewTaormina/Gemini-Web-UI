import express from 'express';
import { settingsService } from './SettingsService.js';
import { authenticateToken, requirePermission, hasPermission, AuthRequest } from '../../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/settings/merged
 * Returns the merged settings for the current user and an optional appId.
 */
router.get('/merged', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user?.id;
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
        const user = (req as AuthRequest).user!;
        const userId = user.id;
        const userLabel = userId.replace(/-/g, '_');
        
        const isUserPath = path.includes(`.user.${userLabel}`) || path.startsWith(`global.user.${userLabel}`);
        
        if (!isUserPath && !hasPermission(user, 'read', 'settings')) {
            return res.status(403).json({ error: "Unauthorized to read this path" });
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
        const user = (req as AuthRequest).user!;
        const userId = user.id;
        const userLabel = userId.replace(/-/g, '_');

        const isUserPath = path.includes(`.user.${userLabel}`) || path.startsWith(`global.user.${userLabel}`);

        if (!isUserPath && !hasPermission(user, 'update', 'settings')) {
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
router.post('/system', authenticateToken, requirePermission('update', 'settings'), async (req, res) => {
    try {
        const { value } = req.body;
        await settingsService.setSetting('global.system', value);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
