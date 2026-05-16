'use client';

import { useState } from 'react';
import type { FormQuestion, FormSchema } from '@/src/types/form-types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles, Loader2, AlertCircle, Check, RefreshCw,
  ChevronRight, Type, AlignLeft, CircleDot, CheckSquare,
  Hash, ListOrdered, Mail, Phone, Tag, LayoutGrid, X,
} from 'lucide-react';

// ── Icona per tipo di domanda ────────────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type, textarea: AlignLeft, single_choice: CircleDot,
  multiple_choice: CheckSquare, number: Hash, select: ListOrdered,
  email: Mail, phone: Phone, price_item: Tag, quantity_picker: LayoutGrid,
};

const TYPE_LABELS: Record<string, string> = {
  text: 'Testo breve', textarea: 'Testo lungo', single_choice: 'Scelta singola',
  multiple_choice: 'Scelta multipla', number: 'Numero', select: 'Menu tendina',
  email: 'Email', phone: 'Telefono', price_item: 'Voce con prezzo',
  quantity_picker: 'Quantità per opzione',
};

// ── Anteprima di una singola domanda ─────────────────────────────────────────
function QuestionPreview({ q }: { q: FormQuestion }) {
  const Icon = TYPE_ICONS[q.type] ?? Type;
  return (
    <div className="border rounded-lg p-3 space-y-1.5 bg-card">
      <div className="flex items-start gap-2">
        <div className="p-1 rounded bg-primary/10 shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium leading-snug">{q.label}</p>
            {q.required && (
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                Obbligatoria
              </span>
            )}
          </div>
          {q.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{q.description}</p>
          )}
          <Badge variant="outline" className="text-[10px] mt-1 h-4 px-1">
            {TYPE_LABELS[q.type] ?? q.type}
          </Badge>
        </div>
      </div>

      {/* Opzioni */}
      {q.options && q.options.length > 0 && (
        <div className="ml-7 space-y-1">
          {q.options.map(opt => (
            <div key={opt.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
                {opt.label}
              </span>
              {opt.price != null && (
                <span className="font-semibold text-primary">€ {opt.price.toFixed(2)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Esempi pronti ────────────────────────────────────────────────────────────
const EXAMPLES = [
  'Modulo per la prenotazione del pranzo sociale con menù adulti a 20€, bambini a 12€ e vegano a 18€. Chiedi nome, numero di persone per ogni menù e recapito telefonico.',
  'Ordine magliette dell\'associazione: taglia S, M, L, XL a 15€ ciascuna. Chiedi nome, cognome e quantità per taglia.',
  'Iscrizione al campo estivo: nome bambino, data di nascita, eventuali allergie, menù standard o vegetariano a 180€ ciascuno.',
];

// ── Props ────────────────────────────────────────────────────────────────────
interface AiFormGeneratorDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApprove: (schema: Partial<FormSchema>) => void;
}

// ── Componente principale ────────────────────────────────────────────────────
export function AiFormGeneratorDialog({ open, onOpenChange, onApprove }: AiFormGeneratorDialogProps) {
  const [step, setStep] = useState<'input' | 'preview' | 'loading'>('input');
  const [description, setDescription] = useState('');
  const [schema, setSchema] = useState<Partial<FormSchema> | null>(null);
  const [error, setError] = useState('');

  const reset = () => {
    setStep('input');
    setSchema(null);
    setError('');
  };

  const generate = async () => {
    if (!description.trim()) {
      setError('Descrivi il modulo che vuoi creare.');
      return;
    }
    setError('');
    setStep('loading');

    try {
      const res = await fetch('/api/ai/generate-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? 'Errore nella generazione. Riprova.');
        setStep('input');
        return;
      }

      setSchema(data.schema);
      setStep('preview');
    } catch {
      setError('Errore di connessione. Verifica la rete e riprova.');
      setStep('input');
    }
  };

  const handleApprove = () => {
    if (!schema) return;
    onApprove(schema);
    onOpenChange(false);
    reset();
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Genera modulo con AI
          </DialogTitle>
          <DialogDescription>
            Descrivi il modulo in italiano — l'AI lo costruirà automaticamente per te.
          </DialogDescription>
        </DialogHeader>

        {/* ── Step: INPUT ── */}
        {(step === 'input' || step === 'loading') && (
          <div className="space-y-4 flex-1 overflow-y-auto">
            <Textarea
              id="ai-form-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Es: Voglio un modulo per la prenotazione del pranzo sociale con menù adulti a 20€, bambini a 12€ e vegano a 18€..."
              rows={5}
              className="resize-none text-sm"
              disabled={step === 'loading'}
            />

            {/* Esempi */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Esempi pronti:</p>
              <div className="space-y-1.5">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setDescription(ex)}
                    disabled={step === 'loading'}
                    className="w-full text-left text-xs text-muted-foreground hover:text-foreground p-2.5 rounded-lg border border-dashed hover:border-primary/40 hover:bg-primary/5 transition-all leading-relaxed"
                  >
                    <ChevronRight className="h-3 w-3 inline-block mr-1 text-primary/60" />
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Annulla</Button>
              <Button
                onClick={generate}
                disabled={step === 'loading' || !description.trim()}
                className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {step === 'loading'
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Generando...</>
                  : <><Sparkles className="h-4 w-4" />Genera modulo</>}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: PREVIEW / APPROVAZIONE ── */}
        {step === 'preview' && schema && (
          <div className="flex flex-col flex-1 overflow-hidden gap-4">
            {/* Banner AI */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 shrink-0">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 flex-1">
                <strong>Rivedi il modulo generato.</strong> Puoi approvarlo così com'è oppure rifiutarlo
                e descrivere meglio cosa vuoi.
              </p>
            </div>

            {/* Anteprima schema */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {/* Intestazione */}
              <div className="space-y-0.5">
                <h3 className="font-bold text-base">{schema.title}</h3>
                {schema.description && (
                  <p className="text-sm text-muted-foreground">{schema.description}</p>
                )}
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {(schema.questions ?? []).length} domande
                  </Badge>
                  {schema.generateCollection && (
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                      Raccolta automatica: {schema.collectionTitle ?? schema.title}
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Domande */}
              <div className="space-y-2">
                {(schema.questions ?? []).map((q, i) => (
                  <QuestionPreview key={q.id ?? i} q={q as FormQuestion} />
                ))}
              </div>
            </div>

            {/* Azioni */}
            <div className="flex items-center gap-2 pt-2 shrink-0 border-t">
              <Button
                variant="outline"
                className="gap-2 flex-1"
                onClick={() => {
                  setStep('input');
                  setSchema(null);
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Rigenera
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 text-destructive hover:bg-destructive/10"
                onClick={handleClose}
                title="Annulla"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                className="gap-2 flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
              >
                <Check className="h-4 w-4" />
                Approva e carica nel builder
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
