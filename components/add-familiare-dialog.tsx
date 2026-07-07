'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useFirestore } from '@/src/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, setDoc } from 'firebase/firestore';
import type { Membro as MembroBase, PersonaAutorizzata } from '@/app/(app)/nucleo-familiare/page';
import { User } from 'firebase/auth';
import { UserData } from '@/src/hooks/use-user-data';
import { triggerNotification } from '@/lib/trigger-notification';
import { PlusCircle, Trash2, UserCheck } from 'lucide-react';


type Membro = Omit<MembroBase, 'id'>;

interface AddFamiliareDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  membroToEdit?: MembroBase | null;
  user: User;
  userData: UserData | null;
}

const initialMembroState: Membro = {
  nome: '',
  cognome: '',
  dataNascita: '',
  codiceFiscale: '',
  luogoNascita: '',
  telefonoPrincipale: '',
  telefonoSecondario: '',
  allergie: '',
  consenso: true,
  personaAutorizzata: [],
  puoRientrareInAutonomia: false,
};

const initialAnagraficaState = {
    via: '',
    numeroCivico: '',
    citta: '',
    provincia: '',
    cap: '',
};

const emptyPersona = (): PersonaAutorizzata => ({ nome: '', cognome: '', telefono: '' });

function calcIsMinorenne(dataNascita: string): boolean {
  if (!dataNascita) return false;
  const today = new Date();
  const birth = new Date(dataNascita);
  const age = today.getFullYear() - birth.getFullYear() -
    (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  return age < 18;
}

export function AddFamiliareDialog({ isOpen, onOpenChange, membroToEdit, user, userData }: AddFamiliareDialogProps) {
  const firestore = useFirestore();
  
  const [membroData, setMembroData] = useState<Membro>(initialMembroState);
  const [anagraficaData, setAnagraficaData] = useState(initialAnagraficaState);
  const [nessunaAllergia, setNessunaAllergia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const isEditing = membroToEdit != null;
  const famigliaId = userData?.familyId || user.uid;
  const isMinorenne = calcIsMinorenne(membroData.dataNascita);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && membroToEdit) {
        const allergie = membroToEdit.allergie || '';
        setNessunaAllergia(allergie === '');
        setMembroData({
          nome: membroToEdit.nome || '',
          cognome: membroToEdit.cognome || '',
          dataNascita: membroToEdit.dataNascita || '',
          codiceFiscale: membroToEdit.codiceFiscale || '',
          luogoNascita: membroToEdit.luogoNascita || '',
          telefonoPrincipale: membroToEdit.telefonoPrincipale || '',
          telefonoSecondario: membroToEdit.telefonoSecondario || '',
          allergie,
          consenso: membroToEdit.consenso ?? (membroToEdit.consensoFoto !== false && membroToEdit.consensoSocial !== false),
          personaAutorizzata: membroToEdit.personaAutorizzata || [],
          puoRientrareInAutonomia: membroToEdit.puoRientrareInAutonomia ?? false,
        });
      } else {
        setNessunaAllergia(false);
        setMembroData(initialMembroState);
      }

      if (userData) {
        setAnagraficaData({
            via: userData.via || '',
            numeroCivico: userData.numeroCivico || '',
            citta: userData.citta || '',
            provincia: userData.provincia || '',
            cap: userData.cap || '',
        });
      } else {
        setAnagraficaData(initialAnagraficaState);
      }

      setError(null);
      setIsSaving(false);
    }
  }, [membroToEdit, isEditing, isOpen, userData]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    let formattedValue = value;
    
    const anagraficaKeys = Object.keys(initialAnagraficaState);
    const isAnagraficaField = anagraficaKeys.includes(id);

    switch (id) {
        case 'codiceFiscale':
        case 'provincia':
            formattedValue = value.toUpperCase();
            break;
        case 'nome':
        case 'cognome':
        case 'luogoNascita':
        case 'citta':
        case 'via':
        case 'allergie':
            formattedValue = value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : '';
            break;
        default:
            break;
    }
    
    if (isAnagraficaField) {
        setAnagraficaData((prev) => ({ ...prev, [id]: formattedValue }));
    } else {
        setMembroData((prev) => ({ ...prev, [id]: formattedValue as any }));
    }
  };

  // ─── Gestione persone autorizzate ────────────────────────────────────────────

  const handleAddPersona = () => {
    setMembroData(prev => ({
      ...prev,
      personaAutorizzata: [...(prev.personaAutorizzata || []), emptyPersona()],
    }));
  };

  const handleRemovePersona = (index: number) => {
    setMembroData(prev => ({
      ...prev,
      personaAutorizzata: (prev.personaAutorizzata || []).filter((_, i) => i !== index),
    }));
  };

  const handlePersonaChange = (index: number, field: keyof PersonaAutorizzata, value: string) => {
    setMembroData(prev => {
      const updated = [...(prev.personaAutorizzata || [])];
      updated[index] = {
        ...updated[index],
        [field]: field === 'nome' || field === 'cognome'
          ? value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : ''
          : value,
      };
      return { ...prev, personaAutorizzata: updated };
    });
  };

  // ─── Close ───────────────────────────────────────────────────────────────────

  const handleClose = () => {
    onOpenChange(false);
  };

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null);
    if (!firestore || !user) {
      setError('Utente o database non disponibile.');
      return;
    }

    if (!membroData.nome || !membroData.cognome || !membroData.dataNascita) {
      setError('Nome, cognome e data di nascita del membro sono obbligatori.');
      return;
    }
    
    if (!anagraficaData.via || !anagraficaData.citta || !anagraficaData.cap) {
        setError('L\'indirizzo della famiglia (via, città, CAP) è obbligatorio.');
        return;
    }

    setIsSaving(true);

    try {
      // Payload membro: includi campi minorenne solo se minorenne
      const membroPayload: any = {
        ...membroData,
      };
      if (!isMinorenne) {
        delete membroPayload.personaAutorizzata;
        delete membroPayload.puoRientrareInAutonomia;
      }

      // Aggiorna documento famiglia
      const famigliaDocRef = doc(firestore, 'famiglie', famigliaId);
      const famigliaPayload = {
        ...anagraficaData,
        uidCapofamiglia: user.uid,
        emailCapofamiglia: user.email,
        updatedAt: serverTimestamp(),
      };
      await setDoc(famigliaDocRef, famigliaPayload, { merge: true });

      // Aggiorna indirizzo sul profilo utente
      const userDocRef = doc(firestore, 'users', user.uid);
      await setDoc(userDocRef, { ...anagraficaData }, { merge: true });

      if (isEditing && membroToEdit) {
        const membroDocRef = doc(firestore, 'famiglie', famigliaId, 'membri', membroToEdit.id);
        await updateDoc(membroDocRef, { ...membroPayload });
      } else {
        const membriCollectionRef = collection(firestore, 'famiglie', famigliaId, 'membri');
        await addDoc(membriCollectionRef, {
            ...membroPayload,
            createdAt: serverTimestamp(),
            archived: false,
        });

        triggerNotification({
          eventType: 'nuovo_utente',
          title: "Nuovo Utente Registrato",
          body: `È stato registrato il membro ${membroData.nome} ${membroData.cognome}. Controlla se compare tra i match in coda.`,
          href: "/admin/gestione-utenti/utenti-registrati",
          userId: "__admin_broadcast__"
        });
      }

      // ── Invia email riepilogo anagrafico ──────────────────────────────────
      try {
        const idToken = await user.getIdToken();
        await fetch('/api/send-member-summary-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            familyHeadId: famigliaId,
            membroData: membroPayload,
            anagraficaData,
            isEdit: isEditing,
          }),
        });
      } catch (emailErr) {
        // L'errore email non blocca il salvataggio
        console.warn('[dialog] Invio email riepilogo fallito (non bloccante):', emailErr);
      }

      handleClose();
    } catch (err) {
      console.error(err);
      setError('Si è verificato un errore durante il salvataggio.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifica Dati Membro' : 'Aggiungi Membro Familiare'}</DialogTitle>
          <DialogDescription>
            {isEditing 
                ? "Aggiorna i dati di questo membro della famiglia."
                : "Inserisci i dati del nuovo membro e l'indirizzo condiviso del nucleo familiare."
            }
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2 p-1">
            <div className="grid gap-4 py-4 pr-4">
            <p className="text-sm font-medium">Dati del Membro</p>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={membroData.nome} onChange={handleChange} />
                </div>
                <div className="grid gap-2">
                <Label htmlFor="cognome">Cognome</Label>
                <Input id="cognome" value={membroData.cognome} onChange={handleChange} />
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="dataNascita">Data di Nascita</Label>
                <Input id="dataNascita" type="date" value={membroData.dataNascita} onChange={handleChange} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="codiceFiscale">Codice Fiscale</Label>
                <Input id="codiceFiscale" value={membroData.codiceFiscale} onChange={handleChange} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="luogoNascita">Luogo di Nascita</Label>
                <Input id="luogoNascita" value={membroData.luogoNascita} onChange={handleChange} />
            </div>

            <div className="space-y-4 border-t pt-4">
                <p className="text-sm font-medium">Indirizzo del Nucleo Familiare (Condiviso)</p>
                <div className="grid grid-cols-5 gap-4">
                    <div className="col-span-3 grid gap-2">
                        <Label htmlFor="citta">Città</Label>
                        <Input id="citta" value={anagraficaData.citta} onChange={handleChange} autoComplete="off"/>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="provincia">Prov.</Label>
                        <Input id="provincia" value={anagraficaData.provincia} onChange={handleChange} maxLength={2} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cap">CAP</Label>
                        <Input id="cap" value={anagraficaData.cap} onChange={handleChange} />
                    </div>
                </div>

                <div className="grid grid-cols-5 gap-4">
                    <div className="col-span-4 grid gap-2">
                        <Label htmlFor="via">Via</Label>
                        <Input id="via" value={anagraficaData.via} onChange={handleChange} autoComplete="off" />
                    </div>
                    <div className="col-span-1 grid gap-2">
                        <Label htmlFor="numeroCivico">N.</Label>
                        <Input id="numeroCivico" value={anagraficaData.numeroCivico} onChange={handleChange} autoComplete="off" />
                    </div>
                </div>
            </div>
            
            <div className="grid gap-2 border-t pt-4">
                <Label className="flex items-center gap-1">
                  Allergie / Intolleranze
                </Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="nessunaAllergia"
                    checked={nessunaAllergia}
                    onCheckedChange={(checked) => {
                      setNessunaAllergia(checked === true);
                      if (checked) setMembroData(prev => ({ ...prev, allergie: '' }));
                    }}
                  />
                  <Label htmlFor="nessunaAllergia" className="text-sm font-normal cursor-pointer">
                    Dichiaro che non ha allergie o intolleranze alimentari
                  </Label>
                </div>
                {!nessunaAllergia && (
                  <Input
                    id="allergie"
                    placeholder="Es. Arachidi, lattosio, glutine..."
                    value={membroData.allergie || ''}
                    onChange={handleChange}
                  />
                )}
            </div>

            {/* Consenso privacy unificato */}
            <div className="grid gap-2 border-t pt-4">
              <Label className="flex items-center gap-1">
                Autorizzazione a foto e social
              </Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="consenso"
                  checked={membroData.consenso ?? true}
                  onCheckedChange={(checked) =>
                    setMembroData(prev => ({ ...prev, consenso: checked === true }))
                  }
                />
                <Label htmlFor="consenso" className="text-sm font-normal cursor-pointer">
                  Autorizzo Azione Cattolica Chiari alla pubblicazione di fotografie sui propri canali social
                </Label>
              </div>
            </div>

            {/* Telefoni */}
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="grid gap-2">
                <Label htmlFor="telefonoPrincipale">Tel. Principale</Label>
                <Input id="telefonoPrincipale" value={membroData.telefonoPrincipale} onChange={handleChange} />
                </div>
                <div className="grid gap-2">
                <Label htmlFor="telefonoSecondario">Tel. Secondario</Label>
                <Input id="telefonoSecondario" value={membroData.telefonoSecondario} onChange={handleChange} />
                </div>
            </div>

            {/* ── Sezione minorenni: persone autorizzate al ritiro ────────────── */}
            {isMinorenne && (
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Ritiro al termine degli incontri</p>
                </div>

                {/* Toggle autonomia */}
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Può rientrare a casa in autonomia</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Il ragazzo è autorizzato a tornare a casa da solo al termine degli incontri.
                    </p>
                  </div>
                  <Switch
                    checked={membroData.puoRientrareInAutonomia ?? false}
                    onCheckedChange={(checked) =>
                      setMembroData(prev => ({ ...prev, puoRientrareInAutonomia: checked }))
                    }
                  />
                </div>

                {/* Lista persone autorizzate */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Persone autorizzate a prelevare il ragazzo
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddPersona}
                      className="h-7 text-xs"
                    >
                      <PlusCircle className="h-3 w-3 mr-1" />
                      Aggiungi
                    </Button>
                  </div>

                  {(membroData.personaAutorizzata || []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic text-center py-2 rounded-lg border border-dashed">
                      Nessuna persona autorizzata aggiunta.
                    </p>
                  )}

                  {(membroData.personaAutorizzata || []).map((persona, index) => (
                    <div key={index} className="rounded-lg border p-3 space-y-2 bg-background">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Persona {index + 1}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => handleRemovePersona(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1">
                          <Label className="text-xs">Nome</Label>
                          <Input
                            value={persona.nome}
                            onChange={e => handlePersonaChange(index, 'nome', e.target.value)}
                            placeholder="Mario"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">Cognome</Label>
                          <Input
                            value={persona.cognome}
                            onChange={e => handlePersonaChange(index, 'cognome', e.target.value)}
                            placeholder="Rossi"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">Telefono (opzionale)</Label>
                        <Input
                          value={persona.telefono || ''}
                          onChange={e => handlePersonaChange(index, 'telefono', e.target.value)}
                          placeholder="333 1234567"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            </div>
        </div>
        {error && <p className="text-sm text-destructive px-1">{error}</p>}
        <DialogFooter className='pt-4 border-t'>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>Annulla</Button>
          <Button type="submit" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Salvataggio...' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}