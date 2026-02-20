import { GoogleGenAI } from "@google/genai";
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface FileAttachment {
  filename: string;
  path: string;
  mimetype: string;
  size: number;
}

export class ChatService {
  private ai: any = null;

  private async getAI() {
    let apiKey = process.env.GEMINI_API_KEY;
    const res = await pool.query("SELECT key, value FROM system_config WHERE key = 'gemini_api_key'");
    if (res.rows.length > 0 && res.rows[0].value !== 'YOUR_API_KEY_HERE') {
      apiKey = res.rows[0].value;
    }

    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      throw new Error("Gemini API key not found.");
    }

    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey });
    }

    return this.ai;
  }

  async getConversations(userId: string) {
    const res = await pool.query(
      "SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC",
      [userId]
    );
    return res.rows;
  }

  async createConversation(userId: string, title: string, model: string = 'gemini-3.1-pro-preview') {
    const res = await pool.query(
      "INSERT INTO conversations (user_id, title, model) VALUES ($1, $2, $3) RETURNING id, user_id, title, model, created_at, updated_at",
      [userId, title, model]
    );
    return res.rows[0];
  }

  async getMessages(conversationId: string, userId: string) {
    // Verify ownership
    const convCheck = await pool.query("SELECT id FROM conversations WHERE id = $1 AND user_id = $2", [conversationId, userId]);
    if (convCheck.rows.length === 0) throw new Error("Unauthorized");

    const res = await pool.query(`
      SELECT m.*,
             (SELECT COALESCE(json_agg(a.*), '[]') 
              FROM attachments a 
              WHERE a.message_id = m.id) as attachments
      FROM messages m
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [conversationId]);
    return res.rows;
  }

  async sendMessage(conversationId: string, userId: string, message: string, files: FileAttachment[] = []) {
    const ai = await this.getAI();
    
    // Get conversation details (including model)
    const convRes = await pool.query(
      "SELECT id, model FROM conversations WHERE id = $1 AND user_id = $2",
      [conversationId, userId]
    );
    if (convRes.rows.length === 0) throw new Error("Conversation not found");
    const modelName = convRes.rows[0].model;

    // Save user message
    const msgRes = await pool.query(
      "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id",
      [conversationId, 'user', message]
    );
    const messageId = msgRes.rows[0].id;

    // Save attachments
    for (const file of files) {
      await pool.query(
        "INSERT INTO attachments (message_id, conversation_id, file_name, file_path, file_type, file_size) VALUES ($1, $2, $3, $4, $5, $6)",
        [messageId, conversationId, file.filename, file.path, file.mimetype, file.size]
      );
    }

    // Get message history for context
    const historyRes = await pool.query(`
      SELECT m.*,
             (SELECT COALESCE(json_agg(a.*), '[]') 
              FROM attachments a 
              WHERE a.message_id = m.id) as attachments
      FROM messages m
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [conversationId]);

    const contents = await Promise.all(historyRes.rows.map(async (row) => {
      const parts: any[] = [];
      
      if (row.content) {
          parts.push({ text: row.content });
      }
      
      // Add attachments to parts if any
      for (const att of row.attachments) {
        try {
          const fileBuffer = await fs.readFile(att.file_path);
          parts.push({
            inlineData: {
              data: fileBuffer.toString('base64'),
              mimeType: att.file_type
            }
          });
        } catch (e) {
          console.error(`Failed to read attachment ${att.file_path}:`, e);
        }
      }

      // Safeguard: Ensure at least one part exists
      if (parts.length === 0) {
          parts.push({ text: "" });
      }

      return {
        role: row.role === 'model' ? 'model' : 'user',
        parts: parts,
      };
    }));

    console.log(`Sending to Gemini [${modelName}]:`, JSON.stringify(contents, null, 2));

    // Generate content
    const result = await ai.models.generateContent({
      model: modelName,
      contents: contents,
    });

    console.log("Gemini Raw Result:", JSON.stringify(result, null, 2));

    const candidate = result.candidates?.[0];
    const responseParts = candidate?.content?.parts || [];
    
    let combinedText = '';
    const generatedAttachments: any[] = [];

    for (const part of responseParts) {
      if (part.text) {
        combinedText += part.text;
      } else if (part.inlineData) {
        const data = Buffer.from(part.inlineData.data, 'base64');
        const ext = part.inlineData.mimeType.split('/')[1] || 'png';
        const filename = `gen-${uuidv4()}.${ext}`;
        const uploadDir = path.resolve(process.env.STORAGE_PATH || './storage_data', 'chat_uploads');
        const filePath = path.join(uploadDir, filename);
        
        await fs.writeFile(filePath, data);
        
        generatedAttachments.push({
          file_name: filename,
          file_path: filePath,
          file_type: part.inlineData.mimeType,
          file_size: data.length
        });
      }
    }

    const finalResponseText = combinedText || (generatedAttachments.length > 0 ? '' : 'No response received.');

    // Save model response
    const modelMsgRes = await pool.query(
      "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id",
      [conversationId, 'model', finalResponseText]
    );
    const modelMessageId = modelMsgRes.rows[0].id;

    // Save generated attachments
    for (const att of generatedAttachments) {
      await pool.query(
        "INSERT INTO attachments (message_id, conversation_id, file_name, file_path, file_type, file_size) VALUES ($1, $2, $3, $4, $5, $6)",
        [modelMessageId, conversationId, att.file_name, att.file_path, att.file_type, att.file_size]
      );
    }

    // Update conversation timestamp
    await pool.query("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [conversationId]);

    // Fetch the newly created attachments for the response
    const attachmentsRes = await pool.query(
      "SELECT id, file_name, file_type, file_size FROM attachments WHERE message_id = $1",
      [modelMessageId]
    );

    return { 
      response: finalResponseText, 
      attachments: attachmentsRes.rows 
    };
  }

  async deleteConversation(conversationId: string, userId: string) {
    // Get attachments first to delete files
    const attRes = await pool.query(
      "SELECT file_path FROM attachments WHERE conversation_id = $1",
      [conversationId]
    );

    // Delete files from disk
    for (const row of attRes.rows) {
      try {
        await fs.unlink(row.file_path);
      } catch (e) {
        console.error(`Failed to delete file ${row.file_path}:`, e);
      }
    }

    // Delete from DB (cascade handles messages and attachments)
    await pool.query(
      "DELETE FROM conversations WHERE id = $1 AND user_id = $2",
      [conversationId, userId]
    );
  }
}

export const chatService = new ChatService();
