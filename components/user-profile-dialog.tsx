'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, UserRound, CheckCircle2 } from 'lucide-react';
import { useFirestore, useUser } from '@/src/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { triggerNotification } from '@/lib/trigger-notification';

const cap = (s: string) =>
  s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : '';

interface UserProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save */
  onSaved?: () => void;
}

export function UserProfileDialog({ isOpen, onOpenChange, onSaved }: UserProfileDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData } = useUserData();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ─── form state ─────────────────────────────────────────────────────── */
  const [form, setForm] = useState({
    nome: '',
    cognome: '',
    dataNascita: '',
    codiceFiscale: '',
    luogoNascita: '',
    telefonoPrincipale: '',
    telefonoSecondario: '',
    allergie: '',
    via: '',
    numeroCivico: '',
    citta: '',
    provincia: '',
    cap: '',
    consenso: true,
  });

  // Pre-fill from userData when dialog opens
  useEffect(() => {
    if (isOpen && userData) {
      setForm({
        nome: userData.nome || '',
        cognome: userData.cognome || '',
        dataNascita: (userData as any).dataNascita || '',
        codiceFiscale: (userData as any).codiceFiscale || '',
        luogoNascita: (userData as any).luogoNascita || '',
        telefonoPrincipale: (userData as any).telefonoPrincipale || '',
        telefonoSecondario: (userData as any).telefonoSecondario || '',
        allergie: (userData as any).allergie || '',
        via: (userData as any).via || '',
        numeroCivico: (userData as any).numeroCivico || '',
        citta: (userData as any).citta || '',
        provincia: (userData as any).provincia || '',
        cap: (userData as any).cap || '',
        consenso: (userData as any).consenso ?? true,
      });
      setSaved(false);
      setError(null);
    }
  }, [isOpen, userData]);

  const set = (field: keyof typeof form, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  /* ─── validation ─────────────────────────────────────────────────────── */
  const validate = () => {
    if (!form.nome.trim()) return 'Il nome è obbligatorio.';
    if (!form.cognome.trim()) return 'Il cognome è obbligatorio.';
    if (!form.dataNascita) return 'La data di nascita è obbligatoria.';
    if (!form.codiceFiscale.trim()) return 'Il codice fiscale è obbligatorio.';
    if (!form.luogoNascita.trim()) return 'Il luogo di nascita è obbligatorio.';
    if (!form.citta.trim()) return 'La città è obbligatoria.';
    if (!form.via.trim()) return "La via è obbligatoria.";
    return null;
  };

  /* ─── save ───────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!firestore || !user) return;
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSaving(true);

    try {
      const familyId = (userData as any)?.familyId || user.uid;

      // 1. Update user profile
      const userPayload = {
        nome: form.nome.trim(),
        cognome: form.cognome.trim(),
        displayName: `${form.nome.trim()} ${form.cognome.trim()}`,
        dataNascita: form.dataNascita,
        codiceFiscale: form.codiceFiscale.trim().toUpperCase(),
        luogoNascita: form.luogoNascita.trim(),
        telefonoPrincipale: form.telefonoPrincipale.trim(),
        telefonoSecondario: form.telefonoSecondario.trim(),
        allergie: form.allergie.trim(),
        via: form.via.trim(),
        numeroCivico: form.numeroCivico.trim(),
        citta: form.citta.trim(),
        provincia: form.provincia.trim().toUpperCase(),
        cap: form.cap.trim(),
        consenso: form.consenso,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(firestore, 'users', user.uid), userPayload, { merge: true });

      // 2. Update/create the user's own entry in famiglie/{familyId}/membri
      //    Use user.uid as the member document ID to allow easy upsert
      const membroPayload = {
        nome: form.nome.trim(),
        cognome: form.cognome.trim(),
        dataNascita: form.dataNascita,
        codiceFiscale: form.codiceFiscale.trim().toUpperCase(),
        luogoNascita: form.luogoNascita.trim(),
        telefonoPrincipale: form.telefonoPrincipale.trim(),
        telefonoSecondario: form.telefonoSecondario.trim(),
        allergie: form.allergie.trim(),
        consenso: form.consenso,
        linkedUserId: user.uid,
        updatedAt: serverTimestamp(),
      };
      await setDoc(
        doc(firestore, 'famiglie', familyId, 'membri', user.uid),
        membroPayload,
        { merge: true }
      );

      // 3. Ensure the famiglia document exists (with address)
      await setDoc(
        doc(firestore, 'famiglie', familyId),
        {
          via: form.via.trim(),
          numeroCivico: form.numeroCivico.trim(),
          citta: form.citta.trim(),
          provincia: form.provincia.trim().toUpperCase(),
          cap: form.cap.trim(),
          uidCapofamiglia: user.uid,
          emailCapofamiglia: user.email,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 4. If this is the first time (no CF before), notify admins/educators
      const wasIncomplete = !userData?.codiceFiscale;
      if (wasIncomplete) {
        triggerNotification({
          eventType: 'nuovo_utente',
          title: "Nuovo Utente Registrato",
          body: `L'utente ${form.nome} ${form.cognome} ha completato il profilo. Controlla i match in coda.`,
          href: "/admin/gestione-utenti/utenti-registrati",
          userId: "__admin_broadcast__"
        });
      }

      setSaved(true);
      setTimeout(() => {
        onSaved?.();
        onOpenChange(false);
      }, 1500);
    } catch (e: any) {
      console.error('[UserProfileDialog]', e);
      setError('Errore durante il salvataggio. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  /* ─── render ─────────────────────────────────────────────────────────── */
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            Il mio profilo
          </DialogTitle>
          <DialogDescription>
            Inserisci o aggiorna i tuoi dati anagrafici. Servono per le iscrizioni e il tesseramento.
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Success */}
          {saved && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <p className="font-semibold text-green-800">Profilo salvato con successo!</p>
            </div>
          )}

          {!saved && (
            <>
              {/* Nome / Cognome */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={e => set('nome', cap(e.target.value))} placeholder="Mario" />
                </div>
                <div className="space-y-1">
                  <Label>Cognome *</Label>
                  <Input value={form.cognome} onChange={e => set('cognome', cap(e.target.value))} placeholder="Rossi" />
                </div>
              </div>

              {/* Data nascita / Luogo */}
              <div className="grid gap-3" style={{ gridTemplateColumns: '3fr 2fr' }}>
                <div className="space-y-1">
                  <Label>Data di nascita *</Label>
                  <Input type="date" value={form.dataNascita} onChange={e => set('dataNascita', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Luogo di nascita *</Label>
                  <Input value={form.luogoNascita} onChange={e => set('luogoNascita', cap(e.target.value))} placeholder="Chiari" />
                </div>
              </div>

              {/* CF */}
              <div className="space-y-1">
                <Label>Codice Fiscale *</Label>
                <Input
                  value={form.codiceFiscale}
                  onChange={e => set('codiceFiscale', e.target.value.toUpperCase())}
                  placeholder="RSSMRA80A01F205X"
                  maxLength={16}
                />
              </div>

              {/* Telefoni */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Telefono principale</Label>
                  <Input value={form.telefonoPrincipale} onChange={e => set('telefonoPrincipale', e.target.value)} placeholder="+39 333 1234567" />
                </div>
                <div className="space-y-1">
                  <Label>Telefono secondario</Label>
                  <Input value={form.telefonoSecondario} onChange={e => set('telefonoSecondario', e.target.value)} placeholder="Opzionale" />
                </div>
              </div>

              {/* Indirizzo */}
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">Indirizzo di residenza</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: '2fr 1fr 1.5fr' }}>
                  <div className="space-y-1">
                    <Label className="text-xs">Città *</Label>
                    <Input value={form.citta} onChange={e => set('citta', cap(e.target.value))} placeholder="Chiari" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Prov.</Label>
                    <Input value={form.provincia} onChange={e => set('provincia', e.target.value.toUpperCase())} maxLength={2} placeholder="BS" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CAP</Label>
                    <Input value={form.cap} onChange={e => set('cap', e.target.value)} maxLength={5} placeholder="25032" />
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-4 space-y-1">
                    <Label className="text-xs">Via *</Label>
                    <Input value={form.via} onChange={e => set('via', cap(e.target.value))} placeholder="Via Roma" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">N.</Label>
                    <Input value={form.numeroCivico} onChange={e => set('numeroCivico', e.target.value)} placeholder="1" />
                  </div>
                </div>
              </div>

              {/* Allergie */}
              <div className="space-y-1">
                <Label>Allergie / Intolleranze</Label>
                <Input value={form.allergie} onChange={e => set('allergie', cap(e.target.value))} placeholder="Nessuna" />
              </div>

              {/* Consenso */}
              <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30">
                <Checkbox
                  id="profile-consenso"
                  checked={form.consenso}
                  onCheckedChange={v => set('consenso', v === true)}
                />
                <div>
                  <Label htmlFor="profile-consenso" className="text-sm font-medium cursor-pointer">
                    Autorizzazione a foto e social
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Autorizzo Azione Cattolica Chiari alla pubblicazione di fotografie sui propri canali social.
                  </p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!saved && (
          <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {saving ? 'Salvataggio...' : 'Salva profilo'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
