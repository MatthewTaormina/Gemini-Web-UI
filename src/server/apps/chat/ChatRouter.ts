import { Router } from 'express';
import { chatService } from './ChatService.js';
import { Request, Response } from 'express';

const router = Router();

// Middleware to check chat permissions is handled by the main index.ts but we can add specific checks here if needed
// Assuming authenticateToken middleware is already used in index.ts

interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        is_root: boolean;
        permissions: string[];
    }
}

router.get('/conversations', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const conversations = await chatService.getConversations(userId);
        res.json(conversations);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/conversations', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { title } = req.body;
        const conversation = await chatService.createConversation(userId, title || 'New Conversation');
        res.status(201).json(conversation);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/conversations/:id/messages', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const messages = await chatService.getMessages(req.params.id, userId);
        res.json(messages);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/conversations/:id/messages', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { message } = req.body;
        const response = await chatService.sendMessage(req.params.id, userId, message);
        res.json({ response });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/conversations/:id', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        await chatService.deleteConversation(req.params.id, userId);
        res.json({ message: 'Conversation deleted' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
