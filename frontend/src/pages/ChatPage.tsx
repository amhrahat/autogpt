import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiClient, errorMessage, type ChatMessage, type Conversation, type Provider } from '../api';
import Nav from '../components/Nav';

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState(''); // '' = default
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  async function loadConversations() {
    const data = await apiClient.listConversations();
    setConversations(data.items);
    return data.items;
  }

  async function loadProviders() {
    const list = await apiClient.listProviders();
    setProviders(list.filter((p) => p.isEnabled));
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadConversations();
        await loadProviders();
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo(0, threadRef.current.scrollHeight);
  }, [messages]);

  async function openConversation(id: string) {
    setActiveId(id);
    setError('');
    try {
      const data = await apiClient.getMessages(id);
      setMessages(data.items);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    setInput('');
    try {
      const reply = await apiClient.sendMessage(content, activeId ?? undefined, providerId || undefined);
      // refresh the thread with the persisted pair
      if (!activeId) setActiveId(reply.conversationId);
      const data = await apiClient.getMessages(reply.conversationId);
      setMessages(data.items);
      await loadConversations();
    } catch (err) {
      setError(errorMessage(err));
      setInput(content); // restore the draft so the user can retry
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteConversation(id: string) {
    if (!confirm('Delete this conversation?')) return;
    try {
      await apiClient.deleteConversation(id);
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      await loadConversations();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function startRename(c: Conversation) {
    setRenamingId(c.id);
    setRenameValue(c.title);
  }

  async function handleRenameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!renamingId || !renameValue.trim()) return;
    try {
      await apiClient.renameConversation(renamingId, renameValue.trim());
      setRenamingId(null);
      await loadConversations();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <Nav />
      <div className="chat-layout">
        <aside className="chat-sidebar">
          <h2>Conversations</h2>
          <ul className="list">
            {conversations.map((c) => (
              <li
                key={c.id}
                className={`list-item clickable ${activeId === c.id ? 'active' : ''}`}
                onClick={() => void openConversation(c.id)}
              >
                {renamingId === c.id ? (
                  <form onSubmit={handleRenameSubmit} className="rename-form">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => setRenamingId(null)}
                    />
                    <button type="submit">✓</button>
                  </form>
                ) : (
                  <div className="list-main">
                    <span>{c.title}</span>
                    <span className="muted small">{c._count?.messages ?? 0} msgs</span>
                  </div>
                )}
                <span className="row-actions">
                  <button
                    type="button"
                    className="btn-link"
                    onClick={(e) => { e.stopPropagation(); startRename(c); }}
                  >
                    rename
                  </button>
                  <button
                    type="button"
                    className="btn-link danger-text"
                    onClick={(e) => { e.stopPropagation(); void handleDeleteConversation(c.id); }}
                  >
                    delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {conversations.length === 0 && <p className="page-note small">No conversations yet.</p>}
        </aside>

        <main className="chat-main">
          <div className="chat-toolbar">
            <label>
              Provider:{' '}
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                <option value="">Default</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.model})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="thread" ref={threadRef}>
            {!activeId && <p className="page-note">Send a message to start a new conversation.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.role}`}>
                <div className="bubble-content">{m.content}</div>
                {m.model && <div className="bubble-meta">{m.model}</div>}
              </div>
            ))}
            {sending && <p className="page-note small">Thinking…</p>}
          </div>

          {error && <p className="error chat-error">{error}</p>}

          <form className="chat-input" onSubmit={handleSend}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={activeId ? 'Message…' : 'New conversation…'}
              disabled={sending}
            />
            <button type="submit" disabled={sending || !input.trim()}>
              Send
            </button>
          </form>
        </main>
      </div>
    </>
  );
}
