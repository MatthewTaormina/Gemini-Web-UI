import { GoogleGenAI } from "@google/genai";
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export class ChatService {
  private ai: any = null;

  private async getAI() {
    // Try environment variable first
    let apiKey = process.env.GEMINI_API_KEY;

    // Then try database (which can override env if set)
    const res = await pool.query("SELECT key, value FROM system_config WHERE key = 'gemini_api_key'");
    if (res.rows.length > 0 && res.rows[0].value !== 'YOUR_API_KEY_HERE') {
      apiKey = res.rows[0].value;
    }

    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      throw new Error("Gemini API key not found. Please set GEMINI_API_KEY in your .env file or system settings.");
    }

    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey });
    }

    return this.ai;
  }

  async sendMessage(conversationId: string, userId: string, message: string) {
    const ai = await this.getAI();
    
    // Get model name
    let modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
    const modelRes = await pool.query("SELECT value FROM system_config WHERE key = 'gemini_model'");
    if (modelRes.rows.length > 0) {
      modelName = modelRes.rows[0].value;
    }

    // Verify conversation belongs to user
    const convRes = await pool.query(
      "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
      [conversationId, userId]
    );
    if (convRes.rows.length === 0) {
      throw new Error("Conversation not found or access denied.");
    }

    // Save user message
    await pool.query(
      "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)",
      [conversationId, 'user', message]
    );

    // Get message history for context
    const historyRes = await pool.query(
      "SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
      [conversationId]
    );

    const contents = historyRes.rows.map(row => ({
      role: row.role === 'model' ? 'model' : 'user',
      parts: [{ text: row.content }],
    }));

    // Generate content using the new SDK
    const result = await ai.models.generateContent({
      model: modelName,
      contents: contents,
    });

    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";

    // Save model response
    await pool.query(
      "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)",
      [conversationId, 'model', responseText]
    );

    return responseText;
  }

  async createConversation(userId: string, title: string) {
    const res = await pool.query(
      "INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at",
      [userId, title]
    );
    return res.rows[0];
  }

  async getConversations(userId: string) {
    const res = await pool.query(
      "SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC",
      [userId]
    );
    return res.rows;
  }

  async getMessages(conversationId: string, userId: string) {
    // Verify access
    const convRes = await pool.query(
      "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
      [conversationId, userId]
    );
    if (convRes.rows.length === 0) {
      throw new Error("Conversation not found or access denied.");
    }

    const res = await pool.query(
      "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
      [conversationId]
    );
    return res.rows;
  }

  async deleteConversation(conversationId: string, userId: string) {
    const res = await pool.query(
      "DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id",
      [conversationId, userId]
    );
    if (res.rows.length === 0) {
      throw new Error("Conversation not found or access denied.");
    }
    return true;
  }
}

export const chatService = new ChatService();
