import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './ChatApp.css';

interface Conversation {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

interface Message {
    id: string;
    role: 'user' | 'model' | 'system';
    content: string;
    created_at: string;
}

interface ChatAppProps {
    token: string | null;
}

const ChatApp: React.FC<ChatAppProps> = ({ token }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchConversations = async () => {
        try {
            const res = await fetch('/api/chat/conversations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                setConversations(data);
            } else {
                console.error("Failed to fetch conversations:", data.error || "Unknown error");
                setConversations([]);
            }
        } catch (err) {
            console.error("Failed to fetch conversations", err);
            setConversations([]);
        }
    };

    const fetchMessages = async (id: string) => {
        try {
            const res = await fetch(`/api/chat/conversations/${id}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                setMessages(data);
            } else {
                console.error("Failed to fetch messages:", data.error || "Unknown error");
                setMessages([]);
            }
        } catch (err) {
            console.error("Failed to fetch messages", err);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, [token]);

    useEffect(() => {
        if (currentConversation) {
            fetchMessages(currentConversation.id);
        } else {
            setMessages([]);
        }
    }, [currentConversation]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleCreateConversation = async () => {
        const title = prompt('Enter conversation title:', 'New Chat');
        if (!title) return;

        try {
            const res = await fetch('/api/chat/conversations', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title })
            });
            const newConv = await res.json();
            setConversations([newConv, ...conversations]);
            setCurrentConversation(newConv);
        } catch (err) {
            console.error("Failed to create conversation", err);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !currentConversation || loading) return;

        const userMsg = input;
        setInput('');
        setLoading(true);

        // Optimistic update
        const tempId = Date.now().toString();
        setMessages([...messages, { id: tempId, role: 'user', content: userMsg, created_at: new Date().toISOString() }]);

        try {
            const res = await fetch(`/api/chat/conversations/${currentConversation.id}/messages`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: userMsg })
            });
            
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to send message");
            }

            // Refresh messages to get the real ones with IDs
            await fetchMessages(currentConversation.id);
        } catch (err: any) {
            alert(err.message);
            // Rollback optimistic update
            setMessages(prev => prev.filter(m => m.id !== tempId));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this conversation?')) return;

        try {
            await fetch(`/api/chat/conversations/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setConversations(conversations.filter(c => c.id !== id));
            if (currentConversation?.id === id) {
                setCurrentConversation(null);
            }
        } catch (err) {
            console.error("Failed to delete conversation", err);
        }
    };

    return (
        <div className="chat-container">
            <aside className={`chat-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <button className="btn btn-new" onClick={handleCreateConversation}>+ New Chat</button>
                    <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? '«' : '»'}
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
                            <button className="btn-delete" onClick={(e) => handleDeleteConversation(conv.id, e)}>×</button>
                        </div>
                    ))}
                </div>
                <div className="sidebar-footer">
                    <div className="placeholder-settings">Settings & Preferences (MVP)</div>
                </div>
            </aside>

            <main className="chat-main">
                {!currentConversation ? (
                    <div className="chat-welcome">
                        <h1>Gemini Chat</h1>
                        <p>Select a conversation or create a new one to start chatting.</p>
                        <button className="btn" onClick={handleCreateConversation}>Start New Chat</button>
                    </div>
                ) : (
                    <>
                        <header className="chat-header">
                            <h2>{currentConversation.title}</h2>
                        </header>
                        <div className="chat-messages">
                            {messages.map(msg => (
                                <div key={msg.id} className={`message ${msg.role}`}>
                                    <div className="message-content">
                                        <div className="message-role">{msg.role === 'user' ? 'You' : 'Gemini'}</div>
                                        <div className="message-text">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="message model loading">
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
                        <form className="chat-input-form" onSubmit={handleSendMessage}>
                            <input 
                                type="text" 
                                value={input} 
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type a message..."
                                disabled={loading}
                            />
                            <button type="submit" className="btn btn-send" disabled={loading || !input.trim()}>
                                Send
                            </button>
                        </form>
                    </>
                )}
            </main>
        </div>
    );
};

export default ChatApp;
