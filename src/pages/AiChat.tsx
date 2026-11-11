import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Wand2,
  FileText,
  TrendingUp,
  Lightbulb,
  Code,
  Zap,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ChatMessage {
  id: number;
  role: 'user';
  content: string;
}

interface Conversation {
  id: number;
  title: string;
  messages: ChatMessage[];
}

interface PromptChip {
  label: string;
  icon: React.ReactNode;
  prefix: string;
}

const promptChips: PromptChip[] = [
  { label: 'Analisar', icon: <TrendingUp size={13} />, prefix: 'Analise detalhadamente: ' },
  { label: 'Criar', icon: <Lightbulb size={13} />, prefix: 'Crie para mim: ' },
  { label: 'Escrever', icon: <FileText size={13} />, prefix: 'Escreva um texto sobre: ' },
  { label: 'Código', icon: <Code size={13} />, prefix: 'Gere o código para: ' },
  { label: 'Resumir', icon: <Zap size={13} />, prefix: 'Resuma de forma clara: ' },
  { label: 'Melhorar', icon: <Wand2 size={13} />, prefix: 'Melhore o seguinte: ' },
];

export function AiChatPage() {
  const { t } = useTheme();

  const [conversations, setConversations] = useState<Conversation[]>([
    { id: 1, title: 'Novo chat', messages: [] },
  ]);
  const [activeConversationId, setActiveConversationId] = useState(1);
  const [draft, setDraft] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeChip, setActiveChip] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  );
  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeConversationId]);

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, [draft]);

  const startConversation = () => {
    const id = Date.now();
    setConversations((cur) => [
      { id, title: 'Novo chat', messages: [] },
      ...cur,
    ]);
    setActiveConversationId(id);
    setDraft('');
    setActiveChip(null);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !activeConversation) return;

    setConversations((cur) =>
      cur.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              title:
                c.messages.length === 0 ? content.slice(0, 40) : c.title,
              messages: [
                ...c.messages,
                { id: Date.now(), role: 'user', content },
              ],
            }
          : c,
      ),
    );
    setDraft('');
    setActiveChip(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const selectChip = (chip: PromptChip) => {
    if (activeChip === chip.label) {
      setActiveChip(null);
      setDraft('');
    } else {
      setActiveChip(chip.label);
      setDraft(chip.prefix);
      setTimeout(() => {
        const ta = inputRef.current;
        if (ta) {
          ta.focus();
          ta.selectionStart = ta.selectionEnd = chip.prefix.length;
        }
      }, 30);
    }
  };

  const clearChip = () => {
    setActiveChip(null);
    setDraft('');
    inputRef.current?.focus();
  };

  return (
    <div
      className="ai-chat-page"
      style={
        {
          '--chat-bg': t.bg,
          '--chat-panel': t.bgSecondary,
          '--chat-surface': t.surface,
          '--chat-border': t.border,
          '--chat-text': t.text,
          '--chat-secondary': t.textSecondary,
          '--chat-muted': t.textMuted,
          '--chat-accent': t.primary,
        } as React.CSSProperties
      }
    >
      {/* Sidebar */}
      <aside className={`ai-sidebar${sidebarOpen ? '' : ' collapsed'}`}>
        <div className="ai-sidebar-header">
          <button className="ai-sidebar-new" onClick={startConversation}>
            <Plus size={16} />
            {sidebarOpen && <span>Novo chat</span>}
          </button>
          <button
            className="ai-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Fechar barra lateral' : 'Abrir barra lateral'}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {sidebarOpen && (
          <>
            <div className="ai-sidebar-label">Conversas</div>
            <div className="ai-sidebar-list">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  className={`ai-sidebar-item${c.id === activeConversationId ? ' active' : ''}`}
                  onClick={() => setActiveConversationId(c.id)}
                  title={c.title}
                >
                  <MessageSquare size={14} />
                  <span>{c.title}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="ai-sidebar-footer">
          <span className="ai-sidebar-brand-icon">
            <Bot size={17} />
          </span>
          {sidebarOpen && (
            <div>
              <strong>Chok IA</strong>
              <span>Prévia</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <section className="ai-main">
        {/* Decorative blobs */}
        <div className="ai-main-bg">
          <div className="ai-blob ai-blob-1" />
          <div className="ai-blob ai-blob-2" />
          <div className="ai-blob ai-blob-3" />
        </div>

        <div className="ai-main-inner">
          {messages.length === 0 ? (
            <div className="ai-empty">
              <h1>Como posso ajudar?</h1>

              {/* Prompt chips */}
              <div className="ai-prompt-chips">
                {promptChips.map((chip) => (
                  <button
                    key={chip.label}
                    className={`ai-chip${activeChip === chip.label ? ' active' : ''}`}
                    onClick={() => selectChip(chip)}
                  >
                    {chip.icon}
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>

              {/* Composer (empty state — centered) */}
              <div className="ai-composer-wrap ai-composer-center">
                {activeChip && (
                  <div className="ai-chip-active-bar">
                    <Wand2 size={13} />
                    <span>{activeChip}</span>
                    <button onClick={clearChip} aria-label="Limpar modo">
                      <X size={13} />
                    </button>
                  </div>
                )}
                <form className="ai-composer" onSubmit={sendMessage}>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Descreva o que precisa…"
                    aria-label="Escreva seu prompt"
                  />
                  <button
                    type="submit"
                    className="ai-send"
                    disabled={!draft.trim()}
                    aria-label="Enviar"
                  >
                    <Send size={16} />
                  </button>
                </form>
                <p className="ai-disclaimer">
                  Chok IA · Prévia — IA ainda não conectada
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="ai-messages">
                {messages.map((m) => (
                  <div className="ai-msg" key={m.id}>
                    <div className="ai-msg-avatar">Você</div>
                    <p>{m.content}</p>
                  </div>
                ))}
                <div className="ai-msg-notice" role="status">
                  <Bot size={16} />
                  <span>IA ainda não conectada. Sua mensagem foi registrada.</span>
                </div>
                <div ref={messagesEndRef} />
              </div>

              {/* Composer (conversation state — bottom) */}
              <div className="ai-composer-wrap ai-composer-bottom">
                {/* Prompt chips inline */}
                <div className="ai-prompt-chips ai-prompt-chips-inline">
                  {promptChips.map((chip) => (
                    <button
                      key={chip.label}
                      className={`ai-chip ai-chip-sm${activeChip === chip.label ? ' active' : ''}`}
                      onClick={() => selectChip(chip)}
                    >
                      {chip.icon}
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>
                {activeChip && (
                  <div className="ai-chip-active-bar">
                    <Wand2 size={13} />
                    <span>{activeChip}</span>
                    <button onClick={clearChip} aria-label="Limpar modo">
                      <X size={13} />
                    </button>
                  </div>
                )}
                <form className="ai-composer" onSubmit={sendMessage}>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Descreva o que precisa…"
                    aria-label="Escreva seu prompt"
                  />
                  <button
                    type="submit"
                    className="ai-send"
                    disabled={!draft.trim()}
                    aria-label="Enviar"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}