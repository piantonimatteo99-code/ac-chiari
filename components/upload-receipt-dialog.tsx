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
import { UploadCloud, X, File as FileIcon, Loader2, Pencil, AlertCircle, RefreshCw, Copy } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUser, useStorage, useFirestore } from '@/src/firebase';
import { ref, uploadBytes, deleteObject, getDownloadURL } from "firebase/storage";
import { collection, doc, writeBatch, arrayUnion, serverTimestamp, getDocs, query, where, runTransaction, addDoc, onSnapshot, getDoc, collectionGroup, deleteField } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO, isValid, parse } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from './ui/separator';
import { Raccolta } from '@/components/raccolta-card';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AnalysisResult {
  importo?: number | null;
  nome_esecutore?: string | null;
  data?: string | null;
  beneficiario?: string | null;
  iban_beneficiario?: string | null;
  causale?: string | null;
}

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

interface ValidationStatus {
  importo: { isValid: boolean; message?: string };
  causale: { isValid: boolean; message?: string };
  beneficiario: { isValid: boolean; message?: string };
  iban: { isValid: boolean; message?: string };
}

interface CachedPayment {
    id: string;
    expires: number;
}

const initialValidationStatus: ValidationStatus = {
  importo: { isValid: true },
  causale: { isValid: true },
  beneficiario: { isValid: true },
  iban: { isValid: true },
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
};

const formatDateForDisplay = (dateString?: string | null): string => {
    if (!dateString) return '';
    try {
        const date = parseISO(dateString);
        if (isValid(date)) {
          return format(date, 'dd/MM/yyyy');
        }
        return dateString;
    } catch (e) {
        return dateString;
    }
};

const parseDisplayDate = (dateString?: string | null): Date | undefined => {
    if (!dateString) return undefined;
    
    let date = parse(dateString, 'dd/MM/yyyy', new Date());
    if (isValid(date)) {
        return date;
    }
    
    date = parseISO(dateString);
    if (isValid(date)) {
        return date;
    }

    return undefined;
};

// Helper functions for localStorage
const getCachedPaymentId = (): CachedPayment | null => {
    const cached = localStorage.getItem('paymentIdCache');
    if (!cached) return null;
    try {
        const data = JSON.parse(cached);
        if (data.id && data.expires && data.expires > Date.now()) {
            return data;
        }
        localStorage.removeItem('paymentIdCache');
        return null;
    } catch {
        return null;
    }
};

const setCachedPaymentId = (id: string) => {
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes from now
    const cache: CachedPayment = { id, expires };
    localStorage.setItem('paymentIdCache', JSON.stringify(cache));
    return cache;
};

const clearCachedPaymentId = () => {
    localStorage.removeItem('paymentIdCache');
};

const formatTimeLeft = (milliseconds: number) => {
    if (milliseconds < 0) return '00:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getCurrentMembershipYear = () => {
  const today = new Date();
  const month = today.getMonth(); // 0-11 (September is 8)
  return month >= 8 ? today.getFullYear() : today.getFullYear() - 1;
};

const getMemberDocRef = async (firestore: any, memberId: string): Promise<any | null> => {
    if (!firestore || !memberId) return null;
    
    const userDocRef = doc(firestore, 'users', memberId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        return userDocRef;
    }

    const membersSnapshot = await getDocs(collectionGroup(firestore, 'membri'));
    const memberDoc = membersSnapshot.docs.find(doc => doc.id === memberId);

    if (memberDoc) {
        return memberDoc.ref;
    }

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
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [formData, setFormData] = useState<AnalysisResult>({});
  const [editedFields, setEditedFields] = useState<Record<keyof AnalysisResult, boolean>>({
    importo: false,
    nome_esecutore: false,
    data: false,
    beneficiario: false,
    iban_beneficiario: false,
    causale: false,
  });

  const [validationStatus, setValidationStatus] = useState<ValidationStatus>(initialValidationStatus);
  const [isFormValid, setIsFormValid] = useState(false);
  
  const [paymentId, setPaymentId] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();

  const [storagePath, setStoragePath] = useState<string | null>(null);
  const idGenerationStarted = useRef(false);

  const generatePaymentId = useCallback(async (forceNew = false): Promise<string | null> => {
        if (!firestore || !user) {
            setFileError("Utente non autenticato o database non disponibile.");
            return null;
        }

        if(forceNew) {
            clearCachedPaymentId();
        }

        setIsGeneratingId(true);
        setFileError(null);
        setPaymentId('');
        setTimeLeft(null);

        try {
            const generatedId = await runTransaction(firestore, async (transaction) => {
                const today = new Date();
                const datePrefix = format(today, 'ddMMyy');
                
                const paymentsRef = collection(firestore, 'payments');
                const q = query(paymentsRef, where('datePrefix', '==', datePrefix));
                
                const querySnapshot = await getDocs(q); 
                
                let nextIdNumber = querySnapshot.size + 1;
                let newPaymentId: string;
                let newPaymentDocRef;

                while(true) {
                    newPaymentId = `${datePrefix}${String(nextIdNumber).padStart(4, '0')}`;
                    newPaymentDocRef = doc(firestore, 'payments', newPaymentId);
                    const docSnap = await transaction.get(newPaymentDocRef);

                    if (!docSnap.exists()) {
                        transaction.set(newPaymentDocRef, {
                            status: 'reserved',
                            userId: user.uid,
                            createdAt: serverTimestamp(),
                            datePrefix: datePrefix,
                        });
                        return newPaymentId;
                    }
                    nextIdNumber++;
                }
            });
            
            if(generatedId) {
                const newCache = setCachedPaymentId(generatedId);
                setPaymentId(generatedId);
                setTimeLeft(newCache.expires - Date.now());
                return generatedId;
            }
            return null;

        } catch (error) {
            console.error("Error generating payment ID:", error);
            setFileError("Errore nella generazione dell'ID di pagamento. Riprova.");
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
        setAnalysisResult(null);
        setFormData({});
        setEditedFields({ importo: false, nome_esecutore: false, data: false, beneficiario: false, iban_beneficiario: false, causale: false });
        setValidationStatus(initialValidationStatus);
        setIsFormValid(false);
        setStoragePath(null);
        idGenerationStarted.current = false;
    }, [preview]);

    useEffect(() => {
        if (isOpen && !idGenerationStarted.current) {
            const cachedId = getCachedPaymentId();
            if (cachedId) {
                setPaymentId(cachedId.id);
                setTimeLeft(cachedId.expires - Date.now());
            } else {
                idGenerationStarted.current = true;
                generatePaymentId();
            }
        }
    }, [isOpen, generatePaymentId]);


  useEffect(() => {
    if (!isOpen) {
      const timeout = setTimeout(() => {
          resetState();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, resetState]);
  
  useEffect(() => {
    if(timeLeft === null) return;
    
    if (timeLeft <= 0) {
        clearCachedPaymentId();
        setPaymentId('');
        return;
    }

    const intervalId = setInterval(() => {
        setTimeLeft(prev => (prev !== null ? prev - 1000 : null));
    }, 1000);

    return () => clearInterval(intervalId);
}, [timeLeft]);


  useEffect(() => {
    if (analysisResult) {
      setFormData({
        ...analysisResult,
        importo: analysisResult.importo ? Math.abs(analysisResult.importo) : null,
        data: formatDateForDisplay(analysisResult.data)
      });
    }
  }, [analysisResult]);

  const expectedBeneficiaries = useMemo(() => 
    raccolte.map(r => r.beneficiario?.trim().toLowerCase() || '').filter(Boolean)
  , [raccolte]);

  const expectedIbans = useMemo(() => 
    raccolte.map(r => r.iban?.replace(/\s/g, '').toUpperCase() || '').filter(Boolean)
  , [raccolte]);
  
  const causaleCompleta = paymentId ? `ACR - ${paymentId}` : '';

  useEffect(() => {
    if (!file) {
        setIsFormValid(false);
        return;
    }
    
    if (file && !analysisResult) {
        setIsFormValid(false);
        return;
    }

    const validateImporto = (): { isValid: boolean; message?: string } => {
        const importoRilevato = formData.importo;
        if (importoRilevato === undefined || importoRilevato === null) {
            return { isValid: false, message: `Importo non rilevato. Atteso: €${importoAtteso}.` };
        }
        const importoAttesoFloat = parseFloat(importoAtteso);
        if (Math.abs(importoRilevato - importoAttesoFloat) < 0.01) {
            return { isValid: true };
        }
        return { isValid: false, message: `Atteso €${importoAtteso}, rilevato €${importoRilevato.toFixed(2)}.` };
    };

    const validateCausale = (): { isValid: boolean; message?: string } => {
        if(!paymentId) return { isValid: false, message: 'ID Pagamento non ancora generato.' };
        const causaleRilevata = (formData.causale || '').trim().toLowerCase();
        const causaleAttesa = `ACR - ${paymentId}`.toLowerCase();
        
        if (causaleRilevata.startsWith(causaleAttesa)) {
            return { isValid: true };
        }
        return { isValid: false, message: `La causale deve iniziare con: ACR - ${paymentId}.` };
    };

    const normalizeTextToSet = (text: string): Set<string> => {
        return new Set((text || '')
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[.,()]/g, ' ')
            .split(/\s+/)
            .filter(Boolean)
        );
    };

    const validateBeneficiario = (): { isValid: boolean; message?: string } => {
        const beneficiarioRilevato = formData.beneficiario || "";
        if (!beneficiarioRilevato) {
            return { isValid: false, message: "Beneficiario non rilevato." };
        }
        if (expectedBeneficiaries.length === 0) {
            return { isValid: true, message: "Nessun beneficiario configurato, validazione saltata." };
        }
        
        const detectedWordsSet = normalizeTextToSet(beneficiarioRilevato);

        const isMatch = expectedBeneficiaries.some(expected => {
            if (!expected) return false;
            const expectedWordsSet = normalizeTextToSet(expected);
            if (expectedWordsSet.size === 0) return false;
            
            const intersection = new Set(Array.from(detectedWordsSet).filter(x => expectedWordsSet.has(x)));
            const union = new Set(Array.from(detectedWordsSet).concat(Array.from(expectedWordsSet)));
            
            const jaccardIndex = union.size > 0 ? intersection.size / union.size : 0;
            
            return jaccardIndex > 0.5;
        });

        if (isMatch) {
            return { isValid: true };
        }

        return { isValid: false, message: `Beneficiario "${formData.beneficiario || 'Non trovato'}" non corrisponde.` };
    };


    const validateIban = (): { isValid: boolean; message?: string } => {
      const ibanRilevato = (formData.iban_beneficiario || "").replace(/\s/g, "").toUpperCase();
      if (!ibanRilevato) {
        return { isValid: false, message: "IBAN non rilevato." };
      }
      if (expectedIbans.length === 0) {
        return { isValid: true, message: "Nessun IBAN configurato, validazione saltata." };
      }
      if (expectedIbans.some(expected => ibanRilevato === expected)) {
        return { isValid: true };
      }
      return { isValid: false, message: `L'IBAN non corrisponde a quello atteso.` };
    };


    const newStatus: ValidationStatus = {
        importo: validateImporto(),
        causale: validateCausale(),
        beneficiario: validateBeneficiario(),
        iban: validateIban(),
    };

    setValidationStatus(newStatus);
    setIsFormValid(
        newStatus.importo.isValid &&
        newStatus.causale.isValid &&
        newStatus.beneficiario.isValid &&
        newStatus.iban.isValid
    );

  }, [formData, file, analysisResult, importoAtteso, paymentId, expectedBeneficiaries, expectedIbans]);


  const handleFileAnalysis = async (fileToAnalyze: File, generatedPaymentId: string) => {
    if (!fileToAnalyze || !user || !firestore || !storage) {
      setFileError("Manca il file o la sessione utente è scaduta.");
      return;
    }
    setIsLoading(true);
    setFileError(null);

    let storageRef: any;
    try {
      const sPath = `receipts/${user.uid}/${Date.now()}_${fileToAnalyze.name}`;
      setStoragePath(sPath);
      storageRef = ref(storage, sPath);

      await uploadBytes(storageRef, fileToAnalyze);
      const gsPath = `gs://${storageRef.bucket}/${sPath}`;

      const docRef = await addDoc(collection(firestore, 'generate'), { image: gsPath, paymentId: generatedPaymentId });

      const unsubscribe = onSnapshot(docRef, (snap) => {
        const data = snap.data();
        if (data?.status?.state === 'ERRORED') {
          console.error("Errore dall'estensione:", data.status);
          setFileError(`L'analisi AI è fallita: ${data.status.error || 'Errore sconosciuto.'}`);
          setIsLoading(false);
          unsubscribe();
          return;
        }
        const output = data?.output || data?.response;
        if (output) {
          try {
            const jsonString = output.replace(/```json\n?|\n?```/g, '');
            setAnalysisResult(JSON.parse(jsonString));
          } catch (e) {
            setFileError(`Errore nel parsing del risultato JSON: ${e}`);
          } finally {
            setIsLoading(false);
            unsubscribe();
          }
        }
      });
    } catch (err: any) {
      setFileError(`Si è verificato un errore: ${err.message}`);
      setIsLoading(false);
      if (storageRef) deleteObject(storageRef).catch(e => console.error("Failed to delete temp file on error:", e));
    }
  };
  

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    setFile(null);
    if(preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileError(null);

    if (fileRejections.length > 0) {
      setFileError('File non valido. Assicurati che sia un\'immagine e che non superi i 10MB.');
      return;
    }
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        setPreview(URL.createObjectURL(selectedFile));
      }
      if (paymentId) {
          handleFileAnalysis(selectedFile, paymentId);
      } else {
        setFileError("ID di pagamento non generato. Riprova.");
      }
    }
  }, [preview, paymentId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

const handleConfirm = async () => {
    if (!firestore || !storagePath || !user || !analysisResult || !paymentId) {
        setFileError('Errore: dati mancanti per la conferma.');
        return;
    }
    setIsLoading(true);

    try {
        const fileRef = ref(storage, storagePath);
        const receiptUrl = await getDownloadURL(fileRef);
        
        // Caricamento in Google Drive (Pagamenti)
        if (file) {
            try {
                const formDataDrive = new FormData();
                formDataDrive.append('file', file);
                
                const memberNames = paymentItems.map(item => item.memberName).join('_');
                const driveFileName = `Ricevuta_${paymentId}_${memberNames}`;
                formDataDrive.append('name', driveFileName);
                
                // Fire-and-forget or await? Let's await but not block the whole thing if it fails
                await fetch('/api/drive/upload-pagamento', {
                    method: 'POST',
                    body: formDataDrive
                });
            } catch (driveErr) {
                console.error("Errore salvataggio in Drive:", driveErr);
            }
        }

        const batch = writeBatch(firestore);

        const hasBeenEdited = Object.values(editedFields).some(Boolean);

        const paymentInfo: any = {
            status: 'committed',
            receiptUrl: receiptUrl,
            timestamp: serverTimestamp(),
            analysisData: formData,
            userId: user.uid,
            isVerified: false, 
        };

        if (hasBeenEdited) {
            paymentInfo.originalAnalysisData = analysisResult;
        }
        
        const paymentDocRef = doc(firestore, 'payments', paymentId);
        batch.update(paymentDocRef, paymentInfo);

        const uniqueRaccoltaIds = Array.from(new Set(paymentItems.map(item => item.raccoltaId)));
        
        const currentMembershipYear = getCurrentMembershipYear();

        for (const raccoltaId of uniqueRaccoltaIds) {
            const raccoltaDocRef = doc(firestore, 'raccolte', raccoltaId);

            const itemsForThisRaccolta = paymentItems.filter(item => item.raccoltaId === raccoltaId);
            const tesseramentoMemberIds = itemsForThisRaccolta.filter(item => item.phase === 'Tesseramento').map(item => item.memberId);
            const caparraMemberIds = itemsForThisRaccolta.filter(item => item.phase === 'Caparra').map(item => item.memberId);
            const saldoMemberIds = itemsForThisRaccolta.filter(item => item.phase === 'Saldo').map(item => item.memberId);

            if (tesseramentoMemberIds.length > 0) {
                batch.update(raccoltaDocRef, { tesseratiIds: arrayUnion(...tesseramentoMemberIds) });
                 for (const memberId of tesseramentoMemberIds) {
                    const memberDocRef = await getMemberDocRef(firestore, memberId);
                    if (memberDocRef) {
                        batch.update(memberDocRef, { tesseramento: currentMembershipYear });
                    }
                }
            }
            if (caparraMemberIds.length > 0) {
                batch.update(raccoltaDocRef, { caparraPaidIds: arrayUnion(...caparraMemberIds) });
            }
            if (saldoMemberIds.length > 0) {
                batch.update(raccoltaDocRef, { saldoPaidIds: arrayUnion(...saldoMemberIds) });
            }
            
            const paymentDetailsPayload: { [key: string]: any } = {};
            itemsForThisRaccolta.forEach(item => {
                const phaseKey = item.phase.toLowerCase();
                 paymentDetailsPayload[`paymentDetails.${phaseKey}.${item.memberId}`] = {
                     ...paymentInfo,
                     paymentId: paymentId
                 };
            });
            
            batch.update(raccoltaDocRef, paymentDetailsPayload);
        }

        await batch.commit();
        clearCachedPaymentId();
        onSuccess();
        onOpenChange(false);

    } catch (err: any) {
        console.error("Errore durante la registrazione dei pagamenti:", err);
        setFileError(`Errore during la registrazione dei pagamenti: ${err.message}`);
    } finally {
        setIsLoading(false);
    }
};
  
  const handleFieldChange = (field: keyof AnalysisResult, value: string | number | Date | undefined) => {
    let finalValue: string | number | undefined;

    if (value instanceof Date) {
        finalValue = format(value, 'dd/MM/yyyy');
    } else {
        finalValue = value;
    }
    
    setFormData(prev => ({ ...prev, [field]: finalValue }));
    setEditedFields(prev => ({ ...prev, [field]: true }));
  };

  const handleFixField = (field: keyof AnalysisResult, value: any) => {
    handleFieldChange(field, value);
  };

  const groupedPaymentDetails = useMemo(() => {
    const groups = new Map<string, { beneficiario: string, iban: string }>();
    raccolte.forEach(r => {
        if (!r.beneficiario || !r.iban) return;
        const key = `${r.beneficiario}-${r.iban}`;
        if (!groups.has(key)) {
            groups.set(key, { beneficiario: r.beneficiario, iban: r.iban });
        }
    });
    return Array.from(groups.values());
  }, [raccolte]);

  const renderField = (id: keyof AnalysisResult, label: string, useTextarea: boolean = false) => {
    const fieldKey = id === 'iban_beneficiario' ? 'iban' : id;
    const validation = validationStatus[fieldKey as keyof ValidationStatus];
    const isValid = validation?.isValid ?? true;

    const InputComponent = useTextarea ? Textarea : Input;
    
    return (
     <div className="grid grid-cols-4 items-start gap-4">
        <Label htmlFor={id} className="text-right pt-2">
            {label}
        </Label>
        <div className="col-span-3 relative">
            <InputComponent
                id={id}
                value={formData[id] === null || formData[id] === undefined ? '' : String(formData[id])}
                onChange={(e: any) => handleFieldChange(id, e.target.value)}
                className={cn(
                    "pr-8",
                    { "h-auto resize-none": useTextarea },
                    analysisResult && !isValid && "border-destructive bg-destructive/10"
                )}
                rows={useTextarea ? 3 : undefined}
            />
            {editedFields[id] && <Pencil className="absolute right-2 top-2 h-4 w-4 text-blue-500"/>}
        </div>
    </div>
    );
  };
  
  const renderNumberField = (id: keyof AnalysisResult, label: string) => {
    const validation = validationStatus[id as keyof ValidationStatus];
    const isValid = validation?.isValid ?? true;
    return (
        <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor={id} className="text-right pt-2">{label}</Label>
            <div className="col-span-3 relative">
                <Input
                    id={id}
                    type="number"
                    value={formData[id] === null || formData[id] === undefined ? '' : String(formData[id])}
                    onChange={(e: any) => handleFieldChange(id, parseFloat(e.target.value))}
                     className={cn("pr-8", analysisResult && !isValid && "border-destructive bg-destructive/10")}
                />
                {editedFields[id] && <Pencil className="absolute right-2 top-2 h-4 w-4 text-blue-500"/>}
            </div>
        </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Riepilogo e Caricamento Ricevuta</DialogTitle>
           <DialogDescription>
             Conferma il pagamento per le selezioni effettuate.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 grid md:grid-cols-2 gap-8 overflow-hidden py-1">
            {/* Left Column */}
            <ScrollArea className="h-full pr-4">
                <div className='flex flex-col space-y-6'>
                    <div>
                        <h3 className='font-semibold mb-2'>1. Esegui il Bonifico</h3>
                            <div className='border rounded-lg text-sm bg-secondary/50'>
                                {groupedPaymentDetails.map((detail, index) => (
                                <div key={index} className="p-4 border-b last:border-b-0">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className='text-muted-foreground'>Beneficiario</p>
                                            <p className='font-medium'>{detail.beneficiario}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(detail.beneficiario)}><Copy className='h-4 w-4' /></Button>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <div>
                                            <p className='text-muted-foreground'>IBAN</p>
                                            <p className='font-medium'>{detail.iban}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(detail.iban)}><Copy className='h-4 w-4' /></Button>
                                    </div>
                                </div>
                            ))}
                             <div className="p-4 border-b">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className='text-muted-foreground'>Importo</p>
                                        <p className='font-bold text-base'>€{importoAtteso}</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(importoAtteso)}><Copy className='h-4 w-4' /></Button>
                                </div>
                            </div>
                             <div className="p-4">
                                <div>
                                    <p className='text-muted-foreground'>Causale</p>
                                    {!paymentId || isGeneratingId ? (
                                        <div className='flex items-center gap-2'>
                                            <Loader2 className="h-4 w-4 animate-spin"/>
                                            <p className="font-semibold text-muted-foreground">Generazione ID in corso...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center">
                                                <p className='font-bold text-primary'>{causaleCompleta}</p>
                                                <div className='flex items-center gap-1'>
                                                    {timeLeft !== null && timeLeft > 0 && (
                                                         <span className='text-xs text-muted-foreground font-mono' title='Tempo rimanente'>{formatTimeLeft(timeLeft)}</span>
                                                    )}
                                                     <Button variant="ghost" size="icon" onClick={() => generatePaymentId(true)} disabled={isGeneratingId}>
                                                        <RefreshCw className={cn('h-4 w-4', isGeneratingId && 'animate-spin')}/>
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(causaleCompleta)}>
                                                        <Copy className='h-4 w-4' />
                                                    </Button>
                                                </div>
                                            </div>
                                             {timeLeft !== null && timeLeft <= 0 && (
                                                <p className='text-xs text-destructive mt-1'>Codice scaduto. Rigenerane uno nuovo.</p>
                                            )}
                                        </>
                                    )}
                                    <p className='text-xs text-muted-foreground mt-1'>Inserire questo codice all'inizio della causale. È possibile aggiungere altri dettagli dopo.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                     <div className='pt-6'>
                        <h3 className='font-semibold mb-2'>Riepilogo Voci</h3>
                        <div className='border rounded-lg p-4 space-y-2 text-sm'>
                            {paymentItems.map((item, index) => (
                                <div key={index} className='flex justify-between'>
                                    <span>{item.phase} per {item.memberName} ({item.raccoltaNome})</span>
                                    <span className='font-medium'>€{item.amount}</span>
                                </div>
                            ))}
                            <Separator />
                            <div className='flex justify-between font-bold text-base pt-2'>
                                <span>TOTALE</span>
                                <span>€{importoAtteso}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </ScrollArea>
            
            {/* Right Column */}
            <ScrollArea className='h-full'>
              <div className='flex flex-col space-y-4 pr-4'>
                 <div>
                    <h3 className='font-semibold mb-2'>2. Carica la Ricevuta</h3>
                     {!analysisResult ? (
                      <div {...getRootProps()} className={cn(`flex flex-1 flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors min-h-[200px]`, { 'pointer-events-none opacity-50': !paymentId || isGeneratingId }, isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50')}>
                          <input {...getInputProps()} disabled={!paymentId || isGeneratingId} />
                          {isLoading ? (
                              <div className="flex flex-col items-center justify-center p-4"><Loader2 className="mr-2 h-8 w-8 animate-spin mb-2" /><p className="text-muted-foreground">Analisi in corso...</p></div>
                          ) : file ? (
                              <div className="relative text-center">
                                  {preview ? <Image src={preview} alt="Anteprima" width={200} height={200} className="w-auto h-auto max-h-48 object-contain rounded-md" /> : <div className="flex flex-col items-center justify-center p-8 bg-muted rounded-md"><FileIcon className="w-16 h-16 text-muted-foreground" /><p className="mt-4 text-lg font-medium">{file.name}</p></div>}
                                  <Button variant="ghost" size="icon" className="absolute -top-3 -right-3 rounded-full h-7 w-7 bg-background border shadow-sm" onClick={(e) => { e.stopPropagation(); setFile(null); if(preview) URL.revokeObjectURL(preview); setPreview(null); setFileError(null); setAnalysisResult(null); }}><X className="h-4 w-4" /></Button>
                              </div>
                          ) : (
                              <><UploadCloud className="w-12 h-12 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">{!paymentId || isGeneratingId ? 'Attendere la generazione dell\'ID...' : 'Trascina la ricevuta o clicca'}</p><p className="text-xs text-muted-foreground mt-1">Immagini (JPG, PNG, WEBP), max 10MB.</p></>
                          )}
                          {fileError && <Alert variant="destructive" className="mt-4"><AlertDescription>{fileError}</AlertDescription></Alert>}
                      </div>
                    ) : (
                      <>
                          <div className="relative text-center p-4 border rounded-lg flex-shrink-0">
                              {preview ? <Image src={preview} alt="Anteprima" width={200} height={200} className="w-auto h-auto max-h-32 object-contain rounded-md mx-auto" /> : <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-md"><FileIcon className="w-12 h-12 text-muted-foreground" /><p className="mt-2 text-sm font-medium">{file?.name}</p></div>}
                          </div>
                          
                          <div className='space-y-2'>
                            {analysisResult && !validationStatus.importo.isValid && (
                                <Alert variant='destructive'>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Importo non Corretto</AlertTitle>
                                    <AlertDescription className="flex justify-between items-center">
                                        {validationStatus.importo.message}
                                        <Button variant="outline" size="sm" onClick={() => handleFixField('importo', parseFloat(importoAtteso))}>Correggi</Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                            {analysisResult && !validationStatus.causale.isValid && (
                                <Alert variant='destructive'>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Causale non Corretta</AlertTitle>
                                    <AlertDescription className="flex justify-between items-center">
                                        {validationStatus.causale.message}
                                        <Button variant="outline" size="sm" onClick={() => handleFixField('causale', causaleCompleta)}>Correggi</Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                            {analysisResult && !validationStatus.beneficiario.isValid && (
                                <Alert variant='destructive'>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Beneficiario non Corretto</AlertTitle>
                                    <AlertDescription className="flex justify-between items-center">
                                        {validationStatus.beneficiario.message}
                                        <Button variant="outline" size="sm" onClick={() => handleFixField('beneficiario', expectedBeneficiaries[0] || '')} disabled={expectedBeneficiaries.length === 0}>Correggi</Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                            {analysisResult && !validationStatus.iban.isValid && (
                                <Alert variant='destructive'>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>IBAN non Corretto</AlertTitle>
                                    <AlertDescription className="flex justify-between items-center">
                                        {validationStatus.iban.message}
                                        <Button variant="outline" size="sm" onClick={() => handleFixField('iban_beneficiario', expectedIbans[0] || '')} disabled={expectedIbans.length === 0}>Correggi</Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                          </div>

                          <h4 className="font-medium text-center">3. Verifica i Dati Estratti</h4>
                          <div className="grid gap-4 py-4">
                              {renderNumberField('importo', 'Importo (€)')}
                              {renderField('nome_esecutore', 'Esecutore')}
                              <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="data" className="text-right">
                                      Data
                                  </Label>
                                  <div className="col-span-3 relative">
                                      <DatePicker
                                          date={parseDisplayDate(formData.data)}
                                          setDate={(date) => handleFieldChange('data', date)}
                                      />
                                      {editedFields['data'] && <Pencil className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500"/>}
                                  </div>
                              </div>
                              {renderField('causale', 'Causale', true)}
                              {renderField('beneficiario', 'Beneficiario', true)}
                              {renderField('iban_beneficiario', 'IBAN Beneficiario')}
                          </div>
                      </>
                    )}
                 </div>
              </div>
            </ScrollArea>
        </div>

        <DialogFooter className='gap-2 pt-4 border-t flex-shrink-0'>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isGeneratingId}>Annulla</Button>
          <Button onClick={handleConfirm} disabled={!analysisResult || isLoading || isGeneratingId || !isFormValid}>
            {isLoading && !analysisResult ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analisi in corso...
              </>
            ) : isLoading && analysisResult ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              'Conferma Pagamento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
