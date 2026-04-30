'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X, Send, Loader2, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  action?: {
    id: string;
    route: string | null;
    selector: string | null;
    sidebarAccordion: string | null;
  } | null;
}

type HighlightState = {
  selector: string;
  active: boolean;
};

// ─── Highlight Engine ──────────────────────────────────────────────────────────
// Injects a pulsing highlight ring on a DOM element identified by a CSS selector
function applyHighlight(selector: string): (() => void) | null {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const prev = el.style.cssText;
  el.classList.add('ai-assistant-highlight');

  // cleanup fn
  return () => {
    el.classList.remove('ai-assistant-highlight');
    el.style.cssText = prev;
  };
}

// ─── Suggested questions ──────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Come aggiungo un familiare?',
  'Dove trovo le notifiche?',
  'Come vedo le spese?',
  'Dove gestisco le iscrizioni?',
  'Come uscire dall\'app?',
  'Come aggiungo un evento al calendario?',
  'Come registro le presenze?',
  'Come verifico un pagamento?',
];

// ─── Main component ───────────────────────────────────────────────────────────
export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState<HighlightState | null>(null);
  const [hasBounced, setHasBounced] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cleanupHighlightRef = useRef<(() => void) | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Attention bounce after 5 seconds if never opened
  useEffect(() => {
    if (hasBounced) return;
    const timer = setTimeout(() => setHasBounced(true), 5000);
    return () => clearTimeout(timer);
  }, [hasBounced]);

  // Clean up highlight on unmount or route change
  useEffect(() => {
    return () => {
      cleanupHighlightRef.current?.();
      cleanupHighlightRef.current = null;
    };
  }, [pathname]);

  const removeHighlight = useCallback(() => {
    cleanupHighlightRef.current?.();
    cleanupHighlightRef.current = null;
    setHighlight(null);
  }, []);

  const triggerHighlight = useCallback((selector: string) => {
    removeHighlight();
    // slight delay to let navigation complete
    setTimeout(() => {
      const cleanup = applyHighlight(selector);
      if (cleanup) {
        cleanupHighlightRef.current = cleanup;
        setHighlight({ selector, active: true });
        // Auto-remove after 6 seconds
        setTimeout(removeHighlight, 6000);
      }
    }, 600);
  }, [removeHighlight]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    removeHighlight();

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, currentRoute: pathname }),
      });

      const data = await res.json();

      const assistantMsg: Message = {
        role: 'assistant',
        text: data.reply ?? 'Scusa, non ho ricevuto una risposta valida.',
        action: data.action ?? null,
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Handle navigation + highlight
      if (data.action) {
        const { route, selector, sidebarAccordion } = data.action;

        // Open sidebar accordion if needed
        if (sidebarAccordion) {
          window.dispatchEvent(
            new CustomEvent('assistant:open-accordion', { detail: { id: sidebarAccordion } })
          );
        }

        // Navigate if needed
        if (route && route !== pathname) {
          router.push(route);
          if (selector) triggerHighlight(selector);
        } else if (selector) {
          triggerHighlight(selector);
        }
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: 'Errore di connessione. Controlla la rete e riprova.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, pathname, removeHighlight, router, triggerHighlight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        text: 'Ciao! 👋 Sono l\'assistente di AC Chiari. Come posso aiutarti?',
      }]);
    }
  };

  return (
    <>
      {/* ── Global highlight CSS ── */}
      <style>{`
        @keyframes ai-pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0.7), 0 0 0 0 rgba(59,130,246,0.3); }
          50%  { box-shadow: 0 0 0 8px rgba(59,130,246,0.0), 0 0 0 16px rgba(59,130,246,0.0); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.7), 0 0 0 0 rgba(59,130,246,0.3); }
        }
        @keyframes ai-bounce-fab {
          0%, 100% { transform: translateY(0); }
          30%       { transform: translateY(-8px); }
          50%       { transform: translateY(-4px); }
          70%       { transform: translateY(-8px); }
        }
        .ai-assistant-highlight {
          outline: 2.5px solid #3b82f6 !important;
          outline-offset: 3px !important;
          border-radius: 8px !important;
          animation: ai-pulse-ring 1.2s ease-in-out 4 !important;
          position: relative;
          z-index: 9999;
        }
        .ai-fab-bounce {
          animation: ai-bounce-fab 0.9s ease-in-out;
        }
      `}</style>

      {/* ── FAB Button ── */}
      {!open && (
        <button
          id="ai-assistant-fab"
          aria-label="Apri assistente AI"
          onClick={handleOpen}
          className={cn(
            'fixed bottom-6 right-6 z-50',
            'w-16 h-16 rounded-full overflow-hidden',
            'bg-white',
            'shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/60',
            'flex items-center justify-center',
            'hover:scale-110 active:scale-95 transition-transform duration-200',
            hasBounced && 'ai-fab-bounce'
          )}
        >
          <Image src="/assistant-walle.png" alt="Assistente" width={64} height={64} className="w-full h-full object-cover animate-robot-idle" />
        </button>
      )}

      {/* ── Chat Panel ── */}
      {open && (
        <div
          id="ai-assistant-panel"
          className={cn(
            'fixed bottom-6 right-6 z-50',
            'w-[360px] max-w-[calc(100vw-2rem)]',
            'flex flex-col',
            'rounded-2xl overflow-hidden',
            'shadow-2xl shadow-black/20',
            'border border-border',
            'bg-card',
            'transition-all duration-300',
          )}
          style={{ height: '520px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white/30 shrink-0">
              <Image src="/assistant-walle.png" alt="Sam" width={36} height={36} className="w-full h-full object-cover animate-robot-idle" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none">Assistente AC Chiari</p>
              <p className="text-[11px] text-blue-100 mt-0.5">Pronto ad aiutarti 🤓</p>
            </div>
            <button
              onClick={() => { setOpen(false); removeHighlight(); }}
              aria-label="Chiudi assistente"
              className="p-1 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-muted/20">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden ring-1 ring-blue-200 mt-0.5">
                    <Image src="/assistant-walle.png" alt="Sam" width={32} height={32} className="w-full h-full object-cover" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-card border border-border text-foreground rounded-tl-sm shadow-sm'
                  )}
                >
                  {msg.text}
                  {msg.action?.selector && (
                    <button
                      onClick={() => {
                        if (msg.action?.selector) triggerHighlight(msg.action.selector);
                      }}
                      className="flex items-center gap-1 mt-2 text-[11px] text-blue-500 hover:text-blue-600 font-medium transition-colors"
                    >
                      <ChevronDown className="h-3 w-3 animate-bounce" />
                      Mostrami dove
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-blue-200 mt-0.5 shrink-0">
                  <Image src="/assistant-walle.png" alt="Sam" width={32} height={32} className="w-full h-full object-cover" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions (shown only before first user message) */}
          {messages.filter(m => m.role === 'user').length === 0 && !loading && (
            <div className="px-3 pb-2 shrink-0">
              <p className="text-[11px] text-muted-foreground mb-1.5 px-1">Domande frequenti:</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className={cn(
                      'text-[11px] px-2.5 py-1 rounded-full border border-border',
                      'bg-background hover:bg-accent hover:text-accent-foreground',
                      'transition-colors duration-150 text-muted-foreground'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 shrink-0 border-t border-border bg-card">
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 border border-border focus-within:ring-2 focus-within:ring-blue-500/30 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Scrivi una domanda..."
                disabled={loading}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                aria-label="Invia messaggio"
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150',
                  input.trim() && !loading
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active highlight indicator ── */}
      {highlight?.active && (
        <div className="fixed bottom-28 right-6 z-50 flex items-center gap-2 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          Elemento evidenziato
          <button onClick={removeHighlight} className="ml-1 hover:text-blue-200">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </>
  );
}
