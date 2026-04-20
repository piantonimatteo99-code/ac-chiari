'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'onboarding-tutorial-v2';

// ── Tipi ──────────────────────────────────────────────────────────────────────

type TooltipPosition = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-center';

interface TutorialStep {
  id: string;
  message: string;
  position?: TooltipPosition;
  /** Se presente, il tutorial attende che l'utente clicchi su questo elemento */
  waitForClick?: string; // CSS selector
  /** Evidenzia questo elemento */
  highlight?: string;
  /** Eseguito prima che lo step venga mostrato */
  onEnter?: () => void;
  /** Se true, lo step avanza automaticamente dopo onEnter */
  autoAdvance?: boolean;
  autoDelay?: number;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function getElementRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  return el ? el.getBoundingClientRect() : null;
}

// ── Tooltip posizionato ───────────────────────────────────────────────────────

interface TooltipProps {
  message: string;
  position: TooltipPosition;
  step: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  highlightRect?: DOMRect | null;
  waitingForClick?: boolean;
}

function TutorialTooltip({ message, position, step, total, onNext, onSkip, highlightRect, waitingForClick }: TooltipProps) {
  const isCenter = position === 'center';

  const getPositionStyle = (): React.CSSProperties => {
    if (isCenter || !highlightRect) {
      return {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 'min(340px, calc(100vw - 32px))',
        zIndex: 10001,
      };
    }

    const margin = 16;
    const vw = window.innerWidth;

    if (position === 'bottom-center' || position === 'bottom-left' || position === 'bottom-right') {
      const top = Math.min(highlightRect.bottom + margin, window.innerHeight - 180);
      const left = position === 'bottom-right'
        ? Math.min(highlightRect.right - 10, vw - 356)
        : position === 'bottom-left'
        ? Math.max(highlightRect.left - 10, 8)
        : Math.max(vw / 2 - 170, 8);
      return {
        position: 'fixed',
        top,
        left,
        maxWidth: 'min(340px, calc(100vw - 32px))',
        zIndex: 10001,
      };
    }

    if (position === 'top-right' || position === 'top-left') {
      const top = Math.max(highlightRect.top - 130, 8);
      const left = position === 'top-right'
        ? Math.min(highlightRect.right - 10, vw - 356)
        : Math.max(highlightRect.left - 10, 8);
      return {
        position: 'fixed',
        top,
        left,
        maxWidth: 'min(340px, calc(100vw - 32px))',
        zIndex: 10001,
      };
    }

    return {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: 'min(340px, calc(100vw - 32px))',
      zIndex: 10001,
    };
  };

  return (
    <div
      style={getPositionStyle()}
      className={cn(
        'bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-blue-200/60 dark:border-blue-800/60',
        'p-4 animate-in fade-in slide-in-from-bottom-2 duration-300',
      )}
    >
      {/* Barra progresso */}
      <div className="flex items-center gap-1.5 mb-3">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 rounded-full transition-all duration-400',
              i < step ? 'bg-blue-600 flex-1' : i === step ? 'bg-blue-400 flex-[2]' : 'bg-gray-200 dark:bg-gray-700 flex-1',
            )}
          />
        ))}
      </div>

      {/* Messaggio */}
      <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed mb-4">{message}</p>

      {/* Azioni */}
      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          Salta tutorial
        </button>
        {!waitingForClick && (
          <button
            onClick={onNext}
            className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 text-white px-3.5 py-1.5 rounded-full hover:bg-blue-700 active:scale-95 transition-all"
          >
            {step < total - 1 ? 'Avanti' : 'Ho capito!'}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
        {waitingForClick && (
          <span className="text-xs text-blue-500 font-medium animate-pulse">
            👆 Clicca l'elemento evidenziato
          </span>
        )}
      </div>
    </div>
  );
}

// ── Spotlight overlay ────────────────────────────────────────────────────────

function SpotlightOverlay({ rect }: { rect: DOMRect | null }) {
  if (!rect) {
    return <div className="fixed inset-0 bg-black/60 z-[10000]" />;
  }

  const pad = 6;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;

  return (
    <svg
      className="fixed inset-0 z-[10000] pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    >
      <defs>
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={10} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.65)"
        mask="url(#spotlight-mask)"
      />
      {/* Ring pulsante intorno all'elemento evidenziato */}
      <rect
        x={x - 2}
        y={y - 2}
        width={w + 4}
        height={h + 4}
        rx={12}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2.5}
        strokeDasharray="6 3"
        className="animate-[dash_2s_linear_infinite]"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="1.5s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

// ── Componente principale ────────────────────────────────────────────────────

interface OnboardingTutorialProps {
  /** Callback chiamato al termine del tutorial */
  onComplete: () => void;
}

export function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [waitingClick, setWaitingClick] = useState(false);
  const listenerRef = useRef<(() => void) | null>(null);

  // Determina se è mobile
  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
  }, []);

  // Mostra dopo breve delay
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  // ── Steps ──────────────────────────────────────────────────────────────────
  const steps: TutorialStep[] = isMobile
    ? [
        {
          id: 'welcome',
          message: '👋 Benvenuto in AC Chiari! Ti mostriamo in pochi secondi come funziona l\'app.',
          position: 'center',
        },
        {
          id: 'dashboard',
          message: '🏠 Questa è la Dashboard: il tuo punto di partenza. Qui trovi un riepilogo di tutte le attività dell\'associazione.',
          position: 'center',
        },
        {
          id: 'hamburger',
          message: '☰ Per navigare tra le sezioni, apri il menù toccando il pulsante in alto a sinistra. Toccalo ora!',
          position: 'bottom-left',
          highlight: 'button.sm\\:hidden',
          waitForClick: 'button.sm\\:hidden',
        },
        {
          id: 'sidebar-open',
          message: '📋 Perfetto! Qui trovi tutte le sezioni dell\'app: puoi aggiungere familiari, confermare la partecipazione agli eventi e caricare i bonifici per le attività.',
          position: 'bottom-right',
          highlight: 'div[data-radix-popper-content-wrapper], [role="dialog"]',
        },
        {
          id: 'close-sidebar',
          message: '👆 Chiudi il menù premendo fuori o sull\'icona ✕ per continuare.',
          position: 'center',
          waitForClick: 'button[aria-label="Close"], button[data-radix-collection-item]',
        },
        {
          id: 'assistant',
          message: '🤖 In caso di dubbi, c\'è sempre il nostro assistente! Tocca l\'avatar in basso a destra per chiedergli aiuto su qualsiasi cosa.',
          position: 'top-right',
          highlight: '#ai-assistant-fab',
        },
      ]
    : [
        {
          id: 'welcome',
          message: '👋 Benvenuto in AC Chiari! Ti mostriamo in pochi secondi come funziona l\'app.',
          position: 'center',
        },
        {
          id: 'dashboard',
          message: '🏠 Questa è la Dashboard: il tuo punto di partenza. Qui trovi un riepilogo delle attività dell\'associazione.',
          position: 'center',
        },
        {
          id: 'sidebar',
          message: '📋 Sulla sinistra trovi la sidebar con tutte le sezioni: puoi aggiungere familiari, vedere gli eventi, confermare le presenze e caricare i bonifici.',
          position: 'center',
          highlight: 'aside',
        },
        {
          id: 'assistant',
          message: '🤖 Hai bisogno di aiuto? L\'assistente in basso a destra è sempre disponibile! Cliccalo per chiedergli qualsiasi cosa sull\'app.',
          position: 'top-right',
          highlight: '#ai-assistant-fab',
        },
      ];

  const totalSteps = steps.length;

  // Aggiorna il rect dell'elemento evidenziato
  const updateRect = useCallback((selector?: string) => {
    if (!selector) {
      setHighlightRect(null);
      return;
    }
    // Aspetta un frame per l'animazione del DOM
    requestAnimationFrame(() => {
      const rect = getElementRect(selector);
      setHighlightRect(rect);
    });
  }, []);

  // Applica lo step corrente
  useEffect(() => {
    if (!visible) return;
    const current = steps[step];
    if (!current) return;

    // Cleanup del listener precedente
    if (listenerRef.current) {
      listenerRef.current();
      listenerRef.current = null;
    }

    updateRect(current.highlight);

    if (current.waitForClick) {
      setWaitingClick(true);
      const sel = current.waitForClick;

      const advance = () => {
        setWaitingClick(false);
        // Piccolo delay per far vedere l'effetto click
        setTimeout(() => {
          const next = step + 1;
          if (next >= totalSteps) {
            finish();
          } else {
            setStep(next);
          }
        }, 600);
      };

      // Poll per trovare l'elemento (può apparire con ritardo nel DOM)
      const poll = setInterval(() => {
        const el = document.querySelector(sel);
        if (el) {
          clearInterval(poll);
          el.addEventListener('click', advance, { once: true });
          listenerRef.current = () => el.removeEventListener('click', advance);
        }
      }, 100);

      const pollCleanup = () => clearInterval(poll);
      const prev = listenerRef.current;
      listenerRef.current = () => {
        pollCleanup();
        prev?.();
      };
    } else {
      setWaitingClick(false);
    }

    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, visible]);

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'done');
    setVisible(false);
    setTimeout(onComplete, 300);
  }, [onComplete]);

  const nextStep = useCallback(() => {
    const next = step + 1;
    if (next >= totalSteps) {
      finish();
    } else {
      setStep(next);
    }
  }, [step, totalSteps, finish]);

  if (!visible) return null;

  const current = steps[step];
  const position = current.position ?? 'center';
  const needsHighlight = Boolean(current.highlight) && highlightRect !== null;

  return (
    <>
      {/* Overlay con spotlight */}
      {needsHighlight ? (
        <SpotlightOverlay rect={highlightRect} />
      ) : (
        <div className="fixed inset-0 bg-black/60 z-[10000]" />
      )}

      {/* Pulsante skip globale */}
      <button
        onClick={finish}
        className="fixed top-4 right-4 z-[10002] p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Salta tutorial"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Tooltip */}
      <TutorialTooltip
        message={current.message}
        position={position}
        step={step}
        total={totalSteps}
        onNext={nextStep}
        onSkip={finish}
        highlightRect={needsHighlight ? highlightRect : undefined}
        waitingForClick={waitingClick}
      />
    </>
  );
}

// ── Hook per verificare se il tutorial è già stato visto ────────────────────

export function useOnboardingTutorial() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setShouldShow(true);
  }, []);

  const markDone = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'done');
    setShouldShow(false);
  }, []);

  return { shouldShow, markDone };
}
