import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './ChatApp.css';

interface Message {
    id: string;
    role: 'user' | 'model' | 'system';
    content: string;
    created_at: string;
    attachments?: Attachment[];
}

interface Attachment {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
}

interface Conversation {
    id: string;
    title: string;
    model: string;
    updated_at: string;
}

const AVAILABLE_MODELS = [
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Preview)' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image (Preview)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
];

export default function ChatApp({ token, onLogout }: { token: string, onLogout: () => void }) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        if (currentConversation) {
            fetchMessages(currentConversation.id);
        } else {
            setMessages([]);
        }
    }, [currentConversation]);

    useEffect(scrollToBottom, [messages]);

    const fetchConversations = async () => {
        const res = await fetch('/api/chat/conversations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401 || res.status === 403) return onLogout();
        const data = await res.json();
        if (Array.isArray(data)) setConversations(data);
    };

    const fetchMessages = async (id: string) => {
        const res = await fetch(`/api/chat/conversations/${id}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401 || res.status === 403) return onLogout();
        const data = await res.json();
        if (Array.isArray(data)) setMessages(data);
    };

    const handleCreateConversation = async () => {
        setCurrentConversation(null);
        setMessages([]);
        const title = prompt('Enter conversation title:');
        if (!title) return;

        const res = await fetch('/api/chat/conversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title, model: selectedModel })
        });
        if (res.status === 401 || res.status === 403) return onLogout();
        const newConv = await res.json();
        setConversations([newConv, ...conversations]);
        setCurrentConversation(newConv);
    };

    const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this conversation?')) return;

        await fetch(`/api/chat/conversations/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        setConversations(conversations.filter(c => c.id !== id));
        if (currentConversation?.id === id) setCurrentConversation(null);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && attachedFiles.length === 0) || !currentConversation || loading) return;

        const formData = new FormData();
        formData.append('content', input);
        attachedFiles.forEach(file => {
            formData.append('files', file);
        });

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            created_at: new Date().toISOString(),
            attachments: attachedFiles.map(f => ({
                id: Math.random().toString(),
                file_name: f.name,
                file_type: f.type,
                file_size: f.size
            }))
        };

        setMessages([...messages, userMessage]);
        setInput('');
        setAttachedFiles([]);
        setLoading(true);

        try {
            const res = await fetch(`/api/chat/conversations/${currentConversation.id}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.status === 401 || res.status === 403) return onLogout();
            
            // Refresh messages to get the real ones with attachments and IDs
            await fetchMessages(currentConversation.id);
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachedFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
        }
    };

    const removeFile = (index: number) => {
        setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
    };

    return (
        <div className={`chat-app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <aside className="chat-sidebar">
                <div className="sidebar-header">
                    <button className="new-chat-btn" onClick={handleCreateConversation}>
                        + New Chat
                    </button>
                </div>
                
                <div className="model-selector-container">
                    <label>Default Model:</label>
                    <select 
                        value={selectedModel} 
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="model-select"
                    >
                        {AVAILABLE_MODELS.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                <div className="conversation-list">
                    {conversations.map(conv => (
                        <div 
                            key={conv.id} 
                            className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`}
                            onClick={() => setCurrentConversation(conv)}
                        >
                            <span className="conv-title">{conv.title}</span>
                            <span className="conv-model-badge">
                                {conv.model?.includes('flash') ? 'Flash' : 'Pro'}
                            </span>
                            <button className="delete-conv-btn" onClick={(e) => handleDeleteConversation(conv.id, e)}>×</button>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="chat-main">
                <button className="collapse-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                    {sidebarCollapsed ? '»' : '«'}
                </button>
                {currentConversation ? (
                    <>
                        <header className="chat-header">
                            <div className="chat-header-info">
                                <h2>{currentConversation.title}</h2>
                                <span className="current-model-info">{currentConversation.model}</span>
                            </div>
                        </header>

                        <div className="messages-container">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                                    <div className="message-content">
                                        <div className="message-role">{msg.role === 'user' ? 'You' : 'Gemini'}</div>
                                        <div className="message-text">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className="message-attachments">
                                                {msg.attachments.map(att => (
                                                    <div key={att.id} className="attachment-item">
                                                        {att.file_type.startsWith('image/') ? (
                                                            <div className="image-attachment-wrapper">
                                                                <img 
                                                                    src={`/uploads/${att.file_name}`} 
                                                                    alt={att.file_name} 
                                                                    className="message-image" 
                                                                    onClick={() => window.open(`/uploads/${att.file_name}`, '_blank')}
                                                                />
                                                                <div className="image-info">
                                                                    {att.file_name} ({Math.round(att.file_size / 1024)}KB)
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="attachment-badge">
                                                                📎 {att.file_name} ({Math.round(att.file_size / 1024)}KB)
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="message-wrapper model">
                                    <div className="message-content">
                                        <div className="message-role">Gemini</div>
                                        <div className="typing-indicator">
                                            <span></span><span></span><span></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <footer className="chat-footer">
                            {attachedFiles.length > 0 && (
                                <div className="attachment-previews">
                                    {attachedFiles.map((file, i) => (
                                        <div key={i} className="file-preview">
                                            <span>{file.name}</span>
                                            <button onClick={() => removeFile(i)}>×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <form className="chat-input-form" onSubmit={handleSendMessage}>
                                <button 
                                    type="button" 
                                    className="attach-btn" 
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Attach files (Image, Video, Audio, Document)"
                                >
                                    📎
                                </button>
                                <input 
                                    type="file" 
                                    multiple 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    style={{ display: 'none' }}
                                    accept="image/*,video/*,audio/*,application/pdf,text/*"
                                />
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Type your message..."
                                    disabled={loading}
                                />
                                <button type="submit" className="send-btn" disabled={loading || (!input.trim() && attachedFiles.length === 0)}>
                                    Send
                                </button>
                            </form>
                        </footer>
                    </>
                ) : (
                    <div className="no-conversation">
                        <h3>Select a conversation or create a new one to start chatting</h3>
                        <button className="new-chat-btn large" onClick={handleCreateConversation}>
                            Start New Conversation
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
