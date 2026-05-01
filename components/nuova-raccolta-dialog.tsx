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
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
import { useCollection, useFirestore, useMemoFirebase } from '@/src/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { triggerNotification } from '@/lib/trigger-notification';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import type { Raccolta } from './raccolta-card';
import { toDate } from 'date-fns';
import { Separator } from './ui/separator';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Alert, AlertDescription } from './ui/alert';

interface NuovaRaccoltaDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  raccoltaToEdit?: Raccolta | null;
  initialData?: Partial<Raccolta>;
  onSaveSuccess?: (raccoltaId: string) => void;
}

export interface FaseRaccolta {
    attiva: boolean;
    dataFine: Date | undefined | null;
    importo: string;
    conclusa: boolean;
    tariffaFratelliAttiva?: boolean;
    importoTariffaFratelli?: string;
}

const capitalizeFirstLetter = (string: string) => {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};

export function NuovaRaccoltaDialog({ isOpen, onOpenChange, raccoltaToEdit, initialData, onSaveSuccess }: NuovaRaccoltaDialogProps) {
    const firestore = useFirestore();
    const isEditing = !!raccoltaToEdit;

    const [nomeRaccolta, setNomeRaccolta] = useState('');
    const [tipo, setTipo] = useState<'standard' | 'tesseramento'>('standard');
    const [selectedGruppi, setSelectedGruppi] = useState<string[]>([]);
    const DEFAULT_IBAN = 'IT67Q0200854341000100216072';
    const DEFAULT_BENEFICIARIO = 'PARROCCHIA DEI SANTI FAUSTINO E GIOVITA UNICREDIT – AG. CHIARI - VIALE MELLINI 1';
    const [iban, setIban] = useState(DEFAULT_IBAN);
    const [beneficiario, setBeneficiario] = useState(DEFAULT_BENEFICIARIO);
    const [accettaBonifico, setAccettaBonifico] = useState(true);
    const [accettaContanti, setAccettaContanti] = useState(false);
    
    const initialFaseState: FaseRaccolta = { attiva: false, dataFine: undefined, importo: '', conclusa: false };
    const initialFaseSaldoState: FaseRaccolta = { ...initialFaseState, tariffaFratelliAttiva: false, importoTariffaFratelli: '' };

    const [faseConferma, setFaseConferma] = useState<FaseRaccolta>(initialFaseState);
    const [faseCaparra, setFaseCaparra] = useState<FaseRaccolta>(initialFaseState);
    const [faseSaldo, setFaseSaldo] = useState<FaseRaccolta>(initialFaseSaldoState);
    
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const groupsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'gruppi');
    }, [firestore]);
    const { data: groups, isLoading: isLoadingGroups } = useCollection<Group>(groupsQuery);


    const handleGroupToggle = (groupId: string, isChecked: boolean) => {
        setSelectedGruppi(prev => 
            isChecked ? [...prev, groupId] : prev.filter(id => id !== groupId)
        );
    };

    const convertFirestoreTimestampToDate = (fase: FaseRaccolta | undefined): FaseRaccolta => {
        if (!fase) return initialFaseState;
        
        const newFase = { ...fase };
        if (fase.dataFine && typeof fase.dataFine === 'object' && 'seconds' in fase.dataFine) {
            newFase.dataFine = toDate((fase.dataFine as any).seconds * 1000);
        } else if (typeof fase.dataFine === 'string') {
             newFase.dataFine = new Date(fase.dataFine);
        }
        return newFase;
    };
    
    const validateFase = (fase: FaseRaccolta, nomeFase: string): string | null => {
        if (!fase.attiva) return null;
        
        if (nomeFase === 'Conferma') {
            const importo = parseFloat(fase.importo);
             if (fase.importo && (isNaN(importo) || importo < 0)) {
                return `L'importo per la fase "${nomeFase}" non è valido.`;
            }
        } else {
            const importo = parseFloat(fase.importo);
            if (isNaN(importo) || importo <= 0) {
                return `L'importo per la fase "${nomeFase}" non è valido.`;
            }
        }

        if (fase.tariffaFratelliAttiva) {
            const importoFratelli = parseFloat(fase.importoTariffaFratelli || '');
            if (isNaN(importoFratelli) || importoFratelli <= 0) {
                 return `L'importo tariffa fratelli per la fase "${nomeFase}" non è valido.`;
            }
        }
        return null;
    }


    const handleSave = async () => {
        setError(null);
        if(!nomeRaccolta){
            setError("Il nome della raccolta è obbligatorio.");
            return;
        }
        if(selectedGruppi.length === 0){
            setError("Seleziona almeno un gruppo.");
            return;
        }
        
        if (tipo === 'standard') {
            const erroreConferma = validateFase(faseConferma, "Conferma");
            if(erroreConferma) { setError(erroreConferma); return; }
            
            const erroreCaparra = validateFase(faseCaparra, "Caparra");
            if(erroreCaparra) { setError(erroreCaparra); return; }
            
            const erroreSaldo = validateFase(faseSaldo, "Saldo");
            if(erroreSaldo) { setError(erroreSaldo); return; }

            if (!faseConferma.attiva && !faseCaparra.attiva && !faseSaldo.attiva) {
                setError("Devi attivare almeno una fase per la raccolta standard.");
                return;
            }
        }
        
        if (!accettaBonifico && !accettaContanti) {
            setError("Devi selezionare almeno un metodo di pagamento.");
            return;
        }

        setIsSaving(true);
        
        const cleanFase = (fase: FaseRaccolta): Partial<FaseRaccolta> => {
            const cleaned: Partial<FaseRaccolta> = { ...fase };
            if (!fase.attiva) {
                cleaned.dataFine = null;
            }
            // Ensure dataFine is null if undefined, to prevent firestore errors
            if (fase.attiva && fase.dataFine === undefined) {
                 cleaned.dataFine = null;
            }
            return cleaned;
        };

        const raccoltaData: Partial<Raccolta> = {
            nome: nomeRaccolta,
            tipo: tipo,
            gruppiId: selectedGruppi,
            accettaBonifico,
            accettaContanti,
            iban: accettaBonifico ? iban : '',
            beneficiario: accettaBonifico ? beneficiario : '',
            faseConferma: cleanFase(faseConferma) as FaseRaccolta,
            faseCaparra: cleanFase(faseCaparra) as FaseRaccolta,
            faseSaldo: cleanFase(faseSaldo) as FaseRaccolta,
            archived: false,
        };

        if (!isEditing) {
            raccoltaData.confermatiIds = [];
            raccoltaData.caparraPaidIds = [];
            raccoltaData.saldoPaidIds = [];
            raccoltaData.tesseratiIds = [];
        }


        try {
            if(!firestore) throw new Error("Firestore non disponibile");

            let finalId: string;

            if (isEditing && raccoltaToEdit) {
                await setDoc(doc(firestore, 'raccolte', raccoltaToEdit.id), raccoltaData, { merge: true });
                finalId = raccoltaToEdit.id;
            } else {
                const newDocRef = await addDoc(collection(firestore, 'raccolte'), { ...raccoltaData, createdAt: serverTimestamp() });
                finalId = newDocRef.id;

                // Notifica broadcast nuova raccolta
                triggerNotification({
                  eventType: 'raccolta_nuova',
                  title: `💳 Nuova raccolta: ${nomeRaccolta}`,
                  body: `È stata aperta una nuova raccolta fondi: "${nomeRaccolta}". Accedi per visualizzare le scadenze.`,
                  href: `/contabilita/raccolte`,
                });
            }
            
            if (onSaveSuccess) {
                onSaveSuccess(finalId);
            }

            onOpenChange(false);
        } catch (error) {
            console.error("Errore durante il salvataggio della raccolta:", error);
            setError(`Si è verificato un errore: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    useEffect(() => {
        if(isOpen) {
             if(isEditing && raccoltaToEdit) {
                setNomeRaccolta(raccoltaToEdit.nome);
                setTipo(raccoltaToEdit.tipo || 'standard');
                setSelectedGruppi(raccoltaToEdit.gruppiId || []);
                setAccettaBonifico(raccoltaToEdit.accettaBonifico ?? true);
                setAccettaContanti(raccoltaToEdit.accettaContanti ?? false);
                setIban(raccoltaToEdit.iban || '');
                setBeneficiario(raccoltaToEdit.beneficiario || '');
                setFaseConferma(convertFirestoreTimestampToDate(raccoltaToEdit.faseConferma));
                setFaseCaparra(convertFirestoreTimestampToDate(raccoltaToEdit.faseCaparra));
                const saldoConverted = convertFirestoreTimestampToDate(raccoltaToEdit.faseSaldo);
                setFaseSaldo({ ...initialFaseSaldoState, ...saldoConverted });
             } else {
                setNomeRaccolta(initialData?.nome || '');
                setTipo(initialData?.tipo || 'standard');
                setSelectedGruppi(initialData?.gruppiId || []);
                setAccettaBonifico(true);
                setAccettaContanti(false);
                setIban(DEFAULT_IBAN);
                setBeneficiario(DEFAULT_BENEFICIARIO);
                setFaseConferma(initialFaseState);
                setFaseCaparra(initialFaseState);
                setFaseSaldo(initialFaseSaldoState);
             }
            setError(null);
            setIsSaving(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, raccoltaToEdit, isEditing, initialData]);

    const renderFase = (
        fase: FaseRaccolta, 
        setFase: React.Dispatch<React.SetStateAction<any>>,
        label: string
    ) => (
        <div className='space-y-4'>
            <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                    <Label htmlFor={`${label}-switch`}>{label}</Label>
                    <p className='text-xs text-muted-foreground'>Attiva la fase di {label.toLowerCase()}.</p>
                </div>
                <Switch id={`${label}-switch`} checked={fase.attiva} onCheckedChange={(checked) => setFase((prev: any) => ({...prev, attiva: checked, conclusa: checked ? prev.conclusa : false}))} />
            </div>
            {fase.attiva && (
                 <div className="space-y-4 pl-2 border-l-2 ml-3 pl-4">
                    <div className="space-y-4">
                        <div className="grid w-full gap-1.5">
                            <Label htmlFor={`importo-${label}`}>Importo (€)</Label>
                            <Input 
                                id={`importo-${label}`}
                                type="number"
                                value={fase.importo}
                                onChange={(e) => setFase((prev: any) => ({ ...prev, importo: e.target.value }))}
                                placeholder='0.00'
                            />
                        </div>
                        <div className="grid w-full gap-1.5">
                            <Label htmlFor={`data-${label}`}>Termine</Label>
                            <DatePicker date={fase.dataFine as Date | undefined} setDate={(date) => setFase((prev: any) => ({...prev, dataFine: date}))} />
                        </div>
                        {isEditing && (
                            <div className="flex items-center justify-between">
                                <Label htmlFor={`concludi-${label}`} className="text-sm text-destructive">Concludi Fase</Label>
                                <Switch id={`concludi-${label}`} checked={fase.conclusa} onCheckedChange={(checked) => setFase((prev: any) => ({...prev, conclusa: checked}))} />
                            </div>
                        )}
                    </div>
                      {label === 'Saldo' && (
                        <>
                            <div className="flex items-center justify-between rounded-lg border p-3 mt-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="tariffa-fratelli-switch">Tariffa Fratelli</Label>
                                    <p className="text-xs text-muted-foreground">Applica uno sconto sul saldo.</p>
                                </div>
                                <Switch
                                    id="tariffa-fratelli-switch"
                                    checked={fase.tariffaFratelliAttiva}
                                    onCheckedChange={(checked) => setFase((prev: any) => ({ ...prev, tariffaFratelliAttiva: checked }))}
                                />
                            </div>
                            {fase.tariffaFratelliAttiva && (
                                <div className="grid w-full gap-1.5 pl-2 border-l-2 ml-3 pl-4">
                                    <Label htmlFor="importo-tariffa-fratelli">Importo Tariffa Fratelli (€)</Label>
                                    <Input
                                        id="importo-tariffa-fratelli"
                                        type="number"
                                        value={fase.importoTariffaFratelli}
                                        onChange={(e) => setFase((prev: any) => ({ ...prev, importoTariffaFratelli: e.target.value }))}
                                        placeholder="0.00"
                                    />
                                </div>
                            )}
                        </>
                    )}
                 </div>
            )}
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Modifica Raccolta Fondi' : 'Nuova Raccolta Fondi'}</DialogTitle>
                    <DialogDescription>
                       {isEditing ? 'Modifica i dettagli di questa raccolta.' : 'Configura i dettagli della nuova raccolta, a quali gruppi è destinata e le scadenze delle fasi.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-1 pr-2">
                    <div className="grid gap-6 py-4 md:grid-cols-2 md:gap-8 pr-4">
                        <div className='space-y-4'>
                            <div className="grid gap-2">
                                <Label htmlFor="nome-raccolta">Nome Raccolta</Label>
                                <Input id="nome-raccolta" value={nomeRaccolta} onChange={(e) => setNomeRaccolta(capitalizeFirstLetter(e.target.value))} placeholder="Es. Iscrizione Campo Estivo 2024" />
                            </div>
                            
                            <div className="grid gap-2">
                                <Label>Tipo di Raccolta</Label>
                                <RadioGroup defaultValue="standard" value={tipo} onValueChange={(value) => setTipo(value as 'standard' | 'tesseramento')}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="standard" id="standard" />
                                        <Label htmlFor="standard">Standard (per attività, campi, ecc.)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="tesseramento" id="tesseramento" />
                                        <Label htmlFor="tesseramento">Tesseramento</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="grid gap-3">
                                <Label>Gruppi Target</Label>
                                <ScrollArea className="h-40 rounded-md border p-4">
                                    {isLoadingGroups ? <p>Caricamento gruppi...</p> : (
                                        <div className="space-y-2">
                                            {groups && groups.length > 0 ? groups.map(group => (
                                                <div key={group.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`group-${group.id}`}
                                                        checked={selectedGruppi.includes(group.id)}
                                                        onCheckedChange={(checked) => handleGroupToggle(group.id, !!checked)}
                                                    />
                                                    <label htmlFor={`group-${group.id}`} className="text-sm font-medium leading-none">
                                                        {group.name}
                                                    </label>
                                                </div>
                                            )) : <p className="text-sm text-muted-foreground">Nessun gruppo trovato.</p>}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                            
                            <Separator />

                            <div>
                                <Label>Metodi di Pagamento Accettati</Label>
                                <div className="space-y-3 mt-2">
                                    <div className="rounded-lg border p-3">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="bonifico-switch">Accetta Bonifico</Label>
                                            <Switch id="bonifico-switch" checked={accettaBonifico} onCheckedChange={setAccettaBonifico} />
                                        </div>
                                        {accettaBonifico && (
                                            <div className="space-y-4 mt-4 pt-4 border-t">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="beneficiario">Intestazione Beneficiario</Label>
                                                    <Input id="beneficiario" value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} placeholder="Es. Parrocchia di San Pancrazio" />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="iban">IBAN per il Pagamento</Label>
                                                    <Input id="iban" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="IT00X0000000000000000000000" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg border p-3">
                                        <Label htmlFor="contanti-switch">Accetta Contanti</Label>
                                        <Switch id="contanti-switch" checked={accettaContanti} onCheckedChange={setAccettaContanti} />
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div className="space-y-4">
                           {tipo === 'standard' ? (
                                <>
                                    {renderFase(faseConferma, setFaseConferma, "Conferma")}
                                    {renderFase(faseCaparra, setFaseCaparra, "Caparra")}
                                    {renderFase(faseSaldo, setFaseSaldo, "Saldo")}
                                </>
                           ) : (
                               <Alert>
                                    <AlertDescription>
                                        Le quote per il tesseramento verranno calcolate automaticamente per ogni famiglia in base alle tariffe definite nella sezione Tesseramento e alla composizione del nucleo familiare.
                                    </AlertDescription>
                                </Alert>
                           )}
                        </div>
                    </div>
                </div>
                 {error && <p className="text-sm text-destructive px-1">{error}</p>}
                <DialogFooter className="pt-4 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Annulla</Button>
                    <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Salvataggio...' : 'Salva Raccolta'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
