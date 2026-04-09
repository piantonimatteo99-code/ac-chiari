'use client';

import { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowRight, ArrowLeft, Users, Search, KeyRound, CheckCircle2, Loader2, Mail,
} from 'lucide-react';
import { User } from 'firebase/auth';
import type { UserData } from '@/src/hooks/use-user-data';
import { cn } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface PersonalData {
  nome: string;
  cognome: string;
  dataNascita: string;
  codiceFiscale: string;
  luogoNascita: string;
  telefonoPrincipale: string;
  telefonoSecondario: string;
  allergie: string;
  via: string;
  numeroCivico: string;
  citta: string;
  provincia: string;
  cap: string;
  consenso: boolean;
}

interface JoinFamilyDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: User;
  userData: UserData | null;
  onSuccess: () => void;
}

const STEPS = [
  { id: 1, label: 'Dati personali', icon: Users },
  { id: 2, label: 'Cerca famiglia', icon: Search },
  { id: 3, label: 'Inserisci codice', icon: KeyRound },
];

const capitalize = (s: string) => s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : '';

/* ─── Component ──────────────────────────────────────────────────────────── */
export function JoinFamilyDialog({ isOpen, onOpenChange, user, userData, onSuccess }: JoinFamilyDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [devPin, setDevPin] = useState<string | null>(null);

  // Step 1 — personal data
  const [personal, setPersonal] = useState<PersonalData>({
    nome: userData?.nome ?? '',
    cognome: userData?.cognome ?? '',
    dataNascita: userData?.dataNascita ?? '',
    codiceFiscale: userData?.codiceFiscale ?? '',
    luogoNascita: userData?.luogoNascita ?? '',
    telefonoPrincipale: userData?.telefonoPrincipale ?? '',
    telefonoSecondario: userData?.telefonoSecondario ?? '',
    allergie: '',
    via: userData?.via ?? '',
    numeroCivico: userData?.numeroCivico ?? '',
    citta: userData?.citta ?? '',
    provincia: userData?.provincia ?? '',
    cap: userData?.cap ?? '',
    consenso: true,
  });

  // Step 2 — family search
  const [searchNome, setSearchNome] = useState('');
  const [searchCognome, setSearchCognome] = useState('');
  const [foundFamily, setFoundFamily] = useState<{ familyId: string; memberName: string; notifiedCount: number } | null>(null);

  // Step 3 — PIN entry
  const [pin, setPin] = useState('');

  const updatePersonal = useCallback((field: keyof PersonalData, value: string | boolean) => {
    setPersonal(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleClose = () => {
    setStep(1);
    setError(null);
    setSuccess(false);
    setFoundFamily(null);
    setPin('');
    setDevPin(null);
    onOpenChange(false);
  };

  /* ── Step 1 → Step 2 validation ─────────────────────────────────────── */
  const validateStep1 = () => {
    if (!personal.nome.trim()) return 'Il nome è obbligatorio.';
    if (!personal.cognome.trim()) return 'Il cognome è obbligatorio.';
    if (!personal.dataNascita) return 'La data di nascita è obbligatoria.';
    if (!personal.codiceFiscale.trim()) return 'Il codice fiscale è obbligatorio.';
    if (!personal.luogoNascita.trim()) return 'Il luogo di nascita è obbligatorio.';
    if (!personal.citta.trim()) return 'La città è obbligatoria.';
    if (!personal.via.trim()) return 'La via è obbligatoria.';
    return null;
  };

  /* ── Step 2: Send PIN ────────────────────────────────────────────────── */
  const handleSendPin = async () => {
    if (!searchNome.trim() || !searchCognome.trim()) {
      setError('Inserisci nome e cognome del familiare da cercare.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/family/send-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: user.uid,
          requesterEmail: user.email,
          requesterName: `${personal.nome} ${personal.cognome}`.trim() || user.displayName,
          targetMemberNome: capitalize(searchNome.trim()),
          targetMemberCognome: capitalize(searchCognome.trim()),
          personalData: personal,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Errore durante la ricerca della famiglia.');
        return;
      }

      setFoundFamily({
        familyId: data.familyId,
        memberName: data.familyMemberFound,
        notifiedCount: data.notifiedCount,
      });
      if (data.devPin) setDevPin(data.devPin);
      setStep(3);
    } catch {
      setError('Errore di connessione. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 3: Verify PIN ──────────────────────────────────────────────── */
  const handleVerifyPin = async () => {
    if (pin.trim().length !== 6) {
      setError('Il codice deve essere di 6 cifre.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/family/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: user.uid, pin: pin.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Codice non valido.');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 2500);
    } catch {
      setError('Errore di connessione. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2: Resend PIN ──────────────────────────────────────────────── */
  const handleResendPin = async () => {
    setFoundFamily(null);
    setPin('');
    setDevPin(null);
    setStep(2);
    // Re-send automatically
    await handleSendPin();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Unisciti a un Nucleo Familiare
          </DialogTitle>
          <DialogDescription>
            Collegati a una famiglia già presente in AC Chiari per condividere iscrizioni e pagamenti.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b bg-muted/30">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className={cn(
                  'flex items-center gap-1.5 text-xs font-medium transition-colors',
                  isActive ? 'text-primary' : isDone ? 'text-green-600' : 'text-muted-foreground'
                )}>
                  <div className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                    isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                  )}>
                    {isDone ? '✓' : s.id}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-px mx-2', step > s.id ? 'bg-green-400' : 'bg-muted-foreground/20')} />
                )}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── SUCCESS ── */}
          {success && (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Collegamento riuscito!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Sei ora parte del nucleo familiare. La pagina si aggiornerà a breve.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 1: Personal data ── */}
          {!success && step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Inserisci i tuoi dati anagrafici. Verranno salvati nel tuo profilo e nel nucleo familiare.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input value={personal.nome} onChange={e => updatePersonal('nome', capitalize(e.target.value))} placeholder="Mario" />
                </div>
                <div className="space-y-1">
                  <Label>Cognome *</Label>
                  <Input value={personal.cognome} onChange={e => updatePersonal('cognome', capitalize(e.target.value))} placeholder="Rossi" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Data di nascita *</Label>
                  <Input type="date" value={personal.dataNascita} onChange={e => updatePersonal('dataNascita', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Luogo di nascita *</Label>
                  <Input value={personal.luogoNascita} onChange={e => updatePersonal('luogoNascita', capitalize(e.target.value))} placeholder="Chiari" />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Codice Fiscale *</Label>
                <Input
                  value={personal.codiceFiscale}
                  onChange={e => updatePersonal('codiceFiscale', e.target.value.toUpperCase())}
                  placeholder="RSSMRA80A01F205X"
                  maxLength={16}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label>Telefono principale</Label>
                <Input value={personal.telefonoPrincipale} onChange={e => updatePersonal('telefonoPrincipale', e.target.value)} placeholder="+39 333 1234567" />
              </div>

              <div className="space-y-1 border-t pt-3">
                <p className="text-sm font-medium">Indirizzo di residenza</p>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Città *</Label>
                    <Input value={personal.citta} onChange={e => updatePersonal('citta', capitalize(e.target.value))} placeholder="Chiari" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Prov.</Label>
                    <Input value={personal.provincia} onChange={e => updatePersonal('provincia', e.target.value.toUpperCase())} maxLength={2} placeholder="BS" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CAP</Label>
                    <Input value={personal.cap} onChange={e => updatePersonal('cap', e.target.value)} placeholder="25032" />
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs">Via *</Label>
                    <Input value={personal.via} onChange={e => updatePersonal('via', capitalize(e.target.value))} placeholder="Via Roma" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">N.</Label>
                    <Input value={personal.numeroCivico} onChange={e => updatePersonal('numeroCivico', e.target.value)} placeholder="1" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Allergie / Intolleranze</Label>
                <Input value={personal.allergie} onChange={e => updatePersonal('allergie', e.target.value)} placeholder="Nessuna" />
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30 mt-2">
                <Checkbox
                  id="join-consenso"
                  checked={personal.consenso}
                  onCheckedChange={(v) => updatePersonal('consenso', v === true)}
                />
                <div>
                  <Label htmlFor="join-consenso" className="text-sm font-medium cursor-pointer">
                    Autorizzazione a foto e social
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Autorizzo Azione Cattolica Chiari alla pubblicazione di fotografie sui propri canali social.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Search family ── */}
          {!success && step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Inserisci il nome e il cognome di un tuo familiare che è già registrato in AC Chiari.
                Il sistema invierà un codice a tutti i membri della sua famiglia.
              </p>

              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-start gap-3">
                <Mail className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-800">
                  Un codice univoco verrà inviato via email ai membri della famiglia trovata.
                  Chiedi a un familiare di comunicarti il codice.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome del familiare *</Label>
                  <Input
                    value={searchNome}
                    onChange={e => setSearchNome(e.target.value)}
                    placeholder="es. Giulia"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cognome del familiare *</Label>
                  <Input
                    value={searchCognome}
                    onChange={e => setSearchCognome(e.target.value)}
                    placeholder="es. Rossi"
                    onKeyDown={e => e.key === 'Enter' && handleSendPin()}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: PIN entry ── */}
          {!success && step === 3 && (
            <div className="space-y-5">
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                <p className="font-medium">Famiglia trovata: <strong>{foundFamily?.memberName}</strong></p>
                {foundFamily?.notifiedCount ? (
                  <p className="mt-1">
                    ✅ Codice inviato a <strong>{foundFamily.notifiedCount}</strong> membro{foundFamily.notifiedCount > 1 ? 'i' : ''} della famiglia.
                    Chiedi loro di comunicarti il codice.
                  </p>
                ) : (
                  <p className="mt-1 text-amber-800">⚠️ SMTP non configurato (modalità sviluppo).</p>
                )}
              </div>

              {devPin && (
                <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm">
                  <p className="font-semibold text-amber-800">🛠 Modalità sviluppo — PIN:</p>
                  <p className="font-mono text-2xl font-bold text-amber-900 mt-1">{devPin}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm">Inserisci il codice a 6 cifre</Label>
                <Input
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="_ _ _ _ _ _"
                  maxLength={6}
                  className="text-center text-3xl font-mono tracking-[0.5em] h-14"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && pin.length === 6 && handleVerifyPin()}
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground text-center">Il codice è valido per 1 ora</p>
              </div>

              <button
                className="text-xs text-primary underline underline-offset-2 w-full text-center"
                onClick={handleResendPin}
                disabled={loading}
              >
                Non hai ricevuto il codice? Reinvia
              </button>
            </div>
          )}

          {/* Error */}
          {error && !success && (
            <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-6 py-4 border-t flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => {
                if (step === 1) handleClose();
                else { setStep(s => s - 1); setError(null); setFoundFamily(null); }
              }}
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {step === 1 ? 'Annulla' : 'Indietro'}
            </Button>

            <div className="flex items-center gap-2">
              {step === 1 && (
                <Button onClick={() => {
                  const err = validateStep1();
                  if (err) { setError(err); return; }
                  setError(null);
                  setStep(2);
                }}>
                  Avanti <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}

              {step === 2 && (
                <Button onClick={handleSendPin} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                  {loading ? 'Ricerca...' : 'Invia Codice'}
                </Button>
              )}

              {step === 3 && (
                <Button
                  onClick={handleVerifyPin}
                  disabled={loading || pin.length !== 6}
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                  {loading ? 'Verifica...' : 'Connettiti alla Famiglia'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
