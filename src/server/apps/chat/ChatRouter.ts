import { Router, Request, Response } from 'express';
import { chatService } from './ChatService.js';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

interface AuthRequest extends Request {
  user?: any;
}

const router = Router();

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(process.env.STORAGE_PATH || './storage_data', 'chat_uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.get('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const conversations = await chatService.getConversations(userId);
    res.json(conversations);
  } catch (err: any) {
    console.error(`Error in chat route:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
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
    const userId = req.user.id;
    const messages = await chatService.getMessages(req.params.id, userId);
    res.json(messages);
  } catch (err: any) {
    console.error(`Error in chat route:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/conversations/:id/messages', upload.array('files'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const { content, tools } = req.body;
    const enabledTools = Array.isArray(tools) ? tools : (tools ? [tools] : []);
    
    console.log(`[ChatRouter] Received message for conv ${req.params.id}. Tools:`, enabledTools);

    const files = (req.files as Express.Multer.File[] || []).map(f => ({
      filename: f.filename,
      path: f.path,
      mimetype: f.mimetype,
      size: f.size
    }));

    const result = await chatService.sendMessage(req.params.id, userId, content, files, enabledTools);
    res.json(result);
  } catch (err: any) {
    console.error(`Error in chat route:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    await chatService.deleteConversation(req.params.id, userId);
    res.status(204).send();
  } catch (err: any) {
    console.error(`Error in chat route:`, err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const { model, title } = req.body;
    const conversation = await chatService.updateConversation(req.params.id, userId, { model, title });
    res.json(conversation);
  } catch (err: any) {
    console.error(`Error in chat route:`, err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
