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

  private getImageUrl(filename: string) {
    return `/uploads/${filename}`;
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

  async updateConversation(conversationId: string, userId: string, updates: { model?: string, title?: string }) {
    const { model, title } = updates;
    const queryParts: string[] = [];
    const values: any[] = [conversationId, userId];
    
    if (model) {
      values.push(model);
      queryParts.push(`model = $${values.length}`);
    }
    if (title) {
      values.push(title);
      queryParts.push(`title = $${values.length}`);
    }

    if (queryParts.length === 0) throw new Error("No updates provided");

    const res = await pool.query(
      `UPDATE conversations SET ${queryParts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *`,
      values
    );
    if (res.rows.length === 0) throw new Error("Conversation not found");
    return res.rows[0];
  }

  async getMessages(conversationId: string, userId: string) {
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

  async generateTitle(conversationId: string, firstMessage: string) {
    const ai = await this.getAI();
    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{
                role: 'user',
                parts: [{ text: `Generate a short title (max 5 words) for: "${firstMessage}". Return ONLY the title text.` }]
            }]
        });
        const title = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'New Conversation';
        const sanitizedTitle = title.replace(/^Title:\s*/i, '').replace(/^"|"$/g, '').trim();
        await pool.query("UPDATE conversations SET title = $1 WHERE id = $2", [sanitizedTitle, conversationId]);
    } catch (e) {
        console.error("[ChatService] Failed to generate title:", e);
    }
  }

  async sendMessage(conversationId: string, userId: string, message: string, files: FileAttachment[] = [], enabledTools: string[] = []) {
    try {
        const ai = await this.getAI();
        
        const convRes = await pool.query(
          "SELECT id, model, (SELECT count(*) FROM messages WHERE conversation_id = $1) as msg_count FROM conversations WHERE id = $1 AND user_id = $2",
          [conversationId, userId]
        );
        if (convRes.rows.length === 0) throw new Error("Conversation not found");
        const modelName = convRes.rows[0].model || 'gemini-3.1-pro-preview';
        const isFirstMessage = parseInt(convRes.rows[0].msg_count) === 0;

        console.log(`[ChatService] sendMessage: convId=${conversationId}, model=${modelName}`);

        // 1. Save user message
        const msgRes = await pool.query(
          "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id",
          [conversationId, 'user', message]
        );
        const messageId = msgRes.rows[0].id;

        if (isFirstMessage) {
          this.generateTitle(conversationId, message).catch(console.error);
        }

        const currentMessageAttachments: any[] = [];
        for (const file of files) {
          await pool.query(
            "INSERT INTO attachments (message_id, conversation_id, file_name, file_path, file_type, file_size) VALUES ($1, $2, $3, $4, $5, $6)",
            [messageId, conversationId, file.filename, file.path, file.mimetype, file.size]
          );
          try {
              const fileBuffer = await fs.readFile(file.path);
              currentMessageAttachments.push({
                  inlineData: { data: fileBuffer.toString('base64'), mimeType: file.mimetype }
              });
          } catch (e) { console.error(`[ChatService] Failed to read uploaded file ${file.path}:`, e); }
        }

        // 2. Fetch history and build contents
        const historyRes = await pool.query(`
          SELECT m.*,
                 (SELECT COALESCE(json_agg(a.*), '[]') 
                  FROM attachments a 
                  WHERE a.message_id = m.id) as attachments
          FROM messages m
          WHERE m.conversation_id = $1
          ORDER BY m.created_at ASC
        `, [conversationId]);

        const aliasRegistry: Record<string, { path: string, filename: string }> = {};
        let imgCounter = 1;

        const contents = await Promise.all(historyRes.rows.map(async (row) => {
          const parts: any[] = [];
          
          // Strip system-generated Markdown links from history
          let contentText = (row.content || "").replace(/!\[.*?\]\(\/uploads\/.*?\)/g, "").trim();
          
          for (const att of row.attachments) {
            if (att.file_type.startsWith('image/')) {
                const alias = `IMG_${imgCounter++}`;
                aliasRegistry[alias] = { path: att.file_path, filename: att.file_name };
                if (!contentText.includes(alias)) {
                    contentText += `\n[Context: Image ${alias}]`;
                }
                try {
                  const fileBuffer = await fs.readFile(att.file_path);
                  parts.push({ inlineData: { data: fileBuffer.toString('base64'), mimeType: att.file_type } });
                } catch (e) { console.warn(`[ChatService] Context file error: ${att.file_path}`); }
            }
          }
          if (contentText) parts.unshift({ text: contentText });
          if (parts.length === 0) parts.push({ text: "" });
          return { role: row.role === 'model' ? 'model' : 'user', parts };
        }));

        if (modelName.includes('-image')) {
            return this.handleDirectImageGeneration(conversationId, modelName, message, currentMessageAttachments);
        }

        // 3. Define Tools
        const tools: any[] = [];
        let systemInstructionText = "You are Gemini, a helpful AI assistant. You have access to tools.";

        if (enabledTools.includes('generate_image')) {
          systemInstructionText += "\n\nCRITICAL: To create or modify images, you MUST call 'generate_image(prompt, source_image)'.\n" +
                                   "Images in history are labeled 'IMG_1', 'IMG_2', etc.\n" +
                                   "To refer to an image, use its label in 'source_image'.\n" +
                                   "NEVER write URLs like '/uploads/...' or Markdown image syntax yourself. You lack file system access.\n" +
                                   "NEVER repeat the metadata tags like '[Context: Image IMG_N]' in your response.";
          
          tools.push({
            functionDeclarations: [{
              name: "generate_image",
              description: "Generates a single image. Use label (e.g. IMG_1) in source_image for contextual edits.",
              parameters: {
                type: "object",
                properties: {
                  prompt: { type: "string", description: "Detailed description of the image." },
                  source_image: { type: "string", description: "Optional: label of a previous image (e.g. IMG_1) to use as base context." }
                },
                required: ["prompt"]
              }
            }]
          });
        }

        if (enabledTools.includes('math')) {
            systemInstructionText += "\n\nTool: 'calculate(expression)'. Use for math.\n" +
                                     "Format: {\"action\": \"calculate\", \"action_input\": {\"expression\": \"...\"}}";
            
            tools.push({
              functionDeclarations: [{
                name: "calculate",
                description: "Evaluates a mathematical expression.",
                parameters: {
                  type: "object",
                  properties: {
                    expression: { type: "string", description: "The math expression to evaluate." }
                  },
                  required: ["expression"]
                }
              }]
            });
        }

        // 4. Generate response
        const result = await ai.models.generateContent({
            model: modelName,
            contents,
            tools: tools.length > 0 ? tools : undefined,
            systemInstruction: { parts: [{ text: systemInstructionText }] }
        });

        if (!result || !result.candidates || result.candidates.length === 0) {
            throw new Error(`Empty response from ${modelName}`);
        }

        const responseParts = result.candidates[0].content?.parts || [];
        const textPartsRaw = responseParts.filter((p: any) => p.text).map((p: any) => p.text).join("\n");
        console.log(`[ChatService] Raw Output: "${textPartsRaw.substring(0, 100)}..."`);
        
        // 5. Parse tool calls
        const findJsonObjects = (text: string) => {
            const objects: { data: any, raw: string }[] = [];
            let start = -1;
            let count = 0;
            for (let i = 0; i < text.length; i++) {
                if (text[i] === '{') {
                    if (count === 0) start = i;
                    count++;
                } else if (text[i] === '}') {
                    count--;
                    if (count === 0 && start !== -1) {
                        const potential = text.substring(start, i + 1);
                        try {
                            objects.push({ data: JSON.parse(potential), raw: potential });
                        } catch (e) {
                            try {
                                if (potential.includes('"action_input": "{')) {
                                    const fixed = potential.replace(/\"action_input\":\s*\"(\{[\s\S]*?\})\"/g, (m, p1) => `\"action_input\": ${JSON.stringify(p1)}`);
                                    objects.push({ data: JSON.parse(fixed), raw: potential });
                                }
                            } catch(e2) {}
                        }
                    }
                }
            }
            return objects;
        };

        const cleanPrompt = (p: any): string => {
            if (!p) return "";
            if (typeof p === 'object') {
                const val = p.prompt || p.description || p.text || p.action_input?.prompt || p.action_input || p.args?.prompt || JSON.stringify(p);
                return cleanPrompt(val);
            }
            let str = String(p).trim();
            if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('"{') && str.endsWith('}"'))) {
                try {
                    const inner = str.startsWith('"{') ? JSON.parse(str) : str;
                    const parsed = typeof inner === 'string' ? JSON.parse(inner) : inner;
                    return cleanPrompt(parsed);
                } catch (e) {}
            }
            str = str.replace(/```json\s*([\s\S]*?)\s*```/g, '$1').replace(/```\s*([\s\S]*?)\s*```/g, '$1');
            return str.replace(/^Prompt:\s*/i, '').trim();
        };

        const foundObjects = findJsonObjects(textPartsRaw);
        const toolCalls: { name: string, args: any }[] = [];
        const jsonStringsToStrip: string[] = [];

        for (const obj of foundObjects) {
            const data = obj.data;
            const isImageTool = data.name === 'generate_image' || data.action === 'generate_image' || 
                               data.action === 'dalle.text2im' || data.action === 'image_gen' || data.action === 'text2im';
            const isMathTool = data.name === 'calculate' || data.action === 'calculate';
            
            if (isImageTool) {
                let args = data.arguments || data.args || data.action_input || data.parameters || data;
                if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e) { args = { prompt: args }; } }
                const prompt = cleanPrompt(args);
                toolCalls.push({ name: 'generate_image', args: { ...args, prompt } });
                jsonStringsToStrip.push(obj.raw);
            } else if (isMathTool) {
                let args = data.arguments || data.args || data.action_input || data.parameters || data;
                if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e) { args = { expression: args }; } }
                toolCalls.push({ name: 'calculate', args: { expression: args.expression || (typeof args === 'string' ? args : "") } });
                jsonStringsToStrip.push(obj.raw);
            }
        }

        const formalToolCalls = responseParts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);
        for (const ftc of formalToolCalls) {
            if (ftc.name === 'generate_image') {
                const prompt = cleanPrompt(ftc.args);
                toolCalls.push({ name: 'generate_image', args: { ...ftc.args, prompt } });
            } else if (ftc.name === 'calculate') {
                toolCalls.push({ name: 'calculate', args: { expression: ftc.args.expression } });
            }
        }

        // 6. Finalize output
        let cleanedText = textPartsRaw;
        for (const s of jsonStringsToStrip) cleanedText = cleanedText.replace(s, "");
        cleanedText = cleanedText.replace(/```json\s*```/g, "").replace(/```\s*```/g, "").trim();

        const allAttachments: any[] = [];
        let finalDisplayContent = cleanedText;

        if (toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
                if (toolCall.name === 'generate_image') {
                    const { prompt: imgPrompt, source_image } = toolCall.args;
                    let activeContext: any[] = [];
                    
                    if (source_image && aliasRegistry[source_image]) {
                        try {
                            const buffer = await fs.readFile(aliasRegistry[source_image].path);
                            activeContext = [{ inlineData: { data: buffer.toString('base64'), mimeType: 'image/png' } }];
                        } catch (e) {}
                    }
                    if (activeContext.length === 0) {
                        activeContext = currentMessageAttachments.length > 0 ? currentMessageAttachments : (Object.values(aliasRegistry).length > 0 ? [{ inlineData: { data: (await fs.readFile(Object.values(aliasRegistry).pop()!.path)).toString('base64'), mimeType: 'image/png' } }] : []);
                    }

                    const result = await this.performImageModelHandoff(conversationId, cleanPrompt(imgPrompt), 1, activeContext);
                    if (result && result.markdown) {
                        allAttachments.push(...(result.attachments || []));
                        finalDisplayContent += (finalDisplayContent ? "\n\n" : "") + result.markdown;
                    }
                } else if (toolCall.name === 'calculate') {
                    const { expression } = toolCall.args;
                    try {
                        const evalResult = eval(expression.replace(/[^0-9+\-*/().\s]/g, ''));
                        finalDisplayContent += (finalDisplayContent ? "\n\n" : "") + `The result of ${expression} is **${evalResult}**.`;
                    } catch (e) {}
                }
            }
        }

        // Post-process ALL content to resolve aliases and strip lingering metadata
        for (const [alias, meta] of Object.entries(aliasRegistry)) {
            const md = `![Image](${this.getImageUrl(meta.filename)})`;
            // Boundary-aware alias replacement
            const regex = new RegExp("\\b" + alias + "\\b", "g");
            finalDisplayContent = finalDisplayContent.replace(regex, md);
            // Aggressive strip of context markers (including any hallucinatory formatting)
            const contextRegex = new RegExp("\\[Context:\\s*Image\\s*" + alias + "\\]", "gi");
            finalDisplayContent = finalDisplayContent.replace(contextRegex, "");
        }
        
        // Final cleanup of extra whitespace/newlines from stripped tags
        finalDisplayContent = finalDisplayContent.replace(/\n\s*\n\s*\n/g, "\n\n").trim();

        const res = await pool.query("INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id", [conversationId, 'model', finalDisplayContent || "No response received."]);
        const messageId = res.rows[0].id;
        for (const att of allAttachments) {
            await pool.query("INSERT INTO attachments (message_id, conversation_id, file_name, file_path, file_type, file_size) VALUES ($1, $2, $3, $4, $5, $6)", [messageId, conversationId, att.file_name, att.file_path, att.file_type, att.file_size]);
        }
        await pool.query("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [conversationId]);
        return { response: finalDisplayContent || "No response received.", attachments: allAttachments, id: messageId };

    } catch (error) {
        console.error("[ChatService] FATAL Error:", error);
        throw error;
    }
  }

  private async performImageModelHandoff(conversationId: string, prompt: string, count: number, lastImageContext: any[] = []) {
    try {
        const ai = await this.getAI();
        const imageModelId = 'gemini-2.5-flash-image';
        const internalCleanedPrompt = prompt.replace(/\{[\s\S]*\}/g, (match) => {
            try { const p = JSON.parse(match); return p.prompt || p.description || match; } catch(e) { return match; }
        }).trim();

        const result = await ai.models.generateContent({
            model: imageModelId,
            contents: [{ 
                role: 'user', 
                parts: [
                    ...lastImageContext, 
                    { text: lastImageContext.length > 0 ? `Modify context based on: ${internalCleanedPrompt}. Single image.` : `Generate image: ${internalCleanedPrompt}.` } 
                ] 
            }]
        });
        
        const imagePart = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        if (imagePart) {
            const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
            const filename = `gen-${uuidv4()}.png`;
            const uploadDir = path.resolve(process.env.STORAGE_PATH || './storage_data', 'chat_uploads');
            const filePath = path.join(uploadDir, filename);
            await fs.writeFile(filePath, buffer);
            
            const att = { file_name: filename, file_path: filePath, file_type: imagePart.inlineData.mimeType, file_size: buffer.length };
            const markdown = `![Generated Image](${this.getImageUrl(filename)})`;
            return { attachments: [att], markdown };
        }
    } catch (err) { console.error(`[ChatService] Handoff failed:`, err.message); }
    return null;
  }

  private async handleDirectImageGeneration(conversationId: string, modelId: string, prompt: string, lastImageContext: any[] = []) {
    try {
        const ai = await this.getAI();
        const internalCleanedPrompt = prompt.replace(/\{[\s\S]*\}/g, (match) => {
            try { const p = JSON.parse(match); return p.prompt || p.description || match; } catch(e) { return match; }
        }).trim();

        const result = await ai.models.generateContent({
            model: modelId,
            contents: [{ 
                role: 'user', 
                parts: [
                    ...lastImageContext, 
                    { text: lastImageContext.length > 0 ? `Modify: ${internalCleanedPrompt}. Single image.` : `Generate image: ${internalCleanedPrompt}.` }
                ] 
            }]
        });
        
        const imagePart = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        if (imagePart) {
            const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
            const filename = `gen-${uuidv4()}.png`;
            const uploadDir = path.resolve(process.env.STORAGE_PATH || './storage_data', 'chat_uploads');
            const filePath = path.join(uploadDir, filename);
            await fs.writeFile(filePath, buffer);
            
            const att = { file_name: filename, file_path: filePath, file_type: imagePart.inlineData.mimeType, file_size: buffer.length };
            const markdown = `![Generated Image](${this.getImageUrl(filename)})`;
            const res = await pool.query("INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id", [conversationId, 'model', markdown]);
            const messageId = res.rows[0].id;
            await pool.query("INSERT INTO attachments (message_id, conversation_id, file_name, file_path, file_type, file_size) VALUES ($1, $2, $3, $4, $5, $6)", [messageId, conversationId, att.file_name, att.file_path, att.file_type, att.file_size]);
            return { response: markdown, attachments: [att], id: messageId };
        }
    } catch (err) { console.error(`[ChatService] Direct failed:`, err.message); }
    const failMsg = "Image generation failed.";
    const res = await pool.query("INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id", [conversationId, 'model', failMsg]);
    return { response: failMsg, attachments: [], id: res.rows[0].id };
  }

  async deleteConversation(conversationId: string, userId: string) {
    const attRes = await pool.query("SELECT file_path FROM attachments WHERE conversation_id = $1", [conversationId]);
    for (const row of attRes.rows) {
      try { await fs.unlink(row.file_path); } catch (e) {}
    }
    await pool.query("DELETE FROM conversations WHERE id = $1 AND user_id = $2", [conversationId, userId]);
  }
}

export const chatService = new ChatService();
