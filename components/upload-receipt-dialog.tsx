'use client';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, X, File as FileIcon, Loader2, RefreshCw, Copy, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUser, useStorage, useFirestore } from '@/src/firebase';
import { getAuth } from 'firebase/auth';
import { ref, uploadBytes, deleteObject, getDownloadURL } from "firebase/storage";
import { collection, doc, writeBatch, arrayUnion, serverTimestamp, getDocs, query, where, runTransaction, getDoc, collectionGroup } from 'firebase/firestore';
import { format } from 'date-fns';
import { Separator } from './ui/separator';
import { Raccolta } from '@/components/raccolta-card';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { triggerNotification } from '@/lib/trigger-notification';

interface PaymentItem {
    raccoltaId: string;
    raccoltaNome: string;
    memberId: string;
    memberName: string;
    phase: string;
    amount: string;
}

interface UploadReceiptDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  raccolte: Raccolta[];
  importoAtteso: string;
  paymentItems: PaymentItem[];
  onSuccess: () => void;
}

interface CachedPayment {
    id: string;
    expires: number;
}

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
};

const getCachedPaymentId = (): CachedPayment | null => {
    const cached = localStorage.getItem('paymentIdCache');
    if (!cached) return null;
    try {
        const data = JSON.parse(cached);
        if (data.id && data.expires && data.expires > Date.now()) return data;
        localStorage.removeItem('paymentIdCache');
        return null;
    } catch {
        return null;
    }
};

const setCachedPaymentId = (id: string) => {
    const expires = Date.now() + 20 * 60 * 1000;
    const cache: CachedPayment = { id, expires };
    localStorage.setItem('paymentIdCache', JSON.stringify(cache));
    return cache;
};

const clearCachedPaymentId = () => localStorage.removeItem('paymentIdCache');

const formatTimeLeft = (ms: number) => {
    if (ms < 0) return '00:00';
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const getCurrentMembershipYear = () => {
    const today = new Date();
    return today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
};

const getMemberDocRef = async (firestore: any, memberId: string): Promise<any | null> => {
    if (!firestore || !memberId) return null;
    const userDocRef = doc(firestore, 'users', memberId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) return userDocRef;
    const membersSnapshot = await getDocs(collectionGroup(firestore, 'membri'));
    const memberDoc = membersSnapshot.docs.find(d => d.id === memberId);
    if (memberDoc) return memberDoc.ref;
    console.error("Could not find document reference for member:", memberId);
    return null;
};

export function UploadReceiptDialog({
  isOpen,
  onOpenChange,
  raccolte,
  importoAtteso,
  paymentItems,
  onSuccess,
}: UploadReceiptDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingId, setIsGeneratingId] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);

  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const idGenerationStarted = useRef(false);

  const causaleCompleta = paymentId ? `ACR - ${paymentId}` : '';

  const generatePaymentId = useCallback(async (forceNew = false): Promise<string | null> => {
        if (!firestore || !user) { setFileError("Utente non autenticato."); return null; }
        if (forceNew) clearCachedPaymentId();
        setIsGeneratingId(true);
        setFileError(null);
        setPaymentId('');
        setTimeLeft(null);
        try {
            const generatedId = await runTransaction(firestore, async (transaction) => {
                const datePrefix = format(new Date(), 'ddMMyy');
                const q = query(collection(firestore, 'payments'), where('datePrefix', '==', datePrefix));
                const snap = await getDocs(q);
                let nextNum = snap.size + 1;
                while (true) {
                    const newId = `${datePrefix}${String(nextNum).padStart(4, '0')}`;
                    const docRef = doc(firestore, 'payments', newId);
                    const docSnap = await transaction.get(docRef);
                    if (!docSnap.exists()) {
                        transaction.set(docRef, { status: 'reserved', userId: user.uid, createdAt: serverTimestamp(), datePrefix });
                        return newId;
                    }
                    nextNum++;
                }
            });
            if (generatedId) {
                const newCache = setCachedPaymentId(generatedId);
                setPaymentId(generatedId);
                setTimeLeft(newCache.expires - Date.now());
                return generatedId;
            }
            return null;
        } catch (error) {
            console.error("Error generating payment ID:", error);
            setFileError("Errore nella generazione dell'ID. Riprova.");
            return null;
        } finally {
            setIsGeneratingId(false);
            idGenerationStarted.current = false;
        }
    }, [firestore, user]);

    const resetState = useCallback(() => {
        setFile(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        setFileError(null);
        setIsLoading(false);
        setStoragePath(null);
        idGenerationStarted.current = false;
    }, [preview]);

    useEffect(() => {
        if (isOpen && !idGenerationStarted.current) {
            const cached = getCachedPaymentId();
            if (cached) { setPaymentId(cached.id); setTimeLeft(cached.expires - Date.now()); }
            else { idGenerationStarted.current = true; generatePaymentId(); }
        }
    }, [isOpen, generatePaymentId]);

    useEffect(() => {
        if (!isOpen) { const t = setTimeout(resetState, 300); return () => clearTimeout(t); }
    }, [isOpen, resetState]);

    useEffect(() => {
        if (timeLeft === null) return;
        if (timeLeft <= 0) { clearCachedPaymentId(); setPaymentId(''); return; }
        const id = setInterval(() => setTimeLeft(p => p !== null ? p - 1000 : null), 1000);
        return () => clearInterval(id);
    }, [timeLeft]);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileError(null);
    if (fileRejections.length > 0) { setFileError("File non valido. Max 10MB, formati: JPG, PNG, WEBP, PDF."); return; }
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      setFile(f);
      if (f.type.startsWith('image/')) setPreview(URL.createObjectURL(f));
    }
  }, [preview]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'], 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  const groupedPaymentDetails = useMemo(() => {
    const groups = new Map<string, { beneficiario: string; iban: string }>();
    raccolte.forEach(r => {
        if (!r.beneficiario || !r.iban) return;
        const key = `${r.beneficiario}-${r.iban}`;
        if (!groups.has(key)) groups.set(key, { beneficiario: r.beneficiario, iban: r.iban });
    });
    return Array.from(groups.values());
  }, [raccolte]);

  const handleConfirm = async () => {
    if (!firestore || !file || !user || !paymentId || !storage) {
        setFileError('Dati mancanti. Assicurati di aver caricato il file.');
        return;
    }
    setIsLoading(true);
    let storageRef: any;
    try {
        const sPath = `receipts/${user.uid}/${Date.now()}_${file.name}`;
        setStoragePath(sPath);
        storageRef = ref(storage, sPath);
        await uploadBytes(storageRef, file);
        let finalReceiptUrl = await getDownloadURL(storageRef);

        // Upload to Google Drive
        try {
            const formDataDrive = new FormData();
            formDataDrive.append('file', file);
            // Nome file = causale (es. "ACR - 010526XXXX")
            formDataDrive.append('name', causaleCompleta);
            const projectNames = Array.from(new Set(paymentItems.map(i => i.raccoltaNome))).join('_');
            const todayFormatted = format(new Date(), 'dd-MM-yyyy');
            formDataDrive.append('folderName', `${projectNames} - ${todayFormatted}`);
            const driveRes = await fetch('/api/drive/upload-pagamento', { method: 'POST', body: formDataDrive });
            const driveData = await driveRes.json();
            if (driveData.file?.webViewLink) {
                finalReceiptUrl = driveData.file.webViewLink;
                deleteObject(storageRef).catch(e => console.error("Error deleting temp storage file:", e));
            }
        } catch (driveErr) {
            console.error("Errore salvataggio in Drive:", driveErr);
        }

        const batch = writeBatch(firestore);
        const paymentInfo: any = {
            status: 'committed',
            receiptUrl: finalReceiptUrl,
            timestamp: serverTimestamp(),
            analysisData: {
                importo: parseFloat(importoAtteso),
                data: format(new Date(), 'dd/MM/yyyy'),
            },
            userId: user.uid,
            isVerified: false,
            isPreApproved: false,
            // Stored for admin review during approval
            items: paymentItems,
            causaleAttesa: causaleCompleta,
            importoAtteso: parseFloat(importoAtteso),
        };

        const paymentDocRef = doc(firestore, 'payments', paymentId);
        batch.update(paymentDocRef, paymentInfo);

        const uniqueRaccoltaIds = Array.from(new Set(paymentItems.map(i => i.raccoltaId)));
        const currentMembershipYear = getCurrentMembershipYear();

        for (const raccoltaId of uniqueRaccoltaIds) {
            const raccoltaDocRef = doc(firestore, 'raccolte', raccoltaId);
            const itemsForThis = paymentItems.filter(i => i.raccoltaId === raccoltaId);
            const tesseramentoIds = itemsForThis.filter(i => i.phase === 'Tesseramento').map(i => i.memberId);
            const caparraIds = itemsForThis.filter(i => i.phase === 'Caparra').map(i => i.memberId);
            const saldoIds = itemsForThis.filter(i => i.phase === 'Saldo').map(i => i.memberId);

            if (tesseramentoIds.length > 0) {
                batch.update(raccoltaDocRef, { tesseratiIds: arrayUnion(...tesseramentoIds) });
                for (const memberId of tesseramentoIds) {
                    const memberDocRef = await getMemberDocRef(firestore, memberId);
                    if (memberDocRef) batch.update(memberDocRef, { tesseramento: currentMembershipYear });
                }
            }
            if (caparraIds.length > 0) batch.update(raccoltaDocRef, { caparraPaidIds: arrayUnion(...caparraIds) });
            if (saldoIds.length > 0) batch.update(raccoltaDocRef, { saldoPaidIds: arrayUnion(...saldoIds) });

            const paymentDetailsPayload: { [key: string]: any } = {};
            itemsForThis.forEach(item => {
                const phaseKey = item.phase.toLowerCase();
                paymentDetailsPayload[`paymentDetails.${phaseKey}.${item.memberId}`] = { ...paymentInfo, paymentId };
            });
            batch.update(raccoltaDocRef, paymentDetailsPayload);
        }

        await batch.commit();

        // Email al capofamiglia (fire-and-forget)
        getAuth().currentUser?.getIdToken().then(idToken => {
            fetch('/api/send-payment-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({
                    familyHeadId: user.uid,
                    paymentItems: paymentItems.map(i => ({ memberName: i.memberName, raccoltaNome: i.raccoltaNome, phase: i.phase, amount: i.amount })),
                    paymentId,
                    receiptUrl: finalReceiptUrl,
                    paymentMethod: 'bonifico',
                }),
            }).catch(e => console.warn('Errore invio email pagamento:', e));
        }).catch(() => {});

        clearCachedPaymentId();

        const memberNames = paymentItems.map(i => i.memberName).join(', ');
        const raccoltaNames = Array.from(new Set(paymentItems.map(i => i.raccoltaNome))).join(', ');
        triggerNotification({
            eventType: 'pagamento_in_attesa',
            title: '📄 Nuova ricevuta caricata - Approvazione richiesta',
            body: `${memberNames} ha caricato la ricevuta per: ${raccoltaNames} (€${importoAtteso}). In attesa di approvazione.`,
            href: '/contabilita/transazioni-da-controllare',
            userId: '__admin_broadcast__',
        });

        onSuccess();
        onOpenChange(false);
    } catch (err: any) {
        console.error("Errore durante la registrazione:", err);
        setFileError(`Errore: ${err.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const canConfirm = !!file && !!paymentId && !isLoading && !isGeneratingId;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Riepilogo e Caricamento Ricevuta</DialogTitle>
          <DialogDescription>
            Esegui il bonifico con i dati indicati, poi carica la ricevuta. Sarà revisionata dal responsabile prima della conferma.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid md:grid-cols-2 gap-8 overflow-hidden py-1">
          {/* Left Column – Dati Bonifico */}
          <ScrollArea className="h-full pr-4">
            <div className="flex flex-col space-y-6">
              <div>
                <h3 className="font-semibold mb-2">1. Esegui il Bonifico</h3>
                <div className="border rounded-lg text-sm bg-secondary/50">
                  {groupedPaymentDetails.map((detail, index) => (
                    <div key={index} className="p-4 border-b last:border-b-0">
                      <div className="flex justify-between items-center">
                        <div><p className="text-muted-foreground">Beneficiario</p><p className="font-medium">{detail.beneficiario}</p></div>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(detail.beneficiario)}><Copy className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <div><p className="text-muted-foreground">IBAN</p><p className="font-medium">{detail.iban}</p></div>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(detail.iban)}><Copy className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                  <div className="p-4 border-b">
                    <div className="flex justify-between items-center">
                      <div><p className="text-muted-foreground">Importo</p><p className="font-bold text-base">€{importoAtteso}</p></div>
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(importoAtteso)}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div>
                      <p className="text-muted-foreground">Causale</p>
                      {!paymentId || isGeneratingId ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <p className="font-semibold text-muted-foreground">Generazione ID in corso...</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <p className="font-bold text-primary">{causaleCompleta}</p>
                            <div className="flex items-center gap-1">
                              {timeLeft !== null && timeLeft > 0 && (
                                <span className="text-xs text-muted-foreground font-mono">{formatTimeLeft(timeLeft)}</span>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => generatePaymentId(true)} disabled={isGeneratingId}>
                                <RefreshCw className={cn('h-4 w-4', isGeneratingId && 'animate-spin')} />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(causaleCompleta)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {timeLeft !== null && timeLeft <= 0 && (
                            <p className="text-xs text-destructive mt-1">Codice scaduto. Rigenerane uno nuovo.</p>
                          )}
                        </>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Inserire questo codice all&apos;inizio della causale.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Riepilogo Voci</h3>
                <div className="border rounded-lg p-4 space-y-2 text-sm">
                  {paymentItems.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{item.phase} per {item.memberName} ({item.raccoltaNome})</span>
                      <span className="font-medium">€{item.amount}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between font-bold text-base pt-2">
                    <span>TOTALE</span><span>€{importoAtteso}</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Right Column – Caricamento */}
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 pr-4">
              <h3 className="font-semibold mb-2">2. Carica la Ricevuta</h3>

              {!file ? (
                <div
                  {...getRootProps()}
                  className={cn(
                    'flex flex-1 flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors min-h-[250px]',
                    { 'pointer-events-none opacity-50': !paymentId || isGeneratingId },
                    isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                  )}
                >
                  <input {...getInputProps()} disabled={!paymentId || isGeneratingId} />
                  <UploadCloud className="w-12 h-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {!paymentId || isGeneratingId ? "Attendere la generazione dell'ID..." : 'Trascina la ricevuta o clicca per selezionarla'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, PDF – max 10MB</p>
                  {fileError && <Alert variant="destructive" className="mt-4"><AlertDescription>{fileError}</AlertDescription></Alert>}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative border rounded-lg p-4 flex flex-col items-center gap-3 bg-muted/30">
                    {preview ? (
                      <Image src={preview} alt="Anteprima" width={300} height={300} className="w-auto h-auto max-h-64 object-contain rounded-md" />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8">
                        <FileIcon className="w-16 h-16 text-muted-foreground" />
                        <p className="mt-2 text-sm font-medium text-center">{file.name}</p>
                      </div>
                    )}
                    <Button
                      variant="ghost" size="icon"
                      className="absolute top-2 right-2 rounded-full h-7 w-7 bg-background border shadow-sm"
                      onClick={() => { setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); setFileError(null); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-3 text-sm text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    <span>File pronto. Clicca &quot;Conferma Pagamento&quot; per inviare la ricevuta al responsabile per l&apos;approvazione.</span>
                  </div>

                  {fileError && <Alert variant="destructive"><AlertDescription>{fileError}</AlertDescription></Alert>}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isGeneratingId}>Annulla</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Invio in corso...</>
            ) : (
              'Conferma Pagamento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
