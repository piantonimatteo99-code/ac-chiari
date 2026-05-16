'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, type User } from 'firebase/auth';
import { useFirestore } from '@/src/firebase';
import { getAuth } from 'firebase/auth';
import { getApp } from 'firebase/app';
import type { FormSchema, FormResponse, AnswerValue, FormCollectionRow } from '@/src/types/form-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  RadioGroup, RadioGroupItem,
} from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2, Loader2, AlertCircle, ChevronRight,
  LogIn, UserCircle2, ArrowRight, Euro, ShieldCheck,
} from 'lucide-react';

// ─── Calcolo totale ──────────────────────────────────────────────────────────
function computeTotal(form: FormSchema, answers: Record<string, AnswerValue>): number {
  let total = 0;
  for (const q of form.questions) {
    if (!q.options) continue;

    if (q.type === 'price_item') {
      const ans = answers[q.id];
      if (!ans) continue;
      const selectedIds = Array.isArray(ans) ? ans : [ans as string];
      for (const optId of selectedIds) {
        const opt = q.options.find(o => o.id === optId);
        if (opt?.price) total += opt.price;
      }
    }

    if (q.type === 'quantity_picker') {
      const quantities = answers[q.id] as Record<string, number> | null;
      if (!quantities) continue;
      for (const opt of q.options) {
        if (opt.price && quantities[opt.id]) {
          total += opt.price * (quantities[opt.id] ?? 0);
        }
      }
    }
  }
  return total;
}

// ─── Componente singola domanda ──────────────────────────────────────────────
function QuestionField({
  question,
  value,
  onChange,
}: {
  question: FormSchema['questions'][number];
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const { type, label, description, required, options, placeholder, minValue, maxValue } = question;

  const baseInput = `border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all`;

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <p className="text-sm font-medium leading-snug">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>

      {type === 'text' && (
        <input
          id={`field-${question.id}`}
          className={baseInput}
          value={(value as string) ?? ''}
          placeholder={placeholder ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      )}

      {type === 'textarea' && (
        <textarea
          id={`field-${question.id}`}
          className={`${baseInput} resize-none`}
          rows={3}
          value={(value as string) ?? ''}
          placeholder={placeholder ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      )}

      {type === 'number' && (
        <input
          id={`field-${question.id}`}
          type="number"
          className={baseInput}
          value={(value as number) ?? ''}
          placeholder={placeholder ?? '0'}
          min={minValue}
          max={maxValue}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        />
      )}

      {type === 'email' && (
        <input
          id={`field-${question.id}`}
          type="email"
          className={baseInput}
          value={(value as string) ?? ''}
          placeholder={placeholder ?? 'nome@email.it'}
          onChange={e => onChange(e.target.value)}
        />
      )}

      {type === 'phone' && (
        <input
          id={`field-${question.id}`}
          type="tel"
          className={baseInput}
          value={(value as string) ?? ''}
          placeholder={placeholder ?? '+39 000 000 0000'}
          onChange={e => onChange(e.target.value)}
        />
      )}

      {type === 'select' && options && (
        <Select value={(value as string) ?? ''} onValueChange={v => onChange(v)}>
          <SelectTrigger id={`field-${question.id}`} className="h-9 text-sm">
            <SelectValue placeholder={placeholder ?? 'Seleziona...'} />
          </SelectTrigger>
          <SelectContent>
            {options.map(opt => (
              <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {type === 'single_choice' && options && (
        <RadioGroup
          value={(value as string) ?? ''}
          onValueChange={v => onChange(v)}
          className="space-y-2"
        >
          {options.map(opt => (
            <div key={opt.id} className="flex items-center gap-2.5">
              <RadioGroupItem value={opt.id} id={`${question.id}-${opt.id}`} />
              <Label htmlFor={`${question.id}-${opt.id}`} className="text-sm cursor-pointer font-normal">
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {type === 'multiple_choice' && options && (
        <div className="space-y-2">
          {options.map(opt => {
            const selected = Array.isArray(value) ? value : [];
            return (
              <div key={opt.id} className="flex items-center gap-2.5">
                <Checkbox
                  id={`${question.id}-${opt.id}`}
                  checked={selected.includes(opt.id)}
                  onCheckedChange={checked => {
                    if (checked) onChange([...selected, opt.id]);
                    else onChange(selected.filter((v: string) => v !== opt.id));
                  }}
                />
                <Label htmlFor={`${question.id}-${opt.id}`} className="text-sm cursor-pointer font-normal">
                  {opt.label}
                </Label>
              </div>
            );
          })}
        </div>
      )}

      {type === 'price_item' && options && (
        <div className="space-y-2">
          {options.map(opt => {
            const selected = Array.isArray(value) ? value : [];
            return (
              <div key={opt.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border hover:bg-muted/30 transition-colors">
                <Checkbox
                  id={`${question.id}-${opt.id}`}
                  checked={selected.includes(opt.id)}
                  onCheckedChange={checked => {
                    if (checked) onChange([...selected, opt.id]);
                    else onChange(selected.filter((v: string) => v !== opt.id));
                  }}
                />
                <Label htmlFor={`${question.id}-${opt.id}`} className="text-sm cursor-pointer font-normal flex-1">
                  {opt.label}
                </Label>
                {opt.price != null && (
                  <span className="text-sm font-semibold text-primary tabular-nums">
                    € {opt.price.toFixed(2)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {type === 'quantity_picker' && options && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_auto] gap-0 rounded-xl border overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/40 border-b">Voce</div>
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/40 border-b text-center">Quantità</div>
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/40 border-b text-right">Subtotale</div>
            {/* Righe */}
            {options.map((opt, oi) => {
              const quantities = (value as Record<string, number>) ?? {};
              const qty = quantities[opt.id] ?? 0;
              const subtotal = (opt.price ?? 0) * qty;
              return (
                <>
                  <div key={`label-${opt.id}`} className={`flex flex-col justify-center px-3 py-2.5 ${oi > 0 ? 'border-t' : ''}`}>
                    <span className="text-sm font-medium">{opt.label}</span>
                    {opt.price != null && (
                      <span className="text-xs text-muted-foreground">€ {opt.price.toFixed(2)} / persona</span>
                    )}
                  </div>
                  <div key={`qty-${opt.id}`} className={`flex items-center justify-center gap-1.5 px-2 py-2.5 ${oi > 0 ? 'border-t' : ''}`}>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full border flex items-center justify-center text-base font-bold hover:bg-muted transition-colors disabled:opacity-30"
                      disabled={qty <= 0}
                      onClick={() => onChange({ ...quantities, [opt.id]: Math.max(0, qty - 1) })}
                    >−</button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full border flex items-center justify-center text-base font-bold hover:bg-muted transition-colors"
                      onClick={() => onChange({ ...quantities, [opt.id]: qty + 1 })}
                    >+</button>
                  </div>
                  <div key={`sub-${opt.id}`} className={`flex items-center justify-end px-3 py-2.5 tabular-nums text-sm font-semibold ${oi > 0 ? 'border-t' : ''} ${subtotal > 0 ? 'text-primary' : 'text-muted-foreground/40'}`}>
                    € {subtotal.toFixed(2)}
                  </div>
                </>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step di identificazione post-submit ────────────────────────────────────
type IdentStep = 'choice' | 'login' | 'anonymous' | 'done';

function IdentificationStep({
  form,
  answers,
  total,
  responseId,
  onComplete,
}: {
  form: FormSchema;
  answers: Record<string, AnswerValue>;
  total: number;
  responseId: string;
  onComplete: () => void;
}) {
  const firestore = useFirestore();
  const [step, setStep] = useState<IdentStep>('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [extName, setExtName] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const [extPhone, setExtPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const auth = (() => {
    try { return getAuth(getApp()); } catch { return null; }
  })();

  // Genera testo riepilogo
  const summaryLines = useMemo(() => {
    return form.questions
      .map(q => {
        const ans = answers[q.id];
        if (ans == null) return null;

        let valueStr = '';

        if (q.type === 'quantity_picker' && q.options) {
          // Mostra solo le voci con quantità > 0: "Menù adulti × 3, Menù bambini × 2"
          const quantities = ans as Record<string, number>;
          const lines = q.options
            .filter(o => quantities[o.id] > 0)
            .map(o => `${o.label} × ${quantities[o.id]}`);
          if (lines.length === 0) return null;
          valueStr = lines.join(', ');
        } else if (
          q.type === 'single_choice' || q.type === 'price_item' ||
          q.type === 'select' || q.type === 'multiple_choice'
        ) {
          const ids = Array.isArray(ans) ? ans : [ans as string];
          valueStr = ids.map(id => q.options?.find(o => o.id === id)?.label ?? id).join(', ');
          if (!valueStr) return null;
        } else {
          if (ans === '' || ans === 0) return null;
          valueStr = String(ans);
        }

        return { label: q.label, value: valueStr };
      })
      .filter(Boolean) as { label: string; value: string }[];
  }, [form, answers]);

  const saveCollectionRow = async (
    userId?: string,
    displayName?: string,
    email?: string,
    phone?: string,
  ) => {
    if (!firestore || !form.generateCollection) return;
    // È identificato se ha fornito nome + almeno un recapito (anche senza account)
    const isIdentified = !!(displayName && (email || phone || userId));
    const row: Omit<FormCollectionRow, 'id'> = {
      formId: form.id,
      responseId,
      userId,
      displayName: displayName ?? 'Sconosciuto',
      email,
      summaryLines,
      total: total > 0 ? total : undefined,
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(firestore, 'form_collection_rows'), row);
    // aggiorno la risposta con i dati identificativi
    await updateDoc(doc(firestore, 'form_responses', responseId), {
      userId: userId ?? null,
      displayName: displayName ?? null,
      email: email ?? null,
      phone: phone ?? null,
      isAnonymous: !isIdentified,
      summaryText: summaryLines.map(l => `${l.label}: ${l.value}`).join('\n'),
    });
  };

  const handleLogin = async () => {
    if (!auth || !email || !password) return;
    setIsLoading(true);
    setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const u = cred.user;
      await saveCollectionRow(u.uid, u.displayName ?? u.email ?? undefined, u.email ?? undefined);
      setStep('done');
      setTimeout(onComplete, 1800);
    } catch (e: any) {
      setError('Credenziali non valide. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  // Utente esterno identificato (non registrato sul portale)
  const handleExternal = async () => {
    if (!extName.trim()) {
      setError('Inserisci il tuo nome e cognome.');
      return;
    }
    if (!extEmail.trim() && !extPhone.trim()) {
      setError('Inserisci almeno un recapito (email o telefono).');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      // isAnonymous = false: l'utente si è identificato con i propri dati
      await saveCollectionRow(undefined, extName.trim(), extEmail.trim() || undefined, extPhone.trim() || undefined);
      setStep('done');
      setTimeout(onComplete, 1800);
    } catch (e) {
      setError('Errore nel salvataggio. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="font-semibold text-green-700">Identificazione completata!</p>
        <p className="text-sm text-muted-foreground">Reindirizzamento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Riepilogo risposte + totale */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Il tuo riepilogo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {summaryLines.map((l, i) => (
            <div key={i} className="flex justify-between text-sm gap-4">
              <span className="text-muted-foreground">{l.label}</span>
              <span className="font-medium text-right">{l.value}</span>
            </div>
          ))}
          {total > 0 && (
            <>
              <Separator className="my-2" />
              <div className="flex justify-between text-sm font-bold">
                <span className="flex items-center gap-1">
                  <Euro className="h-4 w-4 text-primary" />
                  Totale da pagare
                </span>
                <span className="text-primary text-base">€ {total.toFixed(2)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Choice step */}
      {step === 'choice' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-center">
            Sei iscritto al portale AC Chiari?
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Se hai un account, accedi per collegare la risposta al tuo profilo.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-14 flex-col gap-1 text-sm border-primary/30 hover:border-primary hover:bg-primary/5"
              onClick={() => setStep('login')}
            >
              <LogIn className="h-5 w-5 text-primary" />
              Sì, accedo
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col gap-1 text-sm border-muted-foreground/30 hover:border-foreground/50"
              onClick={() => setStep('anonymous')}
            >
              <UserCircle2 className="h-5 w-5 text-muted-foreground" />
              No, lascio i miei dati
            </Button>
          </div>
        </div>
      )}

      {/* Login step */}
      {step === 'login' && (
        <div className="space-y-3">
          <button
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            onClick={() => { setStep('choice'); setError(''); }}
          >
            ← Torna indietro
          </button>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nome@email.it"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Password</Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-9"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
          <Button className="w-full gap-2" onClick={handleLogin} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Accedi e conferma
          </Button>
        </div>
      )}

      {/* Utente esterno: si identifica con nome + recapito */}
      {step === 'anonymous' && (
        <div className="space-y-3">
          <button
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            onClick={() => { setStep('choice'); setError(''); }}
          >
            ← Torna indietro
          </button>
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-xs text-blue-700">
              Lascia i tuoi dati di contatto in modo che il creatore del modulo possa identificarti.
              È richiesto almeno un recapito (email o telefono).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome e cognome *</Label>
            <Input
              id="ext-name"
              value={extName}
              onChange={e => setExtName(e.target.value)}
              placeholder="Mario Rossi"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input
              id="ext-email"
              type="email"
              value={extEmail}
              onChange={e => setExtEmail(e.target.value)}
              placeholder="mario@email.it"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Numero di telefono</Label>
            <Input
              id="ext-phone"
              type="tel"
              value={extPhone}
              onChange={e => setExtPhone(e.target.value)}
              placeholder="+39 333 000 0000"
              className="h-9"
            />
          </div>
          {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}

          {/* Consenso privacy per utente esterno */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <ShieldCheck className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              Cliccando su <strong>Conferma e invia</strong> acconsenti al trattamento dei tuoi
              dati personali da parte di Azione Cattolica di Chiari, ai sensi del Reg. UE 679/2016
              (GDPR), per le finalità indicate nel modulo.{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-primary font-medium hover:text-primary/80 transition-colors"
              >
                Leggi l&apos;informativa completa
              </a>
              .
            </p>
          </div>

          <Button className="w-full gap-2" onClick={handleExternal} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Conferma e invia
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Pagina principale ───────────────────────────────────────────────────────
export default function PublicFormPage() {
  const params = useParams();
  const formId = params?.formId as string;
  const firestore = useFirestore();

  const [form, setForm] = useState<FormSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [phase, setPhase] = useState<'form' | 'identification' | 'success'>('form');
  const [savedResponseId, setSavedResponseId] = useState<string | null>(null);

  // Carica schema form
  useEffect(() => {
    if (!firestore || !formId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, 'forms', formId));
        if (!snap.exists()) { setNotFound(true); return; }
        const data = { id: snap.id, ...snap.data() } as FormSchema;
        if (data.status === 'closed') { setNotFound(true); return; }
        setForm(data);
      } catch {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [firestore, formId]);

  const total = useMemo(() => form ? computeTotal(form, answers) : 0, [form, answers]);

  const handleSubmit = async () => {
    if (!firestore || !form) return;
    setSubmitError('');

    // Validazione campi obbligatori
    for (const q of form.questions) {
      if (!q.required) continue;
      const ans = answers[q.id];
      const isEmpty = ans == null || ans === '' || (Array.isArray(ans) && ans.length === 0);
      if (isEmpty) {
        setSubmitError(`Il campo "${q.label}" è obbligatorio.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Firestore non accetta undefined — usiamo null per i campi opzionali
      const payload = {
        formId: form.id,
        projectId: form.projectId,
        userId: null,
        displayName: null,
        email: null,
        phone: null,
        isAnonymous: true,
        answers,
        total: total > 0 ? total : null,
        summaryText: null,
        submittedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(firestore, 'form_responses'), payload);
      setSavedResponseId(ref.id);

      if (form.generateCollection) {
        setPhase('identification');
      } else {
        setPhase('success');
      }
    } catch (e) {
      setSubmitError('Errore nell\'invio. Riprova.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Not found ──
  if (notFound || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="font-bold text-lg">Modulo non disponibile</h1>
            <p className="text-sm text-muted-foreground">
              Il modulo che stai cercando non esiste, è scaduto o è stato chiuso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Success ──
  if (phase === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-green-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div>
              <h1 className="font-bold text-xl text-green-700">Modulo inviato!</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Grazie per aver compilato <strong>{form.title}</strong>.
              </p>
            </div>
            {total > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
                <p className="text-xs text-muted-foreground">Totale</p>
                <p className="text-2xl font-bold text-primary">€ {total.toFixed(2)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Fase: identificazione post-submit ──
  if (phase === 'identification' && savedResponseId && form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-start justify-center p-4 pt-10">
        <div className="max-w-lg w-full space-y-4">
          <div className="text-center space-y-1">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
            <h1 className="text-xl font-bold">Modulo inviato con successo!</h1>
            <p className="text-sm text-muted-foreground">
              Un ultimo passo per completare la tua risposta.
            </p>
          </div>
          <Card>
            <CardContent className="pt-4">
              <IdentificationStep
                form={form}
                answers={answers}
                total={total}
                responseId={savedResponseId}
                onComplete={() => setPhase('success')}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Fase principale: compilazione ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-start justify-center p-4 pt-10">
      <div className="max-w-xl w-full space-y-4 pb-16">
        {/* Header form */}
        <Card className="border-t-4 border-t-primary">
          <CardContent className="pt-5 pb-4">
            <h1 className="text-xl font-bold">{form.title}</h1>
            {form.description && (
              <p className="text-sm text-muted-foreground mt-1">{form.description}</p>
            )}
            {!form.allowAnonymous && (
              <Badge variant="outline" className="mt-2 text-xs">
                Richiede autenticazione
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Domande */}
        {form.questions.map((q, i) => (
          <Card key={q.id}>
            <CardContent className="pt-4 pb-4">
              <QuestionField
                question={q}
                value={answers[q.id] ?? null}
                onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
              />
            </CardContent>
          </Card>
        ))}

        {/* Totale live (se ci sono price_item) */}
        {form.questions.some(q => q.type === 'price_item') && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <Euro className="h-4 w-4 text-primary" />
              Totale selezionato
            </span>
            <span className="text-xl font-bold text-primary tabular-nums">
              € {total.toFixed(2)}
            </span>
          </div>
        )}

        {/* Errore validazione */}
        {submitError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}

        {/* Pulsante submit + note privacy */}
        <div className="space-y-3">
          <Button
            className="w-full h-12 text-base gap-2"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <ChevronRight className="h-5 w-5" />}
            Invia modulo
          </Button>

          {/* Banner consenso privacy — mostrato a tutti (i dati vengono sempre trattati) */}
          <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-slate-50/80 border border-slate-200">
            <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
              Inviando il modulo acconsenti al trattamento dei dati inseriti da parte di
              {' '}<strong className="text-slate-600">Azione Cattolica di Chiari</strong>{' '}
              ai sensi del Reg. UE 679/2016 (GDPR).{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-primary font-medium hover:text-primary/80 transition-colors"
              >
                Informativa sulla privacy
              </a>
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            I campi con * sono obbligatori
          </p>
        </div>
      </div>
    </div>
  );
}
