'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil, Send, X } from 'lucide-react';
import styles from './index.module.css';

type ChatMessage = {
  id: number;
  author: string;
  message: string;
  sentAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onMessage?: () => void;
};

const NAME_KEY = 'podhomme_chat_name';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ChatDrawer({ open, onClose, onMessage }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load name from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(NAME_KEY) ?? '';
    setName(stored);
    if (!stored) setEditingName(true);
  }, []);

  // Fetch message history when drawer opens
  useEffect(() => {
    if (!open) return;
    fetch('/api/chat')
      .then((r) => r.json())
      .then(setMessages);
  }, [open]);

  // Listen for incoming chat SSE events
  const openRef = useRef(open);
  openRef.current = open;
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  useEffect(() => {
    const source = new EventSource('/api/events');
    source.addEventListener('chat', (e) => {
      const msg = JSON.parse(e.data) as ChatMessage;
      setMessages((prev) => [...prev.slice(-49), msg]);
      if (!openRef.current) onMessageRef.current?.();
    });
    return () => source.close();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open && name) inputRef.current?.focus();
  }, [open, name]);

  function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    localStorage.setItem(NAME_KEY, trimmed);
    setName(trimmed);
    setEditingName(false);
    inputRef.current?.focus();
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !name || sending) return;
    setSending(true);
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: name, message: text }),
    });
    setInput('');
    setSending(false);
    inputRef.current?.focus();
  }

  return (
    <aside className={`${styles.drawer} ${open ? styles.open : ''}`}>
      <div className={styles.inner} aria-label="Chat">
        <div className={styles.header}>
          <span className={styles.title}>Chat</span>
          <button
            className="btn-icon"
            onClick={onClose}
            aria-label="Close chat"
          >
            <X size={16} />
          </button>
        </div>

        {/* Name bar */}
        <div className={styles.nameBar}>
          {editingName ? (
            <form
              className={styles.nameForm}
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
              }}
            >
              <input
                className="input"
                placeholder="Your name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={50}
                autoFocus
                autoComplete="off"
                data-1p-ignore
              />
              <button type="submit" className="btn-primary text-xs px-2 py-1">
                OK
              </button>
            </form>
          ) : (
            <div className={styles.nameDisplay}>
              <span className={styles.nameLabel}>
                Chatting as <strong>{name}</strong>
              </span>
              <button
                className="btn-icon"
                onClick={() => {
                  setNameInput(name);
                  setEditingName(true);
                }}
                aria-label="Edit name"
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Message list */}
        <div className={styles.messages}>
          {messages.length === 0 && (
            <p className={styles.empty}>No messages yet. Say something!</p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.message} ${msg.author === name ? styles.mine : ''}`}
            >
              <div className={styles.meta}>
                <span className={styles.author}>{msg.author}</span>
                <span className={styles.time}>{formatTime(msg.sentAt)}</span>
              </div>
              <div className={styles.bubble}>{msg.message}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form className={styles.inputRow} onSubmit={sendMessage}>
          <input
            ref={inputRef}
            className="input"
            placeholder={name ? 'Say something…' : 'Set a name above first'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            disabled={!name || editingName}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn-primary p-2"
            disabled={!input.trim() || !name || sending}
            aria-label="Send"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </aside>
  );
}
