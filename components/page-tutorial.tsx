'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TutorialStep {
  title: string;
  description: string;
  icon?: string;
}

interface PageTutorialProps {
  pageId: string;
  steps: TutorialStep[];
}

export function PageTutorial({ pageId, steps }: PageTutorialProps) {
  const storageKey = `tutorial_v1_${pageId}`;
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(storageKey);
    if (!seen) {
      const timer = setTimeout(() => setVisible(true), 700);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const dismiss = (permanent: boolean) => {
    setIsExiting(true);
    setTimeout(() => {
      setVisible(false);
      setIsExiting(false);
      setCurrentStep(0);
    }, 300);
    if (permanent) {
      localStorage.setItem(storageKey, 'seen');
    }
  };

  if (!visible) return null;

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 w-[320px] rounded-2xl shadow-2xl border bg-background/95 backdrop-blur-md',
        'transition-all duration-300 ease-out',
        isExiting
          ? 'opacity-0 translate-y-3 scale-95'
          : 'opacity-100 translate-y-0 scale-100',
      )}
      style={{ animationFillMode: 'both' }}
    >
      {/* Barra di progresso */}
      <div className="h-1 rounded-t-2xl bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-base leading-none select-none">
              {step.icon ?? '💡'}
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              Guida rapida
            </span>
          </div>
          <button
            onClick={() => dismiss(false)}
            className="text-muted-foreground hover:text-foreground transition-colors rounded-full p-1 hover:bg-muted -mr-1 -mt-1"
            title="Chiudi (riapparirà la prossima volta)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenuto */}
        <div className="mb-4">
          <h3 className="font-semibold text-sm mb-1.5 leading-snug">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
        </div>

        {/* Dots indicatori */}
        {steps.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  'rounded-full transition-all duration-200',
                  i === currentStep
                    ? 'w-5 h-1.5 bg-primary'
                    : 'w-1.5 h-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/50',
                )}
              />
            ))}
          </div>
        )}

        {/* Azioni */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => dismiss(true)}
            className="text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
          >
            Non mostrare più
          </button>
          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentStep(s => s - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {!isLast ? (
              <Button
                size="sm"
                className="h-8 px-4 text-xs"
                onClick={() => setCurrentStep(s => s + 1)}
              >
                Avanti
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 px-4 text-xs"
                onClick={() => dismiss(true)}
              >
                Ho capito ✓
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
