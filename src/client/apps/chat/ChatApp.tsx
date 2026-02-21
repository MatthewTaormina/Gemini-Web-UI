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
    { id: 'gemini-3.1-pro-preview', name: '3.1 Pro', description: 'Advanced reasoning (Latest)' },
    { id: 'gemini-3-pro-preview', name: '3 Pro', description: 'Core capabilities' },
    { id: 'gemini-3-flash-preview', name: '3 Flash', description: 'Speed optimized' },
    { id: 'gemini-2.5-pro', name: '2.5 Pro', description: 'Stable performance' },
    { id: 'gemini-2.5-flash', name: '2.5 Flash', description: 'Fastest stable' },
    { id: 'gemini-2.5-flash-image', name: '2.5 Image', description: 'Native image generation' },
    { id: 'gemini-2.0-flash-exp-image-generation', name: '2.0 Image (Exp)', description: 'Experimental image model' },
    { id: 'gemini-3-pro-image-preview', name: '3 Pro Image', description: 'High quality image generation' },
];

const SUGGESTIONS = [
    { text: 'Create an image of a futuristic city', icon: '✨', prompt: 'Generate an image of a futuristic city with flying cars and neon lights' },
    { text: 'Help me write a professional email', icon: '📧', prompt: 'Help me write a professional email to my manager requesting a meeting' },
    { text: 'Explain quantum physics simply', icon: '🔬', prompt: 'Explain quantum physics to me like I am five' },
    { text: 'Suggest some healthy dinner ideas', icon: '🥗', prompt: 'Suggest some healthy dinner ideas for a busy weeknight' },
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
    const [previews, setPreviews] = useState<string[]>([]);
    const [enabledTools, setEnabledTools] = useState<string[]>(['generate_image', 'math']);
    const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        if (currentConversation) {
            fetchMessages(currentConversation.id);
            setSelectedModel(currentConversation.model);
        } else {
            setMessages([]);
        }
    }, [currentConversation]);

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    const fetchConversations = async () => {
        const res = await fetch('/api/chat/conversations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401 || res.status === 403) return onLogout();
        const data = await res.json();
        if (Array.isArray(data)) {
            setConversations(data);
            // If we have a current conversation, update its title in the state
            if (currentConversation) {
                const updated = data.find((c: Conversation) => c.id === currentConversation.id);
                if (updated && updated.title !== currentConversation.title) {
                    setCurrentConversation(updated);
                }
            }
        }
    };

    const fetchMessages = async (id: string) => {
        const res = await fetch(`/api/chat/conversations/${id}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401 || res.status === 403) return onLogout();
        const data = await res.json();
        if (Array.isArray(data)) setMessages(data);
    };

    const handleUpdateModel = async (model: string) => {
        if (!currentConversation) return;
        const res = await fetch(`/api/chat/conversations/${currentConversation.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ model })
        });
        if (res.ok) {
            const updated = await res.json();
            setConversations(conversations.map(c => c.id === updated.id ? updated : c));
            setCurrentConversation(updated);
            setSelectedModel(model);
        }
    };

    const handleCreateConversation = async (title?: string) => {
        const res = await fetch('/api/chat/conversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                title: title || 'New Conversation', 
                model: selectedModel 
            })
        });
        if (res.status === 401 || res.status === 403) return onLogout();
        const newConv = await res.json();
        setConversations([newConv, ...conversations]);
        setCurrentConversation(newConv);
        return newConv;
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

    const toggleTool = (toolId: string) => {
        setEnabledTools(prev => 
            prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId]
        );
    };

    const handleSendMessage = async (e?: React.FormEvent, customInput?: string) => {
        if (e) e.preventDefault();
        
        const messageText = customInput || input;
        if ((!messageText.trim() && attachedFiles.length === 0) || loading) return;

        let activeConv = currentConversation;
        if (!activeConv) {
            activeConv = await handleCreateConversation('New Conversation');
        }

        const formData = new FormData();
        formData.append('content', messageText);
        enabledTools.forEach(tool => {
            formData.append('tools', tool);
        });
        attachedFiles.forEach(file => {
            formData.append('files', file);
        });

        // Optimistic update
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
            created_at: new Date().toISOString(),
            attachments: attachedFiles.map(f => ({
                id: Math.random().toString(),
                file_name: f.name,
                file_type: f.type,
                file_size: f.size
            }))
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setAttachedFiles([]);
        setPreviews([]);
        setLoading(true);

        try {
            const res = await fetch(`/api/chat/conversations/${activeConv!.id}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.status === 401 || res.status === 403) return onLogout();
            
            // Refresh messages to get the real ones with attachments and IDs
            await fetchMessages(activeConv!.id);
            
            // Refresh conversations to get updated titles
            await fetchConversations();
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setAttachedFiles(prev => [...prev, ...newFiles]);
            
            newFiles.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        setPreviews(prev => [...prev, reader.result as string]);
                    };
                    reader.readAsDataURL(file);
                } else {
                    setPreviews(prev => [...prev, '']);
                }
            });
        }
    };

    const removeFile = (index: number) => {
        setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
        setPreviews(previews.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className={`chat-app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <aside className="chat-sidebar">
                <div className="sidebar-header">
                    <button className="new-chat-btn" onClick={() => setCurrentConversation(null)}>
                        <span className="plus-icon">+</span> New Chat
                    </button>
                </div>
                
                <div className="conversation-list">
                    {conversations.map(conv => (
                        <div 
                            key={conv.id} 
                            className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`}
                            onClick={() => setCurrentConversation(conv)}
                        >
                            <span className="conv-title">{conv.title}</span>
                            <button className="delete-conv-btn" onClick={(e) => handleDeleteConversation(conv.id, e)}>×</button>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="chat-main">
                <button className="collapse-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                    {sidebarCollapsed ? '›' : '‹'}
                </button>

                {currentConversation ? (
                    <>
                        <header className="chat-header">
                            <div className="chat-header-info">
                                <select 
                                    className="model-header-select"
                                    value={currentConversation.model}
                                    onChange={(e) => handleUpdateModel(e.target.value)}
                                >
                                    {AVAILABLE_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="chat-header-actions">
                                <button 
                                    className={`action-btn tools-btn ${enabledTools.length > 0 ? 'active' : ''}`}
                                    onClick={() => setIsToolsModalOpen(!isToolsModalOpen)}
                                >
                                    🛠️ Tools ({enabledTools.length})
                                </button>
                                {isToolsModalOpen && (
                                    <div className="tools-modal" style={{ top: '60px', bottom: 'auto', left: 'auto', right: '24px' }}>
                                        <div className="modal-header">
                                            <h3>Capabilities</h3>
                                            <button className="close-modal-btn" onClick={() => setIsToolsModalOpen(false)}>×</button>
                                        </div>
                                        <div className="tools-list">
                                            <div className={`tool-item ${enabledTools.includes('generate_image') ? 'enabled' : ''}`} onClick={() => toggleTool('generate_image')}>
                                                <span className="tool-icon">🖼️</span>
                                                <div className="tool-info">
                                                    <span className="tool-name">Images</span>
                                                    <span className="tool-desc">Generate AI images</span>
                                                </div>
                                                <input type="checkbox" checked={enabledTools.includes('generate_image')} readOnly className="tool-checkbox" />
                                            </div>
                                            <div className={`tool-item ${enabledTools.includes('math') ? 'enabled' : ''}`} onClick={() => toggleTool('math')}>
                                                <span className="tool-icon">🔢</span>
                                                <div className="tool-info">
                                                    <span className="tool-name">Math</span>
                                                    <span className="tool-desc">Solve complex math</span>
                                                </div>
                                                <input type="checkbox" checked={enabledTools.includes('math')} readOnly className="tool-checkbox" />
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                                                            </div>
                                                        ) : (
                                                            <div className="attachment-badge">
                                                                📎 {att.file_name}
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
                    </>
                ) : (
                    <div className="no-conversation">
                        <h1 className="landing-title">Where should we start?</h1>
                        <div className="suggestions-grid">
                            {SUGGESTIONS.map((s, i) => (
                                <div 
                                    key={i} 
                                    className="suggestion-pill"
                                    onClick={() => {
                                        setInput(s.prompt);
                                        textareaRef.current?.focus();
                                    }}
                                >
                                    <span className="suggestion-icon">{s.icon}</span>
                                    <span>{s.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <footer className="chat-footer">
                    <div className="chat-input-container">
                        {!currentConversation && (
                            <div className="model-pill-selector">
                                {AVAILABLE_MODELS.map(m => (
                                    <div 
                                        key={m.id} 
                                        className={`model-pill ${selectedModel === m.id ? 'active' : ''}`}
                                        onClick={() => setSelectedModel(m.id)}
                                    >
                                        {m.name}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {previews.length > 0 && (
                            <div className="attachment-previews">
                                {previews.map((preview, i) => (
                                    <div 
                                        key={i} 
                                        className="file-preview" 
                                        style={{ backgroundImage: preview ? `url(${preview})` : 'none', backgroundColor: preview ? 'transparent' : '#f1f3f4' }}
                                    >
                                        {!preview && <span style={{ fontSize: '20px' }}>📎</span>}
                                        <button className="file-preview-remove" onClick={() => removeFile(i)}>×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="chat-input-row">
                            <form className="chat-input-form" onSubmit={(e) => handleSendMessage(e)}>
                                <button 
                                    type="button" 
                                    className="action-btn" 
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Attach files"
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
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type your message..."
                                    rows={1}
                                    disabled={loading}
                                />
                                <button 
                                    type="submit" 
                                    className="action-btn send-btn" 
                                    disabled={loading || (!input.trim() && attachedFiles.length === 0)}
                                >
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                                    </svg>
                                </button>
                            </form>
                        </div>
                    </div>
                    <div className="footer-disclaimer">
                        Gemini is AI and can make mistakes.
                    </div>
                </footer>
            </main>
        </div>
    );
}
