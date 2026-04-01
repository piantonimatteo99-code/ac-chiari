'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
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
import { useFirestore, useUser, useStorage, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, X, File as FileIcon, Loader2, CircleX } from 'lucide-react';
import Image from 'next/image';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { useUserData } from '@/src/hooks/use-user-data';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { Raccolta } from './raccolta-card';
import { triggerNotification } from '@/lib/trigger-notification';

export interface Spesa {
    id: string;
    data: Date;
    descrizione: string;
    importo: number;
    importoPagato: number;
    receiptUrl?: string;
    raccoltaId?: string;
    raccoltaNome?: string;
    registeredBy: string; // UID of the user
    registeredByName: string; // displayName of the user
    createdAt: any;
}

interface AddSpesaDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AddSpesaDialog({ isOpen, onOpenChange }: AddSpesaDialogProps) {
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { userData } = useUserData();

  const [data, setData] = useState<Date | undefined>(new Date());
  const [descrizione, setDescrizione] = useState('');
  const [importo, setImporto] = useState<number | ''>('');
  const [selectedRaccolta, setSelectedRaccolta] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const raccolteQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'raccolte'), where('archived', '==', false));
  }, [firestore]);
  const { data: raccolte, isLoading: isLoadingRaccolte } = useCollection<Raccolta>(raccolteQuery);

  const resetForm = useCallback(() => {
    setData(new Date());
    setDescrizione('');
    setImporto('');
    setSelectedRaccolta('');
    setFile(null);
    if (preview) {
        URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setError(null);
    setIsSaving(false);
  }, [preview]);

  useEffect(() => {
    if (!isOpen) {
        const timer = setTimeout(() => {
            resetForm();
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [isOpen, resetForm]);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      setError('File non valido. Assicurati che sia un\'immagine o un PDF e non superi i 10MB.');
      setFile(null);
      setPreview(null);
      return;
    }

    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
       if (preview) {
        URL.revokeObjectURL(preview);
      }
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        setPreview(URL.createObjectURL(selectedFile));
      } else {
        setPreview(null);
      }
      setError(null);
    }
  }, [preview]);
  
  useEffect(() => {
    return () => {
        if (preview) {
            URL.revokeObjectURL(preview);
        }
    }
  }, [preview]);


  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'], 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  const handleSubmit = async () => {
    if (!firestore || !user || !userData) {
      setError("Utente non autenticato o database non disponibile.");
      return;
    }
    if (!data || !descrizione || importo === '' || importo <= 0) {
      setError("Data, descrizione e importo sono obbligatori.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let receiptUrl = '';
      if (file && storage) {
        const storageRef = ref(storage, `spese_receipts/${user.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        receiptUrl = await getDownloadURL(storageRef);
        
        // Upload to Google Drive (Pagamenti folder)
        try {
            const formDataDrive = new FormData();
            formDataDrive.append('file', file);
            // Construct a meaningful name for the expense receipt
            const driveFileName = `Spesa_${descrizione.replace(/[^a-zA-Z0-9-]/g, '_').substring(0, 30)}_${Date.now()}`;
            formDataDrive.append('name', driveFileName);
            
            const selectedRaccoltaData = raccolte?.find(r => r.id === selectedRaccolta);
            if (selectedRaccoltaData) {
                const dateStr = format(new Date(), 'dd-MM-yyyy');
                formDataDrive.append('folderName', `${selectedRaccoltaData.nome} - ${dateStr}`);
            }

            const driveRes = await fetch('/api/drive/upload-pagamento', {
                method: 'POST',
                body: formDataDrive
            });
            const driveData = await driveRes.json();
            
            if (driveData.file?.webViewLink) {
                receiptUrl = driveData.file.webViewLink;

                // Delete the temporary file from Firebase Storage to save space since it's now on Drive
                deleteObject(storageRef).catch(e => console.error("Error deleting temp storage file:", e));
            }
        } catch (driveErr) {
            console.error("Errore salvataggio ricevuta della spesa in Drive:", driveErr);
        }
      }
      
      const selectedRaccoltaData = raccolte?.find(r => r.id === selectedRaccolta);

      const spesaData: Omit<Spesa, 'id'> = {
        data,
        descrizione,
        importo: Number(importo),
        importoPagato: 0,
        receiptUrl,
        raccoltaId: selectedRaccoltaData?.id || '',
        raccoltaNome: selectedRaccoltaData?.nome || '',
        registeredBy: user.uid,
        registeredByName: userData.displayName,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(firestore, 'spese'), spesaData);

      triggerNotification({
          eventType: 'transazione_da_controllare',
          title: `Nuova Spesa Registrata (${userData.displayName})`,
          body: `Registrata una spesa di €${Number(importo).toFixed(2)} per: ${descrizione}`,
          href: '/contabilita/conto',
          userId: '__admin_broadcast__'
      });

      onOpenChange(false);
    } catch (err: any) {
      console.error("Errore during il salvataggio della spesa:", err);
      setError(`Si è verificato un errore: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };
  
    const handleRemoveFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        setFile(null);
        setPreview(null);
        setError(null);
    }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Aggiungi Spesa</DialogTitle>
          <DialogDescription>
            Registra una nuova uscita sostenuta per le attività.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-4 -mr-4 p-1">
            <div className="grid gap-6 py-4 pr-2">
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="data">Data della Spesa</Label>
                        <DatePicker date={data} setDate={setData} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="importo">Importo (€)</Label>
                        <Input
                        id="importo"
                        type="number"
                        value={importo}
                        onChange={(e) => setImporto(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        placeholder="0.00"
                        />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="descrizione">Descrizione</Label>
                    <Textarea
                    id="descrizione"
                    value={descrizione}
                    onChange={(e) => setDescrizione(e.target.value)}
                    placeholder="Es. Acquisto materiali per attività..."
                    rows={2}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="raccolta">Raccolta di Riferimento (Opzionale)</Label>
                    <Select value={selectedRaccolta} onValueChange={setSelectedRaccolta}>
                        <SelectTrigger id="raccolta">
                            <SelectValue placeholder={isLoadingRaccolte ? "Caricamento..." : "Nessuna"} />
                        </SelectTrigger>
                        <SelectContent>
                             {raccolte && raccolte.length > 0 && selectedRaccolta && (
                                <div
                                    className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-destructive outline-none focus:bg-accent"
                                    onClick={() => setSelectedRaccolta('')}
                                >
                                    <CircleX className="absolute left-2 h-4 w-4" />
                                    Rimuovi selezione
                                </div>
                            )}
                            {raccolte?.map(raccolta => (
                                <SelectItem key={raccolta.id} value={raccolta.id}>
                                    {raccolta.nome}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                <Separator />

                <div className="grid gap-2">
                    <Label>Carica Ricevuta (Opzionale)</Label>
                    <div {...getRootProps()} className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                        <input {...getInputProps()} />
                        {file ? (
                            <div className="text-center">
                                {preview ? <Image src={preview} alt="Anteprima" width={200} height={150} className="w-auto h-auto max-h-36 object-contain rounded-md" /> : <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-md"><FileIcon className="w-12 h-12 text-muted-foreground" /><p className="mt-2 text-sm font-medium">{file.name}</p></div>}
                                <p className="text-xs text-muted-foreground mt-2">{file.name}</p>
                            </div>
                        ) : (
                            <>
                            <UploadCloud className="w-10 h-10 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">Trascina un file o clicca</p>
                            <p className="text-xs text-muted-foreground mt-1">Immagine o PDF, max 10MB.</p>
                            </>
                        )}
                        { file && (
                            <Button variant="ghost" size="icon" className="absolute top-2 right-2 rounded-full h-7 w-7 bg-background border shadow-sm" onClick={handleRemoveFile}><X className="h-4 w-4" /></Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
        {error && <p className="text-sm text-destructive px-1">{error}</p>}
        <DialogFooter className='pt-4 border-t'>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Salvataggio...' : 'Salva Spesa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
