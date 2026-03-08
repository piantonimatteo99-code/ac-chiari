'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

export interface Tariffa {
    id: string;
    label: string;
    description: string;
    quotaIntera: number;
    quotaScontata: number;
    gratuita: number;
    order: number;
}

const DEFAULT_TARIFFE: Tariffa[] = [
    { id: 'adulti', label: 'Adulti', description: 'Nati prima del 1996', quotaIntera: 37.00, quotaScontata: 29.60, gratuita: 0, order: 1 },
    { id: 'giovani', label: 'Giovani', description: 'Nati dal 1996 fino al 2007', quotaIntera: 29.00, quotaScontata: 23.20, gratuita: 0, order: 2 },
    { id: 'giovanissimi', label: 'Giovanissimi', description: 'Nati dal 2008 al 2011', quotaIntera: 20.00, quotaScontata: 16.00, gratuita: 0, order: 3 },
    { id: 'acr', label: 'ACR', description: 'Nati dopo il 2011', quotaIntera: 16.00, quotaScontata: 12.80, gratuita: 0, order: 4 },
];

export default function TariffePage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const tariffeQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'tariffe-tesseramento');
    }, [firestore]);

    const { data: tariffeData, isLoading } = useCollection<Tariffa>(tariffeQuery);
    const [localTariffe, setLocalTariffe] = useState<any[]>([]);

    // Initialize collection if it's empty
    useEffect(() => {
        if (!isLoading && firestore && tariffeData?.length === 0) {
            const batch = writeBatch(firestore);
            DEFAULT_TARIFFE.forEach(tariffa => {
                const docRef = doc(firestore, 'tariffe-tesseramento', tariffa.id);
                batch.set(docRef, tariffa);
            });
            batch.commit().catch(console.error);
        }
    }, [isLoading, tariffeData, firestore]);

    // Update local state when Firestore data loads or changes
    useEffect(() => {
        if (tariffeData) {
            const sortedData = [...tariffeData].sort((a, b) => a.order - b.order);
            setLocalTariffe(sortedData.map(t => ({
                ...t,
                quotaIntera: (t.quotaIntera || 0).toFixed(2),
                quotaScontata: (t.quotaScontata || 0).toFixed(2),
                gratuita: (t.gratuita || 0).toFixed(2),
            })));
        }
    }, [tariffeData]);

    const handleFieldChange = (id: string, field: keyof Tariffa, value: string) => {
        setLocalTariffe(prev =>
            prev.map(t => {
                if (t.id === id) {
                    return { ...t, [field]: value };
                }
                return t;
            })
        );
    };
    
    const handleAmountBlur = (e: React.FocusEvent<HTMLInputElement>, id: string, field: 'quotaIntera' | 'quotaScontata' | 'gratuita') => {
        const value = parseFloat(e.target.value.replace(',', '.'));
        handleFieldChange(id, field, !isNaN(value) ? value.toFixed(2) : '0.00');
    };

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        const batch = writeBatch(firestore);
        localTariffe.forEach(tariffa => {
            const docRef = doc(firestore, 'tariffe-tesseramento', tariffa.id);
            const { id, ...dataToSave } = tariffa;
            batch.update(docRef, {
                ...dataToSave,
                quotaIntera: parseFloat(String(dataToSave.quotaIntera).replace(',', '.')) || 0,
                quotaScontata: parseFloat(String(dataToSave.quotaScontata).replace(',', '.')) || 0,
                gratuita: parseFloat(String(dataToSave.gratuita).replace(',', '.')) || 0,
            });
        });

        try {
            await batch.commit();
            toast({
                title: "Salvataggio completato",
                description: "Le tariffe sono state aggiornate con successo.",
            });
        } catch (error) {
            console.error("Error saving tariffs:", error);
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Si è verificato un errore durante il salvataggio delle tariffe.",
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                <CardTitle>Quote di Iscrizione</CardTitle>
                <CardDescription>
                    Tabelle riassuntive delle quote per il tesseramento. Modifica gli importi e salva le modifiche.
                </CardDescription>
                </CardHeader>
                <CardContent>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead className="w-[120px]">Settore</TableHead>
                        <TableHead>Descrizione Età</TableHead>
                        <TableHead className="text-center">Quota intera</TableHead>
                        <TableHead className="text-center">Quota scontata (20%)</TableHead>
                        <TableHead className="text-center">Gratuità</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">Caricamento tariffe...</TableCell>
                        </TableRow>
                    ) : localTariffe.map(tariffa => (
                        <TableRow key={tariffa.id}>
                            <TableCell className="font-medium">{tariffa.label}</TableCell>
                            <TableCell>
                                {tariffa.id === 'adulti' && (
                                    <div className="flex items-center gap-2">
                                        <span>Nati prima del</span>
                                        <Input
                                            type="number"
                                            value={tariffa.description.match(/\d{4}/)?.[0] || ''}
                                            onChange={(e) => handleFieldChange(tariffa.id, 'description', `Nati prima del ${e.target.value}`)}
                                            className="w-20"
                                        />
                                    </div>
                                )}
                                {tariffa.id === 'giovani' && (
                                    <div className="flex items-center gap-2">
                                        <span>Nati dal</span>
                                        <Input
                                            type="number"
                                            value={tariffa.description.match(/\d{4}/g)?.[0] || ''}
                                            onChange={(e) => {
                                                const years = tariffa.description.match(/\d{4}/g) || ['',''];
                                                handleFieldChange(tariffa.id, 'description', `Nati dal ${e.target.value} fino al ${years[1]}`)
                                            }}
                                            className="w-20"
                                        />
                                        <span>fino al</span>
                                        <Input
                                            type="number"
                                            value={tariffa.description.match(/\d{4}/g)?.[1] || ''}
                                            onChange={(e) => {
                                                const years = tariffa.description.match(/\d{4}/g) || ['',''];
                                                handleFieldChange(tariffa.id, 'description', `Nati dal ${years[0]} fino al ${e.target.value}`)
                                            }}
                                            className="w-20"
                                        />
                                    </div>
                                )}
                                {tariffa.id === 'giovanissimi' && (
                                    <div className="flex items-center gap-2">
                                        <span>Nati dal</span>
                                        <Input
                                            type="number"
                                            value={tariffa.description.match(/\d{4}/g)?.[0] || ''}
                                            onChange={(e) => {
                                                const years = tariffa.description.match(/\d{4}/g) || ['',''];
                                                handleFieldChange(tariffa.id, 'description', `Nati dal ${e.target.value} al ${years[1]}`)
                                            }}
                                            className="w-20"
                                        />
                                        <span>al</span>
                                        <Input
                                            type="number"
                                            value={tariffa.description.match(/\d{4}/g)?.[1] || ''}
                                            onChange={(e) => {
                                                const years = tariffa.description.match(/\d{4}/g) || ['',''];
                                                handleFieldChange(tariffa.id, 'description', `Nati dal ${years[0]} al ${e.target.value}`)
                                            }}
                                            className="w-20"
                                        />
                                    </div>
                                )}
                                {tariffa.id === 'acr' && (
                                    <div className="flex items-center gap-2">
                                        <span>Nati dopo il</span>
                                        <Input
                                            type="number"
                                            value={tariffa.description.match(/\d{4}/)?.[0] || ''}
                                            onChange={(e) => handleFieldChange(tariffa.id, 'description', `Nati dopo il ${e.target.value}`)}
                                            className="w-20"
                                        />
                                    </div>
                                )}
                                {!['adulti', 'giovani', 'giovanissimi', 'acr'].includes(tariffa.id) && (
                                    <Input 
                                        type="text" 
                                        value={tariffa.description} 
                                        onChange={(e) => handleFieldChange(tariffa.id, 'description', e.target.value)}
                                        className="w-full"
                                    />
                                )}
                            </TableCell>
                            <TableCell>
                                <div className='flex items-center justify-center gap-1'>
                                    <span>€</span>
                                    <Input 
                                        type="text" 
                                        value={tariffa.quotaIntera} 
                                        onChange={(e) => handleFieldChange(tariffa.id, 'quotaIntera', e.target.value)}
                                        onBlur={(e) => handleAmountBlur(e, tariffa.id, 'quotaIntera')}
                                        className="w-20 text-center"
                                    />
                                </div>
                            </TableCell>
                            <TableCell>
                                 <div className='flex items-center justify-center gap-1'>
                                    <span>€</span>
                                    <Input 
                                        type="text" 
                                        value={tariffa.quotaScontata} 
                                        onChange={(e) => handleFieldChange(tariffa.id, 'quotaScontata', e.target.value)}
                                        onBlur={(e) => handleAmountBlur(e, tariffa.id, 'quotaScontata')}
                                        className="w-20 text-center"
                                    />
                                 </div>
                            </TableCell>
                            <TableCell>
                               <div className='flex items-center justify-center gap-1'>
                                    <span>€</span>
                                    <Input 
                                        type="text" 
                                        value={tariffa.gratuita} 
                                        onChange={(e) => handleFieldChange(tariffa.id, 'gratuita', e.target.value)}
                                        onBlur={(e) => handleAmountBlur(e, tariffa.id, 'gratuita')}
                                        className="w-20 text-center"
                                    />
                                 </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSaving ? 'Salvataggio...' : 'Salva Modifiche'}
                </Button>
            </div>

            <Card>
                <CardHeader>
                <CardTitle>Note e Condizioni</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                    <span className="font-semibold text-foreground">*</span> Lo sconto è applicato a tutti i membri del nucleo famigliare (anche al primo).
                </p>
                <p>
                    <span className="font-semibold text-foreground">**</span> La gratuità (per i nuclei famigliari con un numero di tesserati superiore ai 3) è applicata a partire dal 4° componente. L'ordine da considerare per i componenti è in base all'età e quindi la gratuità è applicata ai più giovani. Mentre per il 1°, 2° e 3° membro è applicata la "Quota scontata" indicata.
                </p>
                </CardContent>
            </Card>
        </div>
    );
}
