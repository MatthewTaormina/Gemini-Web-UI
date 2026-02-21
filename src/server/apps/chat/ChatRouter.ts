import { Router, Response } from 'express';
import { chatService } from './ChatService.js';
import multer from 'multer';
import { AuthRequest } from '../../middleware/auth.js';

const router = Router();

// Use memory storage for handoff to StorageService
const upload = multer({ storage: multer.memoryStorage() });

router.get('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversations = await chatService.getConversations(userId);
    res.json(conversations);
  } catch (err: any) {
    console.error(`Error in chat route:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, model } = req.body;
    const conversation = await chatService.createConversation(userId, title, model);
    res.status(201).json(conversation);
  } catch (err: any) {
    console.error(`Error in chat route:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/conversations/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const messages = await chatService.getMessages(req.params.id as string, userId);
    res.json(messages);
  } catch (err: any) {
    console.error(`Error in chat route:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/conversations/:id/messages', upload.array('files'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { content, tools } = req.body;
    const enabledTools = Array.isArray(tools) ? tools : (tools ? [tools] : []);
    
    console.log(`[ChatRouter] Received message for conv ${req.params.id}. Tools:`, enabledTools);

    const files = (req.files as Express.Multer.File[] || []).map(f => ({
      filename: f.originalname,
      buffer: f.buffer,
      mimetype: f.mimetype,
      size: f.size
    }));

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    const result = await chatService.sendMessage(req.params.id as string, userId, content, files, enabledTools, token);
    res.json(result);
  } catch (err: any) {
    console.error(`Error in chat route:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await chatService.deleteConversation(req.params.id as string, userId);
    res.status(204).send();
  } catch (err: any) {
    console.error(`Error in chat route:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { model, title } = req.body;
    const conversation = await chatService.updateConversation(req.params.id as string, userId, { model, title });
    res.json(conversation);
  } catch (err: any) {
    console.error(`Error in chat route:`, err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
