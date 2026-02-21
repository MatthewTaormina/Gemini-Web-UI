import { Router, Response } from 'express';
import { storageVolumeService } from './StorageVolumeService.js';
import { storageService } from './StorageService.js';
import { AuthRequest } from '../../middleware/auth.js';
import multer from 'multer';

const router = Router();
const upload = multer(); // Store in memory for handoff to StorageService

// --- VOLUME MANAGEMENT ---

// List all volumes
router.get('/volumes', async (req: AuthRequest, res: Response) => {
    try {
        const volumes = await storageVolumeService.getVolumes();
        res.json(volumes);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get single volume
router.get('/volumes/:id', async (req: AuthRequest, res: Response) => {
    try {
        const volume = await storageVolumeService.getVolumeById(req.params.id as string);
        if (!volume) return res.status(404).json({ error: 'Volume not found' });
        res.json(volume);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Create volume
router.post('/volumes', async (req: AuthRequest, res: Response) => {
    try {
        const volume = await storageVolumeService.createVolume(req.body);
        res.status(201).json(volume);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update volume
router.put('/volumes/:id', async (req: AuthRequest, res: Response) => {
    try {
        const volume = await storageVolumeService.updateVolume(req.params.id as string, req.body);
        res.json(volume);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete volume
router.delete('/volumes/:id', async (req: AuthRequest, res: Response) => {
    try {
        await storageVolumeService.deleteVolume(req.params.id as string);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- S3 CONFIGURATION ---

router.post('/config/s3/buckets', async (req: AuthRequest, res: Response) => {
    try {
        const bucket = await storageVolumeService.createS3Bucket(req.body);
        res.status(201).json(bucket);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/config/s3/credentials', async (req: AuthRequest, res: Response) => {
    try {
        const creds = await storageVolumeService.createS3Credentials(req.body);
        res.status(201).json(creds);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- FILE OPERATIONS ---

// File Upload
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        const { volumeId, namespace, userId, appId, metadata } = req.body;
        
        // Default to the current user if not specified
        const finalUserId = userId || (namespace === 'users' ? req.user?.id : undefined);

        const fileRecord = await storageService.uploadFile({
            volumeId,
            userId: finalUserId,
            appId,
            namespace: namespace || 'users',
            filename: req.file.originalname,
            buffer: req.file.buffer,
            mimeType: req.file.mimetype,
            metadata: metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : {}
        });

        res.status(201).json(fileRecord);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// File Download/Stream
router.get('/file/:id', async (req: AuthRequest, res: Response) => {
    try {
        const fileId = req.params.id as string;
        
        // Strategy: Hybrid Presign/Stream
        // First try to get a direct URL (like S3 presigned)
        const directUrl = await storageService.getFileUrl(fileId);
        
        if (directUrl && directUrl.startsWith('http')) {
            // Redirect to S3 presigned URL
            return res.redirect(directUrl);
        }

        // Otherwise stream through the server (Local, FTP, etc.)
        const { stream, mimeType, filename } = await storageService.getFileStream(fileId);
        
        res.setHeader('Content-Type', mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        
        (stream as any).pipe(res);
    } catch (error: any) {
        console.error(`Download error for file ${req.params.id}:`, error.message);
        res.status(500).json({ error: 'Failed to retrieve file', details: error.message });
    }
});

export default router;
