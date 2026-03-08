'use client';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { AlertCircle, Loader2, Pencil } from 'lucide-react';
import Image from 'next/image';
import { useFirestore } from '@/src/firebase';
import type { FlatPayment } from '@/app/(app)/contabilita/transazioni-da-controllare/page';
import { format, parse, isValid, parseISO } from 'date-fns';
import { Separator } from './ui/separator';
import Link from 'next/link';

export type AnalysisResult = {
  importo?: number | null;
  nome_esecutore?: string | null;
  data?: string | null;
  beneficiario?: string | null;
  iban_beneficiario?: string | null;
  causale?: string | null;
};

interface EditTransactionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  payment: FlatPayment;
  onSave: (payment: FlatPayment, newFormData: AnalysisResult) => void;
}

const formatDateForDisplay = (dateString?: string | null): string => {
    if (!dateString) return '';
    try {
        const date = parseISO(dateString);
        if (isValid(date)) return format(date, 'dd/MM/yyyy');
        return dateString;
    } catch (e) {
        return dateString;
    }
};

const parseDisplayDate = (dateString?: string | null): Date | undefined => {
    if (!dateString) return undefined;
    let date = parse(dateString, 'dd/MM/yyyy', new Date());
    if (isValid(date)) return date;
    date = parseISO(dateString);
    if (isValid(date)) return date;
    return undefined;
};

export function EditTransactionDialog({ isOpen, onOpenChange, payment, onSave }: EditTransactionDialogProps) {
  const [formData, setFormData] = useState<AnalysisResult>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { originalAnalysisData } = payment.paymentDetails;

  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...payment.paymentDetails.analysisData,
        data: formatDateForDisplay(payment.paymentDetails.analysisData.data),
      });
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen, payment]);

  const handleFieldChange = (field: keyof AnalysisResult, value: string | number | Date | undefined) => {
    let finalValue: string | number | undefined;
    if (value instanceof Date) {
      finalValue = format(value, 'dd/MM/yyyy');
    } else {
      finalValue = value;
    }
    setFormData(prev => ({ ...prev, [field]: finalValue }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
        await onSave(payment, formData);
        onOpenChange(false);
    } catch (err: any) {
        console.error('Error saving transaction:', err);
        setError(`Si è verificato un errore: ${err.message}`);
    } finally {
        setIsSaving(false);
    }
  };
  
    const renderOriginalValue = (field: keyof AnalysisResult, label: string) => (
    <div className='space-y-1'>
        <p className='text-xs text-muted-foreground font-medium'>{label}</p>
        <p className="text-sm text-muted-foreground whitespace-normal break-words h-auto">
            {originalAnalysisData?.[field] ? String(originalAnalysisData[field]) : <i className='text-muted-foreground'>Non rilevato</i>}
        </p>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Modifica Dati Transazione</DialogTitle>
          <DialogDescription>
            Visualizza i dati originali e modifica i campi necessari per questa transazione.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid md:grid-cols-2 gap-8 overflow-hidden py-4">
            <div className='flex flex-col space-y-4'>
                <h4 className='font-semibold'>Ricevuta</h4>
                <Link href={payment.paymentDetails.receiptUrl} target="_blank" rel="noopener noreferrer">
                  <div className="relative w-full h-full min-h-[300px] border rounded-lg bg-muted/30 overflow-hidden cursor-pointer">
                      <Image
                          src={payment.paymentDetails.receiptUrl}
                          alt="Ricevuta"
                          fill
                          className="object-contain"
                      />
                  </div>
                </Link>
            </div>

            <div className='flex flex-col space-y-4 overflow-y-auto pr-4'>
                <h4 className='font-semibold'>Dati Estratti</h4>
                <div className='grid grid-cols-1 gap-6'>
                    
                    <div>
                        {renderOriginalValue('importo', 'Importo Originale')}
                        <div className='mt-2'>
                             <Label htmlFor="importo">Importo Modificato (€)</Label>
                            <Input
                                id="importo"
                                type="number"
                                value={formData.importo ?? ''}
                                onChange={(e) => handleFieldChange('importo', parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                    
                     <Separator />

                    <div>
                        {renderOriginalValue('data', 'Data Originale')}
                        <div className='mt-2'>
                             <Label htmlFor="data">Data Modificata</Label>
                            <DatePicker
                                date={parseDisplayDate(formData.data)}
                                setDate={(date) => handleFieldChange('data', date)}
                            />
                        </div>
                    </div>

                    <Separator />
                    
                    <div>
                        {renderOriginalValue('causale', 'Causale Originale')}
                        <div className='mt-2'>
                             <Label htmlFor="causale">Causale Modificata</Label>
                            <Textarea
                                id="causale"
                                value={formData.causale ?? ''}
                                onChange={(e) => handleFieldChange('causale', e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    
                    <Separator />

                    <div>
                        {renderOriginalValue('beneficiario', 'Beneficiario Originale')}
                         <div className='mt-2'>
                            <Label htmlFor="beneficiario">Beneficiario Modificato</Label>
                            <Input
                                id="beneficiario"
                                value={formData.beneficiario ?? ''}
                                onChange={(e) => handleFieldChange('beneficiario', e.target.value)}
                            />
                         </div>
                    </div>
                    
                    <Separator />
                    
                     <div>
                        {renderOriginalValue('iban_beneficiario', 'IBAN Originale')}
                        <div className='mt-2'>
                           <Label htmlFor="iban_beneficiario">IBAN Modificato</Label>
                            <Input
                                id="iban_beneficiario"
                                value={formData.iban_beneficiario ?? ''}
                                onChange={(e) => handleFieldChange('iban_beneficiario', e.target.value)}
                            />
                        </div>
                    </div>

                </div>
            </div>

        </div>

        {error && (
            <div className='text-sm text-destructive flex items-center gap-2'>
                <AlertCircle className="h-4 w-4" /> {error}
            </div>
        )}

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Annulla</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Salvataggio...' : 'Salva Modifiche'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
